"""Management command to sync menu embeddings.

Usage:
    python manage.py sync_embeddings                    # All restaurants
    python manage.py sync_embeddings --restaurant UUID  # Specific restaurant
    python manage.py sync_embeddings --missing          # Only dishes without embeddings
"""

from __future__ import annotations

from django.core.management.base import BaseCommand, CommandError

from apps.chatbot.services.embedding import sync_all_embeddings, sync_dish_embedding
from apps.chatbot.models import MenuEmbedding
from apps.menus.models import Dish
from apps.restaurants.models import Restaurant


class Command(BaseCommand):
    help = "Generate or refresh menu embeddings for the AI Concierge chatbot."

    def add_arguments(self, parser):
        parser.add_argument(
            "--restaurant",
            type=str,
            help="UUID of a specific restaurant to sync (default: all active restaurants).",
        )
        parser.add_argument(
            "--missing",
            action="store_true",
            help="Only sync dishes that don't have an embedding yet.",
        )

    def handle(self, *args, **options):
        restaurant_id = options.get("restaurant")
        missing_only = options.get("missing")

        if missing_only:
            return self._sync_missing(restaurant_id)

        if restaurant_id:
            try:
                restaurant = Restaurant.objects.get(pk=restaurant_id, status="active")
            except Restaurant.DoesNotExist:
                raise CommandError(f"Restaurant {restaurant_id} not found or not active.")
            count = sync_all_embeddings(str(restaurant.id))
            self.stdout.write(self.style.SUCCESS(f"Synced {count} dishes for {restaurant.name}."))
        else:
            restaurants = Restaurant.objects.filter(status="active")
            total = 0
            for restaurant in restaurants:
                count = sync_all_embeddings(str(restaurant.id))
                total += count
                self.stdout.write(f"  {restaurant.name}: {count} dishes")
            self.stdout.write(self.style.SUCCESS(f"\nTotal: {total} dishes synced across {restaurants.count()} restaurants."))

    def _sync_missing(self, restaurant_id: str | None):
        """Sync only dishes that don't have an embedding yet."""
        dishes = Dish.objects.filter(is_available=True)
        if restaurant_id:
            dishes = dishes.filter(restaurant_id=restaurant_id)

        existing_ids = set(
            MenuEmbedding.objects.values_list("dish_id", flat=True)
        )
        missing = [d for d in dishes if d.pk not in existing_ids]

        if not missing:
            self.stdout.write(self.style.SUCCESS("All dishes already have embeddings."))
            return

        self.stdout.write(f"Syncing {len(missing)} dishes without embeddings...")
        for dish in missing:
            try:
                sync_dish_embedding(str(dish.pk))
                self.stdout.write(f"  ✓ {dish.name_en}")
            except Exception as exc:
                self.stdout.write(self.style.WARNING(f"  ✗ {dish.name_en}: {exc}"))

        self.stdout.write(self.style.SUCCESS(f"\nDone. {len(missing)} dishes processed."))
