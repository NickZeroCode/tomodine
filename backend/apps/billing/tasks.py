"""Celery tasks for subscription lifecycle maintenance."""

from __future__ import annotations

import logging

logger = logging.getLogger(__name__)

# Try to import Celery; fall back to a synchronous stub for environments
# without Celery (dev, testing).
try:
    from celery import shared_task
except ImportError:
    # Stub decorator — runs the function synchronously.
    def shared_task(*args, **kwargs):
        def decorator(fn):
            return fn

        return decorator


@shared_task(ignore_result=True)
def expire_subscriptions():
    """Flip lapsed trial/period rows to EXPIRED.

    Entitlement itself is date-driven (``Subscription.is_entitled``), so this
    is bookkeeping: it keeps the Django admin, ``SubscriptionViewSet`` and the
    dashboards honest instead of showing a dead trial as "trialing" forever.
    Idempotent — safe to run as often as the beat schedule likes.
    """
    from django.utils import timezone

    from apps.billing.models import Subscription

    now = timezone.now()
    trial_expired = Subscription.objects.filter(
        status=Subscription.Status.TRIALING,
        trial_ends_at__isnull=False,
        trial_ends_at__lt=now,
    ).update(status=Subscription.Status.EXPIRED)
    period_expired = Subscription.objects.filter(
        status=Subscription.Status.ACTIVE,
        current_period_end__isnull=False,
        current_period_end__lt=now,
    ).update(status=Subscription.Status.EXPIRED)
    total = trial_expired + period_expired
    if total:
        logger.info("Expired %d lapsed subscription(s)", total)
    return {"trial_expired": trial_expired, "period_expired": period_expired}
