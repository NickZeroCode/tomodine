"""Dining tables and their QR codes."""

from __future__ import annotations

import secrets

from django.db import models
from django.utils.translation import gettext_lazy as _

from apps.core.managers import TenantManager
from apps.core.models import TimeStampedModel


class Table(TimeStampedModel):
    class Status(models.TextChoices):
        AVAILABLE = "available", _("Available")
        OCCUPIED = "occupied", _("Occupied")
        AWAITING_ORDER = "awaiting_order", _("Awaiting Order")
        ORDER_RECEIVED = "order_received", _("Order Received")
        PREPARING = "preparing", _("Preparing")
        READY = "ready", _("Ready")
        AWAITING_SERVICE = "awaiting_service", _("Awaiting Service")
        SERVED = "served", _("Served")
        AWAITING_PAYMENT = "awaiting_payment", _("Awaiting Payment")
        RESERVED = "reserved", _("Reserved")
        ATTENTION = "attention", _("Attention Required")
        OFFLINE = "offline", _("Offline")

    restaurant = models.ForeignKey(
        "restaurants.Restaurant", on_delete=models.CASCADE, related_name="tables"
    )
    number = models.CharField(max_length=50)
    label = models.CharField(max_length=100, blank=True, default="")
    seats = models.PositiveIntegerField(default=4)
    floor = models.CharField(max_length=50, blank=True, default="")
    status = models.CharField(
        max_length=30, choices=Status.choices, default=Status.AVAILABLE, db_index=True
    )
    is_active = models.BooleanField(default=True, db_index=True)

    # Floor-map position (CSS-grid coordinates, 12-column modular grid).
    # ``null`` = auto-place; the frontend lays untitled tables out in a
    # deterministic flow when no explicit position is stored.
    grid_x = models.PositiveSmallIntegerField(null=True, blank=True)
    grid_y = models.PositiveSmallIntegerField(null=True, blank=True)
    grid_w = models.PositiveSmallIntegerField(default=2)
    grid_h = models.PositiveSmallIntegerField(default=2)

    # When the current party was seated (set on first order, cleared on paid).
    seated_at = models.DateTimeField(null=True, blank=True, db_index=True)

    # Monotonic counter for WS event-sourcing reconciliation: clients that
    # reconnect send their last seen version and receive a replay/snapshot.
    version = models.PositiveIntegerField(default=0)

    objects = TenantManager()

    class Meta:
        unique_together = (("restaurant", "number"),)
        ordering = ("number",)
        indexes = [
            # Names match the ones generated in 0001_initial so the new
            # migration only adds the seated_at index.
            models.Index(fields=("restaurant", "status"), name="tables_tabl_restaur_715b06_idx"),
            models.Index(fields=("restaurant", "is_active"), name="tables_tabl_restaur_2e47cf_idx"),
            models.Index(fields=("restaurant", "seated_at"), name="table_rest_seated_idx"),
        ]

    def bump_version(self) -> int:
        """Atomically increment and return the entity version (event sourcing)."""
        type(self).objects.filter(pk=self.pk).update(version=models.F("version") + 1)
        self.refresh_from_db(fields=["version"])
        return self.version

    def __str__(self) -> str:  # pragma: no cover
        return f"{self.restaurant.slug} · Table {self.number}"


class QRCode(TimeStampedModel):
    """A table's QR identity.

    ``token`` is the opaque, unguessable value encoded into the QR payload so
    that internal table PKs are never exposed to customers.
    """

    restaurant = models.ForeignKey(
        "restaurants.Restaurant", on_delete=models.CASCADE, related_name="qr_codes"
    )
    table = models.OneToOneField(Table, on_delete=models.CASCADE, related_name="qr_code")
    token = models.CharField(max_length=64, unique=True, db_index=True, editable=False)
    is_active = models.BooleanField(default=True, db_index=True)

    objects = TenantManager()

    class Meta:
        indexes = [models.Index(fields=("restaurant", "is_active"))]

    def save(self, *args, **kwargs):
        if not self.token:
            self.token = secrets.token_urlsafe(32)
        super().save(*args, **kwargs)

    def regenerate_token(self) -> None:
        self.token = secrets.token_urlsafe(32)
        self.save(update_fields=("token", "updated_at"))
