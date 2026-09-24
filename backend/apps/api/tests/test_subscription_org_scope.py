"""Subscription sharing across every branch of the same restaurant.

A subscription is restaurant-wide: any branch under the same organization
(or, for legacy rows, owned by the same owner) must see and use it.  Other
tenants must never see it.
"""

from __future__ import annotations

from datetime import timedelta
from decimal import Decimal

from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from apps.billing.entitlements import get_entitlements, resolve_subscription
from apps.billing.models import Subscription, SubscriptionPlan
from apps.organizations.models import Organization
from apps.restaurants.models import Restaurant, RestaurantMembership

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


def results_of(data):
    """Paginated response → list, or plain list when pagination is off."""
    if isinstance(data, dict):
        return data.get("results", [])
    return data


def ids_of(rows) -> set[str]:
    return {str(row["id"]) for row in rows}


def make_branch(owner, organization, name) -> Restaurant:
    branch = Restaurant.objects.create(
        owner=owner, organization=organization, name=name
    )
    RestaurantMembership.objects.create(
        restaurant=branch, user=owner, is_owner=True
    )
    return branch


class RestaurantWideSubscriptionTests(APITestCase):
    """Same organization → every branch shares the subscription."""

    def setUp(self):
        self.owner = make_user("rw-owner@example.com")
        self.org = Organization.objects.create(owner=self.owner, name="RW Holding")
        self.branch_a = make_branch(self.owner, self.org, "RW Main")
        self.branch_b = make_branch(self.owner, self.org, "RW Second")
        # Live, entitled subscription created on branch A only.
        self.subscription = make_subscription(self.branch_a)
        self.client.force_authenticate(self.owner)
        self.ctx_a = {"HTTP_X_RESTAURANT_SLUG": self.branch_a.slug}
        self.ctx_b = {"HTTP_X_RESTAURANT_SLUG": self.branch_b.slug}

    def test_entitlements_shared_with_sibling_branch(self):
        ent = get_entitlements(self.branch_b)
        self.assertTrue(ent.entitled)
        self.assertTrue(ent.has_analytics)
        self.assertEqual(ent.max_tables, 20)

    def test_resolve_subscription_finds_org_subscription_from_sibling(self):
        sub = resolve_subscription(self.branch_b)
        self.assertIsNotNone(sub)
        self.assertEqual(sub.pk, self.subscription.pk)

    def test_analytics_allowed_on_sibling_branch(self):
        response = self.client.get("/api/v1/analytics/overview/", **self.ctx_b)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_subscription_list_visible_from_sibling_branch(self):
        response = self.client.get("/api/v1/subscriptions/", **self.ctx_b)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        results = results_of(response.data)
        self.assertIn(str(self.subscription.id), ids_of(results))
        self.assertTrue(results[0]["is_entitled"])

    def test_expired_org_subscription_blocks_sibling_branches(self):
        self.subscription.status = Subscription.Status.EXPIRED
        self.subscription.save(update_fields=["status"])
        self.assertFalse(get_entitlements(self.branch_b).entitled)
        response = self.client.get("/api/v1/analytics/overview/", **self.ctx_b)
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_subscribe_from_sibling_updates_single_subscription(self):
        pro_plan = make_plan(
            "pro-shared", price=Decimal("999"), max_tables=50, has_analytics=True
        )

        def org_count():
            return Subscription.objects.filter(
                restaurant__organization=self.org
            ).count()

        self.assertEqual(org_count(), 1)
        response = self.client.post(
            "/api/v1/subscriptions/subscribe/",
            {"plan_id": str(pro_plan.id)},
            format="json",
            **self.ctx_b,
        )
        self.assertIn(
            response.status_code,
            (status.HTTP_200_OK, status.HTTP_201_CREATED),
        )
        # Still exactly ONE subscription row for the whole restaurant.
        self.assertEqual(org_count(), 1)
        self.assertEqual(str(response.data["id"]), str(self.subscription.id))
        self.subscription.refresh_from_db()
        self.assertEqual(self.subscription.plan_id, pro_plan.id)
        self.assertEqual(self.subscription.status, Subscription.Status.ACTIVE)
        # And the new plan is now shared with the sibling that subscribed.
        self.assertTrue(get_entitlements(self.branch_a).entitled)

    def test_subscribe_creates_when_restaurant_has_none(self):
        other_owner = make_user("rw-fresh@example.com")
        other_branch = make_restaurant(other_owner, "Fresh Spot")
        plan = make_plan("fresh-plan")
        self.client.force_authenticate(other_owner)
        response = self.client.post(
            "/api/v1/subscriptions/subscribe/",
            {"plan_id": str(plan.id)},
            format="json",
            HTTP_X_RESTAURANT_SLUG=other_branch.slug,
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        sub = Subscription.objects.get(restaurant=other_branch)
        self.assertEqual(sub.plan_id, plan.id)
        self.assertEqual(sub.status, Subscription.Status.ACTIVE)

    def test_other_restaurant_does_not_see_subscription(self):
        other_owner = make_user("rw-other@example.com")
        other_branch = make_restaurant(other_owner, "Unrelated Spot")
        self.client.force_authenticate(other_owner)
        ctx = {"HTTP_X_RESTAURANT_SLUG": other_branch.slug}

        listing = self.client.get("/api/v1/subscriptions/", **ctx)
        self.assertEqual(listing.status_code, status.HTTP_200_OK)
        self.assertNotIn(
            str(self.subscription.id), ids_of(results_of(listing.data))
        )
        # Without a subscription of their own, analytics stays gated.
        analytics = self.client.get("/api/v1/analytics/overview/", **ctx)
        self.assertEqual(analytics.status_code, status.HTTP_403_FORBIDDEN)


class LegacyBranchSharingTests(APITestCase):
    """Branches created before the organization link (organization=NULL)."""

    def setUp(self):
        self.owner = make_user("legacy-owner@example.com")
        # organization intentionally NULL — legacy row shape.
        self.branch_a = make_branch(self.owner, None, "Legacy Main")
        self.branch_b = make_branch(self.owner, None, "Legacy Second")
        self.subscription = make_subscription(self.branch_a)
        self.client.force_authenticate(self.owner)
        self.ctx_b = {"HTTP_X_RESTAURANT_SLUG": self.branch_b.slug}

    def test_legacy_sibling_shares_subscription_without_org(self):
        self.assertIsNone(self.branch_a.organization_id)
        ent = get_entitlements(self.branch_b)
        self.assertTrue(ent.entitled)
        self.assertTrue(ent.has_analytics)

    def test_subscription_list_visible_from_legacy_sibling(self):
        response = self.client.get("/api/v1/subscriptions/", **self.ctx_b)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn(str(self.subscription.id), ids_of(results_of(response.data)))


class BranchCreationSubscriptionTests(APITestCase):
    """Creating a branch must never fork the subscription."""

    def setUp(self):
        self.owner = make_user("bc-owner@example.com")
        self.org = Organization.objects.create(owner=self.owner, name="BC Holding")
        self.branch = make_branch(self.owner, self.org, "BC Main")
        self.subscription = make_subscription(self.branch)
        self.client.force_authenticate(self.owner)
        self.ctx = {"HTTP_X_RESTAURANT_SLUG": self.branch.slug}

    def test_paid_restaurant_adds_branch_without_duplicating_subscription(self):
        self.subscription.status = Subscription.Status.ACTIVE
        self.subscription.current_period_end = timezone.now() + timedelta(days=30)
        self.subscription.save(update_fields=["status", "current_period_end"])

        response = self.client.post(
            "/api/v1/restaurants/", {"name": "BC Second"}, format="json", **self.ctx
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)

        new_branch = Restaurant.objects.get(name="BC Second")
        self.assertEqual(new_branch.organization_id, self.org.id)
        self.assertEqual(
            Subscription.objects.filter(restaurant__organization=self.org).count(),
            1,
        )
        ent = get_entitlements(new_branch)
        self.assertTrue(ent.entitled)
        self.assertTrue(ent.has_analytics)

    def test_trial_restaurant_still_limited_to_one_branch(self):
        # setUp subscription is TRIALING (model default) → second branch blocked.
        response = self.client.post(
            "/api/v1/restaurants/", {"name": "BC Blocked"}, format="json", **self.ctx
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.data.get("code"), "plan_limit_reached")


class SubscriptionListOrderingTests(APITestCase):
    """Entitled rows must sort before stale per-branch leftovers."""

    def setUp(self):
        self.owner = make_user("ord-owner@example.com")
        self.org = Organization.objects.create(owner=self.owner, name="Ord Holding")
        self.branch_a = make_branch(self.owner, self.org, "Ord Main")
        self.branch_b = make_branch(self.owner, self.org, "Ord Second")

        # Stale, lapsed trial left behind on branch B (historical shape).
        stale_plan = make_plan("stale-trial")
        self.stale = Subscription.objects.create(
            restaurant=self.branch_b,
            plan=stale_plan,
            status=Subscription.Status.TRIALING,
            trial_ends_at=timezone.now() - timedelta(days=3),
        )
        # Live paid subscription on branch A.
        live_plan = make_plan("live-paid", price=Decimal("1500"))
        self.live = Subscription.objects.create(
            restaurant=self.branch_a,
            plan=live_plan,
            status=Subscription.Status.ACTIVE,
            current_period_end=timezone.now() + timedelta(days=20),
        )
        self.client.force_authenticate(self.owner)
        self.ctx_b = {"HTTP_X_RESTAURANT_SLUG": self.branch_b.slug}

    def test_entitled_subscription_sorts_first_in_listing(self):
        response = self.client.get("/api/v1/subscriptions/", **self.ctx_b)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        results = results_of(response.data)
        self.assertGreaterEqual(len(results), 2)
        self.assertEqual(str(results[0]["id"]), str(self.live.id))
        self.assertTrue(results[0]["is_entitled"])
        self.assertFalse(results[1]["is_entitled"])

    def test_resolve_prefers_entitled_over_stale_trial(self):
        self.assertEqual(resolve_subscription(self.branch_b).pk, self.live.pk)
        ent = get_entitlements(self.branch_b)
        self.assertTrue(ent.entitled)
        self.assertTrue(ent.has_analytics)
