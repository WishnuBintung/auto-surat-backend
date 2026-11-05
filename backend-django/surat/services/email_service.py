import os
import base64
import logging
import requests
import resend
from django.conf import settings

logger = logging.getLogger(__name__)

def send_surat_via_gmail_admin(recipient_email: str, subject: str, body_message: str, pdf_path: str = None):
    """
    Mengirimkan email resmi berisi dokumen surat menggunakan Resend HTTP API (Port 443).
    Mendukung `pdf_path` baik berupa path file lokal maupun URL Cloudinary (`https://...`).
    """
    api_key = getattr(settings, "RESEND_API_KEY", os.environ.get("RESEND_API_KEY", ""))
    
    if not api_key:
        error_msg = "RESEND_API_KEY belum dikonfigurasi di environment / settings.py."
        logger.error(error_msg)
        return {"status": "ERROR", "message": error_msg}

    resend.api_key = api_key

    try:
        html_body = body_message.replace('\n', '<br>') if body_message else ""
        text_body = body_message or ""

        is_remote_url = isinstance(pdf_path, str) and pdf_path.strip().lower().startswith(("http://", "https://"))
        if is_remote_url:
            clean_url = pdf_path.strip()
            html_body += (
                f'<br><br><p><a href="{clean_url}" '
                f'style="display:inline-block;padding:10px 18px;background-color:#1a56db;color:#ffffff;'
                f'text-decoration:none;border-radius:6px;font-weight:bold;">'
                f'Unduh Dokumen Surat Resmi (PDF)</a></p>'
                f'<p style="font-size:12px;color:#555;">Tautan langsung: {clean_url}</p>'
            )
            text_body += f"\n\nUnduh Dokumen Surat Resmi (PDF): {clean_url}"

        payload = {
            "from": getattr(settings, "DEFAULT_FROM_EMAIL", "onboarding@resend.dev"),
            "to": [recipient_email],
            "subject": subject,
            "html": f"<p>{html_body}</p>",
            "text": text_body,
        }

        # Lampirkan file PDF baik dari disk lokal maupun dari URL Cloudinary
        if pdf_path and os.path.exists(str(pdf_path)):
            with open(pdf_path, "rb") as f:
                pdf_bytes = f.read()
                pdf_base64 = base64.b64encode(pdf_bytes).decode("utf-8")
                
            filename = os.path.basename(pdf_path) or "Surat_Resmi.pdf"
            if not filename.lower().endswith(".pdf"):
                filename += ".pdf"
            payload["attachments"] = [
                {
                    "filename": filename,
                    "content": pdf_base64,
                }
            ]
        elif is_remote_url:
            try:
                dl_resp = requests.get(pdf_path.strip(), timeout=15)
                if dl_resp.status_code == 200 and dl_resp.content:
                    pdf_base64 = base64.b64encode(dl_resp.content).decode("utf-8")
                    url_basename = os.path.basename(pdf_path.strip().split("?")[0]) or "Surat_Resmi.pdf"
                    if not url_basename.lower().endswith(".pdf"):
                        url_basename += ".pdf"
                    payload["attachments"] = [
                        {
                            "filename": url_basename,
                            "content": pdf_base64,
                        }
                    ]
            except Exception as dl_exc:
                logger.warning("Gagal mengunduh lampiran PDF dari URL untuk email (tautan unduh tetap disertakan): %s", dl_exc)

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