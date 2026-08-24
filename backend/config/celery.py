"""Celery application configuration for TomoDine.

Usage:
    celery -A config worker -l info
    celery -A config beat -l info   (if periodic tasks are added)
"""

from __future__ import annotations

import os

from celery import Celery

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")

app = Celery("tomodine")
app.config_from_object("django.conf:settings", namespace="CELERY")
app.autodiscover_tasks()
