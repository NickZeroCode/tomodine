"""Subscription entitlement checks — enforce plan limits at write time.

These guards run in the API layer before creating tenant resources so a
restaurant can never exceed the limits of its current plan. Fail-open is NOT
acceptable here: if no active subscription exists, treat the restaurant as
unentitled (limits of zero) rather than allowing unbounded growth.

A subscription belongs to the whole restaurant, not a single branch: every
branch that shares the owner/organization shares the subscription
(``subscription_scope``).  A plan bought on one branch unlocks every
sibling branch.
"""

from __future__ import annotations

from dataclasses import dataclass

from django.db.models import Q

from apps.billing.models import Subscription


@dataclass(frozen=True)
class Entitlements:
    """Resolved limits for a restaurant's current subscription."""

    entitled: bool
    max_tables: int
    max_staff: int
    max_dishes: int
    has_analytics: bool


def subscription_scope(restaurant) -> Q:
    """Q filter matching every Subscription shared with ``restaurant``.

    All branches owned by the same owner or linked to the same organization
    share one subscription.  The owner clause covers legacy branches created
    before the organization link existed (organization NULL), so those
    branches still see the restaurant's subscription.
    """
    if restaurant is None:
        return Q(pk__in=[])  # matches nothing — fail closed
    scope = Q(restaurant__owner_id=restaurant.owner_id)
    if restaurant.organization_id:
        scope |= Q(restaurant__organization_id=restaurant.organization_id)
    return scope


def _coverage_end(subscription: Subscription):
    """When the subscription's coverage runs out (never None)."""
    if (
        subscription.status == Subscription.Status.TRIALING
        and subscription.trial_ends_at
    ):
        return subscription.trial_ends_at
    return (
        subscription.current_period_end
        or subscription.trial_ends_at
        or subscription.started_at
    )


def _pick_best(candidates: list[Subscription]) -> Subscription | None:
    """Best subscription: entitled first, then furthest coverage, pk tiebreak."""
    if not candidates:
        return None
    return max(candidates, key=lambda s: (s.is_entitled, _coverage_end(s), s.pk))


def resolve_subscription(restaurant) -> Subscription | None:
    """Return the subscription shared by ``restaurant``'s branches, if any.

    Organization-wide lookup: a subscription bought on one branch applies to
    every sibling branch.  When multiple rows exist (historical per-branch
    subscriptions), the entitled one with the furthest coverage wins so
    callers always see the effective subscription.
    """
    if restaurant is None:
        return None
    candidates = list(
        Subscription.objects.filter(subscription_scope(restaurant)).select_related(
            "plan"
        )
    )
    return _pick_best(candidates)


def resolve_subscription_for_user(user) -> Subscription | None:
    """Best subscription among the restaurants ``user`` owns.

    Used by branch creation, where the new branch does not exist yet —
    scope by ownership instead of by branch.
    """
    if user is None or not getattr(user, "is_authenticated", False):
        return None
    candidates = list(
        Subscription.objects.filter(
            Q(restaurant__owner_id=user.pk)
            | Q(
                restaurant__memberships__user_id=user.pk,
                restaurant__memberships__is_owner=True,
            )
        )
        .select_related("plan")
        .distinct()
    )
    return _pick_best(candidates)


def get_entitlements(restaurant) -> Entitlements:
    """Return the effective entitlements for a restaurant.

    Entitlements are shared across every branch of the restaurant (see
    ``subscription_scope``): a subscription bought on one branch unlocks the
    plan for all of its sibling branches.  A restaurant without an active
    (in-trial or paid) subscription gets zero limits, which blocks creation
    of new plan-gated resources while still allowing reads and order flow to
    be handled by callers as they see fit.
    """
    subscription = resolve_subscription(restaurant)
    if subscription is None or not subscription.is_entitled:
        return Entitlements(
            entitled=False,
            max_tables=0,
            max_staff=0,
            max_dishes=0,
            has_analytics=False,
        )
    plan = subscription.plan
    return Entitlements(
        entitled=True,
        max_tables=plan.max_tables,
        max_staff=plan.max_staff,
        max_dishes=plan.max_dishes,
        has_analytics=plan.has_analytics,
    )


class PlanLimitExceeded(Exception):
    """Raised when a write would exceed the restaurant's plan limit."""

    def __init__(self, resource: str, limit: int):
        self.resource = resource
        self.limit = limit
        super().__init__(f"Plan limit reached for {resource} (max {limit}).")


def check_table_limit(restaurant) -> None:
    from apps.tables.models import Table

    ent = get_entitlements(restaurant)
    if ent.max_tables <= 0:
        raise PlanLimitExceeded("tables", ent.max_tables)
    count = Table.objects.filter(restaurant=restaurant, is_active=True).count()
    if count >= ent.max_tables:
        raise PlanLimitExceeded("tables", ent.max_tables)


def check_dish_limit(restaurant) -> None:
    from apps.menus.models import Dish

    ent = get_entitlements(restaurant)
    if ent.max_dishes <= 0:
        raise PlanLimitExceeded("dishes", ent.max_dishes)
    count = Dish.objects.filter(restaurant=restaurant).count()
    if count >= ent.max_dishes:
        raise PlanLimitExceeded("dishes", ent.max_dishes)


def check_staff_limit(restaurant) -> None:
    from apps.restaurants.models import RestaurantMembership

    ent = get_entitlements(restaurant)
    if ent.max_staff <= 0:
        raise PlanLimitExceeded("staff", ent.max_staff)
    count = RestaurantMembership.objects.filter(
        restaurant=restaurant, is_active=True
    ).count()
    if count >= ent.max_staff:
        raise PlanLimitExceeded("staff", ent.max_staff)
