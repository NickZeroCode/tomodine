"""Subscription entitlement checks — enforce plan limits at write time.

These guards run in the API layer before creating tenant resources so a
restaurant can never exceed the limits of its current plan. Fail-open is NOT
acceptable here: if no active subscription exists, treat the restaurant as
unentitled (limits of zero) rather than allowing unbounded growth.
"""

from __future__ import annotations

from dataclasses import dataclass

from apps.billing.models import Subscription


@dataclass(frozen=True)
class Entitlements:
    """Resolved limits for a restaurant's current subscription."""

    entitled: bool
    max_tables: int
    max_staff: int
    max_dishes: int
    has_analytics: bool


def get_entitlements(restaurant) -> Entitlements:
    """Return the effective entitlements for a restaurant.

    A restaurant without an active (in-trial or paid) subscription gets zero
    limits, which blocks creation of new plan-gated resources while still
    allowing reads and order flow to be handled by callers as they see fit.
    """
    subscription = (
        Subscription.objects.filter(restaurant=restaurant)
        .select_related("plan")
        .first()
    )
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
