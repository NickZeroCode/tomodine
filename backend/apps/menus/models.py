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
    """Add-ons / extras, e.g. Extra Cheese, Extra Spicy.

    Can optionally belong to a ModifierGroup for grouped selection
    (e.g. Spice Level → Mild/Medium/Spicy).
    Modifiers without a group are standalone add-ons (legacy behavior).
    """

    dish = models.ForeignKey(Dish, on_delete=models.CASCADE, related_name="modifiers")
    restaurant = models.ForeignKey(
        "restaurants.Restaurant", on_delete=models.CASCADE, related_name="dish_modifiers"
    )
    group = models.ForeignKey(
        "menus.ModifierGroup",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="options",
        help_text="Optional group this modifier belongs to. Null = standalone add-on.",
    )
    price_delta = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    is_available = models.BooleanField(default=True)
    is_default = models.BooleanField(
        default=False,
        help_text="Pre-selected when the customer opens this dish.",
    )
    display_order = models.PositiveIntegerField(default=0)

    objects = TenantManager()

    class Meta:
        ordering = ("display_order", "name_en")
        indexes = [
            models.Index(fields=["dish", "group"]),
        ]


class ModifierGroup(TimeStampedModel):
    """A category of choices for a dish (e.g. Portion Size, Spice Level, Add-ons).

    Selection rules:
    - min_selections = 0 → optional group
    - min_selections >= 1 → required group
    - max_selections = 1 → radio (pick one)
    - max_selections > 1 → checkbox (pick many)
    """

    dish = models.ForeignKey(Dish, on_delete=models.CASCADE, related_name="modifier_groups")
    restaurant = models.ForeignKey(
        "restaurants.Restaurant", on_delete=models.CASCADE, related_name="modifier_groups"
    )
    name_en = models.CharField(max_length=100)
    name_bn = models.CharField(max_length=100, blank=True, default="")
    min_selections = models.PositiveIntegerField(
        default=0,
        help_text="Minimum options the customer must select. 0 = optional, 1+ = required.",
    )
    max_selections = models.PositiveIntegerField(
        default=1,
        help_text="Maximum options the customer can select. 1 = radio, 2+ = checkboxes.",
    )
    is_active = models.BooleanField(default=True)
    display_order = models.PositiveIntegerField(default=0)

    objects = TenantManager()

    class Meta:
        ordering = ("display_order", "name_en")
        indexes = [
            models.Index(fields=["dish", "is_active"]),
        ]

    def __str__(self) -> str:
        return f"{self.name_en} ({self.dish_id})"

    @property
    def is_required(self) -> bool:
        return self.min_selections > 0


class DishAssociation(TimeStampedModel):
    """Frequently-bought-together association between two dishes.

    Computed via Apriori k=2 (co-occurrence in the same order).
    Directional: dish_a → dish_b with confidence and lift scores.
    """

    restaurant = models.ForeignKey(
        "restaurants.Restaurant", on_delete=models.CASCADE, related_name="dish_associations"
    )
    dish_a = models.ForeignKey(
        Dish, on_delete=models.CASCADE, related_name="associations_as_a"
    )
    dish_b = models.ForeignKey(
        Dish, on_delete=models.CASCADE, related_name="associations_as_b"
    )
    support = models.PositiveIntegerField(
        default=0, help_text="Number of orders containing both dishes."
    )
    confidence = models.DecimalField(
        max_digits=5, decimal_places=3, default=0,
        help_text="P(dish_b | dish_a) = support / orders_with_a.",
    )
    lift = models.DecimalField(
        max_digits=6, decimal_places=2, default=1,
        help_text="confidence / P(dish_b). >1 = real association.",
    )

    objects = TenantManager()

    class Meta:
        unique_together = [("restaurant", "dish_a", "dish_b")]
        indexes = [
            models.Index(fields=["restaurant", "dish_a", "-confidence"]),
            models.Index(fields=["restaurant", "dish_b"]),
        ]

    def __str__(self) -> str:
        return f"{self.dish_a_id} → {self.dish_b_id} (conf={self.confidence})"
