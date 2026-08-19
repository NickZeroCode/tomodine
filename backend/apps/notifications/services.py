"""Helpers to broadcast events to a restaurant's realtime channel group."""

from __future__ import annotations

import logging
from typing import Any

from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer

logger = logging.getLogger("apps")


def broadcast_to_restaurant(slug: str, event_type: str, payload: dict[str, Any]) -> None:
    """Publish an event to all connected staff of a restaurant.

    Failures are logged, never raised, so a broken broker never breaks the
    synchronous request path.
    """
    channel_layer = get_channel_layer()
    if channel_layer is None:
        return
    try:
        async_to_sync(channel_layer.group_send)(
            f"restaurant.{slug}",
            {"type": event_type, "payload": payload},
        )
    except Exception as exc:  # pragma: no cover - defensive
        logger.warning("Realtime broadcast failed for %s: %s", slug, exc)


def notify_restaurant(
    restaurant,
    *,
    kind: str,
    title_en: str,
    title_bn: str = "",
    body_en: str = "",
    body_bn: str = "",
    metadata: dict[str, Any] | None = None,
) -> None:
    """Persist a Notification and push it to the restaurant's live channel.

    Persistence guarantees the notification is never lost even if no staff
    client is connected; the broadcast is best-effort and never raises.
    """
    from .models import Notification

    notification = Notification.objects.create(
        restaurant=restaurant,
        kind=kind,
        title_en=title_en,
        title_bn=title_bn,
        body_en=body_en,
        body_bn=body_bn,
        metadata=metadata or {},
    )
    broadcast_to_restaurant(
        restaurant.slug,
        "notification.event",
        {
            "id": str(notification.id),
            "kind": notification.kind,
            "title_en": notification.title_en,
            "title_bn": notification.title_bn,
            "body_en": notification.body_en,
            "body_bn": notification.body_bn,
            "is_read": notification.is_read,
            "created_at": notification.created_at.isoformat(),
        },
    )
