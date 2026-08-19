"""Shared permission primitives for tenant-scoped API access."""

from __future__ import annotations

from typing import Any

from rest_framework.permissions import BasePermission
from rest_framework.request import Request


def _resolve_membership(request: Request):
    """Return the active membership for request.user in request.restaurant.

    Resolved lazily here (not in middleware) because DRF authentication runs
    after Django middleware, so ``request.user`` is only guaranteed inside the
    permission/view layer.
    """
    cached = getattr(request, "_resolved_membership", None)
    if cached is not None:
        return cached

    membership = None
    user = request.user
    restaurant = getattr(request, "restaurant", None)
    if user and user.is_authenticated and restaurant is not None:
        from apps.restaurants.models import RestaurantMembership

        membership = (
            RestaurantMembership.objects.filter(
                restaurant=restaurant, user=user, is_active=True
            )
            .select_related("role")
            .first()
        )
    request._resolved_membership = membership
    return membership


class IsRestaurantMember(BasePermission):
    """Allow access only to users who belong to the resolved restaurant."""

    message = "You are not a member of this restaurant."

    def has_permission(self, request: Request, view: Any) -> bool:
        user = request.user
        if not user or not user.is_authenticated:
            return False
        if getattr(request, "restaurant", None) is None:
            return False
        return _resolve_membership(request) is not None


class HasRestaurantPermission(BasePermission):
    """Check a specific permission codename against the member's role.

    Views declare ``required_permission = "<codename>"``. Restaurant owners
    bypass codename checks (they hold all rights implicitly).
    """

    message = "You do not have the required permission."

    def has_permission(self, request: Request, view: Any) -> bool:
        required = getattr(view, "required_permission", None)
        if not required:
            return True
        membership = _resolve_membership(request)
        if membership is None or not membership.is_active:
            return False
        if membership.is_owner:
            return True
        role = membership.role
        if role is None:
            return False
        return role.permissions.filter(codename=required).exists()
