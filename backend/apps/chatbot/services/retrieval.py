"""Menu retrieval — semantic search using vector similarity.

Computes cosine similarity in Python.  For a typical restaurant menu
(< 500 dishes) this completes in < 10 ms, which is well within the
200 ms budget.  No pgvector extension required.

Every query enforces restaurant_id filtering — branch isolation is
non-negotiable.

Performance: embeddings are cached in-memory per restaurant for 5 minutes,
avoiding repeated DB reads for the same branch.
"""

from __future__ import annotations

import math
import time
from typing import Any

# In-memory cache: { restaurant_id: (timestamp, [rows]) }
_EMBED_CACHE: dict[str, tuple[float, list[dict]]] = {}
_CACHE_TTL = 300  # 5 minutes


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

    def _load_embeddings(self) -> list[dict]:
        """Load embeddings with in-memory caching."""
        now = time.time()
        cached = _EMBED_CACHE.get(self.restaurant_id)
        if cached and (now - cached[0]) < _CACHE_TTL:
            return cached[1]

        from apps.chatbot.models import MenuEmbedding

        rows = list(
            MenuEmbedding.objects.filter(
                restaurant_id=self.restaurant_id,
                is_available=True,
            ).values(
                "dish_id", "dish_name", "description", "price",
                "dish_category", "embedding",
            )
        )
        _EMBED_CACHE[self.restaurant_id] = (now, rows)
        return rows

    def search(
        self,
        query_vector: list[float],
        limit: int = 5,
        *,
        max_price: float | None = None,
        min_price: float | None = None,
        category: str | None = None,
    ) -> list[dict[str, Any]]:
        """Return the top-`limit` dishes most similar to `query_vector`."""
        rows = self._load_embeddings()

        # Apply filters in Python (already pre-filtered by is_available in cache).
        if max_price is not None:
            rows = [r for r in rows if float(r.get("price", 0)) <= max_price]
        if min_price is not None:
            rows = [r for r in rows if float(r.get("price", 0)) >= min_price]
        if category:
            rows = [r for r in rows if r.get("dish_category", "").lower() == category.lower()]

        if not rows:
            return []

        # Score each row by cosine similarity.
        scored: list[tuple[float, dict]] = []
        for row in rows:
            emb = row.get("embedding") or []
            sim = _cosine_similarity(query_vector, emb) if emb else 0.0
            result = {k: v for k, v in row.items() if k != "embedding"}
            result["similarity"] = round(sim, 4)
            scored.append((sim, result))

        scored.sort(key=lambda x: x[0], reverse=True)
        return [row for _, row in scored[:limit]]

    def get_by_ids(self, dish_ids: list[str]) -> list[dict[str, Any]]:
        """Fetch specific dishes by ID (for price comparison). Uses cache."""
        rows = self._load_embeddings()
        id_set = set(str(d) for d in dish_ids)
        return [
            {k: v for k, v in r.items() if k != "embedding"}
            for r in rows
            if str(r.get("dish_id")) in id_set
        ]

    def get_categories(self) -> list[str]:
        """Return distinct categories for this branch's menu. Uses cache."""
        rows = self._load_embeddings()
        return list({r.get("dish_category", "") for r in rows if r.get("dish_category")})


def invalidate_cache(restaurant_id: str) -> None:
    """Clear the cached embeddings for a branch (call after sync)."""
    _EMBED_CACHE.pop(restaurant_id, None)
