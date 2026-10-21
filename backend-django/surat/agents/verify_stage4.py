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

from accounts.models import Department, Faculty, Lecturer, Student, User
from surat.agents.execution_tools import (
    ExecutionPipelineResult,
    PdfRenderUploadError,
    SuratExecutionTools,
    execute_post_approval_tools,
)
from surat.agents.letter_agent import SuratDraftingAgent
from surat.agents.memory_agent import (
    AgenticMemoryAgent,
    MemoryDiffEvaluationSchema,
    compare_and_store_memory,
)
from surat.models import (
    AgentFeedbackMemory,
    ApprovalStatus,
    SuratApproval,
    SuratAuditLog,
    SuratRequest,
    SuratStatus,
    SuratType,
    TteSignature,
)
from surat.views import LecturerApprovalActionAPIView, SuratRequestDetailAPIView


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


def _ensure_stage4_master_data():
    faculty, _ = Faculty.objects.get_or_create(
        id="FAK-TEST-STAGE4",
        defaults={"nama_fakultas": "Fakultas Ilmu Komputer"},
    )
    dept, _ = Department.objects.get_or_create(
        id="DEP-TEST-STAGE4",
        defaults={"fakultas": faculty, "nama_prodi": "Teknik Informatika"},
    )
    student_user, _ = User.objects.get_or_create(
        id="USR-MHS-STAGE4",
        defaults={
            "nama": "Mahasiswa Uji Tahap 4",
            "password": "hashed_password",
            "nip_nim": "2023880001",
            "role": "STUDENT",
        },
    )
    student_user.is_authenticated = True
    student, _ = Student.objects.get_or_create(
        nim="2023880001",
        defaults={
            "user": student_user,
            "fakultas": faculty,
            "prodi": dept,
            "semester_aktif": 6,
            "tahun_akademik": "2026/2027",
            "status_akademik": "AKTIF",
            "tahun_masuk": 2023,
            "status_pembayaran_ukt": "LUNAS",
            "total_sks": 110,
            "total_sks_lulus": 110,
            "ipk_kumulatif": 3.85,
            "catatan_pelanggaran_etik": False,
            "status_disiplin_kampus": True,
        },
    )

    lecturer_user, _ = User.objects.get_or_create(
        id="USR-DSN-STAGE4",
        defaults={
            "nama": "Prof. Dr. Pejabat Penguji, M.Kom.",
            "password": "hashed_password",
            "nip_nim": "198001012005011001",
            "role": "LECTURER",
        },
    )
    lecturer_user.is_authenticated = True
    lecturer, _ = Lecturer.objects.get_or_create(
        id="LEC-TEST-STAGE4",
        defaults={
            "user": lecturer_user,
            "fakultas": faculty,
            "prodi": dept,
            "jabatan_struktural": ["DEKAN"],
        },
    )

    surat_type, _ = SuratType.objects.get_or_create(
        kode_surat="SP-MAG-S4",
        defaults={
            "nama_surat": "Surat Pengantar Magang Tahap 4",
            "kategori": "Akademik",
            "is_auto_approval": False,
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
    return student_user, student, lecturer_user, lecturer, surat_type


def _cleanup_stage4_records(created_ids: List[int]) -> None:
    if created_ids:
        SuratRequest.objects.filter(id__in=created_ids).delete()
    AgentFeedbackMemory.objects.filter(kode_surat_id="SP-MAG-S4").delete()
    SuratType.objects.filter(kode_surat="SP-MAG-S4").delete()
    Student.objects.filter(nim="2023880001").delete()
    Lecturer.objects.filter(id="LEC-TEST-STAGE4").delete()
    User.objects.filter(id__in=["USR-MHS-STAGE4", "USR-DSN-STAGE4"]).delete()
    Department.objects.filter(id="DEP-TEST-STAGE4").delete()
    Faculty.objects.filter(id="FAK-TEST-STAGE4").delete()


def run_stage4_verification() -> None:
    if "testserver" not in settings.ALLOWED_HOSTS:
        settings.ALLOWED_HOSTS.append("testserver")

    created_request_ids: List[int] = []
    try:
        print("[1/6] Memverifikasi skema OpenAPI (@extend_schema) pada LecturerApprovalActionAPIView...")
        generator = SchemaGenerator()
        schema = generator.get_schema(request=None, public=True)
        paths = schema.get("paths", {})
        approval_path = "/surat/approval/{approval_id}/action/"
        if approval_path not in paths:
            print(f"GAGAL: Endpoint {approval_path} tidak ditemukan pada skema OpenAPI.")
            sys.exit(1)
        print("BERHASIL: Kontrak OpenAPI LecturerApprovalActionAPIView tervalidasi.")

        print("[2/6] Menguji AgenticMemoryAgent (diffing gemini-3.8-flash & penyimpanan AgentFeedbackMemory)...")
        student_user, student, lecturer_user, lecturer, surat_type = _ensure_stage4_master_data()

        # Uji 2a: Jika draf identik, tidak memanggil LLM dan tidak menyimpan rule
        mock_identical_client = _MockGenAIClient([])
        mem_agent_identical = AgenticMemoryAgent(client=mock_identical_client)
        eval_identical = mem_agent_identical.compare_drafts(
            ai_original_draft="Yth. Kepala HRD PT Telkom Indonesia di Tempat. Dengan hormat,",
            final_approved_content="Yth. Kepala HRD PT Telkom Indonesia di Tempat. Dengan hormat,",
            kode_surat=surat_type.kode_surat,
        )
        assert not eval_identical.is_significant
        assert len(mock_identical_client.models.call_history) == 0

        # Uji 2b: Jika terdapat perbedaan signifikan, panggil gemini-3.8-flash dan ekstrak aturan
        mock_diff_client = _MockGenAIClient(
            [
                {
                    "is_significant": True,
                    "diff_summary": (
                        "Pejabat mengubah sapaan 'Yth. Kepala HRD' menjadi "
                        "'Yth. Direktur Human Capital & Strategy' serta menambahkan klausul "
                        "kerahasiaan data perusahaan."
                    ),
                    "extracted_rule": (
                        "Gunakan sapaan resmi 'Yth. Direktur Human Capital & Strategy' untuk "
                        "BUMN telekomunikasi dan sertakan klausul komitmen kerahasiaan data."
                    ),
                    "style_guidelines": [
                        "Gunakan sapaan resmi 'Yth. Direktur Human Capital & Strategy' untuk BUMN telekomunikasi.",
                        "Sertakan klausul komitmen mahasiswa dalam menjaga kerahasiaan data instansi.",
                    ],
                }
            ]
        )
        mem_agent_diff = AgenticMemoryAgent(client=mock_diff_client)
        assert mem_agent_diff.model_name == "gemini-3.8-flash"

        eval_diff = mem_agent_diff.compare_drafts(
            ai_original_draft="Yth. Kepala HRD PT Telkom Indonesia di Tempat.",
            final_approved_content="Yth. Direktur Human Capital & Strategy PT Telkom Indonesia di Tempat.",
            kode_surat=surat_type.kode_surat,
        )
        assert isinstance(eval_diff, MemoryDiffEvaluationSchema)
        assert eval_diff.is_significant is True
        assert len(mock_diff_client.models.call_history) == 1
        assert mock_diff_client.models.call_history[0]["model"] == "gemini-3.8-flash"
        print("BERHASIL: AgenticMemoryAgent membandingkan diff secara akurat menggunakan gemini-3.8-flash.")

        print("[3/6] Menguji LecturerApprovalActionAPIView (APPROVE asinkron + execution_tools + memory_agent)...")
        surat_req = SuratRequest.objects.create(
            student=student,
            kode_surat=surat_type,
            status=SuratStatus.PENDING_APPROVAL,
            payload_data={
                "instansi_tujuan": "PT Telekomunikasi Indonesia (Persero) Tbk",
                "tujuan_keperluan": "Permohonan Kerja Praktik Mahasiswa",
                "posisi_dilamar": "AI Engineer Intern",
                "tanggal_mulai": "2026-11-01",
                "tanggal_selesai": "2027-01-31",
            },
            user_prompt_context="Permohonan magang AI Engineer di Telkom.",
            ai_original_draft=(
                "Yth. Kepala HRD PT Telekomunikasi Indonesia (Persero) Tbk di Tempat. "
                "Dengan hormat, bersama surat ini kami mengajukan permohonan magang."
            ),
            self_critique_score=9,
        )
        created_request_ids.append(surat_req.id)

        approval_step = SuratApproval.objects.create(
            surat_request=surat_req,
            step_order=1,
            approver=lecturer,
            status=ApprovalStatus.PENDING,
        )

        edited_final_content = (
            "Yth. Direktur Human Capital & Strategy PT Telekomunikasi Indonesia (Persero) Tbk di Tempat. "
            "Dengan hormat, sehubungan dengan program akademik Fakultas Ilmu Komputer, kami mengajukan "
            "permohonan kerja praktik mahasiswa dengan komitmen penuh menjaga kerahasiaan data."
        )

        mock_memory_client = _MockGenAIClient(
            [
                {
                    "is_significant": True,
                    "diff_summary": "Perubahan sapaan ke Direktur Human Capital dan penambahan komitmen kerahasiaan.",
                    "extracted_rule": "Gunakan sapaan Yth. Direktur Human Capital & Strategy serta klausul kerahasiaan.",
                    "style_guidelines": [
                        "Gunakan sapaan Yth. Direktur Human Capital & Strategy serta klausul kerahasiaan."
                    ],
                }
            ],
            delay_seconds=0.05,
        )

        factory = APIRequestFactory()
        expected_cloudinary_url = "https://res.cloudinary.com/autosurat/image/upload/v1/autosurat_output/surat_magang_s4.pdf"

        with patch(
            "surat.services.pdf_service.render_and_upload_pdf",
            return_value=expected_cloudinary_url,
        ) as mock_pdf_upload:
            LecturerApprovalActionAPIView.memory_agent_instance = AgenticMemoryAgent(
                client=mock_memory_client
            )
            LecturerApprovalActionAPIView.execution_tools_instance = SuratExecutionTools()

            approve_req = factory.post(
                f"/api/surat/approval/{approval_step.id}/action/",
                data={
                    "action": "APPROVE",
                    "catatan": "Disetujui dengan revisi sapaan jabatan.",
                    "final_approved_content": edited_final_content,
                    "final_status": "SENT",
                },
                format="json",
            )
            force_authenticate(approve_req, user=lecturer_user)

            start_ts = time.perf_counter()
            approve_resp = LecturerApprovalActionAPIView.as_view()(
                approve_req, approval_id=approval_step.id
            )
            elapsed_ms = (time.perf_counter() - start_ts) * 1000

            assert approve_resp.status_code == 200, (
                f"Expected HTTP 200, got {approve_resp.status_code}: {approve_resp.data}"
            )
            assert approve_resp.data["final_approved_content"] == edited_final_content

            worker = LecturerApprovalActionAPIView._last_worker_thread
            assert worker is not None, "Background worker thread tidak terinisiasi saat APPROVE."
            worker.join(timeout=5.0)
            assert not worker.is_alive(), "Background worker thread masih berjalan melampaui timeout."
            mock_pdf_upload.assert_called_once()

        print(
            f"BERHASIL: Endpoint APPROVE merespons dalam {elapsed_ms:.1f} ms dan menyelesaikan "
            "eksekusi background thread dengan aman."
        )

        print("[4/6] Memverifikasi pembaruan SuratRequestDetail milik mahasiswa (PDF, TTE, Status SENT)...")
        surat_req.refresh_from_db()
        assert surat_req.status == SuratStatus.SENT, f"Status akhir harus SENT, ditemukan: {surat_req.status}"
        assert surat_req.file_pdf_url == expected_cloudinary_url
        assert surat_req.nomor_surat_resmi is not None and surat_req.kode_surat.kode_surat in surat_req.nomor_surat_resmi
        assert surat_req.qr_verification_code is not None and "/api/surat/verify/" in surat_req.qr_verification_code
        assert surat_req.final_approved_content == edited_final_content

        # Verifikasi detail via SuratRequestDetailAPIView milik mahasiswa
        detail_req = factory.get(f"/api/surat/requests/{surat_req.id}/")
        force_authenticate(detail_req, user=student_user)
        detail_resp = SuratRequestDetailAPIView.as_view()(detail_req, pk=surat_req.id)
        assert detail_resp.status_code == 200
        detail_data = detail_resp.data
        assert detail_data["status"] == SuratStatus.SENT
        assert detail_data["file_pdf_url"] == expected_cloudinary_url
        assert detail_data["final_approved_content"] == edited_final_content
        assert len(detail_data["signatures"]) == 1
        assert detail_data["signatures"][0]["signer_name"] == lecturer_user.nama
        assert detail_data["signatures"][0]["hash_document"]
        assert detail_data["signatures"][0]["token"]
        print("BERHASIL: SuratRequestDetail milik mahasiswa memuat file_pdf_url, TteSignature, dan status SENT.")

        print("[5/6] Memverifikasi Agentic Memory Loop (injeksi aturan baru ke pembuatan surat berikutnya)...")
        saved_memories = AgentFeedbackMemory.objects.filter(
            surat_request=surat_req,
            kode_surat=surat_type,
            is_active=True,
        )
        assert saved_memories.exists(), "Aturan gaya bahasa tidak tersimpan di AgentFeedbackMemory."
        memory_obj = saved_memories.first()
        assert "Direktur Human Capital" in memory_obj.extracted_rule

        # Pastikan SuratDraftingAgent._load_active_style_rules mengambil aturan tersebut untuk surat berikutnya
        drafting_agent = SuratDraftingAgent(api_key="dummy-key")
        loaded_rules = drafting_agent._load_active_style_rules(surat_type.kode_surat)
        assert any("Direktur Human Capital" in r for r in loaded_rules), (
            "Aturan dari AgentFeedbackMemory gagal dimuat oleh SuratDraftingAgent."
        )
        print("BERHASIL: Aturan gaya bahasa tersimpan di PostgreSQL dan otomatis dimuat pada penyusunan surat berikutnya.")

        print("[6/6] Memeriksa kepatuhan larangan emoji pada seluruh berkas Tahap 4...")
        checked_files = [
            BASE_DIR / "surat" / "views.py",
            BASE_DIR / "surat" / "serializers.py",
            BASE_DIR / "surat" / "agents" / "execution_tools.py",
            BASE_DIR / "surat" / "agents" / "memory_agent.py",
            BASE_DIR / "surat" / "agents" / "verify_stage4.py",
        ]
        for file_path in checked_files:
            content = file_path.read_text(encoding="utf-8")
            non_ascii_chars = [ch for ch in content if ord(ch) > 127]
            if non_ascii_chars:
                print(
                    f"GAGAL: Ditemukan karakter non-ASCII/emoji pada {file_path.name}: {non_ascii_chars}"
                )
                sys.exit(1)
        print("BERHASIL: Seluruh kode dan komentar Tahap 4 100% bersih dari emoji.")

        print("\nKESIMPULAN: TAHAP 4 LULUS VERIFIKASI TEKNIS SECARA MUTLAK.")
    finally:
        LecturerApprovalActionAPIView.memory_agent_instance = None
        LecturerApprovalActionAPIView.execution_tools_instance = None
        _cleanup_stage4_records(created_request_ids)


if __name__ == "__main__":
    run_stage4_verification()
