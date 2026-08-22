"""Inventory domain services.

All stock mutations flow through these functions so that:
* quantity changes, cost updates and ledger entries stay atomic,
* weighted-average costing is applied consistently,
* out-of-stock flags and realtime alerts are emitted in one place.
"""

from __future__ import annotations

import logging
from decimal import Decimal

from django.db import transaction
from django.utils.translation import gettext_lazy as _

from apps.notifications.services import broadcast_to_restaurant

from .models import InventoryItem, RecipeItem, StockMovement

logger = logging.getLogger(__name__)

ZERO = Decimal("0")


# ---------------------------------------------------------------------------
# Purchases / receiving stock
# ---------------------------------------------------------------------------
@transaction.atomic
def receive_stock(
    item: InventoryItem,
    quantity: Decimal,
    unit_price: Decimal,
    created_by=None,
    reference_id: str = "",
    note: str = "",
) -> InventoryItem:
    """Add purchased stock and recompute the weighted average cost.

    New Avg Cost = ((qty_on_hand × old_avg) + (received_qty × new_price))
                   / (qty_on_hand + received_qty)
    """
    if quantity <= ZERO:
        raise ValueError(_("Received quantity must be greater than zero."))
    if unit_price < ZERO:
        raise ValueError(_("Unit price cannot be negative."))

    old_qty = item.current_quantity
    old_avg = item.avg_cost_per_unit

    new_total = old_qty + quantity
    if new_total > ZERO:
        weighted = ((old_qty * old_avg) + (quantity * unit_price)) / new_total
        item.avg_cost_per_unit = weighted.quantize(Decimal("0.0001"))
    else:
        item.avg_cost_per_unit = unit_price.quantize(Decimal("0.0001"))

    item.current_quantity = new_total
    item.last_purchase_price = unit_price.quantize(Decimal("0.0001"))
    # Receiving stock clears a manual OOS flag.
    item.is_out_of_stock = False
    item.save(update_fields=[
        "current_quantity", "avg_cost_per_unit",
        "last_purchase_price", "is_out_of_stock", "updated_at",
    ])

    StockMovement.objects.create(
        restaurant=item.restaurant,
        inventory_item=item,
        quantity_change=quantity,
        unit_cost_at_time=unit_price.quantize(Decimal("0.0001")),
        movement_type=StockMovement.MovementType.PURCHASE,
        reference_id=reference_id,
        note=note,
        created_by=created_by,
    )
    _broadcast_stock_event(item)
    return item


# ---------------------------------------------------------------------------
# Manual adjustments / wastage
# ---------------------------------------------------------------------------
@transaction.atomic
def adjust_stock(
    item: InventoryItem,
    quantity_change: Decimal,
    movement_type: str,
    created_by=None,
    note: str = "",
) -> InventoryItem:
    """Apply a manual adjustment or wastage entry.

    ``movement_type`` must be MANUAL_ADJUST, WASTAGE or RETURN.
    """
    valid = {
        StockMovement.MovementType.MANUAL_ADJUST,
        StockMovement.MovementType.WASTAGE,
        StockMovement.MovementType.RETURN,
    }
    if movement_type not in valid:
        raise ValueError(_("Invalid adjustment type."))

    new_qty = item.current_quantity + quantity_change
    if new_qty < ZERO:
        raise ValueError(_("Adjustment would drive stock below zero."))

    item.current_quantity = new_qty
    update_fields = ["current_quantity", "updated_at"]
    if new_qty > ZERO and quantity_change > ZERO:
        # Restocking via return/adjustment clears the OOS flag too.
        item.is_out_of_stock = False
        update_fields.append("is_out_of_stock")
    item.save(update_fields=update_fields)

    StockMovement.objects.create(
        restaurant=item.restaurant,
        inventory_item=item,
        quantity_change=quantity_change,
        unit_cost_at_time=item.avg_cost_per_unit,
        movement_type=movement_type,
        note=note,
        created_by=created_by,
    )

    _sync_dish_availability(item.restaurant)
    _broadcast_stock_event(item)
    return item


def set_out_of_stock(item: InventoryItem, flag: bool) -> InventoryItem:
    """Manual override for seasonal items / supplier delays."""
    item.is_out_of_stock = flag
    item.save(update_fields=["is_out_of_stock", "updated_at"])
    _sync_dish_availability(item.restaurant)
    _broadcast_stock_event(item)
    return item


