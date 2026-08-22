"""Add organization FK to Restaurant (branches)."""

import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("restaurants", "0001_initial"),
        ("organizations", "0001_initial"),
    ]

    operations = [
        migrations.AddField(
            model_name="restaurant",
            name="organization",
            field=models.ForeignKey(
                blank=True,
                help_text="The owning organization. Null for legacy single-branch accounts.",
                null=True,
                on_delete=django.db.models.deletion.CASCADE,
                related_name="branches",
                to="organizations.organization",
            ),
        ),
    ]
