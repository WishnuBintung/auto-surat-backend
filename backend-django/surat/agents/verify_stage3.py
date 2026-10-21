import json
import os
import sys
import time
from pathlib import Path
from typing import Any, List
from unittest.mock import patch

# Pastikan direktori backend-django berada di sys.path
BASE_DIR = Path(__file__).resolve().parent.parent.parent
if str(BASE_DIR) not in sys.path:
    sys.path.insert(0, str(BASE_DIR))

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "core.settings")

import django

django.setup()

from django.conf import settings
from drf_spectacular.generators import SchemaGenerator
from rest_framework.test import APIRequestFactory, force_authenticate

from accounts.models import Department, Faculty, Student, User
from surat.agents.letter_agent import (
    SuratAgentRateLimitError,
    SuratAgentTimeoutError,
    SuratDraftingAgent,
)
from surat.models import SuratAuditLog, SuratRequest, SuratStatus, SuratType, TteSignature
from surat.views import SuratRequestCreateAPIView


class _MockLLMResponse:
    def __init__(self, payload: dict) -> None:
        self.text = json.dumps(payload)
        self.parsed = None


class _MockModelsNamespace:
    def __init__(self, queued_responses: List[Any], delay_seconds: float = 0.05) -> None:
        self.queued_responses = list(queued_responses)
        self.delay_seconds = delay_seconds
        self.call_history: List[dict] = []

    def generate_content(self, model: str, contents: str, config: Any) -> Any:
        if self.delay_seconds > 0:
            time.sleep(self.delay_seconds)
        self.call_history.append({"model": model, "contents": contents, "config": config})
        if not self.queued_responses:
            raise RuntimeError("Antrean respons simulasi habis.")
        next_item = self.queued_responses.pop(0)
        if isinstance(next_item, BaseException):
            raise next_item
        return _MockLLMResponse(next_item)


class _MockGenAIClient:
    def __init__(self, queued_responses: List[Any], delay_seconds: float = 0.05) -> None:
        self.models = _MockModelsNamespace(queued_responses, delay_seconds=delay_seconds)


class _SimulatedRateLimitError(Exception):
    def __init__(self, message: str) -> None:
        super().__init__(message)
        self.code = 429


def _ensure_test_master_data():
    faculty, _ = Faculty.objects.get_or_create(
        id="FAK-TEST-STAGE3",
        defaults={"nama_fakultas": "Fakultas Ilmu Komputer"},
    )
    dept, _ = Department.objects.get_or_create(
        id="DEP-TEST-STAGE3",
        defaults={"fakultas": faculty, "nama_prodi": "Teknik Informatika"},
    )
    user, _ = User.objects.get_or_create(
        id="USR-MHS-STAGE3",
        defaults={
            "nama": "Mahasiswa Uji Tahap 3",
            "password": "hashed_password",
            "nip_nim": "2023990001",
            "role": "STUDENT",
        },
    )
    user.is_authenticated = True
    student, _ = Student.objects.get_or_create(
        nim="2023990001",
        defaults={
            "user": user,
            "fakultas": faculty,
            "prodi": dept,
            "semester_aktif": 6,
            "tahun_akademik": "2026/2027",
            "status_akademik": "AKTIF",
            "tahun_masuk": 2023,
            "status_pembayaran_ukt": "LUNAS",
            "total_sks": 110,
            "total_sks_lulus": 110,
            "ipk_kumulatif": 3.75,
            "catatan_pelanggaran_etik": False,
            "status_disiplin_kampus": True,
        },
    )
    surat_type, _ = SuratType.objects.get_or_create(
        kode_surat="SP-MAG",
        defaults={
            "nama_surat": "Surat Pengantar Magang",
            "kategori": "Akademik",
            "is_auto_approval": True,
            "template_path": "surat/magang.html",
            "required_payload_fields": [
                {"field": "instansi_tujuan", "type": "string"},
                {"field": "tujuan_keperluan", "type": "string"},
                {"field": "posisi_dilamar", "type": "string"},
                {"field": "tanggal_mulai", "type": "date"},
                {"field": "tanggal_selesai", "type": "date"},
            ],
        },
    )
    return user, student, surat_type, dept, faculty


def _cleanup_test_records(created_ids: List[int]) -> None:
    if created_ids:
        SuratRequest.objects.filter(id__in=created_ids).delete()
    Student.objects.filter(nim="2023990001").delete()
    User.objects.filter(id="USR-MHS-STAGE3").delete()
    Department.objects.filter(id="DEP-TEST-STAGE3").delete()
    Faculty.objects.filter(id="FAK-TEST-STAGE3").delete()


