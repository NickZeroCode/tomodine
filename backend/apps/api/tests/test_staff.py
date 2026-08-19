"""Tests for staff management endpoints (roles + member add/update/remove)."""

from __future__ import annotations

from rest_framework import status
from rest_framework.test import APITestCase

from apps.rbac.models import Permission, Role
from apps.restaurants.models import RestaurantMembership

from .factories import make_restaurant, make_subscription, make_user


def make_staff_role() -> Role:
    perm, _ = Permission.objects.get_or_create(
        codename="staff.manage", defaults={"name_en": "Manage staff"}
    )
    role, _ = Role.objects.get_or_create(
        restaurant=None, slug="manager", defaults={"name_en": "Manager", "is_system": True}
    )
    role.permissions.add(perm)
    return role


class StaffManagementTests(APITestCase):
    def setUp(self):
        self.owner = make_user("owner@example.com")
        self.restaurant = make_restaurant(self.owner, "Staff Test House")
        make_subscription(self.restaurant)
        self.role = make_staff_role()
        self.client.force_authenticate(self.owner)
        self.base = f"/api/v1/restaurants/{self.restaurant.id}"

    def test_roles_lists_system_roles(self):
        response = self.client.get(f"{self.base}/roles/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        slugs = {r["slug"] for r in response.data}
        self.assertIn("manager", slugs)

    def test_owner_can_add_member_by_email(self):
        response = self.client.post(
            f"{self.base}/members/",
            {"email": "waiter@example.com", "role": str(self.role.id)},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["user_email"], "waiter@example.com")
        self.assertTrue(
            RestaurantMembership.objects.filter(
                restaurant=self.restaurant, user__email="waiter@example.com"
            ).exists()
        )

    def test_add_member_requires_email(self):
        response = self.client.post(f"{self.base}/members/", {"role": str(self.role.id)}, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_add_member_rejects_unknown_role(self):
        response = self.client.post(
            f"{self.base}/members/",
            {"email": "x@example.com", "role": "999999"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_non_member_cannot_add_staff(self):
        outsider = make_user("outsider@example.com")
        self.client.force_authenticate(outsider)
        response = self.client.post(
            f"{self.base}/members/",
            {"email": "y@example.com", "role": str(self.role.id)},
            format="json",
        )
        # Not a member of the restaurant at all -> 404 (get_object scoping)
        self.assertIn(response.status_code, (status.HTTP_403_FORBIDDEN, status.HTTP_404_NOT_FOUND))

    def test_owner_can_change_member_role(self):
        member_user = make_user("cook@example.com")
        membership = RestaurantMembership.objects.create(
            restaurant=self.restaurant, user=member_user
        )
        response = self.client.patch(
            f"{self.base}/members/{membership.id}/",
            {"role": str(self.role.id)},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        membership.refresh_from_db()
        self.assertEqual(membership.role_id, self.role.id)

    def test_owner_can_remove_member(self):
        member_user = make_user("temp@example.com")
        membership = RestaurantMembership.objects.create(
            restaurant=self.restaurant, user=member_user
        )
        response = self.client.delete(f"{self.base}/members/{membership.id}/")
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        membership.refresh_from_db()
        self.assertFalse(membership.is_active)

    def test_owner_membership_cannot_be_modified(self):
        owner_membership = RestaurantMembership.objects.get(
            restaurant=self.restaurant, user=self.owner
        )
        response = self.client.delete(f"{self.base}/members/{owner_membership.id}/")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
