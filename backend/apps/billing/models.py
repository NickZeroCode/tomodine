"""Subscription plans, restaurant subscriptions, and billing records."""

from __future__ import annotations

from decimal import Decimal

from django.db import models
from django.utils import timezone
from django.utils.translation import gettext_lazy as _

from apps.core.managers import TenantManager
from apps.core.models import TimeStampedModel


class SubscriptionPlan(TimeStampedModel):
    """A configurable commercial plan. Prices are NOT hard-coded."""

    class Interval(models.TextChoices):
        MONTHLY = "monthly", _("Monthly")
        YEARLY = "yearly", _("Yearly")

    code = models.SlugField(max_length=50, unique=True, db_index=True)
    name_en = models.CharField(max_length=100)
    name_bn = models.CharField(max_length=100, blank=True, default="")
    description_en = models.TextField(blank=True, default="")
    description_bn = models.TextField(blank=True, default="")
    price = models.DecimalField(max_digits=10, decimal_places=2, default=Decimal("0"))
    currency = models.CharField(max_length=3, default="BDT")
    interval = models.CharField(
        max_length=10, choices=Interval.choices, default=Interval.MONTHLY
    )
    trial_days = models.PositiveIntegerField(default=14)
    max_tables = models.PositiveIntegerField(default=10)
    max_staff = models.PositiveIntegerField(default=5)
    max_dishes = models.PositiveIntegerField(default=100)
    has_analytics = models.BooleanField(default=True)
    is_active = models.BooleanField(default=True, db_index=True)
    display_order = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ("display_order", "price")


class Subscription(TimeStampedModel):
    """A restaurant's subscription state and entitlements."""

    class Status(models.TextChoices):
        TRIALING = "trialing", _("Trialing")
        ACTIVE = "active", _("Active")
        PAST_DUE = "past_due", _("Past Due")
        EXPIRED = "expired", _("Expired")
        CANCELLED = "cancelled", _("Cancelled")

    restaurant = models.OneToOneField(
        "restaurants.Restaurant", on_delete=models.CASCADE, related_name="subscription"
    )
    plan = models.ForeignKey(
        SubscriptionPlan, on_delete=models.PROTECT, related_name="subscriptions"
    )
    status = models.CharField(
        max_length=20, choices=Status.choices, default=Status.TRIALING, db_index=True
    )
    started_at = models.DateTimeField(default=timezone.now)
    trial_ends_at = models.DateTimeField(blank=True, null=True)
    current_period_end = models.DateTimeField(blank=True, null=True)
    auto_renew = models.BooleanField(default=True)
    cancelled_at = models.DateTimeField(blank=True, null=True)

    objects = TenantManager()

    class Meta:
        indexes = [models.Index(fields=("status",))]

    @property
    def is_entitled(self) -> bool:
        """Whether premium features are currently unlocked."""
        if self.status in {self.Status.ACTIVE, self.Status.TRIALING}:
            now = timezone.now()
            if self.status == self.Status.TRIALING and self.trial_ends_at:
                return now <= self.trial_ends_at
            if self.current_period_end:
                return now <= self.current_period_end
            return True
        return False


class BillingRecord(TimeStampedModel):
    """An invoice/payment event (manual or gateway-driven)."""

    class Status(models.TextChoices):
        PENDING = "pending", _("Pending")
        PAID = "paid", _("Paid")
        FAILED = "failed", _("Failed")
        REFUNDED = "refunded", _("Refunded")

    restaurant = models.ForeignKey(
        "restaurants.Restaurant", on_delete=models.CASCADE, related_name="billing_records"
    )
    subscription = models.ForeignKey(
        Subscription, on_delete=models.SET_NULL, null=True, related_name="billing_records"
    )
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    currency = models.CharField(max_length=3, default="BDT")
    status = models.CharField(
        max_length=20, choices=Status.choices, default=Status.PENDING, db_index=True
    )
    period_start = models.DateTimeField(blank=True, null=True)
    period_end = models.DateTimeField(blank=True, null=True)
    reference = models.CharField(max_length=100, blank=True, default="")

    objects = TenantManager()

    class Meta:
        ordering = ("-created_at",)
        indexes = [models.Index(fields=("restaurant", "status"))]


class Offer(TimeStampedModel):
    """A promotional offer that can apply to orders at a restaurant."""

    class DiscountType(models.TextChoices):
        PERCENTAGE = "percentage", _("Percentage")
        FIXED = "fixed", _("Fixed amount")

    restaurant = models.ForeignKey(
        "restaurants.Restaurant",
        on_delete=models.CASCADE,
        related_name="offers",
    )
    dish = models.ForeignKey(
        "menus.Dish",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="offers",
        help_text=_("Link to a specific dish to show offer price on that dish."),
    )
    name_en = models.CharField(max_length=150)
    name_bn = models.CharField(max_length=150, blank=True, default="")
    description_en = models.TextField(blank=True, default="")
    description_bn = models.TextField(blank=True, default="")
    code = models.CharField(
        max_length=50,
        blank=True,
        default="",
        help_text=_("Optional promo code customers can enter."),
    )
    discount_type = models.CharField(
        max_length=20,
        choices=DiscountType.choices,
        default=DiscountType.PERCENTAGE,
    )
    discount_value = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        help_text=_("Percentage (e.g. 15 for 15%) or fixed BDT amount."),
    )
    min_order_amount = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        default=0,
        help_text=_("Minimum order subtotal to qualify (0 = no minimum)."),
    )
    start_date = models.DateTimeField(blank=True, null=True)
    end_date = models.DateTimeField(blank=True, null=True)
    is_active = models.BooleanField(default=True)
    max_uses = models.PositiveIntegerField(
        blank=True,
        null=True,
        help_text=_("Leave blank for unlimited uses."),
    )
    current_uses = models.PositiveIntegerField(default=0)

    objects = TenantManager()

    class Meta:
        ordering = ("-created_at",)
        indexes = [
            models.Index(fields=("restaurant", "is_active")),
            models.Index(fields=("restaurant", "code")),
        ]

    def __str__(self) -> str:
        return f"{self.name_en} ({self.discount_value}{'%' if self.discount_type == 'percentage' else '৳'})"