def run_stage3_verification() -> None:
    if "testserver" not in settings.ALLOWED_HOSTS:
        settings.ALLOWED_HOSTS.append("testserver")

    created_request_ids: List[int] = []
    try:
        print("[1/6] Memeriksa skema OpenAPI (@extend_schema / Swagger) pada seluruh endpoint...")
        generator = SchemaGenerator()
        schema = generator.get_schema(request=None, public=True)
        paths = schema.get("paths", {})
        if "/surat/request/" not in paths:
            print("GAGAL: Endpoint /surat/request/ tidak terdaftar pada skema OpenAPI.")
            sys.exit(1)
        post_spec = paths["/surat/request/"].get("post", {})
        responses_spec = post_spec.get("responses", {})
        if "202" not in responses_spec and "201" not in responses_spec:
            print("GAGAL: Dokumentasi response 201/202 pada /surat/request/ tidak ditemukan.")
            sys.exit(1)
        print("BERHASIL: Dokumentasi OpenAPI (@extend_schema) tetap utuh dan tervalidasi.")

        print("[2/6] Menyiapkan data uji dan menguji eksekusi asinkron POST /api/surat/request/...")
        user, student, surat_type, _, _ = _ensure_test_master_data()
        factory = APIRequestFactory()

        mock_client_success = _MockGenAIClient(
            [
                {
                    "extracted_payload": {
                        "instansi_tujuan": "PT Telekomunikasi Indonesia (Persero) Tbk",
                        "tujuan_keperluan": "Permohonan Kerja Praktik Mahasiswa",
                        "posisi_dilamar": "Backend Engineer Intern",
                        "tanggal_mulai": "2026-11-01",
                        "tanggal_selesai": "2027-01-31",
                    },
                    "ai_original_draft": (
                        "Yth. Pimpinan Divisi Human Capital PT Telekomunikasi Indonesia (Persero) Tbk "
                        "di Tempat. Dengan hormat, kami mengajukan permohonan kerja praktik mahasiswa "
                        "atas nama Mahasiswa Uji Tahap 3 (NIM 2023990001) pada posisi Backend Engineer Intern."
                    ),
                    "evaluation": {
                        "self_critique_score": 9,
                        "revision_notes": ["Draf sudah memenuhi standar administrasi akademik."],
                    },
                }
            ],
            delay_seconds=0.15,
        )

        # Pasang trap pada TTE, PDF/Cloudinary, dan penomoran untuk menjamin State Pausing
        with (
            patch("surat.services.tte_service.create_tte_signature") as mock_tte,
            patch("surat.services.pdf_service.render_and_upload_pdf") as mock_pdf,
            patch("cloudinary.uploader.upload") as mock_cloudinary,
        ):
            SuratRequestCreateAPIView.agent_instance = SuratDraftingAgent(client=mock_client_success)

            request = factory.post(
                "/api/surat/request/",
                data={
                    "kode_surat": surat_type.kode_surat,
                    "user_prompt_context": (
                        "Saya ingin magang di PT Telkom Indonesia sebagai Backend Engineer Intern "
                        "mulai 1 November 2026 sampai 31 Januari 2027."
                    ),
                },
                format="json",
            )
            force_authenticate(request, user=user)

            start_ts = time.perf_counter()
            view = SuratRequestCreateAPIView.as_view()
            response = view(request)
            elapsed_http = time.perf_counter() - start_ts

            assert response.status_code in (201, 202), f"Status HTTP tidak sesuai: {response.status_code}"
            req_id = response.data.get("request_id") or response.data.get("data", {}).get("request_id")
            assert req_id is not None, "ID transaksi (request_id) tidak dikembalikan pada response."
            created_request_ids.append(req_id)

            # Pastikan status awal saat HTTP kembali adalah SUBMITTED (karena worker memiliki delay 0.15s)
            initial_status_in_resp = response.data.get("surat_status") or response.data.get("data", {}).get("status")
            assert initial_status_in_resp == SuratStatus.SUBMITTED, (
                f"Status awal harus SUBMITTED, ditemukan: {initial_status_in_resp}"
            )
            print(
                f"BERHASIL: Endpoint langsung merespons HTTP {response.status_code} dalam "
                f"{elapsed_http * 1000:.1f} ms dengan request_id={req_id} dan status awal={initial_status_in_resp}."
            )

            print("[3/6] Menunggu background thread selesai dan memverifikasi hasil penyimpanan...")
            worker = SuratRequestCreateAPIView._last_worker_thread
            assert worker is not None, "Background thread tidak terinisiasi."
            worker.join(timeout=5.0)
            assert not worker.is_alive(), "Background thread menggantung melampaui batas waktu."

            surat_req = SuratRequest.objects.get(pk=req_id)
            assert surat_req.status == SuratStatus.PENDING_APPROVAL, (
                f"Status akhir harus PENDING_APPROVAL, ditemukan: {surat_req.status}"
            )
            assert surat_req.payload_data["instansi_tujuan"] == "PT Telekomunikasi Indonesia (Persero) Tbk"
            assert surat_req.payload_data["posisi_dilamar"] == "Backend Engineer Intern"
            assert surat_req.payload_data["tanggal_mulai"] == "2026-11-01"
            assert surat_req.payload_data["tanggal_selesai"] == "2027-01-31"
            assert surat_req.self_critique_score == 9
            assert "PT Telekomunikasi Indonesia" in (surat_req.ai_original_draft or "")
            print("BERHASIL: Background worker menyimpan payload_data, ai_original_draft, dan mengubah status ke PENDING_APPROVAL.")

            print("[4/6] Memverifikasi kepatuhan mutlak terhadap prinsip State Pausing...")
            assert surat_req.nomor_surat_resmi is None, "PELANGGARAN: nomor_surat_resmi sudah terisi pada Fase 1!"
            assert surat_req.file_pdf_url is None, "PELANGGARAN: file_pdf_url sudah terisi pada Fase 1!"
            assert surat_req.qr_verification_code is None, "PELANGGARAN: qr_verification_code sudah terisi pada Fase 1!"
            assert not TteSignature.objects.filter(surat_request=surat_req).exists(), (
                "PELANGGARAN: Record TteSignature dibuat sebelum approval!"
            )
            mock_tte.assert_not_called()
            mock_pdf.assert_not_called()
            mock_cloudinary.assert_not_called()
            print("BERHASIL: State Pausing terjaga ketat (0 panggilan TTE, QR Code, PDF, maupun Cloudinary).")

        print("[5/6] Menguji penanganan error (Timeout & RateLimit) di dalam background thread -> status FAILED...")
        for label, simulated_exc in [
            ("Timeout", TimeoutError("Request timed out after 30s")),
            ("RateLimit", _SimulatedRateLimitError("429 RESOURCE_EXHAUSTED")),
        ]:
            SuratRequestCreateAPIView.agent_instance = SuratDraftingAgent(
                client=_MockGenAIClient([simulated_exc], delay_seconds=0.01)
            )
            err_req = factory.post(
                "/api/surat/request/",
                data={
                    "kode_surat": surat_type.kode_surat,
                    "konteks": f"Uji skenario gagal {label} pada background worker.",
                },
                format="json",
            )
            force_authenticate(err_req, user=user)
            err_resp = SuratRequestCreateAPIView.as_view()(err_req)
            assert err_resp.status_code in (201, 202)
            err_req_id = err_resp.data["request_id"]
            created_request_ids.append(err_req_id)

            err_worker = SuratRequestCreateAPIView._last_worker_thread
            assert err_worker is not None
            err_worker.join(timeout=5.0)

            failed_record = SuratRequest.objects.get(pk=err_req_id)
            assert failed_record.status == SuratStatus.FAILED, (
                f"Status surat saat terjadi {label} harus FAILED, ditemukan: {failed_record.status}"
            )
            assert SuratAuditLog.objects.filter(
                surat_request=failed_record, action_id="AI_ERR_LIMIT"
            ).exists(), f"Audit log kegagalan {label} tidak tercatat."

        SuratRequestCreateAPIView.agent_instance = None
        print("BERHASIL: Error Timeout dan RateLimit tertangani di dalam thread dan mengubah status surat menjadi FAILED.")

        print("[6/6] Memeriksa kepatuhan larangan emoji pada seluruh berkas yang dimodifikasi...")
        checked_files = [
            BASE_DIR / "surat" / "views.py",
            BASE_DIR / "surat" / "serializers.py",
            BASE_DIR / "surat" / "models.py",
            BASE_DIR / "surat" / "agents" / "letter_agent.py",
            BASE_DIR / "surat" / "agents" / "verify_stage3.py",
        ]
        for file_path in checked_files:
            content = file_path.read_text(encoding="utf-8")
            non_ascii_chars = [ch for ch in content if ord(ch) > 127]
            if non_ascii_chars:
                print(f"GAGAL: Ditemukan karakter non-ASCII/emoji pada {file_path.name}: {non_ascii_chars}")
                sys.exit(1)
        print("BERHASIL: Seluruh kode dan komentar 100% bersih dari karakter emoji.")

        print("\nKESIMPULAN: TAHAP 3 LULUS VERIFIKASI TEKNIS SECARA MUTLAK.")
    finally:
        SuratRequestCreateAPIView.agent_instance = None
        _cleanup_test_records(created_request_ids)


if __name__ == "__main__":
    run_stage3_verification()
