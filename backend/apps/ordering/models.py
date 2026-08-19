"""Customer sessions, carts, and orders."""

from __future__ import annotations

import secrets
from decimal import Decimal

from django.db import models
from django.utils.translation import gettext_lazy as _

from apps.core.managers import TenantManager
from apps.core.models import TimeStampedModel


class CustomerSession(TimeStampedModel):
    """An anonymous customer presence at a table, established via QR scan.

    Each physical device gets its own session (identified by ``device_id``
    generated client-side and stored in localStorage), so multiple people
    at the same table can order independently without accounts.
    """

    restaurant = models.ForeignKey(
        "restaurants.Restaurant", on_delete=models.CASCADE, related_name="customer_sessions"
    )
    table = models.ForeignKey(
        "tables.Table", on_delete=models.CASCADE, related_name="sessions"
    )
    token = models.CharField(max_length=64, unique=True, db_index=True, editable=False)
    device_id = models.CharField(max_length=64, db_index=True, blank=True, default="", help_text="Client-generated UUID stored in localStorage to track per-device sessions.")
    language = models.CharField(max_length=5, default="en")
    party_size = models.PositiveIntegerField(default=1)
    is_active = models.BooleanField(default=True, db_index=True)
    ended_at = models.DateTimeField(blank=True, null=True)

    objects = TenantManager()

    class Meta:
        indexes = [
            models.Index(fields=("restaurant", "table")),
            models.Index(fields=("restaurant", "is_active")),
            models.Index(fields=("table", "device_id", "is_active")),
        ]

    def save(self, *args, **kwargs):
        if not self.token:
            self.token = secrets.token_urlsafe(32)
        super().save(*args, **kwargs)


class Cart(TimeStampedModel):
    session = models.OneToOneField(
        CustomerSession, on_delete=models.CASCADE, related_name="cart"
    )
    restaurant = models.ForeignKey(
        "restaurants.Restaurant", on_delete=models.CASCADE, related_name="carts"
    )

    objects = TenantManager()


class CartItem(TimeStampedModel):
    cart = models.ForeignKey(Cart, on_delete=models.CASCADE, related_name="items")
    dish = models.ForeignKey("menus.Dish", on_delete=models.CASCADE)
    variant = models.ForeignKey(
        "menus.DishVariant", on_delete=models.SET_NULL, null=True, blank=True
    )
    quantity = models.PositiveIntegerField(default=1)
    special_instructions = models.CharField(max_length=500, blank=True, default="")
    unit_price = models.DecimalField(max_digits=10, decimal_places=2)

    class Meta:
        indexes = [models.Index(fields=("cart",))]


class Order(TimeStampedModel):
    class Status(models.TextChoices):
        NEW = "new", _("New")
        ACCEPTED = "accepted", _("Accepted")
        PREPARING = "preparing", _("Preparing")
        READY = "ready", _("Ready")
        SERVED = "served", _("Served")
        PAID = "paid", _("Paid")
        REJECTED = "rejected", _("Rejected")
        CANCELLED = "cancelled", _("Cancelled")

    class OrderType(models.TextChoices):
        DINE_IN = "dine_in", _("Dine in")
        TAKE_AWAY = "take_away", _("Take away")

    restaurant = models.ForeignKey(
        "restaurants.Restaurant", on_delete=models.CASCADE, related_name="orders"
    )
    table = models.ForeignKey(
        "tables.Table", on_delete=models.SET_NULL, null=True, related_name="orders"
    )
    session = models.ForeignKey(
        CustomerSession, on_delete=models.SET_NULL, null=True, blank=True, related_name="orders"
    )
    order_number = models.CharField(max_length=20, db_index=True)
    status = models.CharField(
        max_length=20, choices=Status.choices, default=Status.NEW, db_index=True
    )
    order_type = models.CharField(
        max_length=20,
        choices=OrderType.choices,
        default=OrderType.DINE_IN,
        db_index=True,
    )
    customer_note = models.CharField(max_length=500, blank=True, default="")
    subtotal = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0"))
    total = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0"))

    objects = TenantManager()

    class Meta:
        unique_together = (("restaurant", "order_number"),)
        ordering = ("-created_at",)
        indexes = [
            models.Index(fields=("restaurant", "status")),
            models.Index(fields=("restaurant", "table")),
            models.Index(fields=("restaurant", "created_at")),
        ]


class OrderItem(TimeStampedModel):
    order = models.ForeignKey(Order, on_delete=models.CASCADE, related_name="items")
    dish_name_en = models.CharField(max_length=255)
    dish_name_bn = models.CharField(max_length=255, blank=True, default="")
    dish_image = models.CharField(max_length=500, blank=True, default="", help_text="Snapshot of the dish image URL at order time.")
    min_prep_time = models.PositiveIntegerField(default=15, help_text="Snapshot of min prep time in minutes.")
    max_prep_time = models.PositiveIntegerField(default=30, help_text="Snapshot of max prep time in minutes.")
    variant_name = models.CharField(max_length=255, blank=True, default="")
    quantity = models.PositiveIntegerField(default=1)
    unit_price = models.DecimalField(max_digits=10, decimal_places=2)
    special_instructions = models.CharField(max_length=500, blank=True, default="")

    class Meta:
        indexes = [models.Index(fields=("order",))]


class OrderStatusHistory(TimeStampedModel):
    """Audit trail of order status transitions."""

    order = models.ForeignKey(Order, on_delete=models.CASCADE, related_name="status_history")
    from_status = models.CharField(max_length=20, blank=True, default="")
    to_status = models.CharField(max_length=20)
    changed_by = models.ForeignKey(
        "accounts.User", on_delete=models.SET_NULL, null=True, blank=True
    )
    note = models.CharField(max_length=255, blank=True, default="")

    class Meta:
        ordering = ("created_at",)
        indexes = [models.Index(fields=("order", "created_at"))]
