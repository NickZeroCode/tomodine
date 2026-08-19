"""Reusable fixtures/factories for API tests."""

from __future__ import annotations

from decimal import Decimal

from django.contrib.auth import get_user_model

from apps.billing.models import Subscription, SubscriptionPlan
from apps.menus.models import Dish, Menu, MenuCategory
from apps.restaurants.models import Restaurant, RestaurantMembership
from apps.tables.models import QRCode, Table

User = get_user_model()


def make_user(email: str = "owner@example.com", password: str = "Str0ng!Passw0rd") -> User:
    return User.objects.create_user(email=email, password=password, full_name="Test Owner")


def make_restaurant(owner: User, name: str = "Dhaka Biryani House") -> Restaurant:
    restaurant = Restaurant.objects.create(owner=owner, name=name)
    RestaurantMembership.objects.create(restaurant=restaurant, user=owner, is_owner=True)
    return restaurant


def make_subscription(restaurant: Restaurant) -> Subscription:
    plan, _ = SubscriptionPlan.objects.get_or_create(
        code="standard",
        defaults={
            "name_en": "Standard",
            "price": Decimal("1500"),
            "interval": SubscriptionPlan.Interval.MONTHLY,
            "max_tables": 20,
            "max_staff": 10,
            "max_dishes": 200,
            "has_analytics": True,
        },
    )
    return Subscription.objects.create(restaurant=restaurant, plan=plan)


def make_menu_with_dish(restaurant: Restaurant) -> Dish:
    menu = Menu.objects.create(restaurant=restaurant, name_en="Main Menu")
    category = MenuCategory.objects.create(
        restaurant=restaurant, menu=menu, name_en="Biriyani", name_bn="বিরিয়ানি"
    )
    return Dish.objects.create(
        restaurant=restaurant,
        category=category,
        name_en="Kacchi Biryani",
        name_bn="কাচ্চি বিরিয়ানি",
        price=Decimal("350"),
    )


def make_table_with_qr(restaurant: Restaurant, number: str = "T1") -> tuple[Table, QRCode]:
    table = Table.objects.create(restaurant=restaurant, number=number, seats=4)
    qr = QRCode.objects.create(restaurant=restaurant, table=table)
    return table, qr
