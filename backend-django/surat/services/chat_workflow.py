from surat.models import SuratType, ChatThread
from .detect_intent import detect_intent_dynamically
from .route_intent import route_intent_with_ai
from surat.agents.letter_agent import SuratDraftingAgent  # Pastikan diimport jika dibutuhkan, atau sesuaikan dengan agen ekstraktor

def handle_incoming_chat_with_redis(thread_id: str, user_message: str, session_data: dict) -> str:
    """
    Menangani alur chat menggunakan state di Redis Cache 
    dan mensinkronikannya dengan model ChatThread di PostgreSQL.
    """
    cleaned_msg = user_message.strip()
    
    active_intent = session_data.get("intent")
    pending_intent = session_data.get("pending_intent")
    waiting_confirmation = session_data.get("is_waiting_for_switch_confirmation", False)
    current_slots = session_data.get("slots", {})

    # Ambil instance ChatThread di database untuk update field document_type jika perlu
    thread_obj = ChatThread.objects.filter(id=thread_id).first()

    # 1. Cek apakah sedang menunggu konfirmasi switch intent
    if waiting_confirmation:
        return handle_switch_confirmation_redis(cleaned_msg, thread_id, session_data, thread_obj)

    # 2. Deteksi intent dari pesan user (Lapis 1 Keyword -> Lapis 2 AI Router)
    detected_kode_surat = detect_intent_dynamically(cleaned_msg)
    if not detected_kode_surat:
        detected_kode_surat = route_intent_with_ai(cleaned_msg)

    # 3. KASUS A: Belum ada intent yang terkunci (Sesi baru)
    if not active_intent:
        if not detected_kode_surat:
            return "Mohon maaf, jenis surat yang Anda maksud belum dikenali. Silakan ketik nama surat dengan jelas."
        
        # Simpan intent ke Redis & update document_type serta title di PostgreSQL
        surat_obj = SuratType.objects.get(kode_surat=detected_kode_surat)
        session_data["intent"] = detected_kode_surat
        
        if thread_obj:
            thread_obj.document_type = detected_kode_surat
            thread_obj.title = f"Permohonan {surat_obj.nama_surat}"
            thread_obj.save(update_fields=['document_type', 'title', 'updated_at'])
        
        return f"Baik, kita akan memproses **{surat_obj.nama_surat}** ({detected_kode_surat})Mari lengkapi data yang diperlukan!"

    # 4. KASUS B: Intent sudah terkunci, tapi user mendadak menyebutkan intent BARU
    if detected_kode_surat and detected_kode_surat != active_intent:
        old_surat = SuratType.objects.get(kode_surat=active_intent)
        new_surat = SuratType.objects.get(kode_surat=detected_kode_surat)
        
        session_data["pending_intent"] = detected_kode_surat
        session_data["is_waiting_for_switch_confirmation"] = True
        
        return (
            f"⚠️ Sesi saat ini sedang memproses **{old_surat.nama_surat}**[cite: 1, 2]. "
            f"Apakah Anda ingin membatalkan draf tersebut dan beralih membuat **{new_surat.nama_surat}**? "
            f"\n\n(Ketik **'Ya'** untuk beralih atau **'Tidak'** untuk melanjutkan draf sebelumnya)"
        )

    # 5. KASUS C: Lanjutkan proses Slot Filling
    return process_slot_filling_redis(cleaned_msg, session_data)


def handle_switch_confirmation_redis(user_message: str, thread_id: str, session_data: dict, thread_obj) -> str:
    message_lower = user_message.strip().lower()
    
    if message_lower in ["ya", "y", "beralih", "lanjutkan"]:
        old_code = session_data.get("intent")
        new_code = session_data.get("pending_intent")
        
        # Pindahkan intent, reset slot, matikan flag
        session_data["intent"] = new_code
        session_data["pending_intent"] = None
        session_data["is_waiting_for_switch_confirmation"] = False
        session_data["slots"] = {}  # Reset bersih cicilan data lama
        
        new_surat_obj = SuratType.objects.get(kode_surat=new_code)
        
        # Perbarui juga di tabel ChatThread PostgreSQL
        if thread_obj:
            thread_obj.document_type = new_code
            thread_obj.title = f"Permohonan {new_surat_obj.nama_surat}"
            thread_obj.save(update_fields=['document_type', 'title', 'updated_at'])
            
        return f"Draf sebelumnya ({old_code}) telah dibatalkan. Berhasil beralih ke **{new_surat_obj.nama_surat}**. Silakan masukkan data yang diperlukan!"
    
    else:
        session_data["pending_intent"] = None
        session_data["is_waiting_for_switch_confirmation"] = False
        
        active_surat_obj = SuratType.objects.get(kode_surat=session_data.get("intent"))
        return f"Baik, peralihan dibatalkan. Kita tetap melanjutkan pengisian untuk **{active_surat_obj.nama_surat}**[cite: 1, 2]."


