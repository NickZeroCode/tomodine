from django.db import migrations, models
import django.db.models.deletion
import uuid
import uuid


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        ("accounts", "0001_initial"),
        ("menus", "0003_add_prep_time"),
        ("restaurants", "0001_initial"),
    ]

    operations = [
        migrations.CreateModel(
            name="InventoryItem",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("created_at", models.DateTimeField(db_index=True, default=django.utils.timezone.now)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("name", models.CharField(max_length=255)),
                ("category", models.CharField(choices=[("raw", "Raw"), ("beverage", "Beverage"), ("dry_goods", "Dry Goods"), ("dairy", "Dairy"), ("produce", "Produce")], db_index=True, default="raw", max_length=20)),
                ("sku", models.CharField(blank=True, db_index=True, default="", max_length=64)),
                ("unit", models.CharField(choices=[("kg", "kg"), ("g", "g"), ("l", "L"), ("ml", "mL"), ("piece", "Piece"), ("box", "Box"), ("bottle", "Bottle")], default="piece", max_length=10)),
                ("current_quantity", models.DecimalField(decimal_places=3, default=0, max_digits=12)),
                ("min_stock_threshold", models.DecimalField(decimal_places=3, default=0, max_digits=12)),
                ("max_stock_threshold", models.DecimalField(blank=True, decimal_places=3, max_digits=12, null=True)),
                ("reorder_point", models.DecimalField(decimal_places=3, default=0, max_digits=12)),
                ("avg_cost_per_unit", models.DecimalField(decimal_places=4, default=0, max_digits=12)),
                ("last_purchase_price", models.DecimalField(decimal_places=4, default=0, max_digits=12)),
                ("supplier_name", models.CharField(blank=True, default="", max_length=255)),
                ("is_out_of_stock", models.BooleanField(db_index=True, default=False)),
                ("restaurant", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="inventory_items", to="restaurants.restaurant")),
            ],
            options={
                "ordering": ("name",),
            },
        ),
        migrations.CreateModel(
            name="RecipeItem",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("created_at", models.DateTimeField(db_index=True, default=django.utils.timezone.now)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("quantity_required", models.DecimalField(decimal_places=3, max_digits=12)),
                ("wastage_percentage", models.DecimalField(decimal_places=2, default=0, help_text="Estimated prep waste, e.g. 5.00 for 5%.", max_digits=5)),
                ("dish", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="recipe_items", to="menus.dish")),
                ("inventory_item", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="recipe_usages", to="inventory.inventoryitem")),
                ("restaurant", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="recipe_items", to="restaurants.restaurant")),
            ],
            options={
                "ordering": ("dish__name_en",),
            },
        ),
        migrations.CreateModel(
            name="StockMovement",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("created_at", models.DateTimeField(db_index=True, default=django.utils.timezone.now)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("quantity_change", models.DecimalField(decimal_places=3, max_digits=12)),
                ("unit_cost_at_time", models.DecimalField(decimal_places=4, default=0, max_digits=12)),
                ("movement_type", models.CharField(choices=[("purchase", "Purchase"), ("order_sale", "Order Sale"), ("return", "Return"), ("wastage", "Wastage"), ("manual_adjust", "Manual Adjustment")], db_index=True, max_length=20)),
                ("reference_id", models.CharField(blank=True, default="", max_length=64)),
                ("note", models.CharField(blank=True, default="", max_length=255)),
                ("created_by", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="stock_movements", to="accounts.user")),
                ("inventory_item", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="movements", to="inventory.inventoryitem")),
                ("restaurant", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="stock_movements", to="restaurants.restaurant")),
            ],
            options={
                "ordering": ("-created_at",),
            },
        ),
        migrations.AddConstraint(
            model_name="inventoryitem",
            constraint=models.UniqueConstraint(condition=~models.Q(sku=""), fields=("restaurant", "sku"), name="uniq_inventory_sku_per_restaurant"),
        ),
        migrations.AddIndex(
            model_name="inventoryitem",
            index=models.Index(fields=("restaurant", "category"), name="inv_item_rest_cat_idx"),
        ),
        migrations.AddIndex(
            model_name="inventoryitem",
            index=models.Index(fields=("restaurant", "is_out_of_stock"), name="inv_item_rest_oos_idx"),
        ),
        migrations.AddConstraint(
            model_name="recipeitem",
            constraint=models.UniqueConstraint(fields=("dish", "inventory_item"), name="uniq_recipe_item_per_dish"),
        ),
        migrations.AddIndex(
            model_name="recipeitem",
            index=models.Index(fields=("restaurant", "dish"), name="inv_recipe_rest_dish_idx"),
        ),
        migrations.AddIndex(
            model_name="stockmovement",
            index=models.Index(fields=("restaurant", "movement_type"), name="inv_move_rest_type_idx"),
        ),
        migrations.AddIndex(
            model_name="stockmovement",
            index=models.Index(fields=("restaurant", "created_at"), name="inv_move_rest_date_idx"),
        ),
    ]