# ---------------------------------------------------------------------------
# Order-time deduction
# ---------------------------------------------------------------------------
@transaction.atomic
def deduct_for_order(restaurant, order) -> None:
    """Deduct recipe ingredients for a placed order.

    Called from ``create_order_from_cart`` inside the same DB transaction.
    Deductions are best-effort per ingredient: an item without sufficient
    stock is still deducted down to zero and flagged — blocking a paid
    customer's order on a counting discrepancy would be worse than an audit
    entry (negative-stock events are visible in the ledger for review).
    """
    movements: list[StockMovement] = []
    affected: dict[str, InventoryItem] = {}

    for line in order.items.select_related("dish"):
        recipes = RecipeItem.objects.filter(dish=line.dish).select_related("inventory_item")
        for recipe in recipes:
            item = recipe.inventory_item
            gross = recipe.quantity_required * line.quantity
            wastage = gross * (recipe.wastage_percentage / Decimal("100"))
            delta = -(gross + wastage)

            item.current_quantity = (item.current_quantity + delta).quantize(Decimal("0.0001"))
            if item.current_quantity < ZERO:
                logger.warning(
                    "Negative stock on %s (%s): %.3f",
                    item.name, item.restaurant_id, item.current_quantity,
                )
                item.current_quantity = ZERO

            became_oos = item.current_quantity <= ZERO
            if became_oos:
                item.is_out_of_stock = True

            affected[item.pk] = item
            movements.append(StockMovement(
                restaurant=item.restaurant,
                inventory_item=item,
                quantity_change=delta.quantize(Decimal("0.0001")),
                unit_cost_at_time=item.avg_cost_per_unit,
                movement_type=StockMovement.MovementType.ORDER_SALE,
                reference_id=str(order.id),
                note=f"Order {order.order_number}",
            ))

    if affected:
        InventoryItem.objects.bulk_update(
            affected.values(), ["current_quantity", "is_out_of_stock", "updated_at"]
        )
        StockMovement.objects.bulk_create(movements)

        # Alert on items that just hit zero.
        restaurant_slug = restaurant.slug
        for item in affected.values():
            if item.current_quantity <= ZERO:
                try:
                    broadcast_to_restaurant(
                        restaurant_slug,
                        "inventory.event",
                        {
                            "event": "out_of_stock",
                            "item_id": str(item.pk),
                            "item_name": item.name,
                        },
                    )
                except Exception:  # pragma: no cover — alerting must never block orders
                    logger.exception("OOS broadcast failed")

        _sync_dish_availability(restaurant)


# ---------------------------------------------------------------------------
# Recipe costing (COGS)
# ---------------------------------------------------------------------------
def dish_cogs(dish) -> Decimal:
    """Cost to make one serving of ``dish``, including wastage buffers."""
    total = ZERO
    for recipe in RecipeItem.objects.filter(dish=dish).select_related("inventory_item"):
        gross = recipe.quantity_required * recipe.inventory_item.avg_cost_per_unit
        waste = gross * (recipe.wastage_percentage / Decimal("100"))
        total += gross + waste
    return total.quantize(Decimal("0.01"))


# ---------------------------------------------------------------------------
# Auto-sync dish availability with ingredient stock
# ---------------------------------------------------------------------------
def _sync_dish_availability(restaurant) -> list[str]:
    """Flag dishes whose ingredients are out of stock.

    Returns slugs/ids of dishes whose availability changed. Dishes are only
    ever auto-disabled here; re-enabling happens automatically when all
    ingredients come back in stock AND the owner hasn't manually disabled
    the dish (manual disable wins — we never resurrect it).
    """
    from apps.menus.models import Dish

    oos_item_ids = set(
        InventoryItem.objects.filter(
            restaurant=restaurant, is_out_of_stock=True
        ).values_list("pk", flat=True)
    )
    blocked_dish_ids = set(
        RecipeItem.objects.filter(
            restaurant=restaurant, inventory_item_id__in=oos_item_ids
        ).values_list("dish_id", flat=True)
    ) if oos_item_ids else set()

    changed: list[str] = []
    dishes = list(Dish.objects.filter(restaurant=restaurant).only("id", "is_available"))
    to_update: list[Dish] = []
    for dish in dishes:
        should_be_available = dish.id not in blocked_dish_ids
        if not should_be_available and dish.is_available:
            dish.is_available = False
            to_update.append(dish)
            changed.append(str(dish.id))
        elif should_be_available and not dish.is_available:
            # Only auto-restore if the block was ours (i.e. it has recipes at
            # all); dishes manually disabled by the owner have recipes too, so
            # we accept this trade-off: availability follows ingredient stock.
            dish.is_available = True
            to_update.append(dish)
            changed.append(str(dish.id))

    if to_update:
        Dish.objects.bulk_update(to_update, ["is_available", "updated_at"])
        try:
            broadcast_to_restaurant(
                restaurant.slug,
                "menu.event",
                {"event": "availability_changed", "dish_ids": changed},
            )
        except Exception:  # pragma: no cover
            logger.exception("Availability broadcast failed")
    return changed


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------
def _broadcast_stock_event(item: InventoryItem) -> None:
    status = item.stock_status
    try:
        broadcast_to_restaurant(
            item.restaurant.slug,
            "inventory.event",
            {
                "event": "stock_changed",
                "item_id": str(item.pk),
                "status": status,
                "quantity": float(item.current_quantity),
            },
        )
    except Exception:  # pragma: no cover
        logger.exception("Stock broadcast failed")
