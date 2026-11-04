import os
import base64
import logging
import resend
from django.conf import settings

logger = logging.getLogger(__name__)

def send_surat_via_gmail_admin(recipient_email: str, subject: str, body_message: str, pdf_path: str = None):
    """
    Mengirimkan email resmi berisi dokumen surat menggunakan Resend HTTP API (Port 443).
    Aman dari kendala [Errno 101] Network is unreachable di server cloud (Render).
    """
    api_key = getattr(settings, "RESEND_API_KEY", os.environ.get("RESEND_API_KEY", ""))
    
    if not api_key:
        error_msg = "RESEND_API_KEY belum dikonfigurasi di environment / settings.py."
        logger.error(error_msg)
        return {"status": "ERROR", "message": error_msg}

    resend.api_key = api_key

    try:
                # Ganti karakter newline (\n) dengan <br> sebelum f-string
        html_body = body_message.replace('\n', '<br>') if body_message else ""

        payload = {
            "from": getattr(settings, "DEFAULT_FROM_EMAIL", "onboarding@resend.dev"),
            "to": [recipient_email],
            "subject": subject,
            "html": f"<p>{html_body}</p>",
            "text": body_message,
        }

        # Jika ada file PDF fisik hasil render WeasyPrint yang akan dilampirkan
        if pdf_path and os.path.exists(pdf_path):
            with open(pdf_path, "rb") as f:
                pdf_bytes = f.read()
                pdf_base64 = base64.b64encode(pdf_bytes).decode("utf-8")
                
            filename = os.path.basename(pdf_path)
            payload["attachments"] = [
                {
                    "filename": filename,
                    "content": pdf_base64,
                }
            ]

        # Kirim HTTP API Request ke Resend
        response = resend.Emails.send(payload)
        
        logger.info(f"Email Resend berhasil terkirim ke {recipient_email}. ID: {response.get('id')}")
        return {
            "status": "SUCCESS", 
            "message": f"Email berhasil dikirim ke {recipient_email}",
            "email_id": response.get("id")
        }

    except Exception as e:
        logger.exception(f"Gagal mengirim email via Resend API: {e}")
        return {"status": "ERROR", "message": str(e)}