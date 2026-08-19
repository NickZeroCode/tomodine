"""Seed core RBAC permissions, system roles, and subscription plans.

Idempotent: safe to run repeatedly. Creates/updates deterministic records so
fresh environments get a consistent baseline without manual admin work.
"""

from __future__ import annotations

from decimal import Decimal

from django.core.management.base import BaseCommand

from apps.billing.models import SubscriptionPlan
from apps.rbac.models import Permission, Role

PERMISSIONS: list[tuple[str, str, str, str]] = [
    # (codename, name_en, name_bn, group)
    ("orders.view", "View orders", "অর্ডার দেখুন", "orders"),
    ("orders.manage", "Manage orders", "অর্ডার পরিচালনা", "orders"),
    ("tables.manage", "Manage tables", "টেবিল পরিচালনা", "tables"),
    ("menu.manage", "Manage menu", "মেনু পরিচালনা", "menu"),
    ("staff.manage", "Manage staff", "স্টাফ পরিচালনা", "staff"),
    ("billing.view", "View billing", "বিলিং দেখুন", "billing"),
    ("billing.manage", "Manage billing", "বিলিং পরিচালনা", "billing"),
    ("analytics.view", "View analytics", "অ্যানালিটিক্স দেখুন", "analytics"),
    ("settings.manage", "Manage settings", "সেটিংস পরিচালনা", "settings"),
]

ROLE_PERMISSIONS: dict[str, list[str]] = {
    "manager": [p[0] for p in PERMISSIONS],
    "waiter": ["orders.view", "orders.manage", "tables.manage", "menu.manage"],
    "kitchen": ["orders.view", "orders.manage"],
    "cashier": ["orders.view", "orders.manage", "billing.view"],
}

ROLE_NAMES: dict[str, tuple[str, str]] = {
    "manager": ("Manager", "ম্যানেজার"),
    "waiter": ("Waiter", "ওয়েটার"),
    "kitchen": ("Kitchen Staff", "কিচেন স্টাফ"),
    "cashier": ("Cashier", "ক্যাশিয়ার"),
}


class Command(BaseCommand):
    help = "Seed baseline RBAC permissions, system roles, and subscription plans."

    def handle(self, *args, **options):
        self._seed_permissions()
        self._seed_roles()
        self._seed_plans()
        self.stdout.write(self.style.SUCCESS("Seed complete."))

    def _seed_permissions(self) -> None:
        for codename, name_en, name_bn, group in PERMISSIONS:
            Permission.objects.update_or_create(
                codename=codename,
                defaults={"name_en": name_en, "name_bn": name_bn, "group": group},
            )

    def _seed_roles(self) -> None:
        for slug, (name_en, name_bn) in ROLE_NAMES.items():
            role, _ = Role.objects.update_or_create(
                restaurant=None,
                slug=slug,
                defaults={"name_en": name_en, "name_bn": name_bn, "is_system": True},
            )
            perms = Permission.objects.filter(codename__in=ROLE_PERMISSIONS[slug])
            role.permissions.set(perms)

    def _seed_plans(self) -> None:
        plans = [
            {
                "code": "trial",
                "name_en": "Trial",
                "name_bn": "ট্রায়াল",
                "price": Decimal("0"),
                "interval": SubscriptionPlan.Interval.MONTHLY,
                "trial_days": 14,
                "max_tables": 5,
                "max_staff": 2,
                "max_dishes": 30,
                "has_analytics": True,
                "display_order": 0,
            },
            {
                "code": "standard",
                "name_en": "Standard",
                "name_bn": "স্ট্যান্ডার্ড",
                "price": Decimal("1500"),
                "interval": SubscriptionPlan.Interval.MONTHLY,
                "trial_days": 14,
                "max_tables": 20,
                "max_staff": 10,
                "max_dishes": 200,
                "has_analytics": True,
                "display_order": 1,
            },
            {
                "code": "pro",
                "name_en": "Pro",
                "name_bn": "প্রো",
                "price": Decimal("3500"),
                "interval": SubscriptionPlan.Interval.MONTHLY,
                "trial_days": 14,
                "max_tables": 100,
                "max_staff": 50,
                "max_dishes": 1000,
                "has_analytics": True,
                "display_order": 2,
            },
        ]
        for data in plans:
            SubscriptionPlan.objects.update_or_create(code=data["code"], defaults=data)
