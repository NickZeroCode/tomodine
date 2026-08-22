"""Chat API serializers."""

from rest_framework import serializers


class ChatRequestSerializer(serializers.Serializer):
    message = serializers.CharField(required=True, max_length=2000)
    session_id = serializers.CharField(required=False, allow_blank=True)
    table_id = serializers.UUIDField(required=False)


class SessionResetSerializer(serializers.Serializer):
    session_id = serializers.CharField(required=True)
