# apps/accounts/backends.py
from django.contrib.auth.backends import BaseBackend
from django.contrib.auth.hashers import check_password
from .models import User

class CustomUserAuthBackend(BaseBackend):
    """
    Custom Backend agar Django dan SimpleJWT bisa mengenali model User biasa (bukan AbstractUser).
    """
    def authenticate(self, request, username=None, password=None, **kwargs):
        # 'username' di sini akan menerima nilai dari field 'nip_nim' yang dikirim saat login
        identifier = username or kwargs.get('nip_nim')
        if not identifier or not password:
            return None

        try:
            user = User.objects.get(nip_nim=identifier)
        except User.DoesNotExist:
            return None

        # Cek kecocokan password (mendukung hash django atau teks biasa dari seed lama)
        is_valid = check_password(password, user.password) if user.password.startswith('pbkdf2_') else (user.password == password)

        if is_valid:
            return user
        return None

    def get_user(self, user_id):
        try:
            return User.objects.get(pk=user_id)
        except User.DoesNotExist:
            return None