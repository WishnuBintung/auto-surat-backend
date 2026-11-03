import os
from django.core.mail import EmailMessage
from django.conf import settings

def send_surat_via_gmail_admin(recipient_email: str, subject: str, body_message: str, pdf_path: str = None):
    """
    Mengirimkan email resmi dari akun admin sistem ke penerima (mahasiswa atau instansi tujuan)
    lengkap dengan lampiran file PDF surat yang telah digenerate.
    """
    try:
        email = EmailMessage(
            subject=subject,
            body=body_message,
            from_email=settings.DEFAULT_FROM_EMAIL,
            to=[recipient_email],
        )
        
        # Jika ada file PDF fisik hasil render WeasyPrint yang dilampirkan
        if pdf_path and os.path.exists(pdf_path):
            email.attach_file(pdf_path)
            
        # Kirim email secara sinkron
        email.send(fail_silently=False)
        return {"status": "SUCCESS", "message": f"Email berhasil dikirim ke {recipient_email}"}
        
    except Exception as e:
        print(f"Gagal mengirim email: {e}")
        return {"status": "ERROR", "message": str(e)}