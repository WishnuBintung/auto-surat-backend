import tempfile
from django.template.loader import render_to_string
from weasyprint import HTML
import cloudinary.uploader

def render_and_upload_pdf(template_path, context_data):
    """
    1. Render template HTML dengan context data.
    2. Cetak menjadi file PDF via WeasyPrint.
    3. Upload file PDF ke Cloudinary secara mandiri dan kembalikan URL amannya (secure_url).
    """
    if not template_path:
        template_path = "kerangka-surat/base_surat.html"

    # Render string HTML menggunakan template engine Django
    html_string = render_to_string(template_path, context_data)

    # Cetak PDF ke file temporary sistem
    with tempfile.NamedTemporaryFile(suffix='.pdf', delete=False) as output_pdf:
        HTML(string=html_string).write_pdf(output_pdf.name)
        pdf_temp_path = output_pdf.name

    # Bersihkan nomor surat dari garis miring
    nomor_surat_clean = str(context_data.get('nomor_surat', 'unknown')).replace('/', '_')

    # Unggah ke Cloudinary secara independen menggunakan resource_type="auto"
    try:
        upload_result = cloudinary.uploader.upload(
            pdf_temp_path,
            resource_type="auto",   # Deteksi otomatis oleh Cloudinary sebagai dokumen/gambar aman
            folder="autosurat_output",
            public_id=f"surat_{nomor_surat_clean}",
            overwrite=True          # Menimpa file lama jika uji coba berulang
        )
        secure_url = upload_result.get("secure_url")
    except Exception as e:
        raise RuntimeError(f"Gagal mengunggah PDF ke Cloudinary: {str(e)}")

    return secure_url