"""ASGI config — HTTP + WebSocket routing via Channels."""

import os

from channels.routing import ProtocolTypeRouter, URLRouter
from django.core.asgi import get_asgi_application

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")

django_asgi_app = get_asgi_application()

from apps.notifications import routing as notifications_routing  # noqa: E402
from apps.notifications.middleware import JwtAuthMiddlewareStack  # noqa: E402

application = ProtocolTypeRouter(
    {
        "http": django_asgi_app,
        "websocket": JwtAuthMiddlewareStack(
            URLRouter(notifications_routing.websocket_urlpatterns)
        ),
    }
)
