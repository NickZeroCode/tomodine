"""Chat API views — POST /api/v1/chat/ and /api/v1/chat/reset/."""

from __future__ import annotations

import logging
import uuid

from rest_framework import status
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.chatbot.serializers import ChatRequestSerializer, SessionResetSerializer
from apps.chatbot.services import memory

logger = logging.getLogger(__name__)


class ChatAPIView(APIView):
    """Process a message through the AI Concierge.

    Branch resolution:
    1. Authenticated user → X-Branch-ID header (JWT claims)
    2. Customer (QR)     → X-Restaurant-Slug header + table_id body
    """

    permission_classes = [AllowAny]

    def post(self, request):
        serializer = ChatRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        message = serializer.validated_data["message"]
        session_id = serializer.validated_data.get("session_id") or str(uuid.uuid4())
        table_id = str(serializer.validated_data["table_id"]) if serializer.validated_data.get("table_id") else None

        # Resolve the branch/restaurant.
        restaurant = self._resolve_restaurant(request, table_id)
        if restaurant is None:
            return Response(
                {"error": "Could not determine the restaurant. Provide X-Branch-ID or X-Restaurant-Slug."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Run the agent.
        from apps.chatbot.agent import chat

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

    def _resolve_restaurant(self, request, table_id: str | None):
        """Resolve the restaurant from headers, table_id, or auth."""
        from apps.restaurants.models import Restaurant

        # 1. Explicit X-Branch-ID header.
        branch_id = request.headers.get("X-Branch-ID")
        if branch_id:
            return Restaurant.objects.filter(pk=branch_id, status="active").first()

        # 2. X-Restaurant-Slug header.
        slug = request.headers.get("X-Restaurant-Slug")
        if slug:
            return Restaurant.objects.filter(slug=slug, status="active").first()

        # 3. From table_id.
        if table_id:
            from apps.tables.models import Table
            table = Table.objects.filter(pk=table_id).select_related("restaurant").first()
            if table:
                return table.restaurant

        # 4. From authenticated user's active branch.
        if request.user and request.user.is_authenticated:
            from apps.restaurants.models import RestaurantMembership
            membership = (
                RestaurantMembership.objects.filter(
                    user=request.user,
                    is_active=True,
                )
                .select_related("restaurant")
                .first()
            )
            if membership:
                return membership.restaurant

        return None


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
