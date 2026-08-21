"""Repair legacy dish_image snapshots that point at dead local media paths.

Orders created while the app used FileSystemStorage (or the Vercel /tmp
fallback) stored URLs like ``/media/dishes/x.png`` or full local URLs.
With S3 storage active those links 404.  This migration rewrites each
snapshot to the storage-relative name (``dishes/x.png``) so serializers
resolve it against whatever storage is currently active.
"""

from django.conf import settings
from django.db import migrations


def repair_snapshots(apps, schema_editor):
    OrderItem = apps.get_model("ordering", "OrderItem")

    media_url = (getattr(settings, "MEDIA_URL", "") or "").rstrip("/")
    s3_host = None
    bucket = getattr(settings, "AWS_STORAGE_BUCKET_NAME", None)
    if bucket:
        region = getattr(settings, "AWS_S3_REGION_NAME", "")
        s3_host = f"https://{bucket}.s3.{region}.amazonaws.com"

    to_update = []
    for item in OrderItem.objects.exclude(dish_image="").iterator():
        url = (item.dish_image or "").strip()
        name = None

        if s3_host and url.startswith(s3_host):
            # Already a correct S3 URL — normalize to relative name.
            name = url[len(s3_host):].lstrip("/")
        elif url.startswith(("http://", "https://")):
            # Some other absolute URL — try to extract anything after /media/.
            if "/media/" in url:
                name = url.split("/media/", 1)[1]
        elif url.startswith("/media/"):
            name = url[len("/media/"):]
        elif url.startswith("media/"):
            name = url[len("media/"):]
        elif media_url and media_url not in ("/media", "") and url.startswith(media_url + "/"):
            name = url[len(media_url) + 1:]
        else:
            # Relative name already — leave as-is.
            continue

        if name:
            item.dish_image = name.lstrip("/")
            to_update.append(item)

    if to_update:
        OrderItem.objects.bulk_update(to_update, ["dish_image"], batch_size=500)
    print(f"Repaired {len(to_update)} order-item image snapshots.")


def unrepair(apps, schema_editor):
    # Not reversible — original values are unrecoverable.
    pass


class Migration(migrations.Migration):
    dependencies = [
        ("ordering", "0006_add_prep_time"),
    ]

    operations = [
        migrations.RunPython(repair_snapshots, unrepair),
    ]
