from rest_framework import serializers

class LoginSerializer(serializers.Serializer):
    nip_nim = serializers.CharField(required=True)
    password = serializers.CharField(required=True, write_only=True)
    
class StandardErrorResponseSerializer(serializers.Serializer):
    status = serializers.CharField(default="error")
    message = serializers.CharField(default="Terjadi kesalahan.")
    errors = serializers.DictField(
        child=serializers.ListField(child=serializers.CharField()),
        default={"field": ["Pesan error di sini."]}
    )   
    
class UserInfoSerializer(serializers.Serializer):
    id = serializers.IntegerField(default=1)
    nama = serializers.CharField(default="Budi Santoso")
    nip_nim = serializers.CharField(default="199801012023011001")
    role = serializers.CharField(default="mahasiswa")   
class LoginResponseSuccessSerializer(serializers.Serializer):
    status = serializers.CharField(default="success")
    message = serializers.CharField(default="Login berhasil")
    access = serializers.CharField(default="eyJhbGciOi...")
    refresh = serializers.CharField(default="eyJhbGciOi...")
    user = UserInfoSerializer() 
class GetMeResponseSerializer(serializers.Serializer):
    id = serializers.IntegerField(default=1)
    nama = serializers.CharField(default="Budi Santoso")
    nip_nim = serializers.CharField(default="M0519001")
    role = serializers.CharField(default="STUDENT")
    profile = serializers.DictField(
        help_text="Berisi objek profil sesuai role (Student/Lecturer) atau {} jika kosong",
        default={
            "nim": "M0519001",
            "prodi": "Informatika",
            "fakultas": "Fakultas Teknologi Informasi dan Data Science"
        }
    )


# --- SERIALIZERS UNTUK LOGOUT ---
class LogoutRequestSerializer(serializers.Serializer):
    refresh = serializers.CharField(
        required=True, 
        help_text="Refresh token yang akan dimasukkan ke blacklist"
    )

class LogoutSuccessSerializer(serializers.Serializer):
    message = serializers.CharField(default="Logout berhasil. Sesi telah diakhiri.")
    status = serializers.CharField(default="success")