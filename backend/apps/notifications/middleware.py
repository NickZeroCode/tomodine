"""WebSocket JWT authentication middleware for Channels."""

from __future__ import annotations

import logging
from urllib.parse import parse_qs

from channels.auth import AuthMiddlewareStack
from channels.db import database_sync_to_async
from django.contrib.auth import get_user_model
from django.contrib.auth.models import AnonymousUser
from rest_framework_simplejwt.exceptions import TokenError
from rest_framework_simplejwt.tokens import AccessToken

User = get_user_model()
logger = logging.getLogger("apps")


@database_sync_to_async
def _user_from_token(raw_token: str):
    try:
        token = AccessToken(raw_token)
        return User.objects.get(id=token["user_id"])
    except (TokenError, KeyError, User.DoesNotExist) as exc:
        logger.info("WebSocket JWT rejected: %s", exc)
        return AnonymousUser()


class JwtAuthMiddleware:
    """Authenticate a WebSocket via ``?token=<access>`` query param."""

    def __init__(self, inner):
        self.inner = inner

    async def __call__(self, scope, receive, send):
        query = parse_qs(scope.get("query_string", b"").decode())
        raw_token = (query.get("token") or [None])[0]
        scope["user"] = (
            await _user_from_token(raw_token) if raw_token else AnonymousUser()
        )
        return await self.inner(scope, receive, send)


def JwtAuthMiddlewareStack(inner):
    return JwtAuthMiddleware(AuthMiddlewareStack(inner))
