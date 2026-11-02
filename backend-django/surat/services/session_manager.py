import json
import logging
from typing import Dict, Any, Optional
from django.core.cache import cache
from surat.models import ChatThread, ChatMessage
from .chat_workflow import handle_incoming_chat_with_redis

logger = logging.getLogger(__name__)

class AutoSuratSessionManager:
    TTL_SECONDS = 1800  # 30 Menit Sliding TTL

    @staticmethod
    def _get_redis_key(thread_id: str) -> str:
        return f"autosurat:session:{thread_id}"

    @classmethod
    def get_session(cls, thread_id: str) -> Dict[str, Any]:
        """Mengambil state aktif dari Redis, sekaligus verifikasi lazy-expiration database."""
        redis_key = cls._get_redis_key(thread_id)
        session_data = cache.get(redis_key)

        if not session_data:
            thread = ChatThread.objects.filter(id=thread_id, status=ChatThread.ThreadStatus.ACTIVE).first()
            if thread:
                thread.status = ChatThread.ThreadStatus.EXPIRED
                thread.save(update_fields=['status', 'updated_at'])
            
            # Struktur default state di Redis jika cache kosong/expired
            return {
                "state": "ACTIVE",
                "intent": None,           # Menggantikan active_kode_surat
                "pending_intent": None,   # Untuk fitur switch intent
                "is_waiting_for_switch_confirmation": False,
                "slots": {}               # Tempat accumulative payload terkumpul
            }

        return session_data

    @classmethod
    def clear_session(cls, thread_id: str, target_status: str = ChatThread.ThreadStatus.CANCELLED):
        """Menghapus cache Redis dan mensinkronisasi status akhir ke PostgreSQL."""
        redis_key = cls._get_redis_key(thread_id)
        cache.delete(redis_key)
        ChatThread.objects.filter(id=thread_id).update(status=target_status)

    @classmethod
    def handle_incoming_message(cls, thread_id: str, user_message: str, user_obj) -> str:
        """
        Handler utama di dalam kelas session manager:
        1. Mengecek keyword pembatalan global (Pilar 5).
        2. Mengambil state aktif dari Redis (session_data).
        3. Mencatat riwayat pesan ke PostgreSQL (ChatMessage).
        4. Meneruskan ke orkestrator state & slot filling.
        """
        cleaned_msg = user_message.strip()
        cleaned_msg_lower = cleaned_msg.lower()

        # 1. Interceptor Keyword Pembatalan (Global di semua state)
        cancellation_keywords = ["batal", "reset", "cancel", "mulai ulang", "stop", "hentikan", "hapus"]
        if cleaned_msg_lower in cancellation_keywords:
            cls.clear_session(thread_id, target_status=ChatThread.ThreadStatus.CANCELLED)
            ChatThread.objects.filter(id=thread_id).update(
                document_type=None, 
                title="Permohonan Surat Dibatalkan"
            )
            return "Sesi permohonan surat ini telah dibatalkan. Ketik jenis surat apa yang ingin kamu buat jika ingin mulai kembali."

        # 2. Ambil sesi aktif dari Redis
        session_data = cls.get_session(thread_id)
        if session_data.get("state") == "EXPIRED":
            return "Sesi Anda telah kedaluwarsa karena tidak ada aktivitas selama 30 menit. Silakan buat sesi/thread baru."

        # 3. Log pesan masuk ke PostgreSQL (ChatMessage history)
        thread = ChatThread.objects.filter(id=thread_id, user=user_obj).first()
        if thread:
            ChatMessage.objects.create(
                thread=thread,
                sender='user',
                message=user_message,
                slots_snapshot=session_data.get("slots", {})
            )

        # 4. Teruskan ke orkestrator logika alur chat (di file chat_workflow_service.py)
        reply_message = handle_incoming_chat_with_redis(thread_id, cleaned_msg, session_data)

        # 5. Simpan kembali pembaruan state session_data ke Redis Cache (Sliding TTL)
        cache.set(cls._get_redis_key(thread_id), session_data, timeout=cls.TTL_SECONDS)

        return reply_message