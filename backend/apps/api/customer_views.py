"""Public, unauthenticated customer-facing ordering API.

Customers arrive via a table QR token. These endpoints are deliberately
narrow and never expose internal PKs beyond the opaque QR/session tokens.
"""

from __future__ import annotations

from django.shortcuts import get_object_or_404
from django.utils.translation import gettext as _
from rest_framework import permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.menus.models import Menu
from apps.notifications.services import broadcast_to_restaurant
from apps.ordering.models import Cart, CartItem, CustomerSession, Order
from apps.ordering.services import create_order_from_cart
from apps.tables.models import QRCode

from .customer_serializers import (
    AddCartItemSerializer,
    CustomerMenuSerializer,
    CustomerOrderSerializer,
    PublicSessionSerializer,
)


def _resolve_qr(token: str) -> QRCode:
    return get_object_or_404(
        QRCode.objects.select_related("restaurant", "table"),
        token=token,
        is_active=True,
    )


class CustomerOrderingViewSet(viewsets.ViewSet):
    permission_classes = (permissions.AllowAny,)

    @action(detail=False, methods=["post"], url_path="session")
    def start_session(self, request):
        """Establish (or resume) a customer session from a QR token.

        Each device gets its own session (keyed by ``device_id``), so
        multiple people at the same table can order independently.
        """
        token = request.data.get("qr_token", "")
        device_id = (request.data.get("device_id") or "").strip()
        language = request.data.get("language", "en")
        party_size = int(request.data.get("party_size", 1) or 1)
        if language not in {"en", "bn"}:
            language = "en"

        qr = _resolve_qr(token)

        # Build the lookup filter — prefer device-scoped session, then
        # fall back to the legacy (no device_id) session so old clients
        # still work.
        lookup = dict(restaurant=qr.restaurant, table=qr.table, is_active=True)
        if device_id:
            session = CustomerSession.objects.filter(device_id=device_id, **lookup).first()
        else:
            session = None
        if session is None:
            session = CustomerSession.objects.create(
                restaurant=qr.restaurant,
                table=qr.table,
                device_id=device_id,
                language=language,
                party_size=max(party_size, 1),
            )
        else:
            if language and session.language != language:
                session.language = language
                session.save(update_fields=("language", "updated_at"))

        Cart.objects.get_or_create(restaurant=qr.restaurant, session=session)
        return Response(PublicSessionSerializer(session).data, status=status.HTTP_200_OK)

    @action(detail=False, methods=["get"], url_path="menu")
    def menu(self, request):
        """Return the active menu for the restaurant owning this QR token."""
        token = request.query_params.get("qr_token", "")
        qr = _resolve_qr(token)
        menus = (
            Menu.objects.filter(restaurant=qr.restaurant, is_active=True)
            .prefetch_related(
                "categories__dishes__variants", "categories__dishes__modifiers"
            )
            .order_by("display_order")
        )
        def _abs_url(request, field):
            """Build an absolute URL for an ImageField (works with S3 and local).

            For S3: returns the full S3 URL.
            For local storage: converts to a base64 data URI so the
            frontend can render it without needing nginx media proxy.
            """
            if not field:
                return None
            try:
                url = field.url
            except ValueError:
                return None
            if not url:
                return None
            # S3 or already absolute — return as-is.
            if url.startswith(("http://", "https://", "data:")):
                return url
            # Check if S3 is configured.
            from django.conf import settings
            if getattr(settings, "AWS_STORAGE_BUCKET_NAME", None):
                return url  # S3 URLs are already absolute.
            # Local storage — convert to base64 data URI.
            if hasattr(field, "path"):
                try:
                    import base64, mimetypes
                    with open(field.path, "rb") as f:
                        encoded = base64.b64encode(f.read()).decode()
                    mime = mimetypes.guess_type(field.path)[0] or "image/png"
                    return f"data:{mime};base64,{encoded}"
                except (FileNotFoundError, OSError):
                    return None
            return request.build_absolute_uri(url)

        return Response(
            {
                "restaurant": {
                    "name": qr.restaurant.name,
                    "slug": qr.restaurant.slug,
                    "currency": qr.restaurant.currency,
                    "logo": _abs_url(request, qr.restaurant.logo),
                    "cover_image": _abs_url(request, qr.restaurant.cover_image),
                },
                "table": {"number": qr.table.number, "label": qr.table.label},
                "menus": CustomerMenuSerializer(menus, many=True).data,
            }
        )

    @action(detail=False, methods=["post"], url_path="cart/items")
    def add_cart_item(self, request):
        serializer = AddCartItemSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        session = get_object_or_404(
            CustomerSession, token=data["session_token"], is_active=True
        )
        cart, _ = Cart.objects.get_or_create(restaurant=session.restaurant, session=session)

        unit_price = data["dish"].price
        if data.get("variant"):
            unit_price += data["variant"].price_delta

        item = CartItem.objects.create(
            cart=cart,
            dish=data["dish"],
            variant=data.get("variant"),
            quantity=data["quantity"],
            special_instructions=data.get("special_instructions", ""),
            unit_price=unit_price,
        )
        return Response({"id": str(item.id)}, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=["post"], url_path="order")
    def place_order(self, request):
        session_token = request.data.get("session_token", "")
        note = request.data.get("customer_note", "")
        order_type = request.data.get("order_type", "dine_in")
        if order_type not in ("dine_in", "take_away"):
            order_type = "dine_in"
        session = get_object_or_404(
            CustomerSession.objects.select_related("restaurant", "table"),
            token=session_token,
            is_active=True,
        )
        from apps.billing.entitlements import get_entitlements

        if not get_entitlements(session.restaurant).entitled:
            return Response(
                {"detail": "This restaurant is not currently accepting orders."},
                status=status.HTTP_403_FORBIDDEN,
            )
        try:
            order = create_order_from_cart(session, customer_note=note, order_type=order_type)
        except ValueError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)

        broadcast_to_restaurant(
            order.restaurant.slug,
            "order.event",
            {
                "order_id": str(order.id),
                "order_number": order.order_number,
                "status": order.status,
                "table": order.table.number if order.table else None,
            },
        )
        from apps.notifications.models import Notification
        from apps.notifications.services import notify_restaurant

        table_label = (order.table.label or order.table.number) if order.table else ""
        notify_restaurant(
            order.restaurant,
            kind=Notification.Kind.NEW_ORDER,
            title_en=f"New order #{order.order_number}",
            title_bn=f"নতুন অর্ডার #{order.order_number}",
            body_en=f"Table {table_label}" if table_label else "",
            body_bn=f"টেবিল {table_label}" if table_label else "",
            metadata={"order_id": str(order.id), "order_number": order.order_number},
        )
        return Response(CustomerOrderSerializer(order).data, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=["get"], url_path="order/status")
    def order_status(self, request):
        session_token = request.query_params.get("session_token", "")
        order_id = request.query_params.get("order_id", "")
        session = get_object_or_404(
            CustomerSession, token=session_token, is_active=True
        )
        order = get_object_or_404(Order, id=order_id, session=session)
        return Response(CustomerOrderSerializer(order).data)

    @action(detail=False, methods=["get"], url_path="orders")
    def list_orders(self, request):
        """Return all orders for this table today (most recent first).

        Uses the session to resolve the table, then returns ALL orders
        at that table today — so bot-placed orders also appear.
        Falls back gracefully if the session is inactive.
        """
        session_token = request.query_params.get("session_token", "")
        session = CustomerSession.objects.filter(token=session_token).first()

        if not session:
            return Response([])

        orders = (
            Order.objects.filter(
                restaurant=session.restaurant,
                table=session.table,
                created_at__date=session.created_at.date(),
            )
            .prefetch_related("items")
            .exclude(status__in=["cancelled", "rejected"])
            .order_by("-created_at")[:30]
        )
        return Response(CustomerOrderSerializer(orders, many=True).data)

    @action(detail=False, methods=["get"], url_path="offers")
    def list_offers(self, request):
        """Return active offers for the restaurant owning this QR token."""
        token = request.query_params.get("qr_token", "")
        qr = _resolve_qr(token)
        from django.db.models import Q
        from django.utils import timezone

        from apps.billing.models import Offer
        from apps.api.serializers import OfferSerializer

        now = timezone.now()
        offers = Offer.objects.filter(
            restaurant=qr.restaurant,
            is_active=True,
        ).filter(
            Q(start_date__isnull=True) | Q(start_date__lte=now),
        ).filter(
            Q(end_date__isnull=True) | Q(end_date__gte=now),
        )
        return Response(OfferSerializer(offers, many=True).data)

    @action(detail=False, methods=["post"], url_path="order/cancel")
    def cancel_order(self, request):
        """Cancel an order — only allowed while status is NEW (before the
        restaurant accepts or starts preparing)."""
        session_token = request.data.get("session_token", "")
        order_id = request.data.get("order_id", "")
        session = get_object_or_404(
            CustomerSession, token=session_token, is_active=True
        )
        order = get_object_or_404(Order, id=order_id, session=session)

        if order.status != Order.Status.NEW:
            return Response(
                {"detail": "This order can no longer be cancelled."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        from apps.ordering.services import transition_order_status

        try:
            order = transition_order_status(
                order=order,
                to_status=Order.Status.CANCELLED,
                note="Cancelled by customer",
            )
        except ValueError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)

        broadcast_to_restaurant(
            order.restaurant.slug,
            "order.event",
            {
                "order_id": str(order.id),
                "order_number": order.order_number,
                "status": order.status,
                "table": order.table.number if order.table else None,
            },
        )
        return Response(CustomerOrderSerializer(order).data)

    @action(detail=False, methods=["post"], url_path="call-waiter")
    def call_waiter(self, request):
        """Send a table-alert notification so the dashboard shows a popup."""
        session_token = request.data.get("session_token", "")
        session = get_object_or_404(
            CustomerSession.objects.select_related("restaurant", "table"),
            token=session_token,
            is_active=True,
        )
        from apps.notifications.models import Notification
        from apps.notifications.services import notify_restaurant

        table_label = session.table.label or session.table.number
        notify_restaurant(
            session.restaurant,
            kind=Notification.Kind.TABLE_ALERT,
            title_en=f"Waiter needed at table {table_label}",
            title_bn=f"টেবিল {table_label}-এ ওয়েটার দরকার",
            body_en=f"Table {table_label} is calling for a waiter",
            body_bn=f"টেবিল {table_label} থেকে ওয়েটার ডাকা হয়েছে",
            metadata={"table": table_label},
        )
        return Response({"detail": "Waiter notified."}, status=status.HTTP_200_OK)
