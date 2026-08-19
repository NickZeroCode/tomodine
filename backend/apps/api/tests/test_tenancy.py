"""Tenant isolation tests: Restaurant A must never see Restaurant B's data."""

from __future__ import annotations

from rest_framework import status
from rest_framework.test import APITestCase

from .factories import (
    make_menu_with_dish,
    make_restaurant,
    make_subscription,
    make_table_with_qr,
    make_user,
)


class TenantIsolationTests(APITestCase):
    def setUp(self):
        self.owner_a = make_user("a@example.com")
        self.restaurant_a = make_restaurant(self.owner_a, "Restaurant A")
        make_subscription(self.restaurant_a)
        make_menu_with_dish(self.restaurant_a)
        self.table_a, _ = make_table_with_qr(self.restaurant_a, "A1")

        self.owner_b = make_user("b@example.com")
        self.restaurant_b = make_restaurant(self.owner_b, "Restaurant B")
        make_subscription(self.restaurant_b)
        make_menu_with_dish(self.restaurant_b)
        self.table_b, _ = make_table_with_qr(self.restaurant_b, "B1")

        self.client.force_authenticate(self.owner_a)

    def test_user_a_cannot_list_user_b_tables(self):
        self.client.force_authenticate(self.owner_a)
        response = self.client.get(
            "/api/v1/tables/", HTTP_X_RESTAURANT_SLUG=self.restaurant_b.slug
        )
        # No membership in B => forbidden
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_user_a_sees_only_own_tables(self):
        response = self.client.get(
            "/api/v1/tables/", HTTP_X_RESTAURANT_SLUG=self.restaurant_a.slug
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        results = response.data.get("results", response.data)
        numbers = {row["number"] for row in results}
        self.assertIn("A1", numbers)
        self.assertNotIn("B1", numbers)

    def test_user_a_cannot_access_user_b_table_detail(self):
        response = self.client.get(
            f"/api/v1/tables/{self.table_b.id}/",
            HTTP_X_RESTAURANT_SLUG=self.restaurant_a.slug,
        )
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_unauthenticated_request_rejected(self):
        self.client.force_authenticate(user=None)
        response = self.client.get(
            "/api/v1/tables/", HTTP_X_RESTAURANT_SLUG=self.restaurant_a.slug
        )
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
