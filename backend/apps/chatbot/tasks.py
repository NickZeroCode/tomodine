"""Celery tasks for the AI Concierge chatbot.

Handles async embedding generation so dish saves never block the request.
"""

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


@shared_task(ignore_result=True, max_retries=3, default_retry_delay=10)
def sync_dish_embedding_task(dish_id: str):
    """Generate (or update) the embedding for a single dish.

    Safe to call from signals, management commands, or other tasks.
    Retries up to 3 times on transient failures (network, API timeout).
    """
    try:
        from apps.chatbot.services.embedding import sync_dish_embedding
        sync_dish_embedding(dish_id)
        logger.info("Embedding synced for dish %s", dish_id)
    except Exception as exc:
        logger.warning("Embedding sync failed for dish %s, retrying: %s", dish_id, exc)
        raise sync_dish_embedding_task.retry(exc=exc)


@shared_task(ignore_result=True)
def sync_all_embeddings_task(restaurant_id: str):
    """Re-generate embeddings for every available dish in a branch.

    Triggered manually or on branch creation.
    """
    from apps.chatbot.services.embedding import sync_all_embeddings
    count = sync_all_embeddings(restaurant_id)
    logger.info("Bulk sync complete for restaurant %s: %d dishes", restaurant_id, count)
    return count


@shared_task(ignore_result=True)
def sync_missing_embeddings_task():
    """Backfill embeddings for available dishes that don't have one yet.

    Covers the gaps per-dish signals miss: bulk ``queryset.update()`` writes,
    saves made while the broker was down, and dishes whose embedding text was
    previously too short to embed. Cheap on the common path — dishes that
    already have an embedding row are skipped without loading vectors.
    """
    from apps.chatbot.models import MenuEmbedding
    from apps.chatbot.services.embedding import sync_dish_embedding
    from apps.menus.models import Dish

    missing_ids = list(
        Dish.objects.filter(is_available=True)
        .exclude(pk__in=MenuEmbedding.objects.values("dish_id"))
        .values_list("pk", flat=True)
    )
    synced = 0
    for dish_id in missing_ids:
        try:
            sync_dish_embedding(dish_id)
            synced += 1
        except Exception as exc:  # keep backfilling the rest
            logger.warning("Embedding backfill failed for dish %s: %s", dish_id, exc)
    if synced:
        logger.info("Backfilled %d missing dish embedding(s)", synced)
    return {"synced": synced, "missing": len(missing_ids)}
