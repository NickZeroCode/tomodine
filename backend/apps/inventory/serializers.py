"""Inventory API serializers."""

from __future__ import annotations

from decimal import Decimal

from django.utils.translation import gettext_lazy as _
from rest_framework import serializers

from apps.menus.models import Dish

from .models import InventoryItem, RecipeItem, StockMovement


class InventoryItemSerializer(serializers.ModelSerializer):
    stock_value = serializers.DecimalField(max_digits=14, decimal_places=2, read_only=True)
    stock_status = serializers.CharField(read_only=True)

    class Meta:
        model = InventoryItem
        fields = (
            "id", "name", "category", "sku", "unit",
            "current_quantity", "min_stock_threshold", "max_stock_threshold",
            "reorder_point", "avg_cost_per_unit", "last_purchase_price",
            "supplier_name", "is_out_of_stock",
            "stock_value", "stock_status",
            "created_at", "updated_at",
        )
        read_only_fields = ("id", "created_at", "updated_at")

    def validate_sku(self, value: str) -> str:
        value = value.strip()
        if not value:
            return ""
        qs = InventoryItem.objects.filter(
            restaurant=self.context["request"].restaurant, sku=value
        )
        if self.instance:
            qs = qs.exclude(pk=self.instance.pk)
        if qs.exists():
            raise serializers.ValidationError(_("An item with this SKU already exists."))
        return value

    def validate(self, attrs):
        max_t = attrs.get("max_stock_threshold", getattr(self.instance, "max_stock_threshold", None))
        min_t = attrs.get("min_stock_threshold", getattr(self.instance, "min_stock_threshold", None))
        if max_t is not None and min_t is not None and max_t < min_t:
            raise serializers.ValidationError(
                {"max_stock_threshold": _("Max threshold cannot be below the min threshold.")}
            )
        return attrs


class StockMovementSerializer(serializers.ModelSerializer):
    item_name = serializers.CharField(source="inventory_item.name", read_only=True)
    created_by_email = serializers.CharField(
        source="created_by.email", read_only=True, default=""
    )

    class Meta:
        model = StockMovement
        fields = (
            "id", "inventory_item", "item_name", "quantity_change",
            "unit_cost_at_time", "movement_type", "reference_id",
            "note", "created_by_email", "created_at",
        )
        read_only_fields = fields


class ReceiveStockSerializer(serializers.Serializer):
    """Payload for the receive-stock action (purchase entry)."""

    quantity = serializers.DecimalField(max_digits=12, decimal_places=3, min_value=0.001)
    unit_price = serializers.DecimalField(max_digits=12, decimal_places=4, min_value=0)
    reference_id = serializers.CharField(required=False, allow_blank=True, default="")
    note = serializers.CharField(required=False, allow_blank=True, default="")


class AdjustStockSerializer(serializers.Serializer):
    quantity_change = serializers.DecimalField(max_digits=12, decimal_places=3)
    movement_type = serializers.ChoiceField(
        choices=("manual_adjust", "wastage", "return")
    )
    note = serializers.CharField(required=False, allow_blank=True, default="")


class RecipeItemSerializer(serializers.ModelSerializer):
    inventory_item_name = serializers.CharField(source="inventory_item.name", read_only=True)
    unit = serializers.CharField(source="inventory_item.unit", read_only=True)
    unit_cost = serializers.DecimalField(
        source="inventory_item.avg_cost_per_unit",
        max_digits=12, decimal_places=4, read_only=True,
    )

    class Meta:
        model = RecipeItem
        fields = (
            "id", "dish", "inventory_item", "inventory_item_name",
            "quantity_required", "wastage_percentage", "unit", "unit_cost",
        )
        read_only_fields = ("id",)


