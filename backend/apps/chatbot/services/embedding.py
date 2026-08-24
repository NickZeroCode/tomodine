"""Embedding generation service.

Uses fastembed (ONNX-based, no PyTorch) with the BAAI/bge-small-en-v1.5 model.
~50 MB total download, runs on CPU, ~3 ms per sentence.  384 dimensions.

MiMo v2.5 is used ONLY for chat completions (the agent), NOT for embeddings.
"""

from __future__ import annotations

import logging
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from apps.menus.models import Dish

logger = logging.getLogger(__name__)

# Lazy-loaded model — only loaded on first embedding request.
_model = None
MODEL_NAME = "BAAI/bge-small-en-v1.5"
DIMENSIONS = 384


def _get_model():
    global _model
    if _model is None:
        from fastembed import TextEmbedding
        logger.info("Loading embedding model: %s (first call, ~50 MB download)", MODEL_NAME)
        _model = TextEmbedding(model_name=MODEL_NAME)
        logger.info("Embedding model loaded successfully (%d dimensions)", DIMENSIONS)
    return _model


def build_embedding_text(dish: "Dish") -> str:
    """Build the text representation of a dish for embedding."""
    parts = [dish.name_en or ""]
    if dish.name_bn:
        parts.append(dish.name_bn)
    if dish.description_en:
        parts.append(dish.description_en)
    if dish.description_bn:
        parts.append(dish.description_bn)
    # Category name if available.
    cat = getattr(dish, "category", None)
    if cat and getattr(cat, "name_en", None):
        parts.append(f"Category: {cat.name_en}")
    # Dietary tags.
    if dish.is_vegetarian:
        parts.append("Vegetarian")
    if dish.is_spicy:
        parts.append("Spicy")
    return " — ".join(p for p in parts if p)


def generate_embedding(text: str) -> list[float]:
    """Generate a 384-dim embedding vector using the local fastembed model."""
    model = _get_model()
    # fastembed returns a generator; list() materialises it.
    embeddings = list(model.embed([text[:2000]]))
    return embeddings[0].tolist()


def sync_dish_embedding(dish_id: str) -> None:
    """Generate (or update) the embedding for a single dish.

    Safe to call from signals, Celery tasks, or management commands.
    """
    from apps.chatbot.models import MenuEmbedding
    from apps.menus.models import Dish

    dish = (
        Dish.objects.select_related("restaurant", "category")
        .filter(pk=dish_id)
        .first()
    )
    if dish is None or not dish.is_available:
        # Dish was deleted or is unavailable — remove stale embedding.
        deleted, _ = MenuEmbedding.objects.filter(dish_id=dish_id).delete()
        if deleted:
            from apps.chatbot.services.retrieval import invalidate_cache
            # We don't know the restaurant_id from the deleted row, so
            # clear all caches (safe — just forces a DB reload).
            from apps.chatbot.services.retrieval import _EMBED_CACHE
            _EMBED_CACHE.clear()
        return

    text = build_embedding_text(dish)
    if len(text.strip()) < 5:
        logger.warning("Dish %s has insufficient text for embedding; skipping.", dish_id)
        return

    try:
        vector = generate_embedding(text)
    except Exception:
        logger.exception("Failed to generate embedding for dish %s", dish_id)
        return

    MenuEmbedding.objects.update_or_create(
        restaurant=dish.restaurant,
        dish=dish,
        defaults={
            "embedding": vector,
            "dish_name": dish.name_en or dish.name_bn or "",
            "dish_category": getattr(getattr(dish, "category", None), "name_en", "") or "",
            "description": dish.description_en or dish.description_bn or "",
            "price": dish.price,
            "is_available": dish.is_available,
        },
    )

    # Invalidate the retrieval cache so next query picks up the new embedding.
    from apps.chatbot.services.retrieval import invalidate_cache
    invalidate_cache(str(dish.restaurant_id))


def sync_all_embeddings(restaurant_id: str) -> int:
    """Re-generate embeddings for every available dish in a branch.

    Returns the number of dishes processed.
    """
    from apps.menus.models import Dish

    dishes = Dish.objects.filter(
        restaurant_id=restaurant_id,
        is_available=True,
    ).values_list("id", flat=True)

    count = 0
    for dish_id in dishes:
        sync_dish_embedding(str(dish_id))
        count += 1

    return count
