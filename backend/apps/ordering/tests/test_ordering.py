"""Order state machine and customer ordering flow tests."""

from __future__ import annotations

from decimal import Decimal

from django.test import TestCase
from rest_framework import status
from rest_framework.test import APITestCase

from apps.api.tests.factories import (
    make_menu_with_dish,
    make_restaurant,
    make_subscription,
    make_table_with_qr,
    make_user,
)
from apps.ordering.models import Cart, CartItem, CustomerSession, Order
from apps.ordering.services import create_order_from_cart, transition_order_status


class OrderStateMachineTests(TestCase):
    def setUp(self):
        self.owner = make_user()
        self.restaurant = make_restaurant(self.owner)
        make_subscription(self.restaurant)
        self.table, _ = make_table_with_qr(self.restaurant)
        self.dish = make_menu_with_dish(self.restaurant)

    def _make_order(self) -> Order:
        session = CustomerSession.objects.create(
            restaurant=self.restaurant, table=self.table
        )
        cart = Cart.objects.create(restaurant=self.restaurant, session=session)
        CartItem.objects.create(
            cart=cart, dish=self.dish, quantity=2, unit_price=self.dish.price
        )
        return create_order_from_cart(session)

    def test_create_order_calculates_total(self):
        order = self._make_order()
        self.assertEqual(order.subtotal, Decimal("700"))
        self.assertEqual(order.total, Decimal("700"))
        self.assertEqual(order.status, Order.Status.NEW)

    def test_valid_transition(self):
        order = self._make_order()
        order = transition_order_status(order, Order.Status.ACCEPTED, changed_by=self.owner)
        self.assertEqual(order.status, Order.Status.ACCEPTED)

    def test_invalid_transition_rejected(self):
        order = self._make_order()
        with self.assertRaises(ValueError):
            transition_order_status(order, Order.Status.PAID, changed_by=self.owner)

    def test_full_happy_path_workflow(self):
        order = self._make_order()
        for next_status in (
            Order.Status.ACCEPTED,
            Order.Status.PREPARING,
            Order.Status.READY,
            Order.Status.SERVED,
            Order.Status.PAID,
        ):
            order = transition_order_status(order, next_status, changed_by=self.owner)
        self.assertEqual(order.status, Order.Status.PAID)
        self.assertEqual(order.status_history.count(), 6)  # 5 transitions + creation

    def test_table_synced_to_available_after_payment(self):
        order = self._make_order()
        for next_status in (
            Order.Status.ACCEPTED,
            Order.Status.PREPARING,
            Order.Status.READY,
            Order.Status.SERVED,
            Order.Status.PAID,
        ):
            order = transition_order_status(order, next_status, changed_by=self.owner)
        self.table.refresh_from_db()
        from apps.tables.models import Table

        self.assertEqual(self.table.status, Table.Status.AVAILABLE)


class CustomerOrderingFlowTests(APITestCase):
    """End-to-end: QR scan -> session -> menu -> cart -> order."""

    def setUp(self):
        self.owner = make_user()
        self.restaurant = make_restaurant(self.owner)
        make_subscription(self.restaurant)
        self.table, self.qr = make_table_with_qr(self.restaurant)
        self.dish = make_menu_with_dish(self.restaurant)

    def test_full_customer_flow(self):
        # 1. Start session from QR token
        response = self.client.post(
            "/api/v1/public/session/",
            {"qr_token": self.qr.token, "language": "bn", "party_size": 3},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        session_token = response.data["session_token"]
        self.assertEqual(response.data["language"], "bn")

        # 2. Fetch menu
        response = self.client.get("/api/v1/public/menu/", {"qr_token": self.qr.token})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["restaurant"]["slug"], self.restaurant.slug)
        self.assertTrue(response.data["menus"])

        # 3. Add item to cart
        response = self.client.post(
            "/api/v1/public/cart/items/",
            {
                "session_token": session_token,
                "dish_id": str(self.dish.id),
                "quantity": 2,
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

        # 4. Place order
        response = self.client.post(
            "/api/v1/public/order/",
            {"session_token": session_token, "customer_note": "No chili please"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["status"], Order.Status.NEW)
        self.assertEqual(response.data["total"], "700.00")

        # 5. Track status
        order_id = response.data["id"]
        response = self.client.get(
            "/api/v1/public/order/status/",
            {"session_token": session_token, "order_id": order_id},
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["id"], order_id)

    def test_invalid_qr_token_rejected(self):
        response = self.client.post(
            "/api/v1/public/session/", {"qr_token": "bogus"}, format="json"
        )
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
