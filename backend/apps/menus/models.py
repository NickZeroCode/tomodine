"""Menu domain: menus, categories, dishes, variants, modifiers."""

from __future__ import annotations

from django.db import models
from django.utils.translation import gettext_lazy as _

from apps.core.managers import TenantManager
from apps.core.models import (
    LocalizedDescriptionModel,
    LocalizedNameModel,
    TimeStampedModel,
)


class Menu(LocalizedNameModel, LocalizedDescriptionModel, TimeStampedModel):
    restaurant = models.ForeignKey(
        "restaurants.Restaurant", on_delete=models.CASCADE, related_name="menus"
    )
    is_active = models.BooleanField(default=True, db_index=True)
    display_order = models.PositiveIntegerField(default=0)

    objects = TenantManager()

    class Meta:
        ordering = ("display_order", "name_en")
        indexes = [models.Index(fields=("restaurant", "is_active"))]


class MenuCategory(LocalizedNameModel, LocalizedDescriptionModel, TimeStampedModel):
    restaurant = models.ForeignKey(
        "restaurants.Restaurant", on_delete=models.CASCADE, related_name="menu_categories"
    )
    menu = models.ForeignKey(Menu, on_delete=models.CASCADE, related_name="categories")
    display_order = models.PositiveIntegerField(default=0)
    is_active = models.BooleanField(default=True, db_index=True)

    objects = TenantManager()

    class Meta:
        ordering = ("display_order", "name_en")
        indexes = [
            models.Index(fields=("restaurant", "menu")),
            models.Index(fields=("restaurant", "is_active")),
        ]


class Dish(LocalizedNameModel, LocalizedDescriptionModel, TimeStampedModel):
    restaurant = models.ForeignKey(
        "restaurants.Restaurant", on_delete=models.CASCADE, related_name="dishes"
    )
    category = models.ForeignKey(
        MenuCategory, on_delete=models.CASCADE, related_name="dishes"
    )
    price = models.DecimalField(max_digits=10, decimal_places=2)
    image = models.ImageField(upload_to="dishes/", blank=True, null=True)
    is_available = models.BooleanField(default=True, db_index=True)
    is_featured = models.BooleanField(default=False)
    is_vegetarian = models.BooleanField(default=False)
    is_spicy = models.BooleanField(default=False)
    min_prep_time = models.PositiveIntegerField(
        default=15,
        help_text="Minimum preparation time in minutes.",
    )
    max_prep_time = models.PositiveIntegerField(
        default=30,
        help_text="Maximum preparation time in minutes.",
    )
    display_order = models.PositiveIntegerField(default=0)

    objects = TenantManager()

    class Meta:
        ordering = ("display_order", "name_en")
        indexes = [
            models.Index(fields=("restaurant", "category")),
            models.Index(fields=("restaurant", "is_available")),
        ]


class DishVariant(LocalizedNameModel, TimeStampedModel):
    """Size/portion options, e.g. Half / Full / Large."""

    dish = models.ForeignKey(Dish, on_delete=models.CASCADE, related_name="variants")
    restaurant = models.ForeignKey(
        "restaurants.Restaurant", on_delete=models.CASCADE, related_name="dish_variants"
    )
    price_delta = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    is_default = models.BooleanField(default=False)
    display_order = models.PositiveIntegerField(default=0)

    objects = TenantManager()

    class Meta:
        ordering = ("display_order", "name_en")


class DishModifier(LocalizedNameModel, TimeStampedModel):
    """Add-ons / extras, e.g. Extra Cheese, Extra Spicy."""

    dish = models.ForeignKey(Dish, on_delete=models.CASCADE, related_name="modifiers")
    restaurant = models.ForeignKey(
        "restaurants.Restaurant", on_delete=models.CASCADE, related_name="dish_modifiers"
    )
    price_delta = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    is_available = models.BooleanField(default=True)

    objects = TenantManager()

    class Meta:
        ordering = ("name_en",)
