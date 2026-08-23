"""Create MenuEmbedding model."""

from django.db import migrations, models
import django.db.models.deletion
import uuid


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        ("restaurants", "0003_alter_restaurant_name"),
        ("menus", "0001_initial"),
    ]

    operations = [
        migrations.CreateModel(
            name="MenuEmbedding",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("embedding", models.JSONField(help_text="384-dim float vector from local sentence-transformers")),
                ("dish_name", models.CharField(max_length=255)),
                ("dish_category", models.CharField(blank=True, default="", max_length=100)),
                ("description", models.TextField(blank=True, default="")),
                ("price", models.DecimalField(decimal_places=2, default=0, max_digits=10)),
                ("is_available", models.BooleanField(default=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                (
                    "restaurant",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="menu_embeddings",
                        to="restaurants.restaurant",
                    ),
                ),
                (
                    "dish",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="embedding",
                        to="menus.dish",
                    ),
                ),
            ],
            options={
                "db_table": "chatbot_menu_embedding",
            },
        ),
        migrations.AddIndex(
            model_name="menuembedding",
            index=models.Index(fields=["restaurant", "is_available"], name="chatbot_menu_rest_is_avail_idx"),
        ),
        migrations.AlterUniqueTogether(
            name="menuembedding",
            unique_together={("restaurant", "dish")},
        ),
    ]
