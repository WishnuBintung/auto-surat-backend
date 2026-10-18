from rest_framework import serializers

class LoginSerializer(serializers.Serializer):
    nip_nim = serializers.CharField(required=True)
    password = serializers.CharField(required=True, write_only=True)