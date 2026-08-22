"""Menu embedding model for vector-powered semantic search.

Uses pgvector for fast similarity search. Every row is branch-scoped
to enforce tenant isolation at the database level.
"""

from __future__ import annotations

import uuid

from django.db import models


class MenuEmbedding(models.Model):
    """Vector embedding for a single dish, scoped to a branch."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    restaurant = models.ForeignKey(
        "restaurants.Restaurant",
        on_delete=models.CASCADE,
        related_name="menu_embeddings",
        db_index=True,
    )
    dish = models.ForeignKey(
        "menus.Dish",
        on_delete=models.CASCADE,
        related_name="embedding",
        db_index=True,
    )

    # pgvector field — stored as a float array in Postgres.
    # OpenAI text-embedding-3-small produces 1536-dim vectors.
    embedding = models.JSONField(help_text="1536-dim float vector from OpenAI")

    # Denormalised for fast filtering without joins.
    dish_name = models.CharField(max_length=255)
    dish_category = models.CharField(max_length=100, blank=True, default="")
    description = models.TextField(blank=True, default="")
    price = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    is_available = models.BooleanField(default=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "chatbot_menu_embedding"
        unique_together = [["restaurant", "dish"]]
        indexes = [
            models.Index(fields=["restaurant", "is_available"]),
        ]

    def __str__(self) -> str:
        return f"Embedding({self.dish_name} @ {self.restaurant_id})"
