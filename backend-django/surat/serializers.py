# apps/surat/serializers.py
from rest_framework import serializers
from .models import (
    SuratType,
    SuratRequest,
    SuratApproval,
    SuratAttachment,
    TteSignature,
    SuratAuditLog
)
from .services.validators import run_validators

# ==============================================================================
# 1. SERIALIZERS UNTUK INPUT (WRITE / CREATE / ACTION)
# ==============================================================================

class SuratRequestCreateSerializer(serializers.Serializer):
    """
    Serializer khusus untuk VALIDASI input saat mahasiswa mengajukan surat baru.
    Menerima kode_surat, payload JSON dinamis, dan file lampiran (attachments).
    """
    kode_surat = serializers.CharField(max_length=50)
    payload_data = serializers.JSONField(default=dict)
    attachments = serializers.ListField(
        child=serializers.FileField(),
        required=False,
        allow_empty=True
    )

    def validate(self, data):
        kode_surat = data.get('kode_surat')
        payload = data.get('payload_data', {})
        
        # 1. Ambil konfigurasi SuratType dari database berdasarkan kode_surat
        try:
            surat_type = SuratType.objects.get(kode_surat=kode_surat)
        except SuratType.DoesNotExist:
            raise serializers.ValidationError(f"Jenis surat dengan kode '{kode_surat}' tidak ditemukan.")

        required_fields = surat_type.required_payload_fields 
        missing_fields = []

        for field_config in required_fields:
            # Ambil nama key-nya dari dictionary (misal: 'tujuan_keperluan')
            field_key = field_config.get('field') if isinstance(field_config, dict) else field_config
            
            # Cek apakah key tersebut ada di payload dan tidak kosong
            if field_key not in payload or not payload.get(field_key):
                missing_fields.append(field_key)

        if missing_fields:
            raise serializers.ValidationError({
                "payload_data": f"Field berikut wajib diisi: {', '.join(missing_fields)}"
            })
        # 3. Ambil object request dan profil mahasiswa
        request = self.context.get('request')
        if not request or not request.user.is_authenticated:
            raise serializers.ValidationError("Autentikasi diperlukan untuk mengajukan surat.")

        user = request.user
        try:
            student_profile = user.student_profile
            student_data = {
                "nim": student_profile.nim,
                "status_akademik": student_profile.status_akademik,
                "status_pembayaran_ukt": student_profile.status_pembayaran_ukt,
                "semester_aktif": student_profile.semester_aktif,
                "total_sks_lulus": student_profile.total_sks_lulus,
                "ipk_kumulatif": student_profile.ipk_kumulatif,
                "catatan_pelanggaran_etik": student_profile.catatan_pelanggaran_etik,
                "status_disiplin_kampus": student_profile.status_disiplin_kampus,
                "status_beasiswa_aktif": student_profile.status_beasiswa_aktif,
                "nama_beasiswa_aktif": student_profile.nama_beasiswa_aktif,
                "prodi": student_profile.prodi.nama_prodi, 
                "fakultas": student_profile.fakultas.nama_fakultas
            }
        except AttributeError:
            raise serializers.ValidationError("Akun ini tidak memiliki profil mahasiswa yang valid.")

        # 4. Ambil data KRS/mata kuliah jika dibutuhkan
        student_courses_data = list(
            student_profile.courses_taken.values("student_id","course_id", "semester_taken", "status_krs")
        )

        # 5. Jalankan validator bisnis (Global Check + Specific Check)
        run_validators(
            kode_surat=kode_surat,
            student_data=student_data,
            payload=payload,
            student_courses_data=student_courses_data
        )

        return data

class SuratApprovalActionSerializer(serializers.Serializer):
    """Serializer untuk input catatan opsional saat Dosen melakukan APPROVE"""
    catatan = serializers.CharField(required=False, allow_blank=True, allow_null=True)


class SuratRejectActionSerializer(serializers.Serializer):
    """Serializer untuk input alasan wajib saat Dosen melakukan REJECT"""
    alasan_penolakan = serializers.CharField(required=True, allow_blank=False)


# ==============================================================================
# 2. SERIALIZERS UNTUK OUTPUT (READ / RESPONSE / DETAIL)
# ==============================================================================

