import logging
import os
import requests
from django.conf import settings

logger = logging.getLogger(__name__)

def send_surat_via_telegram(chat_id: str, caption: str, pdf_path: str = None):
    """
    Mengirimkan file PDF surat resmi secara otonom langsung ke chat ID Telegram pengguna.
    Mendukung `pdf_path` baik berupa path file lokal maupun URL Cloudinary (`https://...`).
    """
    token = getattr(settings, "TELEGRAM_BOT_TOKEN", os.environ.get("TELEGRAM_BOT_TOKEN", ""))
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
        opened_file = None
        is_remote_url = isinstance(pdf_path, str) and pdf_path.strip().lower().startswith(("http://", "https://"))

        try:
            if pdf_path and os.path.exists(str(pdf_path)):
                opened_file = open(pdf_path, "rb")
                files = {"document": opened_file}
                response = requests.post(url, data=payload, files=files, timeout=20)
            elif is_remote_url:
                clean_url = pdf_path.strip()
                dl_resp = requests.get(clean_url, timeout=15)
                if dl_resp.status_code == 200 and dl_resp.content:
                    filename = os.path.basename(clean_url.split("?")[0]) or "Surat_Resmi.pdf"
                    if not filename.lower().endswith(".pdf"):
                        filename += ".pdf"
                    files = {"document": (filename, dl_resp.content, "application/pdf")}
                    response = requests.post(url, data=payload, files=files, timeout=20)
                else:
                    # Fallback: kirim URL langsung sebagai parameter document ke Telegram API
                    payload["document"] = clean_url
                    response = requests.post(url, data=payload, timeout=20)
            else:
                return {"status": "ERROR", "message": "Path atau URL dokumen PDF tidak ditemukan untuk dikirim ke Telegram."}
        finally:
            if opened_file is not None:
                opened_file.close()
            
        res_data = response.json()
        if res_data.get("ok"):
            return {"status": "SUCCESS", "message": f"Dokumen berhasil dikirim ke Telegram (Chat ID: {chat_id})"}
        else:
            return {"status": "ERROR", "message": res_data.get("description", "Gagal mengirim ke Telegram")}
            
    except Exception as e:
        logger.exception("Error Telegram Service: %s", e)
        return {"status": "ERROR", "message": str(e)}