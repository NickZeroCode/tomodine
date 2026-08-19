"""Restaurant tenant and membership models."""

from __future__ import annotations

from django.conf import settings
from django.db import models
from django.utils.text import slugify
from django.utils.translation import gettext_lazy as _

from apps.core.models import TimeStampedModel


class Restaurant(TimeStampedModel):
    """A tenant in the SaaS. Every piece of business data hangs off this."""

    class Status(models.TextChoices):
        ACTIVE = "active", _("Active")
        SUSPENDED = "suspended", _("Suspended")
        CLOSED = "closed", _("Closed")

    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="owned_restaurants",
    )
    name = models.CharField(max_length=255)
    slug = models.SlugField(max_length=255, unique=True, db_index=True)
    description = models.TextField(blank=True, default="")
    logo = models.ImageField(upload_to="restaurants/logos/", blank=True, null=True)
    cover_image = models.ImageField(upload_to="restaurants/covers/", blank=True, null=True)
    phone = models.CharField(max_length=20, blank=True, default="")
    email = models.EmailField(blank=True, default="")
    website = models.URLField(blank=True, default="")

    # Bangladesh-structured address
    address_line = models.CharField(max_length=255, blank=True, default="")
    area = models.CharField(max_length=120, blank=True, default="")
    upazila = models.CharField(max_length=120, blank=True, default="")
    district = models.CharField(max_length=120, blank=True, default="")
    division = models.CharField(max_length=120, blank=True, default="")

    currency = models.CharField(max_length=3, default="BDT")
    default_language = models.CharField(
        max_length=5, choices=(("en", "English"), ("bn", "বাংলা")), default="en"
    )
    opening_time = models.TimeField(blank=True, null=True)
    closing_time = models.TimeField(blank=True, null=True)

    status = models.CharField(
        max_length=20, choices=Status.choices, default=Status.ACTIVE, db_index=True
    )

    class Meta:
        ordering = ("name",)
        indexes = [models.Index(fields=("slug",)), models.Index(fields=("status",))]

    def __str__(self) -> str:  # pragma: no cover
        return self.name

    def save(self, *args, **kwargs):
        if not self.slug:
            base = slugify(self.name) or "restaurant"
            candidate = base
            suffix = 1
            while Restaurant.objects.filter(slug=candidate).exclude(pk=self.pk).exists():
                suffix += 1
                candidate = f"{base}-{suffix}"
            self.slug = candidate
        super().save(*args, **kwargs)


class RestaurantMembership(TimeStampedModel):
    """Links a user to a restaurant with a role (RBAC) and ownership flag."""

    restaurant = models.ForeignKey(
        Restaurant, on_delete=models.CASCADE, related_name="memberships"
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="restaurant_memberships",
    )
    role = models.ForeignKey(
        "rbac.Role",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="memberships",
    )
    is_owner = models.BooleanField(default=False)
    is_active = models.BooleanField(default=True, db_index=True)
    invited_email = models.EmailField(blank=True, default="")

    class Meta:
        unique_together = (("restaurant", "user"),)
        indexes = [
            models.Index(fields=("restaurant", "user")),
            models.Index(fields=("restaurant", "is_active")),
        ]

    def __str__(self) -> str:  # pragma: no cover
        return f"{self.user} @ {self.restaurant}"
