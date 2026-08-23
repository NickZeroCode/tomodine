"""Chat API views — POST /api/v1/chat/ and /api/v1/chat/reset/."""

from __future__ import annotations

import logging
import time
import uuid

from django.core.cache import cache
from rest_framework import status
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.chatbot.serializers import ChatRequestSerializer, SessionResetSerializer
from apps.chatbot.services import memory

logger = logging.getLogger(__name__)

RATE_LIMIT = 30  # requests per window
RATE_WINDOW = 60  # seconds


def _check_rate_limit(key: str) -> bool:
    """Return True if the request is allowed, False if rate-limited."""
    cache_key = f"chatbot:rl:{key}"
    count = cache.get(cache_key, 0)
    if count >= RATE_LIMIT:
        return False
    cache.set(cache_key, count + 1, RATE_WINDOW)
    return True


class ChatAPIView(APIView):
    """Process a message through the AI Concierge.

    Branch resolution:
    1. Authenticated user → X-Branch-ID header (JWT claims)
    2. Customer (QR)     → X-Restaurant-Slug header + table_id body
    """

    permission_classes = [AllowAny]

    def post(self, request):
        # Rate limit by IP + session.
        rate_key = request.META.get("REMOTE_ADDR", "unknown")
        if not _check_rate_limit(rate_key):
            return Response(
                {"error": "Too many requests. Please wait a moment."},
                status=status.HTTP_429_TOO_MANY_REQUESTS,
            )

        serializer = ChatRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        message = serializer.validated_data["message"]
        session_id = serializer.validated_data.get("session_id") or str(uuid.uuid4())
        table_id_raw = serializer.validated_data.get("table_id") or None

        # Resolve the branch/restaurant and normalise table_id to a UUID.
        restaurant, table_id = self._resolve(request, table_id_raw)

        # Run the agent.
        from apps.chatbot.agent import chat

        if restaurant is None:
            # No restaurant context — system-info mode (landing page chatbot).
            try:
                result = chat(
                    restaurant=None,
                    session_id=session_id,
                    user_message=message,
                    table_id=None,
                )
            except Exception:
                logger.exception("Chat agent error (system-info mode)")
                return Response(
                    {
                        "success": False,
                        "response": "I'm having trouble right now. Please try again.",
                        "session_id": session_id,
                    },
                    status=status.HTTP_500_INTERNAL_SERVER_ERROR,
                )
            return Response(result)

        try:
            result = chat(
                restaurant=restaurant,
                session_id=session_id,
                user_message=message,
                table_id=table_id,
            )
        except Exception:
            logger.exception("Chat agent error")
            return Response(
                {
                    "success": False,
                    "response": "I'm having trouble right now. Please try again.",
                    "session_id": session_id,
                },
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        return Response(result)

    def _resolve(self, request, table_id_raw: str | None):
        """Resolve restaurant and normalise table_id to a UUID.

        Accepts either a UUID table_id or a QR token string.
        Returns (restaurant, table_id | None).
        """
        from apps.restaurants.models import Restaurant

        table_id: str | None = None
        restaurant = None

        # 1. Try to resolve table_id / QR token first (gives us both restaurant + table).
        if table_id_raw:
            table_id, restaurant = self._resolve_table(table_id_raw)

        # 2. Explicit X-Branch-ID header.
        if not restaurant:
            branch_id = request.headers.get("X-Branch-ID")
            if branch_id:
                restaurant = Restaurant.objects.filter(pk=branch_id, status="active").first()

        # 3. X-Restaurant-Slug header.
        if not restaurant:
            slug = request.headers.get("X-Restaurant-Slug")
            if slug:
                restaurant = Restaurant.objects.filter(slug=slug, status="active").first()

        # 4. From authenticated user's active branch.
        if not restaurant and request.user and request.user.is_authenticated:
            from apps.restaurants.models import RestaurantMembership
            membership = (
                RestaurantMembership.objects.filter(user=request.user, is_active=True)
                .select_related("restaurant")
                .first()
            )
            if membership:
                restaurant = membership.restaurant

        return restaurant, table_id

    @staticmethod
    def _resolve_table(raw: str) -> tuple[str | None, "Restaurant | None"]:
        """Try to resolve `raw` as a UUID table_id or a QR token.

        Returns (table_id_uuid, restaurant) — either may be None.
        """
        from apps.tables.models import QRCode, Table

        # A) Try as a direct UUID primary key.
        try:
            table = Table.objects.select_related("restaurant").filter(pk=raw).first()
            if table:
                return str(table.id), table.restaurant
        except Exception:
            pass

        # B) Try as a QR token.
        qr = (
            QRCode.objects.select_related("table__restaurant")
            .filter(token=raw, is_active=True)
            .first()
        )
        if qr and qr.table:
            return str(qr.table_id), qr.table.restaurant

        return None, None


class SessionResetAPIView(APIView):
    """Clear a conversation session."""

    permission_classes = [AllowAny]

    def post(self, request):
        serializer = SessionResetSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        session_id = serializer.validated_data["session_id"]
        branch_id = request.headers.get("X-Branch-ID", "default")
        org_id = "default"

        if request.user and request.user.is_authenticated:
            org_id = str(getattr(request.user, "organization_id", "default")) or "default"

        memory.clear_history(org_id, branch_id, session_id)

        new_session_id = str(uuid.uuid4())
        return Response({
            "success": True,
            "message": "Session reset.",
            "new_session_id": new_session_id,
        })


class EmbeddingSyncAPIView(APIView):
    """Trigger embedding sync for a branch (admin/owner only)."""

    def post(self, request):
        branch_id = request.headers.get("X-Branch-ID")
        if not branch_id:
            return Response({"error": "X-Branch-ID required"}, status=status.HTTP_400_BAD_REQUEST)

        from apps.chatbot.services.embedding import sync_all_embeddings

        try:
            count = sync_all_embeddings(branch_id)
        except Exception:
            logger.exception("Embedding sync failed")
            return Response(
                {"error": "Sync failed."},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        return Response({"success": True, "synced": count})
