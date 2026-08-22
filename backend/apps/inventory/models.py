"""Inventory domain: stock items, recipes (BOM), and immutable stock movements.

Design notes
------------
* Every model is tenant-scoped via a ``restaurant`` FK + :class:`TenantManager`,
  matching the conventions of ``menus``/``tables``/``ordering``.
* ``StockMovement`` is append-only (no updates/deletes through the API) — it is
  the audit trail that powers valuation and variance analysis.
* Weighted-average costing is computed in ``services.py`` so it stays testable
  and is always executed inside the caller's transaction.
"""

from __future__ import annotations

from decimal import Decimal

from django.db import models
from django.utils.translation import gettext_lazy as _

from apps.core.managers import TenantManager
from apps.core.models import TimeStampedModel


class InventoryItem(TimeStampedModel):
    """A physical stock item (ingredient, beverage, dry good, …)."""

    class Category(models.TextChoices):
        RAW = "raw", _("Raw")
        BEVERAGE = "beverage", _("Beverage")
        DRY_GOODS = "dry_goods", _("Dry Goods")
        DAIRY = "dairy", _("Dairy")
        PRODUCE = "produce", _("Produce")

    class Unit(models.TextChoices):
        KG = "kg", _("kg")
        G = "g", _("g")
        L = "l", _("L")
        ML = "ml", _("mL")
        PIECE = "piece", _("Piece")
        BOX = "box", _("Box")
        BOTTLE = "bottle", _("Bottle")

    restaurant = models.ForeignKey(
        "restaurants.Restaurant",
        on_delete=models.CASCADE,
        related_name="inventory_items",
    )
    name = models.CharField(max_length=255)
    category = models.CharField(
        max_length=20, choices=Category.choices, default=Category.RAW, db_index=True
    )
    sku = models.CharField(max_length=64, blank=True, default="", db_index=True)
    unit = models.CharField(max_length=10, choices=Unit.choices, default=Unit.PIECE)

    current_quantity = models.DecimalField(max_digits=12, decimal_places=3, default=Decimal("0"))
    min_stock_threshold = models.DecimalField(max_digits=12, decimal_places=3, default=Decimal("0"))
    max_stock_threshold = models.DecimalField(max_digits=12, decimal_places=3, null=True, blank=True)
    reorder_point = models.DecimalField(max_digits=12, decimal_places=3, default=Decimal("0"))

    avg_cost_per_unit = models.DecimalField(max_digits=12, decimal_places=4, default=Decimal("0"))
    last_purchase_price = models.DecimalField(max_digits=12, decimal_places=4, default=Decimal("0"))

    supplier_name = models.CharField(max_length=255, blank=True, default="")

    # Manual override — e.g. saving stock for a VIP reservation.
    is_out_of_stock = models.BooleanField(default=False, db_index=True)

    objects = TenantManager()

    class Meta:
        ordering = ("name",)
        constraints = [
            models.UniqueConstraint(
                fields=("restaurant", "sku"),
                condition=~models.Q(sku=""),
                name="uniq_inventory_sku_per_restaurant",
            )
        ]
        indexes = [
            models.Index(fields=("restaurant", "category"), name="inv_item_rest_cat_idx"),
            models.Index(fields=("restaurant", "is_out_of_stock"), name="inv_item_rest_oos_idx"),
        ]

    def __str__(self) -> str:  # pragma: no cover
        return self.name

    # ------------------------------------------------------------------
    # Derived state (used by serializers and the dashboard)
    # ------------------------------------------------------------------
    @property
    def stock_value(self) -> Decimal:
        return (self.current_quantity * self.avg_cost_per_unit).quantize(Decimal("0.01"))

    @property
    def stock_status(self) -> str:
        """healthy | low | out | overstock — drives the dashboard colouring."""
        if self.is_out_of_stock or self.current_quantity <= 0:
            return "out"
        if self.max_stock_threshold is not None and self.current_quantity > self.max_stock_threshold:
            return "overstock"
        if self.current_quantity <= self.reorder_point:
            return "low"
        return "healthy"


class RecipeItem(TimeStampedModel):
    """Bill of materials: how much of an inventory item a dish consumes."""

    restaurant = models.ForeignKey(
        "restaurants.Restaurant",
        on_delete=models.CASCADE,
        related_name="recipe_items",
    )
    dish = models.ForeignKey(
        "menus.Dish", on_delete=models.CASCADE, related_name="recipe_items"
    )
    inventory_item = models.ForeignKey(
        InventoryItem, on_delete=models.CASCADE, related_name="recipe_usages"
    )
    quantity_required = models.DecimalField(max_digits=12, decimal_places=3)
    wastage_percentage = models.DecimalField(
        max_digits=5, decimal_places=2, default=Decimal("0"),
        help_text=_("Estimated prep waste, e.g. 5.00 for 5%."),
    )

    objects = TenantManager()

    class Meta:
        ordering = ("dish__name_en",)
        constraints = [
            models.UniqueConstraint(
                fields=("dish", "inventory_item"),
                name="uniq_recipe_item_per_dish",
            )
        ]
        indexes = [models.Index(fields=("restaurant", "dish"), name="inv_recipe_rest_dish_idx")]

    def __str__(self) -> str:  # pragma: no cover
        return f"{self.dish} → {self.inventory_item}"


class StockMovement(TimeStampedModel):
    """Immutable audit trail of every stock change."""

    class MovementType(models.TextChoices):
        PURCHASE = "purchase", _("Purchase")
        ORDER_SALE = "order_sale", _("Order Sale")
        RETURN = "return", _("Return")
        WASTAGE = "wastage", _("Wastage")
        MANUAL_ADJUST = "manual_adjust", _("Manual Adjustment")

    restaurant = models.ForeignKey(
        "restaurants.Restaurant",
        on_delete=models.CASCADE,
        related_name="stock_movements",
    )
    inventory_item = models.ForeignKey(
        InventoryItem, on_delete=models.CASCADE, related_name="movements"
    )
    quantity_change = models.DecimalField(max_digits=12, decimal_places=3)
    unit_cost_at_time = models.DecimalField(max_digits=12, decimal_places=4, default=Decimal("0"))
    movement_type = models.CharField(max_length=20, choices=MovementType.choices, db_index=True)
    reference_id = models.CharField(max_length=64, blank=True, default="")
    note = models.CharField(max_length=255, blank=True, default="")
    created_by = models.ForeignKey(
        "accounts.User",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="stock_movements",
    )

    objects = TenantManager()

    class Meta:
        ordering = ("-created_at",)
        indexes = [
            models.Index(fields=("restaurant", "movement_type"), name="inv_move_rest_type_idx"),
            models.Index(fields=("restaurant", "created_at"), name="inv_move_rest_date_idx"),
        ]

    def __str__(self) -> str:  # pragma: no cover
        return f"{self.movement_type} {self.quantity_change} × {self.inventory_item}"