class DishCostSerializer(serializers.Serializer):
    """Per-dish profitability view (COGS vs selling price)."""

    dish_id = serializers.CharField()
    dish_name = serializers.CharField()
    price = serializers.DecimalField(max_digits=10, decimal_places=2)
    cogs = serializers.DecimalField(max_digits=12, decimal_places=2)
    gross_profit = serializers.DecimalField(max_digits=12, decimal_places=2)
    margin_percent = serializers.FloatField()
    ingredient_count = serializers.IntegerField()

    @classmethod
    def build(cls, restaurant) -> list[dict]:
        """Compute cost rows for every dish of the restaurant in one pass."""
        dishes = Dish.objects.filter(restaurant=restaurant).only("id", "name_en", "name_bn", "price")
        recipes = RecipeItem.objects.filter(restaurant=restaurant).select_related("dish", "inventory_item")

        # Group recipe lines per dish.
        per_dish: dict[str, list[RecipeItem]] = {}
        for r in recipes:
            per_dish.setdefault(str(r.dish_id), []).append(r)

        rows: list[dict] = []
        for d in dishes:
            lines = per_dish.get(str(d.id), [])
            cogs = Decimal("0")
            for r in lines:
                gross = r.quantity_required * r.inventory_item.avg_cost_per_unit
                waste = gross * (r.wastage_percentage / Decimal("100"))
                cogs += gross + waste
            cogs = cogs.quantize(Decimal("0.01"))
            price = d.price.quantize(Decimal("0.01"))
            profit = (price - cogs).quantize(Decimal("0.01"))
            margin = float((profit / price * 100)) if price > 0 else 0.0
            rows.append({
                "dish_id": str(d.id),
                "dish_name": d.name_en,
                "price": price,
                "cogs": cogs,
                "gross_profit": profit,
                "margin_percent": round(margin, 1),
                "ingredient_count": len(lines),
            })
        rows.sort(key=lambda r: r["margin_percent"])
        return rows


class InventorySummarySerializer(serializers.Serializer):
    """Top-level KPI block for the inventory dashboard."""

    total_stock_value = serializers.DecimalField(max_digits=16, decimal_places=2)
    total_items = serializers.IntegerField()
    low_stock_count = serializers.IntegerField()
    out_of_stock_count = serializers.IntegerField()
    overstock_count = serializers.IntegerField()
    affected_dishes = serializers.ListField(child=serializers.CharField())

    @classmethod
    def build(cls, restaurant) -> dict:
        items = list(InventoryItem.objects.filter(restaurant=restaurant))
        total_value = sum((i.stock_value for i in items), Decimal("0"))
        low = sum(1 for i in items if i.stock_status == "low")
        out = sum(1 for i in items if i.stock_status == "out")
        over = sum(1 for i in items if i.stock_status == "overstock")

        oos_ids = [i.pk for i in items if i.stock_status == "out"]
        affected: list[str] = []
        if oos_ids:
            affected = list(
                RecipeItem.objects.filter(
                    restaurant=restaurant, inventory_item_id__in=oos_ids
                )
                .values_list("dish__name_en", flat=True)
                .distinct()[:20]
            )

        return {
            "total_stock_value": total_value.quantize(Decimal("0.01")),
            "total_items": len(items),
            "low_stock_count": low,
            "out_of_stock_count": out,
            "overstock_count": over,
            "affected_dishes": affected,
        }


class ValuationReportSerializer(serializers.Serializer):
    """Inventory valuation + COGS report for a date range."""

    period_start = serializers.DateField()
    period_end = serializers.DateField()
    opening_value = serializers.DecimalField(max_digits=16, decimal_places=2)
    purchases_total = serializers.DecimalField(max_digits=16, decimal_places=2)
    wastage_total = serializers.DecimalField(max_digits=16, decimal_places=2)
    closing_value = serializers.DecimalField(max_digits=16, decimal_places=2)
    cogs = serializers.DecimalField(max_digits=16, decimal_places=2)

    @classmethod
    def build(cls, restaurant, start, end) -> dict:
        from datetime import datetime, time

        from django.utils import timezone as tz

        start_dt = tz.make_aware(datetime.combine(start, time.min))
        end_dt = tz.make_aware(datetime.combine(end, time.max))

        movements = StockMovement.objects.filter(
            restaurant=restaurant, created_at__range=(start_dt, end_dt)
        )

        purchases = sum(
            (m.quantity_change * m.unit_cost_at_time for m in movements.filter(movement_type="purchase")),
            ZERO,
        )
        wastage = sum(
            (-m.quantity_change * m.unit_cost_at_time for m in movements.filter(movement_type="wastage")),
            ZERO,
        )

        items = InventoryItem.objects.filter(restaurant=restaurant)
        closing = sum((i.stock_value for i in items), ZERO)

        # Opening value ≈ closing − net movement value in the period.
        net_change = sum((m.quantity_change * m.unit_cost_at_time for m in movements), ZERO)
        opening = closing - net_change

        cogs = sum(
            (-m.quantity_change * m.unit_cost_at_time for m in movements.filter(movement_type="order_sale")),
            ZERO,
        )

        return {
            "period_start": start,
            "period_end": end,
            "opening_value": opening.quantize(Decimal("0.01")),
            "purchases_total": purchases.quantize(Decimal("0.01")),
            "wastage_total": wastage.quantize(Decimal("0.01")),
            "closing_value": closing.quantize(Decimal("0.01")),
            "cogs": cogs.quantize(Decimal("0.01")),
        }
