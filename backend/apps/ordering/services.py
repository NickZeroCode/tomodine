"""Order domain services — state machine and totals.

Business rules live here, not in views or serializers, so they are testable
and reusable across API and realtime paths.
"""

from __future__ import annotations

from decimal import Decimal

from django.db import transaction
from django.utils import timezone
from django.utils.translation import gettext as _

from .models import CustomerSession, Order, OrderItem, OrderStatusHistory

# Allowed status transitions for the staff workflow.
# Simplified pipeline: NEW → PREPARING → READY → SERVED → PAID.
# ACCEPTED is kept only so legacy orders in that state can still move forward.
_ALLOWED_TRANSITIONS: dict[str, set[str]] = {
    Order.Status.NEW: {Order.Status.PREPARING, Order.Status.REJECTED, Order.Status.CANCELLED},
    Order.Status.ACCEPTED: {Order.Status.PREPARING, Order.Status.CANCELLED},  # legacy
    Order.Status.PREPARING: {Order.Status.READY, Order.Status.CANCELLED},
    Order.Status.READY: {Order.Status.SERVED, Order.Status.CANCELLED},
    Order.Status.SERVED: {Order.Status.PAID},
    Order.Status.PAID: set(),
    Order.Status.REJECTED: set(),
    Order.Status.CANCELLED: set(),
}


def generate_order_number(restaurant) -> str:
    """Sequential per-restaurant, per-day order number (e.g. ``A-0001``)."""
    today = timezone.localdate()
    prefix = today.strftime("%y%m%d")
    count = Order.objects.filter(
        restaurant=restaurant, created_at__date=today
    ).count()
    return f"{prefix}-{count + 1:04d}"


@transaction.atomic
def create_order_from_cart(session: CustomerSession, customer_note: str = "", order_type: str = "dine_in") -> Order:
    """Convert a customer session's cart into a persisted order atomically."""
    cart = getattr(session, "cart", None)
    if cart is None:
        raise ValueError(_("This session has no cart."))

    items = list(cart.items.select_related("dish", "variant"))
    if not items:
        raise ValueError(_("The cart is empty."))

    subtotal = Decimal("0")
    order = Order.objects.create(
        restaurant=session.restaurant,
        table=session.table,
        session=session,
        order_number=generate_order_number(session.restaurant),
        customer_note=customer_note,
        order_type=order_type,
    )

    order_items: list[OrderItem] = []
    for item in items:
        line_total = item.unit_price * item.quantity
        subtotal += line_total
        order_items.append(
            OrderItem(
                order=order,
                dish_name_en=item.dish.name_en,
                dish_name_bn=item.dish.name_bn,
                # Store the storage-relative name (not a full URL) so the
                # serializer can resolve it against whatever storage is
                # active later (S3, local, etc.) without dead links.
                dish_image=item.dish.image.name if item.dish.image else "",
                min_prep_time=item.dish.min_prep_time,
                max_prep_time=item.dish.max_prep_time,
                variant_name=item.variant.name_en if item.variant else "",
                quantity=item.quantity,
                unit_price=item.unit_price,
                special_instructions=item.special_instructions,
            )
        )
    OrderItem.objects.bulk_create(order_items)

    order.subtotal = subtotal
    order.total = subtotal
    order.save(update_fields=("subtotal", "total", "updated_at"))

    OrderStatusHistory.objects.create(
        order=order, from_status="", to_status=Order.Status.NEW, note=_("Order placed")
    )

    # Deduct recipe ingredients from inventory (same transaction — atomic
    # with the order itself). Cart items carry the live dish FK; they are
    # captured BEFORE the cart is cleared below. Best-effort: never blocks
    # a placed order.
    try:
        from apps.inventory.services import deduct_for_order

        deduct_for_order(session.restaurant, order, items)
    except Exception:  # pragma: no cover — inventory must never break ordering
        import logging

        logging.getLogger(__name__).exception("Inventory deduction failed for order %s", order.pk)

    # Clear the cart after successful order creation.
    cart.items.all().delete()
    return order


@transaction.atomic
def transition_order_status(order: Order, to_status: str, changed_by=None, note: str = "") -> Order:
    """Validate and apply a status transition, writing an audit record."""
    if to_status not in Order.Status.values:
        raise ValueError(_("Unknown order status."))

    allowed = _ALLOWED_TRANSITIONS.get(order.status, set())
    if to_status not in allowed:
        raise ValueError(
            _("Cannot move order from %(from)s to %(to)s.")
            % {"from": order.status, "to": to_status}
        )

    from_status = order.status
    order.status = to_status
    order.save(update_fields=("status", "updated_at"))
    OrderStatusHistory.objects.create(
        order=order,
        from_status=from_status,
        to_status=to_status,
        changed_by=changed_by,
        note=note,
    )

    # Keep the table status roughly in sync for the floor view.
    if order.table_id:
        _sync_table_status(order)
    return order


def _sync_table_status(order: Order) -> None:
    from django.utils import timezone

    from apps.notifications.services import broadcast_to_restaurant
    from apps.tables.models import Table

    mapping = {
        Order.Status.NEW: Table.Status.ORDER_RECEIVED,
        Order.Status.ACCEPTED: Table.Status.PREPARING,
        Order.Status.PREPARING: Table.Status.PREPARING,
        Order.Status.READY: Table.Status.READY,
        Order.Status.SERVED: Table.Status.AWAITING_PAYMENT,
        Order.Status.PAID: Table.Status.AVAILABLE,
        Order.Status.CANCELLED: Table.Status.AVAILABLE,
        Order.Status.REJECTED: Table.Status.AVAILABLE,
    }
    new_status = mapping.get(order.status)
    if not new_status or not order.table_id:
        return

    table = Table.objects.filter(pk=order.table_id).first()
    if table is None:
        return

    updates = {"status": new_status}
    # Seating lifecycle: stamp on first activity, clear when the party leaves.
    if new_status == Table.Status.ORDER_RECEIVED and table.seated_at is None:
        updates["seated_at"] = timezone.now()
    elif new_status == Table.Status.AVAILABLE and table.seated_at is not None:
        updates["seated_at"] = None

    for field, value in updates.items():
        setattr(table, field, value)
    table.bump_version()
    table.save(update_fields=[*updates.keys(), "version", "updated_at"])

    # Push a compact diff event (not full state) over the WS channel.
    try:
        broadcast_to_restaurant(
            order.restaurant.slug,
            "table.event",
            {
                "event": "status_changed",
                "table_id": str(table.pk),
                "status": table.status,
                "seated_at": table.seated_at.isoformat() if table.seated_at else None,
                "dining_minutes": (
                    int((timezone.now() - table.seated_at).total_seconds() // 60)
                    if table.seated_at else None
                ),
                "version": table.version,
            },
        )
    except Exception:  # pragma: no cover — realtime must never block orders
        pass
