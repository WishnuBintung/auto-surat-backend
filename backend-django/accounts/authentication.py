# accounts/authentication.py
from rest_framework_simplejwt.authentication import JWTAuthentication
from .models import User

class CustomJWTAuthentication(JWTAuthentication):
    def get_user(self, validated_token):
        try:
            user_id = validated_token.get('user_id')
            if not user_id:
                return None
            
            user = User.objects.get(pk=user_id)
            
            # Tambahkan atribut dinamis agar DRF mengenalinya sebagai user yang terautentikasi
            user.is_authenticated = True
            return user
        except User.DoesNotExist:
            return None