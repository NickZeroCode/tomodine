"""Floor-map positions, seating timestamps, and version counter for tables."""

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("tables", "0001_initial"),
    ]

    operations = [
        migrations.AddField(
            model_name="table",
            name="grid_x",
            field=models.PositiveSmallIntegerField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="table",
            name="grid_y",
            field=models.PositiveSmallIntegerField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="table",
            name="grid_w",
            field=models.PositiveSmallIntegerField(default=2),
        ),
        migrations.AddField(
            model_name="table",
            name="grid_h",
            field=models.PositiveSmallIntegerField(default=2),
        ),
        migrations.AddField(
            model_name="table",
            name="seated_at",
            field=models.DateTimeField(blank=True, db_index=True, null=True),
        ),
        migrations.AddField(
            model_name="table",
            name="version",
            field=models.PositiveIntegerField(default=0),
        ),
        migrations.AddIndex(
            model_name="table",
            index=models.Index(fields=("restaurant", "seated_at"), name="table_rest_seated_idx"),
        ),
    ]
