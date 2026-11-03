import os
import requests
from django.conf import settings

def send_surat_via_telegram(chat_id: str, caption: str, pdf_path: str = None):
    """
    Mengirimkan file PDF surat resmi secara otonom langsung ke chat ID Telegram pengguna.
    """
    token = settings.TELEGRAM_BOT_TOKEN
    if not token:
        return {"status": "ERROR", "message": "Telegram Bot Token belum dikonfigurasi."}
        
    url = f"https://api.telegram.org/bot{token}/sendDocument"
    
    try:
        payload = {
            "chat_id": chat_id,
            "caption": caption,
            "parse_mode": "Markdown"
        }
        
        files = {}
        if pdf_path and os.path.exists(pdf_path):
            files = {"document": open(pdf_path, "rb")}
            
        response = requests.post(url, data=payload, files=files)
        
        # Tutup file jika sempat dibuka
        if "document" in files:
            files["document"].close()
            
        res_data = response.json()
        if res_data.get("ok"):
            return {"status": "SUCCESS", "message": f"Dokumen berhasil dikirim ke Telegram (Chat ID: {chat_id})"}
        else:
            return {"status": "ERROR", "message": res_data.get("description", "Gagal mengirim ke Telegram")}
            
    except Exception as e:
        print(f"Error Telegram Service: {e}")
        return {"status": "ERROR", "message": str(e)}