"""Tenant resolution middleware.

Resolves the active restaurant from the ``X-Restaurant-Slug`` header (or the
``restaurant`` query parameter) and attaches:

- ``request.restaurant`` — the Restaurant instance (or None)
- ``request.membership`` — the authenticated user's membership in that
  restaurant (or None)

Views/permissions then enforce isolation. This middleware performs *lookup*
only; authorization is enforced by permission classes, never by trusting the
client-supplied slug.
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

        slug = request.headers.get("X-Restaurant-Slug") or request.GET.get("restaurant")
        if not slug:
            return None

        try:
            restaurant = Restaurant.objects.get(slug=slug)
        except Restaurant.DoesNotExist:
            logger.info("Unknown restaurant slug requested: %s", slug)
            return None

        request.restaurant = restaurant

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
