"""Embedding generation service.

Uses OpenAI text-embedding-3-small (1536 dimensions).
Generates embeddings for menu items and stores them in MenuEmbedding.
"""

from __future__ import annotations

import logging
from typing import TYPE_CHECKING

from django.conf import settings

if TYPE_CHECKING:
    from apps.menus.models import Dish

logger = logging.getLogger(__name__)

# OpenAI client for embeddings — lazy initialised.
# Uses the standard OpenAI endpoint (MiMo may not support /embeddings).
_client = None


def _get_client():
    global _client
    if _client is None:
        import openai
        _client = openai.OpenAI(
            api_key=getattr(settings, "OPENAI_EMBEDDING_API_KEY", None),
            base_url=getattr(settings, "OPENAI_EMBEDDING_BASE_URL", "https://api.openai.com/v1"),
        )
    return _client


MODEL = getattr(settings, "OPENAI_EMBEDDING_MODEL", "text-embedding-3-small")
DIMENSIONS = 1536


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
    """Generate a 1536-dim embedding vector for the given text."""
    client = _get_client()
    response = client.embeddings.create(
        model=MODEL,
        input=text[:8000],  # Stay within token limits.
    )
    return response.data[0].embedding


def sync_dish_embedding(dish_id: str) -> None:
    """Generate (or update) the embedding for a single dish.

    Safe to call from signals, Celery tasks, or management commands.
    """
    from apps.chatbot.models import MenuEmbedding
    from apps.menus.models import Dish

    dish = (
        Dish.objects.select_related("restaurant", "category")
        .filter(pk=dish_id, is_available=True)
        .first()
    )
    if dish is None:
        # Dish was deleted or is unavailable — remove stale embedding.
        MenuEmbedding.objects.filter(dish_id=dish_id).delete()
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
