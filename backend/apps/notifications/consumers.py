"""WebSocket consumers for restaurant-scoped real-time events."""

from __future__ import annotations

import logging

from channels.db import database_sync_to_async
from channels.generic.websocket import AsyncJsonWebsocketConsumer

from apps.restaurants.models import Restaurant, RestaurantMembership

logger = logging.getLogger("apps")


class RestaurantEventsConsumer(AsyncJsonWebsocketConsumer):
    """Streams order/table events to authenticated staff of one restaurant.

    Connect: ``/ws/restaurants/<slug>/events/?token=<jwt>``
    Group:   ``restaurant.<slug>``
    """

    group_name: str | None = None

    async def connect(self):
        user = self.scope.get("user")
        slug = self.scope["url_route"]["kwargs"]["slug"]

        if not user or not user.is_authenticated:
            await self.close(code=4401)
            return

        allowed = await self._is_member(user, slug)
        if not allowed:
            await self.close(code=4403)
            return

        self.group_name = f"restaurant.{slug}"
        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.accept()

    async def disconnect(self, close_code):
        if self.group_name:
            await self.channel_layer.group_discard(self.group_name, self.channel_name)

    @database_sync_to_async
    def _is_member(self, user, slug: str) -> bool:
        try:
            restaurant = Restaurant.objects.get(slug=slug)
        except Restaurant.DoesNotExist:
            return False
        return RestaurantMembership.objects.filter(
            restaurant=restaurant, user=user, is_active=True
        ).exists()

    async def receive_json(self, content, **kwargs):  # pragma: no cover
        # Staff dashboards are receive-only; ignore client-sent messages.
        return

    # Handlers for group events (type="order.event" -> order_event)
    async def order_event(self, event):
        await self.send_json({"type": "order", "payload": event.get("payload", {})})

    async def table_event(self, event):
        await self.send_json({"type": "table", "payload": event.get("payload", {})})

    async def notification_event(self, event):
        await self.send_json({"type": "notification", "payload": event.get("payload", {})})