def process_slot_filling_redis(user_message: str, session_data: dict) -> str:
    """
    Mengelola slot filling secara fleksibel (mendukung input acak/terbalik)
    serta membersihkan slot menggunakan fungsi sanitizer.
    """
    try:
        surat_type = SuratType.objects.get(kode_surat=session_data.get("intent"))
    except SuratType.DoesNotExist:
        return "Terjadi kesalahan sistem: Jenis surat tidak ditemukan."

    required_fields = surat_type.required_payload_fields or []
    current_slots = session_data.get("slots", {})

    # 1. GUNAKAN AI / EXTRACTOR UNTUK MENANGKAP SLOT DARI PESAN BEBAS USER
    # Menggunakan SuratDraftingAgent atau fungsi helper ekstraksi slot berstandar LLM
    try:
        agent = SuratDraftingAgent()
        # Meminta AI mengekstrak data apa saja yang relevan dari pesan bebas user saat ini
        extraction_result = agent.extract_slots_from_text(
            user_prompt_context=user_message,
            kode_surat=surat_type.kode_surat,
            required_fields=required_fields
        )
        extracted_data = getattr(extraction_result, "extracted_slots", {}) or {}
    except Exception:
        # Fallback darurat jika ekstraksi AI gagal: masukkan langsung ke target kosong pertama
        extracted_data = {}
        for item in required_fields:
            fk = item.get("field")
            if fk not in current_slots or not current_slots[fk]:
                extracted_data[fk] = user_message
                break

    # 2. TERAPKAN SANITASI & AKUMULASI KE REDIS SLOTS (Accumulative Merge)
    for field_key, raw_val in extracted_data.items():
        if raw_val:
            # Bersihkan dari kata tugas/noise menggunakan sanitizer regex kita
            cleaned_val = sanitize_extracted_slot(field_key, raw_val)
            # Hanya simpan jika slot tersebut memang bagian dari required fields
            if any(item.get("field") == field_key for item in required_fields):
                current_slots[field_key] = cleaned_val

    session_data["slots"] = current_slots

    # 3. Render checklist status kelengkapan terbaru
    checklist_lines, is_complete, next_target_label = generate_checklist_status_response(surat_type, current_slots)
    formatted_checklist = "\n".join(checklist_lines)

    if is_complete:
        return f"{formatted_checklist}\n\n🎉 **Semua data untuk {surat_type.nama_surat} sudah lengkap!**[cite: 1, 2] Silakan ketik 'Lanjut' untuk memproses draf surat."
    else:
        return f"{formatted_checklist}\n\nMohon informasikan data untuk: **{next_target_label}**"

def generate_checklist_status_response(surat_type, current_slots: dict):
    required_fields = surat_type.required_payload_fields or []
    checklist_lines = [f"📋 **Status Kelengkapan: {surat_type.nama_surat}**"]
    
    all_complete = True
    next_target_label = None
    
    for item in required_fields:
        field_key = item.get("field")
        field_label = item.get("label", field_key) 
        
        is_filled = field_key in current_slots and bool(current_slots[field_key])
        
        if is_filled:
            value = current_slots[field_key]
            checklist_lines.append(f"✅ **{field_label}**: {value}")
        else:
            checklist_lines.append(f"❌ **{field_label}**: *(Belum diisi)*")
            all_complete = False
            if not next_target_label:
                next_target_label = field_label  
                
    return checklist_lines, all_complete, next_target_label

import re
from typing import Dict, Any

def sanitize_extracted_slot(field_name: str, raw_value: Any) -> Any:
    """
    Membersihkan slot dari sisa kata depan atau kalimat percakapan 
    yang tidak sengaja ikut terekstrak.
    """
    if not isinstance(raw_value, str) or not raw_value.strip():
        return raw_value

    text = raw_value.strip()

    # Sanitasi khusus instansi tujuan (buang kata depan/pembuka)
    if field_name == "instansi_tujuan":
        patterns_to_remove = [
            r'^(untuk|ke|pada|kepada|di)\s+',
            r'^(tolong buatkan surat( rekomendasi)?( beasiswa)?( untuk)?)\s+',
            r'^(ditujukan ke|ditujukan kepada)\s+'
        ]
        for pattern in patterns_to_remove:
            text = re.sub(pattern, '', text, flags=re.IGNORECASE).strip()

    # Sanitasi khusus keperluan / alasan
    elif field_name in ["tujuan_keperluan", "alasan_pengajuan"]:
        patterns_to_remove = [
            r'^(untuk|guna|rangka|dalam rangka)\s+',
            r'^(keperluan)\s+'
        ]
        for pattern in patterns_to_remove:
            text = re.sub(pattern, '', text, flags=re.IGNORECASE).strip()

    return text