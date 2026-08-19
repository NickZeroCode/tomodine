"""Tests for subscription entitlement / plan-limit enforcement."""

from __future__ import annotations

from decimal import Decimal

from rest_framework import status
from rest_framework.test import APITestCase

from apps.billing.models import Subscription, SubscriptionPlan
from apps.menus.models import Dish, Menu, MenuCategory

from .factories import make_restaurant, make_subscription, make_user


def make_plan(code: str, **overrides) -> SubscriptionPlan:
    defaults = {
        "name_en": code.title(),
        "price": Decimal("0"),
        "interval": SubscriptionPlan.Interval.MONTHLY,
        "max_tables": 20,
        "max_staff": 10,
        "max_dishes": 200,
        "has_analytics": True,
    }
    defaults.update(overrides)
    return SubscriptionPlan.objects.create(code=code, **defaults)


class PlanLimitTests(APITestCase):
    def setUp(self):
        self.owner = make_user("owner@example.com")
        self.restaurant = make_restaurant(self.owner, "Limit House")
        self.client.force_authenticate(self.owner)
        self.slug = {"HTTP_X_RESTAURANT_SLUG": self.restaurant.slug}

    # -- tables ---------------------------------------------------------
    def test_table_creation_blocked_at_limit(self):
        plan = make_plan("tiny", max_tables=1)
        Subscription.objects.create(restaurant=self.restaurant, plan=plan)
        first = self.client.post(
            "/api/v1/tables/", {"number": "T1", "seats": 2}, format="json", **self.slug
        )
        self.assertEqual(first.status_code, status.HTTP_201_CREATED)
        second = self.client.post(
            "/api/v1/tables/", {"number": "T2", "seats": 2}, format="json", **self.slug
        )
        self.assertEqual(second.status_code, status.HTTP_403_FORBIDDEN)

    # -- dishes ---------------------------------------------------------
    def test_dish_creation_blocked_at_limit(self):
        plan = make_plan("tiny-dish", max_dishes=1)
        Subscription.objects.create(restaurant=self.restaurant, plan=plan)
        menu = Menu.objects.create(restaurant=self.restaurant, name_en="Main")
        category = MenuCategory.objects.create(
            restaurant=self.restaurant, menu=menu, name_en="Cat"
        )
        Dish.objects.create(
            restaurant=self.restaurant, category=category,
            name_en="Dish 1", price=Decimal("100"),
        )
        response = self.client.post(
            "/api/v1/dishes/",
            {"category": str(category.id), "name_en": "Dish 2", "price": "100"},
            format="json",
            **self.slug,
        )
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    # -- analytics gating ----------------------------------------------
    def test_analytics_blocked_without_plan_flag(self):
        plan = make_plan("no-analytics", has_analytics=False)
        Subscription.objects.create(restaurant=self.restaurant, plan=plan)
        response = self.client.get("/api/v1/analytics/overview/", **self.slug)
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_analytics_allowed_with_plan_flag(self):
        make_subscription(self.restaurant)
        response = self.client.get("/api/v1/analytics/overview/", **self.slug)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
