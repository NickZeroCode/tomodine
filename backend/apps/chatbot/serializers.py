"""Chat API serializers."""

from rest_framework import serializers


class ChatRequestSerializer(serializers.Serializer):
    message = serializers.CharField(required=True, max_length=2000)
    session_id = serializers.CharField(required=False, allow_blank=True)
    # Accept either a UUID table_id or a QR token string.
    table_id = serializers.CharField(required=False, allow_blank=True, max_length=200)
    # Customer session token for order isolation.
    session_token = serializers.CharField(required=False, allow_blank=True, max_length=200)


class SessionResetSerializer(serializers.Serializer):
    session_id = serializers.CharField(required=True)
