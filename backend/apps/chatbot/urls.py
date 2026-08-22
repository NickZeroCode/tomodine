"""Chatbot URL routing."""

from django.urls import path

from .views import ChatAPIView, EmbeddingSyncAPIView, SessionResetAPIView

urlpatterns = [
    path("chat/", ChatAPIView.as_view(), name="chatbot-chat"),
    path("chat/reset/", SessionResetAPIView.as_view(), name="chatbot-reset"),
    path("chat/sync-embeddings/", EmbeddingSyncAPIView.as_view(), name="chatbot-sync"),
]
