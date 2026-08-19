"""Role-Based Access Control scoped per restaurant."""

from __future__ import annotations

from django.db import models
from django.utils.translation import gettext_lazy as _

from apps.core.models import TimeStampedModel


class Permission(TimeStampedModel):
    """A granular capability, e.g. ``orders.accept`` or ``menu.edit``."""

    codename = models.CharField(max_length=100, unique=True, db_index=True)
    name_en = models.CharField(max_length=150)
    name_bn = models.CharField(max_length=150, blank=True, default="")
    group = models.CharField(max_length=60, db_index=True, default="general")

    class Meta:
        ordering = ("group", "codename")

    def __str__(self) -> str:  # pragma: no cover
        return self.codename


class Role(TimeStampedModel):
    """A named set of permissions belonging to a restaurant.

    ``is_system`` marks seeded roles (Owner, Manager, Waiter, Kitchen,
    Cashier) that should not be deleted.
    """

    restaurant = models.ForeignKey(
        "restaurants.Restaurant",
        on_delete=models.CASCADE,
        related_name="roles",
        null=True,
        blank=True,
        help_text=_("Null for globally shared system roles."),
    )
    name_en = models.CharField(max_length=100)
    name_bn = models.CharField(max_length=100, blank=True, default="")
    slug = models.SlugField(max_length=100)
    permissions = models.ManyToManyField(Permission, related_name="roles", blank=True)
    is_system = models.BooleanField(default=False)

    class Meta:
        unique_together = (("restaurant", "slug"),)
        indexes = [models.Index(fields=("restaurant", "slug"))]

    def __str__(self) -> str:  # pragma: no cover
        return self.name_en
