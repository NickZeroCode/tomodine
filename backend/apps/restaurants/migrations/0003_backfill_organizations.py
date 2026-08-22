"""Backfill Organization for every existing Restaurant.

Each existing Restaurant becomes a Branch under a newly-created Organization
whose name and owner mirror the Restaurant's.  This migration is idempotent
(running it again does nothing if every restaurant already has an organization).
"""

import uuid as _uuid
from django.utils.text import slugify

from django.db import migrations


def create_organizations(apps, schema_editor):
    Organization = apps.get_model("organizations", "Organization")
    Restaurant = apps.get_model("restaurants", "Restaurant")

    used_slugs = set(Organization.objects.values_list("slug", flat=True))

    for r in Restaurant.objects.filter(organization__isnull=True).select_related("owner"):
        # Generate a unique slug — the model's save() won't run in
        # migrations the same way, so we do it explicitly.
        base = slugify(r.name) or f"org-{_uuid.uuid4().hex[:8]}"
        slug = base
        suffix = 1
        while slug in used_slugs:
            suffix += 1
            slug = f"{base}-{suffix}"
        used_slugs.add(slug)

        org = Organization(
            owner=r.owner,
            name=r.name or f"Organization for {r.slug}",
            slug=slug,
            description=r.description,
        )
        org.save(force_insert=True)
        r.organization = org
        r.save(update_fields=["organization"])


def reverse(apps, schema_editor):
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
