"""Tenant-scoped queryset helpers enforcing data isolation."""

from __future__ import annotations

from typing import TYPE_CHECKING

from django.db import models

if TYPE_CHECKING:
    from apps.restaurants.models import Restaurant


class TenantQuerySet(models.QuerySet):
    def for_restaurant(self, restaurant: "Restaurant") -> "TenantQuerySet":
        return self.filter(restaurant=restaurant)


class TenantManager(models.Manager):
    def get_queryset(self) -> TenantQuerySet:
        return TenantQuerySet(self.model, using=self._db)

    def for_restaurant(self, restaurant: "Restaurant") -> TenantQuerySet:
        return self.get_queryset().for_restaurant(restaurant)
