import json
import sys
from pathlib import Path
from pydantic import ValidationError

from surat.agents.schemas import (
    AgentSuratDraftOutputSchema,
    build_dynamic_payload_schema,
)

def run_stage1_verification():
    base_dir = Path(__file__).resolve().parent.parent.parent
    required_fields_path = base_dir / "required_field_surat.json"
    payload_path = base_dir / "payload.json"

    print("[1/5] Memeriksa keberadaan berkas kontrak data...")
    if not required_fields_path.exists() or not payload_path.exists():
        print("GAGAL: Berkas required_field_surat.json atau payload.json tidak ditemukan.")
        sys.exit(1)

    with open(required_fields_path, "r", encoding="utf-8") as f:
        required_spec = json.load(f)

    print("BERHASIL: Berkas kontrak data berhasil dimuat.")

    print("[2/5] Menguji kesesuaian penuh antara required_field_surat.json dan SuratMagangPayloadSchema...")
    expected_fields = {item["field"] for item in required_spec}
    defined_fields = set(
        AgentSuratDraftOutputSchema.model_json_schema()["$defs"]["SuratMagangPayloadSchema"]["properties"].keys()
    )
    if expected_fields != defined_fields:
        print(f"GAGAL: Ketidakcocokan field! JSON: {expected_fields} vs Pydantic: {defined_fields}")
        sys.exit(1)
    print(f"BERHASIL: Ke-5 field kontrak data ({', '.join(sorted(expected_fields))}) tervalidasi identik.")

    print("[3/5] Menguji fungsi dinamis build_dynamic_payload_schema terhadap required_field_surat.json...")
    try:
        DynamicSchema = build_dynamic_payload_schema("DynamicMagangSchema", required_spec)
        valid_instance = DynamicSchema(
            instansi_tujuan="PT Telekomunikasi Indonesia",
            tujuan_keperluan="Observasi dan Praktik Kerja Lapangan",
            posisi_dilamar="Software Engineer Intern",
            tanggal_mulai="2026-11-01",
            tanggal_selesai="2026-12-31",
        )
        assert valid_instance.tanggal_mulai.year == 2026
        print("BERHASIL: Dynamic schema builder berfungsi akurat dengan tipe data date dan string.")
    except Exception as e:
        print(f"GAGAL pada pengujian Dynamic Schema: {e}")
        sys.exit(1)

    print("[4/5] Menguji Negative Test (Simulasi Halusinasi Tanggal Terbalik & Skor Tanpa Catatan)...")
    try:
        # Skenario gagal 1: tanggal_selesai lebih awal dari tanggal_mulai
        AgentSuratDraftOutputSchema(
            extracted_payload={
                "instansi_tujuan": "PT Maju Jaya",
                "tujuan_keperluan": "Magang Mandiri",
                "posisi_dilamar": "Backend Developer",
                "tanggal_mulai": "2026-12-10",
                "tanggal_selesai": "2026-11-01",
            },
            ai_original_draft="Dengan hormat, bersama surat ini kami mengajukan permohonan magang...",
            evaluation={"self_critique_score": 9, "revision_notes": []},
        )
        print("GAGAL: Kronologi tanggal terbalik berhasil lolos!")
        sys.exit(1)
    except ValidationError:
        pass

    try:
        # Skenario gagal 2: skor di bawah 8 tetapi revision_notes kosong
        AgentSuratDraftOutputSchema(
            extracted_payload={
                "instansi_tujuan": "PT Maju Jaya",
                "tujuan_keperluan": "Magang Mandiri",
                "posisi_dilamar": "Backend Developer",
                "tanggal_mulai": "2026-11-01",
                "tanggal_selesai": "2026-12-10",
            },
            ai_original_draft="Dengan hormat, bersama surat ini kami mengajukan permohonan magang...",
            evaluation={"self_critique_score": 6, "revision_notes": []},
        )
        print("GAGAL: Evaluasi skor rendah tanpa revision_notes berhasil lolos!")
        sys.exit(1)
    except ValidationError:
        print("BERHASIL: Validator kronologi tanggal dan konsistensi evaluasi diri bekerja sangat ketat.")

    print("[5/5] Menguji Positive Test & konversi to_payload_dict()...")
    valid_output = AgentSuratDraftOutputSchema(
        extracted_payload={
            "instansi_tujuan": "PT Toyota Astra Motor",
            "tujuan_keperluan": "Permohonan Kerja Praktik Mahasiswa Informatika",
            "posisi_dilamar": "AI & Software Engineering Intern",
            "tanggal_mulai": "2026-11-01",
            "tanggal_selesai": "2027-01-31",
        },
        ai_original_draft=(
            "Yth. Pimpinan HRD PT Toyota Astra Motor di Tempat. Dengan hormat, "
            "sehubungan dengan program akademik Fakultas, kami mengajukan permohonan magang."
        ),
        evaluation={
            "self_critique_score": 9,
            "revision_notes": ["Format sudah memenuhi standar baku surat permohonan magang."],
        },
    )
    payload_dict = valid_output.to_payload_dict()
    assert payload_dict["tanggal_mulai"] == "2026-11-01"
    print("BERHASIL: Output agen berhasil dikonversi menjadi dictionary siap simpan ke PostgreSQL.")
    print("\nKESIMPULAN: TAHAP 1 LULUS VERIFIKASI TEKNIS SECARA MUTLAK.")

if __name__ == "__main__":
    run_stage1_verification()