"""WebSocket URL routing."""

from django.urls import re_path

from .consumers import RestaurantEventsConsumer

websocket_urlpatterns = [
    re_path(
        r"^ws/restaurants/(?P<slug>[\w-]+)/events/$",
        RestaurantEventsConsumer.as_asgi(),
    ),
]
