import os
import base64
import logging
import requests
from django.conf import settings

logger = logging.getLogger(__name__)

def send_surat_via_gmail_admin(recipient_email: str, subject: str, body_message: str, pdf_path: str = None):
    """
    Mengirimkan email resmi berisi dokumen surat menggunakan Brevo HTTP API (Port 443).
    Aman dari kendala jaringan di server cloud (Render).
    """
    api_key = getattr(settings, "BREVO_API_KEY", os.environ.get("BREVO_API_KEY", ""))
    
    if not api_key:
        error_msg = "BREVO_API_KEY belum dikonfigurasi di environment / settings.py."
        logger.error(error_msg)
        return {"status": "ERROR", "message": error_msg}

    url = "https://api.brevo.com/v3/smtp/email"
    
    sender_email = getattr(settings, "DEFAULT_FROM_EMAIL", "no-reply@autosurat.com")
    
    headers = {
        "accept": "application/json",
        "api-key": api_key,
        "content-type": "application/json"
    }

    html_body = body_message.replace('\n', '<br>') if body_message else ""

    payload = {
        "sender": {"email": sender_email, "name": "AutoSurat Kampus"},
        "to": [{"email": recipient_email}],
        "subject": subject,
        "htmlContent": f"<p>{html_body}</p>",
        "textContent": body_message
    }

    # Jika ada lampiran file PDF
    if pdf_path and os.path.exists(pdf_path):
        try:
            with open(pdf_path, "rb") as f:
                pdf_bytes = f.read()
                pdf_base64 = base64.b64encode(pdf_bytes).decode("utf-8")
                
            filename = os.path.basename(pdf_path)
            payload["attachment"] = [
                {
                    "content": pdf_base64,
                    "name": filename
                }
            ]
        except Exception as attach_err:
            logger.error(f"Gagal memproses lampiran PDF untuk Brevo: {attach_err}")

    try:
        response = requests.post(url, json=payload, headers=headers)
        res_data = response.json()

        if response.status_code in [200, 201, 202]:
            message_id = res_data.get("messageId")
            logger.info(f"Email Brevo berhasil terkirim ke {recipient_email}. ID: {message_id}")
            return {
                "status": "SUCCESS", 
                "message": f"Email berhasil dikirim ke {recipient_email}",
                "email_id": message_id
            }
        else:
            logger.error(f"Gagal mengirim email via Brevo API: {res_data}")
            return {"status": "ERROR", "message": str(res_data)}

    except Exception as e:
        logger.exception(f"Kesalahan koneksi saat mengirim email via Brevo API: {e}")
        return {"status": "ERROR", "message": str(e)}