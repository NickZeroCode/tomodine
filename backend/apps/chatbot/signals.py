"""Django signals for the chatbot app.

Automatically triggers embedding sync when a dish is created or updated.
"""

from __future__ import annotations

import logging

from django.db.models.signals import post_save
from django.dispatch import receiver

logger = logging.getLogger(__name__)


@receiver(post_save, sender="menus.Dish")
def sync_embedding_on_dish_save(sender, instance, created, **kwargs):
    """Trigger embedding sync whenever a dish is saved.

    Uses Celery if available; otherwise runs synchronously in-process.
    The task is idempotent — safe to call multiple times for the same dish.
    """
    # Only sync if the dish is available (unavailable dishes get removed).
    if not instance.is_available:
        return

    try:
        from apps.chatbot.tasks import sync_dish_embedding_task
        # .delay() sends to Celery if available; otherwise runs inline.
        sync_dish_embedding_task.delay(str(instance.pk))
        logger.debug("Queued embedding sync for dish %s (%s)", instance.pk, "created" if created else "updated")
    except Exception:
        # Celery not available — run synchronously.
        try:
            from apps.chatbot.services.embedding import sync_dish_embedding
            sync_dish_embedding(str(instance.pk))
            logger.debug("Synced embedding inline for dish %s", instance.pk)
        except Exception:
            logger.warning("Failed to sync embedding for dish %s", instance.pk, exc_info=True)
