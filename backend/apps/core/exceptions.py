"""Centralised API exception handling.

Returns a consistent, localization-friendly error envelope and never leaks
raw stack traces or internals to clients.
"""

from __future__ import annotations

import logging
from typing import Any

from django.core.exceptions import PermissionDenied as DjangoPermissionDenied
from django.http import Http404
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import exception_handler

logger = logging.getLogger("apps")


def _flatten_errors(detail: Any) -> dict[str, Any]:
    if isinstance(detail, dict):
        return {key: _flatten_errors(value) for key, value in detail.items()}
    if isinstance(detail, (list, tuple)):
        return {"errors": [str(item) for item in detail]}
    return {"errors": [str(detail)]}


def api_exception_handler(exc: Exception, context: dict[str, Any]) -> Response | None:
    if isinstance(exc, Http404):
        return Response(
            {"code": "not_found", "message": "Resource not found.", "errors": {}},
            status=status.HTTP_404_NOT_FOUND,
        )
    if isinstance(exc, DjangoPermissionDenied):
        # Detect plan-gating exceptions — surface a machine-readable code
        # and the user-facing message so the frontend can show an upgrade
        # prompt instead of a bare "permission denied".
        if getattr(exc, "plan_gate", False):
            return Response(
                {
                    "code": "plan_upgrade_required",
                    "message": str(exc),
                    "errors": {},
                },
                status=status.HTTP_403_FORBIDDEN,
            )
        return Response(
            {"code": "permission_denied", "message": str(exc) or "You do not have permission.", "errors": {}},
            status=status.HTTP_403_FORBIDDEN,
        )

    response = exception_handler(exc, context)
    if response is None:
        logger.exception("Unhandled API exception: %s", exc)
        import traceback as tb
        return Response(
            {
                "code": "server_error",
                "message": str(exc) or "An unexpected error occurred.",
                "errors": {"traceback": [tb.format_exc()]},
            },
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )

    payload: dict[str, Any] = {
        "code": getattr(exc, "default_code", "error"),
        "message": "Request failed.",
        "errors": {},
    }

    detail = response.data
    if isinstance(detail, dict) and "detail" in detail:
        payload["message"] = str(detail["detail"])
        remaining = {k: v for k, v in detail.items() if k != "detail"}
        if remaining:
            payload["errors"] = _flatten_errors(remaining)
    else:
        payload["errors"] = _flatten_errors(detail)
        # Surface first field error as the headline message when available.
        try:
            first = next(iter(payload["errors"].values()))
            if isinstance(first, dict) and first.get("errors"):
                payload["message"] = first["errors"][0]
        except (StopIteration, AttributeError):
            pass

    response.data = payload
    return response
