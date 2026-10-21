import json
import os
import sys
from pathlib import Path
from typing import Any, List

# Pastikan direktori backend-django berada di sys.path saat dijalankan langsung
BASE_DIR = Path(__file__).resolve().parent.parent.parent
if str(BASE_DIR) not in sys.path:
    sys.path.insert(0, str(BASE_DIR))

from surat.agents.letter_agent import (
    SuratAgentConfigurationError,
    SuratAgentRateLimitError,
    SuratAgentTimeoutError,
    SuratAgentUpstreamError,
    SuratAgentValidationError,
    SuratDraftingAgent,
)
from surat.agents.prompts import (
    build_initial_user_prompt,
    build_self_reflection_revision_prompt,
    build_system_prompt,
)
from surat.agents.schemas import AgentSuratDraftOutputSchema


class _MockLLMResponse:
    def __init__(self, payload: dict) -> None:
        self.text = json.dumps(payload)
        self.parsed = None


class _MockModelsNamespace:
    def __init__(self, queued_responses: List[Any]) -> None:
        self.queued_responses = list(queued_responses)
        self.call_history: List[dict] = []

    def generate_content(self, model: str, contents: str, config: Any) -> Any:
        self.call_history.append(
            {"model": model, "contents": contents, "config": config}
        )
        if not self.queued_responses:
            raise RuntimeError("Antrean respons simulasi habis.")
        next_item = self.queued_responses.pop(0)
        if isinstance(next_item, BaseException):
            raise next_item
        return _MockLLMResponse(next_item)


class _MockGenAIClient:
    def __init__(self, queued_responses: List[Any]) -> None:
        self.models = _MockModelsNamespace(queued_responses)


class _SimulatedRateLimitError(Exception):
    def __init__(self, message: str) -> None:
        super().__init__(message)
        self.code = 429


