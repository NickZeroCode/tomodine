"""Shared abstract model primitives used across all apps.

Every tenant-scoped entity inherits from ``TenantModel`` so that:
- a ``restaurant`` foreign key is always present,
- the table gets a composite index on (restaurant, ...),
- queryset helpers can enforce tenant isolation centrally.
"""

from __future__ import annotations

import uuid

from django.db import models
from django.utils import timezone


class TimeStampedModel(models.Model):
    """Abstract base providing UUID primary key and audit timestamps."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    created_at = models.DateTimeField(default=timezone.now, db_index=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        abstract = True
        ordering = ("-created_at",)


class LocalizedNameModel(models.Model):
    """Provides bilingual name fields with graceful Bangla fallback."""

    name_en = models.CharField(max_length=255)
    name_bn = models.CharField(max_length=255, blank=True, default="")

    class Meta:
        abstract = True

    def localized_name(self, language: str = "en") -> str:
        if language == "bn" and self.name_bn:
            return self.name_bn
        return self.name_en


class LocalizedDescriptionModel(models.Model):
    """Provides bilingual description fields with graceful Bangla fallback."""

    description_en = models.TextField(blank=True, default="")
    description_bn = models.TextField(blank=True, default="")

    class Meta:
        abstract = True

    def localized_description(self, language: str = "en") -> str:
        if language == "bn" and self.description_bn:
            return self.description_bn
        return self.description_en
