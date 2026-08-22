"""Backfill Organization for every existing Restaurant.

Each existing Restaurant becomes a Branch under a newly-created Organization
whose name and owner mirror the Restaurant's.  This migration is idempotent
(running it again does nothing if every restaurant already has an organization).
"""

from django.db import migrations


def create_organizations(apps, schema_editor):
    Organization = apps.get_model("organizations", "Organization")
    Restaurant = apps.get_model("restaurants", "Restaurant")

    for r in Restaurant.objects.filter(organization__isnull=True).select_related("owner"):
        org = Organization.objects.create(
            owner=r.owner,
            name=r.name,
            description=r.description,
        )
        r.organization = org
        r.save(update_fields=["organization"])


def reverse(apps, schema_editor):
    # Null out organization — safe because the FK is nullable.
    Restaurant = apps.get_model("restaurants", "Restaurant")
    Restaurant.objects.all().update(organization=None)


class Migration(migrations.Migration):
    dependencies = [
        ("restaurants", "0002_add_organization"),
        ("organizations", "0001_initial"),
    ]

    operations = [
        migrations.RunPython(create_organizations, reverse),
    ]
