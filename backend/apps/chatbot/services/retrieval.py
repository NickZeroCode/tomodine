"""Menu retrieval — semantic search using vector similarity.

Computes cosine similarity in Python.  For a typical restaurant menu
(< 500 dishes) this completes in < 10 ms, which is well within the
200 ms budget.  No pgvector extension required.

Every query enforces restaurant_id filtering — branch isolation is
non-negotiable.
"""

from __future__ import annotations

import math
from typing import Any


def _cosine_similarity(a: list[float], b: list[float]) -> float:
    """Compute cosine similarity between two vectors."""
    dot = sum(x * y for x, y in zip(a, b))
    norm_a = math.sqrt(sum(x * x for x in a))
    norm_b = math.sqrt(sum(x * x for x in b))
    if norm_a == 0 or norm_b == 0:
        return 0.0
    return dot / (norm_a * norm_b)


class MenuRetriever:
    """Semantic menu search scoped to a single branch."""

    def __init__(self, restaurant_id: str):
        self.restaurant_id = restaurant_id

    def search(
        self,
        query_vector: list[float],
        limit: int = 5,
        *,
        max_price: float | None = None,
        min_price: float | None = None,
        category: str | None = None,
    ) -> list[dict[str, Any]]:
        """Return the top-`limit` dishes most similar to `query_vector`.

        Results are always filtered by:
        - restaurant_id (branch isolation)
        - is_available = True
        """
        from apps.chatbot.models import MenuEmbedding

        qs = MenuEmbedding.objects.filter(
            restaurant_id=self.restaurant_id,
            is_available=True,
        )

        if max_price is not None:
            qs = qs.filter(price__lte=max_price)
        if min_price is not None:
            qs = qs.filter(price__gte=min_price)
        if category:
            qs = qs.filter(dish_category__iexact=category)

        rows = list(qs.values(
            "dish_id", "dish_name", "description", "price",
            "dish_category", "embedding",
        ))

        if not rows:
            return []

        # Score each row by cosine similarity.
        scored: list[tuple[float, dict]] = []
        for row in rows:
            emb = row.pop("embedding", None) or []
            sim = _cosine_similarity(query_vector, emb) if emb else 0.0
            row["similarity"] = round(sim, 4)
            scored.append((sim, row))

        scored.sort(key=lambda x: x[0], reverse=True)
        return [row for _, row in scored[:limit]]

    def get_by_ids(self, dish_ids: list[str]) -> list[dict[str, Any]]:
        """Fetch specific dishes by ID (for price comparison)."""
        from apps.chatbot.models import MenuEmbedding

        rows = MenuEmbedding.objects.filter(
            restaurant_id=self.restaurant_id,
            dish_id__in=dish_ids,
        ).values("dish_id", "dish_name", "description", "price", "dish_category")

        return list(rows)

    def get_categories(self) -> list[str]:
        """Return distinct categories for this branch's menu."""
        from apps.chatbot.models import MenuEmbedding

        return list(
            MenuEmbedding.objects.filter(
                restaurant_id=self.restaurant_id,
                is_available=True,
            )
            .values_list("dish_category", flat=True)
            .distinct()
        )
