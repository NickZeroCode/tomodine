"""Persisted notifications plus real-time event delivery."""

from __future__ import annotations

from django.db import models
from django.utils.translation import gettext_lazy as _

from apps.core.managers import TenantManager
from apps.core.models import TimeStampedModel


class Notification(TimeStampedModel):
    class Kind(models.TextChoices):
        NEW_ORDER = "new_order", _("New Order")
        ORDER_STATUS = "order_status", _("Order Status")
        TABLE_ALERT = "table_alert", _("Table Alert")
        SYSTEM = "system", _("System")

    restaurant = models.ForeignKey(
        "restaurants.Restaurant", on_delete=models.CASCADE, related_name="notifications"
    )
    kind = models.CharField(max_length=30, choices=Kind.choices, default=Kind.SYSTEM)
    title_en = models.CharField(max_length=200)
    title_bn = models.CharField(max_length=200, blank=True, default="")
    body_en = models.TextField(blank=True, default="")
    body_bn = models.TextField(blank=True, default="")
    is_read = models.BooleanField(default=False, db_index=True)
    metadata = models.JSONField(default=dict, blank=True)

    objects = TenantManager()

    class Meta:
        ordering = ("-created_at",)
        indexes = [models.Index(fields=("restaurant", "is_read"))]
