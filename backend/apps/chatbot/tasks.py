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
