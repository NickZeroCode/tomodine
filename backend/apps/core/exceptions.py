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
        return Response(
            {"code": "permission_denied", "message": "You do not have permission.", "errors": {}},
            status=status.HTTP_403_FORBIDDEN,
        )

    response = exception_handler(exc, context)
    if response is None:
        logger.exception("Unhandled API exception: %s", exc)
        return Response(
            {"code": "server_error", "message": "An unexpected error occurred.", "errors": {}},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )

    payload: dict[str, Any] = {
        "code": getattr(exc, "default_code", "error"),
        "message": "Request failed.",
        "errors": {},
    }

    # Surface plan-gating as a distinct, machine-readable code so the
    # frontend can show a meaningful upgrade prompt instead of a bare 403.
    if getattr(exc, "plan_gate", False):
        payload["code"] = "plan_upgrade_required"
        payload["message"] = str(exc)

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
