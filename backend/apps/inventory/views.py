"""Inventory API viewsets — items, recipes, movements, and reports."""

from __future__ import annotations

from datetime import date

from django.utils.translation import gettext as _
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response

from apps.api.views import TenantScopedViewSet
from apps.notifications.services import notify_restaurant

from . import serializers as inv_serializers
from .models import InventoryItem, RecipeItem, StockMovement
from .services import adjust_stock, receive_stock, set_out_of_stock


class InventoryItemViewSet(TenantScopedViewSet):
    serializer_class = inv_serializers.InventoryItemSerializer
    queryset = InventoryItem.objects.all()
    required_permission = "inventory.manage"
    filterset_fields = ("category", "is_out_of_stock")
    search_fields = ("name", "sku", "supplier_name")

    def get_queryset(self):
        qs = super().get_queryset()
        return qs

    @action(detail=True, methods=["post"], url_path="receive")
    def receive(self, request, pk=None):
        """Receive purchased stock (weighted-average costing applied)."""
        item = self.get_object()
        serializer = inv_serializers.ReceiveStockSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            receive_stock(
                item,
                quantity=serializer.validated_data["quantity"],
                unit_price=serializer.validated_data["unit_price"],
                created_by=request.user,
                reference_id=serializer.validated_data.get("reference_id", ""),
                note=serializer.validated_data.get("note", ""),
            )
        except ValueError as exc:
            raise ValidationError(str(exc))
        return Response(inv_serializers.InventoryItemSerializer(item).data)

    @action(detail=True, methods=["post"], url_path="adjust")
    def adjust(self, request, pk=None):
        """Manual adjustment / wastage / return entry."""
        item = self.get_object()
        serializer = inv_serializers.AdjustStockSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            adjust_stock(
                item,
                quantity_change=serializer.validated_data["quantity_change"],
                movement_type=serializer.validated_data["movement_type"],
                created_by=request.user,
                note=serializer.validated_data.get("note", ""),
            )
        except ValueError as exc:
            raise ValidationError(str(exc))

        # Critical alert when the item just ran out.
        if item.current_quantity <= 0:
            notify_restaurant(
                item.restaurant,
                kind="system",
                title_en=f"Out of stock: {item.name}",
                title_bn=f"স্টক শেষ: {item.name}",
                body_en=f"'{item.name}' has run out of stock. Affected menu items are now unavailable.",
                body_bn=f"'{item.name}' এর স্টক শেষ। সংশ্লিষ্ট মেনু আইটেম এখন অপ্রাপ্য।",
            )
        return Response(inv_serializers.InventoryItemSerializer(item).data)

    @action(detail=True, methods=["post"], url_path="out-of-stock")
    def out_of_stock(self, request, pk=None):
        """Manual OOS override (seasonal items, supplier delays)."""
        item = self.get_object()
        flag = bool(request.data.get("flag", True))
        set_out_of_stock(item, flag)
        return Response(inv_serializers.InventoryItemSerializer(item).data)

    @action(detail=True, methods=["get"], url_path="movements")
    def movements(self, request, pk=None):
        """Ledger entries for this item (most recent first)."""
        item = self.get_object()
        qs = StockMovement.objects.filter(inventory_item=item)[:100]
        return Response(inv_serializers.StockMovementSerializer(qs, many=True).data)

    @action(detail=False, methods=["get"], url_path="summary")
    def summary(self, request):
        """KPI block: total value + stock-status counts + affected dishes."""
        data = inv_serializers.InventorySummarySerializer.build(self.get_restaurant())
        return Response(inv_serializers.InventorySummarySerializer(data).data)

    @action(detail=False, methods=["get"], url_path="valuation")
    def valuation(self, request):
        """Inventory valuation report for a date range (defaults: this month)."""
        today = date.today()
        try:
            start = date.fromisoformat(request.query_params.get("start", "") or "") or today.replace(day=1)
            end = date.fromisoformat(request.query_params.get("end", "") or "") or today
        except ValueError:
            raise ValidationError({"detail": _("Invalid date format. Use YYYY-MM-DD.")})
        if end < start:
            raise ValidationError({"detail": _("End date must be after start date.")})

        data = inv_serializers.ValuationReportSerializer.build(self.get_restaurant(), start, end)
        return Response(inv_serializers.ValuationReportSerializer(data).data)


class RecipeItemViewSet(TenantScopedViewSet):
    serializer_class = inv_serializers.RecipeItemSerializer
    queryset = RecipeItem.objects.select_related("dish", "inventory_item")
    required_permission = "inventory.manage"
    filterset_fields = ("dish", "inventory_item")

    @action(detail=False, methods=["get"], url_path="dish-costs")
    def dish_costs(self, request):
        """Per-dish COGS / price / margin table for the whole menu."""
        rows = inv_serializers.DishCostSerializer.build(self.get_restaurant())
        return Response(rows)


class StockMovementViewSet(TenantScopedViewSet):
    """Read-only ledger — movements are created exclusively via services."""

    serializer_class = inv_serializers.StockMovementSerializer
    queryset = StockMovement.objects.select_related("inventory_item", "created_by")
    required_permission = "inventory.manage"
    filterset_fields = ("movement_type", "inventory_item")
    http_method_names = ("get",)

    def get_queryset(self):
        qs = super().get_queryset()
        start = self.request.query_params.get("start")
        end = self.request.query_params.get("end")
        if start:
            try:
                qs = qs.filter(created_at__date__gte=date.fromisoformat(start))
            except ValueError:
                pass
        if end:
            try:
                qs = qs.filter(created_at__date__lte=date.fromisoformat(end))
            except ValueError:
                pass
        return qs
