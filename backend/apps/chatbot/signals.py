"""Django signals for the chatbot app.

Automatically triggers embedding sync when a dish is created or updated.
Also syncs on delete to remove stale embeddings.
"""

from __future__ import annotations

import logging

from django.db.models.signals import post_save, post_delete
from django.dispatch import receiver

logger = logging.getLogger(__name__)


def _queue_sync(dish_id: str, label: str):
    """Try Celery first; fall back to synchronous."""
    try:
        from apps.chatbot.tasks import sync_dish_embedding_task
        sync_dish_embedding_task.delay(dish_id)
        logger.debug("Queued embedding sync for dish %s (%s)", dish_id, label)
    except Exception:
        try:
            from apps.chatbot.services.embedding import sync_dish_embedding
            sync_dish_embedding(dish_id)
            logger.debug("Synced embedding inline for dish %s", dish_id)
        except Exception:
            logger.warning("Failed to sync embedding for dish %s", dish_id, exc_info=True)


@receiver(post_save, sender="menus.Dish")
def sync_embedding_on_dish_save(sender, instance, created, **kwargs):
    """Trigger embedding sync whenever a dish is saved."""
    _queue_sync(str(instance.pk), "created" if created else "updated")


@receiver(post_delete, sender="menus.Dish")
def remove_embedding_on_dish_delete(sender, instance, **kwargs):
    """Remove the embedding when a dish is deleted."""
    try:
        from apps.chatbot.models import MenuEmbedding
        from apps.chatbot.services.retrieval import invalidate_cache
        deleted, _ = MenuEmbedding.objects.filter(dish_id=instance.pk).delete()
        invalidate_cache(str(instance.restaurant_id))
        logger.debug("Removed %d embedding(s) for deleted dish %s", deleted, instance.pk)
    except Exception:
        logger.warning("Failed to remove embedding for deleted dish %s", instance.pk, exc_info=True)