class SuratTypeSerializer(serializers.ModelSerializer):
    """Serializer output untuk master data jenis surat (misal untuk pilihan dropdown frontend)"""
    class Meta:
        model = SuratType
        fields = ['kode_surat', 'nama_surat', 'kategori', 'is_auto_approval', 'template_path']


class SuratAttachmentSerializer(serializers.ModelSerializer):
    """Serializer output untuk file lampiran mahasiswa"""
    class Meta:
        model = SuratAttachment
        fields = ['id', 'nama_dokumen', 'file_url', 'mime_type', 'created_at']


class TteSignatureSerializer(serializers.ModelSerializer):
    """Serializer output untuk informasi TTE & QR Code verifikasi"""
    signer_name = serializers.CharField(source='signer.user.nama', read_only=True, default="Sistem Otomatis")
    signer_nip = serializers.CharField(source='signer.user.nip_nim', read_only=True, default=None)

    class Meta:
        model = TteSignature
        fields = ['id', 'signer_name', 'signer_nip', 'hash_document', 'token', 'created_at']


class SuratApprovalSerializer(serializers.ModelSerializer):
    """Serializer output untuk timeline antrean persetujuan dosen/pejabat"""
    approver_name = serializers.CharField(source='approver.user.nama', read_only=True, default=None)
    approver_nip = serializers.CharField(source='approver.user.nip_nim', read_only=True, default=None)

    class Meta:
        model = SuratApproval
        fields = [
            'id',
            'step_order',
            'approver',
            'approver_name',
            'approver_nip',
            'status',
            'catatan',
            'created_at'
        ]


class SuratAuditLogSerializer(serializers.ModelSerializer):
    """Serializer output untuk rekam jejak aktivitas (audit log) surat"""
    class Meta:
        model = SuratAuditLog
        fields = ['id', 'action_id', 'action', 'created_at']


class SuratRequestListSerializer(serializers.ModelSerializer):
    """Serializer output ringkas untuk menampilkan daftar riwayat surat di dashboard"""
    nama_surat = serializers.CharField(source='kode_surat.nama_surat', read_only=True)
    kategori = serializers.CharField(source='kode_surat.kategori', read_only=True)
    nim_mahasiswa = serializers.CharField(source='student.nim', read_only=True)
    nama_mahasiswa = serializers.CharField(source='student.user.nama', read_only=True)

    class Meta:
        model = SuratRequest
        fields = [
            'id',
            'nim_mahasiswa',
            'nama_mahasiswa',
            'kode_surat',
            'nama_surat',
            'kategori',
            'nomor_surat_resmi',
            'status',
            'created_at'
        ]


class SuratRequestDetailSerializer(serializers.ModelSerializer):
    """
    Serializer output detail lengkap berikut seluruh relasi bersarang (nested) 
    seperti lampiran, timeline approval, TTE, dan audit logs.
    """
    nama_surat = serializers.CharField(source='kode_surat.nama_surat', read_only=True)
    nama_mahasiswa = serializers.CharField(source='student.user.nama', read_only=True)
    nim_mahasiswa = serializers.CharField(source='student.nim', read_only=True)
    prodi_mahasiswa = serializers.CharField(source='student.prodi.nama_prodi', read_only=True)
    fakultas_mahasiswa = serializers.CharField(source='student.fakultas.nama_fakultas', read_only=True)
    
    # Nested relasi menggunakan related_name dari models_3.py kita
    attachments = SuratAttachmentSerializer(many=True, read_only=True)
    approvals = SuratApprovalSerializer(many=True, read_only=True)
    signatures = TteSignatureSerializer(many=True, read_only=True)
    audit_logs = SuratAuditLogSerializer(many=True, read_only=True)

    class Meta:
        model = SuratRequest
        fields = [
            'id',
            'nim_mahasiswa',
            'nama_mahasiswa',
            'prodi_mahasiswa',
            'fakultas_mahasiswa',
            'kode_surat',
            'nama_surat',
            'nomor_surat_resmi',
            'status',
            'payload_data',
            'file_pdf_url',
            'qr_verification_code',
            'created_at',
            'attachments',
            'approvals',
            'signatures',
            'audit_logs'
        ]
        
# serializers.py
class SuratRequestSuccessResponseSerializer(serializers.Serializer):
    status = serializers.CharField(default="success")
    message = serializers.CharField(default="Pengajuan surat berhasil dibuat.")
    data = serializers.DictField(default={"request_id": 123, "nomor_surat": "B/123/UNIV/2026"})