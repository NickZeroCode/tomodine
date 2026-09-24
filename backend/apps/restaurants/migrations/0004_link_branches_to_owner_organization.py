"""Link every un-organizationed branch to its owner's organization.

Branches created through the API before this fix were saved with
``organization=NULL``, which made them invisible to organization-scoped
billing — a subscription bought on one branch did not apply to siblings.

This backfill groups each such branch under the owner's existing
organization (creating one when the owner has none), so every branch of the
same restaurant shares one subscription.  Idempotent: re-running only
touches rows that are still unlinked.
"""

import uuid as _uuid

from django.utils.text import slugify

from django.db import migrations


def link_branches_to_owner_organization(apps, schema_editor):
    Organization = apps.get_model("organizations", "Organization")
    Restaurant = apps.get_model("restaurants", "Restaurant")

    used_slugs = set(Organization.objects.values_list("slug", flat=True))
    owner_orgs: dict = {}

    qs = (
        Restaurant.objects.filter(organization__isnull=True)
        .order_by("created_at", "id")
        .values_list("id", "owner_id", "name", "slug", "description")
    )
    for pk, owner_id, name, slug, description in qs:
        org = owner_orgs.get(owner_id)
        if org is None:
            org = (
                Organization.objects.filter(owner_id=owner_id)
                .order_by("created_at", "id")
                .first()
            )
            if org is None:
                # Owner has no organization yet — create one (same unique-
                # slug logic as 0003, since model save() does not run here).
                base = slugify(name or "") or f"org-{_uuid.uuid4().hex[:8]}"
                candidate = base
                suffix = 1
                while candidate in used_slugs:
                    suffix += 1
                    candidate = f"{base}-{suffix}"
                used_slugs.add(candidate)
                org = Organization(
                    owner_id=owner_id,
                    name=name or f"Organization for {slug}",
                    slug=candidate,
                    description=description or "",
                )
                org.save(force_insert=True)
            owner_orgs[owner_id] = org
        Restaurant.objects.filter(pk=pk).update(organization=org)


def reverse(apps, schema_editor):
    # Intentionally a no-op: rolling back the schema must not orphan
    # branches that are now correctly grouped under their organization.
    pass


class Migration(migrations.Migration):
    dependencies = [
        ("restaurants", "0003_backfill_organizations"),
        ("organizations", "0001_initial"),
    ]

    operations = [
        migrations.RunPython(
            link_branches_to_owner_organization, reverse_code=reverse
        ),
    ]