def run_stage2_verification() -> None:
    print("[1/6] Memeriksa konfigurasi requirements.txt dan core/settings.py...")
    req_path = BASE_DIR / "requirements.txt"
    settings_path = BASE_DIR / "core" / "settings.py"

    req_content = req_path.read_text(encoding="utf-8")
    settings_content = settings_path.read_text(encoding="utf-8")

    if "google-genai" not in req_content:
        print("GAGAL: SDK google-genai belum terdaftar di requirements.txt.")
        sys.exit(1)

    for required_setting in (
        "GEMINI_API_KEY",
        "GEMINI_MODEL_NAME",
        "AGENT_CRITIQUE_MIN_SCORE",
        "AGENT_MAX_REVISIONS",
        "AGENT_TIMEOUT_SECONDS",
    ):
        if required_setting not in settings_content:
            print(f"GAGAL: Konfigurasi {required_setting} belum diekspos di core/settings.py.")
            sys.exit(1)
    print("BERHASIL: Dependensi SDK dan konfigurasi settings.py terverifikasi lengkap.")

    print("[2/6] Menguji pemuatan required_field_surat.json dan konstruksi prompt formal...")
    agent_probe = SuratDraftingAgent(api_key="dummy-key")
    required_fields = agent_probe.get_required_fields_for_kode("SKM-01")
    system_prompt = build_system_prompt(
        kode_surat="SKM-01",
        required_fields=required_fields,
        style_rules=["Gunakan sapaan Yth. Pimpinan Divisi Human Capital."],
    )
    user_prompt = build_initial_user_prompt(
        user_prompt_context="Permohonan magang di PT Telkom Indonesia sebagai Backend Intern.",
        kode_surat="SKM-01",
        student_metadata={"nama": "Budi Santoso", "nim": "202301001"},
    )

    for item in required_fields:
        field_name = item["field"]
        if field_name not in system_prompt:
            print(f"GAGAL: Field '{field_name}' dari required_field_surat.json tidak masuk ke System Prompt.")
            sys.exit(1)

    if "ZERO-HALLUCINATION" not in system_prompt or "SELF-REFLECTION" not in system_prompt:
        print("GAGAL: Instruksi pencegahan halusinasi atau rubrik Self-Reflection tidak ditemukan.")
        sys.exit(1)

    if "Budi Santoso" not in user_prompt:
        print("GAGAL: Metadata mahasiswa tidak terinjeksi ke dalam User Prompt.")
        sys.exit(1)
    print("BERHASIL: Template prompt mematuhi spesifikasi required_field_surat.json dan standar akademik.")

    print("[3/6] Menguji alur utama Structured Outputs ketika self_critique_score >= 8 (1 Iterasi)...")
    mock_client_pass = _MockGenAIClient(
        [
            {
                "extracted_payload": {
                    "instansi_tujuan": "PT Telekomunikasi Indonesia (Persero) Tbk",
                    "tujuan_keperluan": "Permohonan Kerja Praktik Mahasiswa Program Studi Informatika",
                    "posisi_dilamar": "Backend Software Engineer Intern",
                    "tanggal_mulai": "2026-11-01",
                    "tanggal_selesai": "2027-01-31",
                },
                "ai_original_draft": (
                    "Yth. Pimpinan Divisi Human Capital PT Telekomunikasi Indonesia (Persero) Tbk "
                    "di Tempat. Dengan hormat, sehubungan dengan pemenuhan kurikulum akademik, "
                    "kami mengajukan permohonan kerja praktik mahasiswa untuk posisi Backend "
                    "Software Engineer Intern pada periode 2026-11-01 hingga 2027-01-31."
                ),
                "evaluation": {
                    "self_critique_score": 9,
                    "revision_notes": [],
                },
            }
        ]
    )
    agent_pass = SuratDraftingAgent(client=mock_client_pass)
    output_pass = agent_pass.draft_letter(
        user_prompt_context="Saya ingin mengajukan magang ke Telkom posisi Backend dari 1 Nov 2026 sampai 31 Jan 2027.",
        kode_surat="SKM-01",
    )
    assert isinstance(output_pass, AgentSuratDraftOutputSchema)
    assert len(mock_client_pass.models.call_history) == 1
    assert output_pass.evaluation.self_critique_score == 9
    assert output_pass.to_payload_dict()["tanggal_mulai"] == "2026-11-01"
    print("BERHASIL: Agen mengeksekusi tepat 1 kali panggilan LLM dan mengembalikan skema Pydantic valid.")

    print("[4/6] Menguji Self-Reflection Loop (self_critique_score < 8 memicu maksimal 1 kali revisi)...")
    mock_client_reflect = _MockGenAIClient(
        [
            {
                "extracted_payload": {
                    "instansi_tujuan": "BRI",
                    "tujuan_keperluan": "Permohonan Magang",
                    "posisi_dilamar": "Data Analyst Intern",
                    "tanggal_mulai": "2026-11-01",
                    "tanggal_selesai": "2026-12-31",
                },
                "ai_original_draft": (
                    "Yth. HRD BRI di Tempat. Dengan hormat, bersama surat ini kami mengajukan "
                    "permohonan magang mahasiswa pada posisi Data Analyst Intern."
                ),
                "evaluation": {
                    "self_critique_score": 6,
                    "revision_notes": [
                        "Nama instansi masih berupa akronim BRI, wajib ditulis PT Bank Rakyat Indonesia (Persero) Tbk.",
                        "Periode tanggal pelaksanaan belum dicantumkan secara eksplisit di dalam draf surat.",
                    ],
                },
            },
            {
                "extracted_payload": {
                    "instansi_tujuan": "PT Bank Rakyat Indonesia (Persero) Tbk",
                    "tujuan_keperluan": "Permohonan Kerja Praktik Mahasiswa",
                    "posisi_dilamar": "Data Analyst Intern",
                    "tanggal_mulai": "2026-11-01",
                    "tanggal_selesai": "2026-12-31",
                },
                "ai_original_draft": (
                    "Yth. Pimpinan Divisi Human Capital PT Bank Rakyat Indonesia (Persero) Tbk "
                    "di Tempat. Dengan hormat, sehubungan dengan program akademik universitas, "
                    "kami mengajukan permohonan kerja praktik pada posisi Data Analyst Intern "
                    "terhitung mulai 2026-11-01 sampai dengan 2026-12-31."
                ),
                "evaluation": {
                    "self_critique_score": 9,
                    "revision_notes": ["Redaksi instansi dan periode tanggal telah diperbaiki."],
                },
            },
        ]
    )
    agent_reflect = SuratDraftingAgent(client=mock_client_reflect)
    output_reflect = agent_reflect.draft_letter(
        user_prompt_context="Tolong buatkan surat magang ke BRI posisi Data Analyst dari 1 Nov 2026 sampai 31 Des 2026.",
        kode_surat="SKM-01",
    )
    assert len(mock_client_reflect.models.call_history) == 2
    second_call_prompt = mock_client_reflect.models.call_history[1]["contents"]
    assert "PT Bank Rakyat Indonesia (Persero) Tbk" in second_call_prompt
    assert output_reflect.evaluation.self_critique_score == 9
    print("BERHASIL: Self-Reflection Loop memperbaiki draf secara otomatis menggunakan revision_notes dalam 1 kali revisi.")

    print("[5/6] Menguji penanganan exception khusus (Timeout, Rate-Limit, dan Validasi Pydantic)...")
    # Uji Timeout
    agent_timeout = SuratDraftingAgent(
        client=_MockGenAIClient([TimeoutError("Request timed out after 30.0s")])
    )
    try:
        agent_timeout.draft_letter("Konteks uji timeout", "SKM-01")
        print("GAGAL: TimeoutError tidak diterjemahkan menjadi SuratAgentTimeoutError.")
        sys.exit(1)
    except SuratAgentTimeoutError as exc:
        assert exc.status_code == 504

    # Uji Rate-Limit (HTTP 429)
    agent_ratelimit = SuratDraftingAgent(
        client=_MockGenAIClient([_SimulatedRateLimitError("429 RESOURCE_EXHAUSTED: Quota exceeded")])
    )
    try:
        agent_ratelimit.draft_letter("Konteks uji rate limit", "SKM-01")
        print("GAGAL: Error 429 tidak diterjemahkan menjadi SuratAgentRateLimitError.")
        sys.exit(1)
    except SuratAgentRateLimitError as exc:
        assert exc.status_code == 429

    # Uji Validasi Pydantic (tanggal terbalik dari LLM)
    agent_invalid_schema = SuratDraftingAgent(
        client=_MockGenAIClient(
            [
                {
                    "extracted_payload": {
                        "instansi_tujuan": "PT Nusantara Teknologi",
                        "tujuan_keperluan": "Permohonan Magang",
                        "posisi_dilamar": "DevOps Intern",
                        "tanggal_mulai": "2026-12-31",
                        "tanggal_selesai": "2026-11-01",
                    },
                    "ai_original_draft": (
                        "Yth. Pimpinan PT Nusantara Teknologi di Tempat. Dengan hormat, "
                        "kami mengajukan permohonan kerja praktik mahasiswa."
                    ),
                    "evaluation": {"self_critique_score": 9, "revision_notes": []},
                }
            ]
        )
    )
    try:
        agent_invalid_schema.draft_letter("Konteks uji validasi tanggal terbalik", "SKM-01")
        print("GAGAL: Output LLM yang melanggar validator kronologi tanggal berhasil lolos!")
        sys.exit(1)
    except SuratAgentValidationError:
        pass
    print("BERHASIL: Seluruh error API (Timeout, Rate-Limit, dan pelanggaran skema) tertangani dengan bersih.")

    print("[6/6] Memeriksa kepatuhan larangan emoji pada seluruh berkas Tahap 2...")
    checked_files = [
        BASE_DIR / "core" / "settings.py",
        BASE_DIR / "surat" / "agents" / "prompts.py",
        BASE_DIR / "surat" / "agents" / "letter_agent.py",
        BASE_DIR / "surat" / "agents" / "schemas.py",
    ]
    for file_path in checked_files:
        content = file_path.read_text(encoding="utf-8")
        non_ascii_chars = [ch for ch in content if ord(ch) > 127]
        if non_ascii_chars:
            print(f"GAGAL: Ditemukan karakter non-ASCII/emoji pada {file_path.name}: {non_ascii_chars}")
            sys.exit(1)
    print("BERHASIL: Seluruh kode, prompt, dan komentar 100% bersih dari emoji.")

    # Opsional: Uji Live Gemini API apabila argumen --live diberikan dan GEMINI_API_KEY tersedia
    live_api_key = os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY")
    if "--live" in sys.argv and live_api_key:
        print("\n[LIVE TEST] Menjalankan pengujian inferensi langsung ke Gemini API...")
        live_agent = SuratDraftingAgent(api_key=live_api_key)
        try:
            live_result = live_agent.draft_letter(
                user_prompt_context=(
                    "Saya mahasiswa Teknik Informatika ingin mengajukan surat pengantar magang "
                    "ke PT Telkom Indonesia untuk posisi Cloud Engineer Intern mulai 1 November 2026 "
                    "sampai 31 Januari 2027 sebagai syarat mata kuliah Kerja Praktik."
                ),
                kode_surat="SKM-01",
            )
            print("BERHASIL LIVE TEST:")
            print(f"  - Payload      : {live_result.to_payload_dict()}")
            print(f"  - Skor Evaluasi: {live_result.evaluation.self_critique_score}/10")
            print(f"  - Catatan      : {live_result.evaluation.revision_notes}")
        except SuratAgentConfigurationError as exc:
            print(f"PERINGATAN LIVE TEST: {exc} (Pastikan GEMINI_API_KEY di .env berisi API Key aktif).")

    print("\nKESIMPULAN: TAHAP 2 LULUS VERIFIKASI TEKNIS SECARA MUTLAK.")


if __name__ == "__main__":
    run_stage2_verification()

