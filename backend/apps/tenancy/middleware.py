"""Tenant resolution middleware.

Resolves the active branch from the ``X-Branch-ID`` header (UUID) or the
``X-Restaurant-Slug`` header (backward compat) and attaches:

- ``request.restaurant`` — the Branch/Restaurant instance (or None)
- ``request.membership`` — the authenticated user's membership in that
  branch (or None)
- ``request.organization`` — the owning Organization (or None)

Views/permissions then enforce isolation. This middleware performs *lookup*
only; authorization is enforced by permission classes, never by trusting the
client-supplied id/slug.
"""

from __future__ import annotations

import logging

from django.utils.deprecation import MiddlewareMixin

from apps.restaurants.models import Restaurant, RestaurantMembership

logger = logging.getLogger("apps")


class TenantContextMiddleware(MiddlewareMixin):
    def process_request(self, request):
        request.restaurant = None
        request.membership = None
        request.organization = None

        # Prefer explicit branch ID (UUID); fall back to slug for backward
        # compat with older clients and the WS auth flow.
        branch_id = request.headers.get("X-Branch-ID")
        slug = request.headers.get("X-Restaurant-Slug") or request.GET.get("restaurant")

        restaurant = None
        if branch_id:
            try:
                restaurant = Restaurant.objects.select_related("organization").get(pk=branch_id)
            except (Restaurant.DoesNotExist, Exception):
                logger.info("Unknown branch ID requested: %s", branch_id)
        elif slug:
            try:
                restaurant = Restaurant.objects.select_related("organization").get(slug=slug)
            except Restaurant.DoesNotExist:
                logger.info("Unknown restaurant slug requested: %s", slug)

        if restaurant is None:
            return None

        request.restaurant = restaurant
        request.organization = restaurant.organization

        user = getattr(request, "user", None)
        if user and user.is_authenticated:
            request.membership = (
                RestaurantMembership.objects.filter(
                    restaurant=restaurant, user=user, is_active=True
                )
                .select_related("role")
                .first()
            )
        return None
