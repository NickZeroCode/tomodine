"""Branch-aware tool definitions for the AI Concierge.

Each tool is a plain Python function. Branch isolation is enforced
via closure injection — the LLM never sees the restaurant_id.

The OpenAI function-calling schemas are defined alongside each tool.
"""

from __future__ import annotations

import json
import logging
from typing import Any

logger = logging.getLogger(__name__)

# ── OpenAI function schemas ─────────────────────────────────────

TOOL_SCHEMAS: list[dict[str, Any]] = [
    {
        "type": "function",
        "function": {
            "name": "search_menu",
            "description": (
                "Search the restaurant menu for dishes matching a natural-language query. "
                "Returns up to 5 items with names, prices, images, descriptions, and similarity scores. "
                "Use this for broad queries like 'show me the menu', 'what's spicy', 'vegetarian options'."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "query": {
                        "type": "string",
                        "description": "The user's search query (e.g. 'spicy chicken', 'vegetarian pasta')",
                    },
                    "max_price": {
                        "type": "number",
                        "description": "Optional maximum price filter in BDT",
                    },
                    "category": {
                        "type": "string",
                        "description": "Optional category filter (e.g. 'Appetizer', 'Main', 'Dessert')",
                    },
                },
                "required": ["query"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_dish",
            "description": (
                "Get full details for a specific dish by name — price, description, image, category, "
                "prep time, dietary info. Use when the user asks about ONE specific dish, asks 'tell me about X', "
                "or shows interest in a particular item."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "dish_name": {
                        "type": "string",
                        "description": "The name of the dish to look up",
                    },
                },
                "required": ["dish_name"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "compare_prices",
            "description": (
                "Compare prices and details of multiple menu items. "
                "Use when the user asks to compare dishes."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "dish_names": {
                        "type": "array",
                        "items": {"type": "string"},
                        "description": "List of dish names or IDs to compare",
                    },
                },
                "required": ["dish_names"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_restaurant_info",
            "description": (
                "Get general information about the restaurant: hours, address, "
                "cuisine type, special features, and about-us text."
            ),
            "parameters": {
                "type": "object",
                "properties": {},
                "required": [],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "check_order_status",
            "description": (
                "Check the status of the customer's latest order(s) for today. "
                "Use when the user asks 'where is my order', 'what's the status', "
                "'is my food ready', or similar order tracking questions."
            ),
            "parameters": {
                "type": "object",
                "properties": {},
                "required": [],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "add_to_cart",
            "description": (
                "Add a menu item to the customer's order cart. "
                "Use ONLY when the user explicitly asks to order or add something."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "dish_name": {
                        "type": "string",
                        "description": "The name of the dish to add",
                    },
                    "quantity": {
                        "type": "integer",
                        "description": "Quantity to add (default 1)",
                        "default": 1,
                        "minimum": 1,
                        "maximum": 20,
                    },
                },
                "required": ["dish_name"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "trigger_waiter",
            "description": (
                "Call a waiter for assistance. "
                "Use when the user asks for a waiter, needs cutlery, wants the bill, etc."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "reason": {
                        "type": "string",
                        "description": "Reason for calling the waiter",
                    },
                    "urgency": {
                        "type": "string",
                        "enum": ["normal", "high"],
                        "description": "Urgency level (default 'normal')",
                        "default": "normal",
                    },
                },
                "required": ["reason"],
            },
        },
    },
]


# ── Tool implementations (branch-scoped) ────────────────────────


def make_search_menu(restaurant_id: str, query_vector_fn):
    """Create a branch-scoped search_menu tool.

    `query_vector_fn(text) -> list[float]` generates embeddings on demand.
    """

    def search_menu(
        query: str,
        max_price: float | None = None,
        category: str | None = None,
    ) -> str:
        from apps.chatbot.services.retrieval import MenuRetriever
        from apps.menus.models import Dish

        retriever = MenuRetriever(restaurant_id)
        vector = query_vector_fn(query)
        results = retriever.search(
            vector,
            limit=5,
            max_price=max_price,
            category=category,
        )
        if not results:
            return json.dumps({"items": [], "message": "No dishes found matching your query."})

        # Enrich with image URLs from the Dish model.
        dish_ids = [r.get("dish_id") for r in results if r.get("dish_id")]
        dishes = {str(d.pk): d for d in Dish.objects.filter(pk__in=dish_ids).select_related("category")}
        for r in results:
            dish = dishes.get(str(r.get("dish_id", "")))
            if dish and dish.image:
                try:
                    r["image_url"] = dish.image.url if hasattr(dish.image, "url") else str(dish.image)
                except Exception:
                    r["image_url"] = ""
            else:
                r["image_url"] = ""
            r["is_vegetarian"] = bool(dish and dish.is_vegetarian)
            r["is_spicy"] = bool(dish and dish.is_spicy)

        return json.dumps({"items": results}, default=str)

    return search_menu


def make_get_dish(restaurant_id: str):
    """Create a branch-scoped get_dish tool for looking up a single dish."""

    def get_dish(dish_name: str) -> str:
        from apps.chatbot.models import MenuEmbedding

        # Try exact match first, then fuzzy.
        emb = (
            MenuEmbedding.objects.filter(
                restaurant_id=restaurant_id,
                is_available=True,
                dish_name__iexact=dish_name,
            )
            .first()
        )
        if not emb:
            emb = (
                MenuEmbedding.objects.filter(
                    restaurant_id=restaurant_id,
                    is_available=True,
                    dish_name__icontains=dish_name,
                )
                .first()
            )
        if not emb:
            return json.dumps({"found": False, "message": f"No dish called '{dish_name}' found on the menu."})

        # Fetch the full Dish object for image and extra fields.
        from apps.menus.models import Dish
        dish = Dish.objects.filter(pk=emb.dish_id).select_related("category").first()

        image_url = ""
        if dish and dish.image:
            try:
                image_url = dish.image.url if hasattr(dish.image, "url") else str(dish.image)
            except Exception:
                pass

        return json.dumps({
            "found": True,
            "dish": {
                "id": str(emb.dish_id),
                "name": emb.dish_name,
                "description": emb.description,
                "price": float(emb.price),
                "category": emb.dish_category,
                "image_url": image_url,
                "is_vegetarian": bool(dish and dish.is_vegetarian),
                "is_spicy": bool(dish and dish.is_spicy),
                "min_prep_time": dish.min_prep_time if dish else None,
                "max_prep_time": dish.max_prep_time if dish else None,
            },
        }, default=str)

    return get_dish


def make_compare_prices(restaurant_id: str):
    """Create a branch-scoped compare_prices tool."""

    def compare_prices(dish_names: list[str]) -> str:
        from apps.chatbot.services.retrieval import MenuRetriever

        retriever = MenuRetriever(restaurant_id)
        # Try matching by ID first, then by name.
        items = retriever.get_by_ids(dish_names)
        if not items:
            # Fuzzy match by name.
            from apps.chatbot.models import MenuEmbedding

            qs = MenuEmbedding.objects.filter(restaurant_id=restaurant_id, is_available=True)
            for name in dish_names:
                qs_items = qs.filter(dish_name__icontains=name).values(
                    "dish_id", "dish_name", "description", "price", "dish_category"
                )
                items.extend(list(qs_items))

        if not items:
            return json.dumps({"items": [], "message": "No matching dishes found."})
        return json.dumps({"items": list(items)}, default=str)

    return compare_prices


def make_get_restaurant_info(restaurant):
    """Create a branch-scoped get_restaurant_info tool."""

    def get_restaurant_info() -> str:
        return json.dumps({
            "name": restaurant.name,
            "address": restaurant.address_line or "",
            "phone": restaurant.phone or "",
            "opening_time": str(restaurant.opening_time) if restaurant.opening_time else "",
            "closing_time": str(restaurant.closing_time) if restaurant.closing_time else "",
            "currency": restaurant.currency or "BDT",
            "default_language": restaurant.default_language or "en",
        })

    return get_restaurant_info


def make_add_to_cart(restaurant_id: str, table_id: str | None):
    """Create a branch-scoped add_to_cart tool.

    This creates a CustomerSession and Order if needed, then adds the dish.
    """

    def add_to_cart(dish_name: str, quantity: int = 1) -> str:
        if not table_id:
            return json.dumps({
                "success": False,
                "error": "No table associated with this session. Please scan a QR code first.",
            })

        from apps.menus.models import Dish
        from apps.ordering.models import CustomerSession, Order, OrderItem
        from apps.tables.models import Table

        # Find the dish.
        dish = (
            Dish.objects.filter(
                restaurant_id=restaurant_id,
                is_available=True,
            )
            .filter(name_en__icontains=dish_name)
            .first()
        )
        if not dish:
            # Try Bengali name.
            dish = (
                Dish.objects.filter(
                    restaurant_id=restaurant_id,
                    is_available=True,
                    name_bn__icontains=dish_name,
                )
                .first()
            )
        if not dish:
            return json.dumps({
                "success": False,
                "error": f"Could not find '{dish_name}' on the menu. Please check the spelling.",
            })

        table = Table.objects.filter(pk=table_id, restaurant_id=restaurant_id).first()
        if not table:
            return json.dumps({"success": False, "error": "Table not found."})

        # Get or create an open order for this table.
        session = CustomerSession.objects.filter(
            restaurant_id=restaurant_id,
            table=table,
            is_active=True,
        ).first()
        if not session:
            session = CustomerSession.objects.create(
                restaurant_id=restaurant_id,
                table=table,
                is_active=True,
            )
        # Find or create an open order for this table.
        # Skip served/paid/cancelled orders — only add to active ones.
        order = (
            Order.objects.filter(
                restaurant_id=restaurant_id,
                table=table,
                session=session,
                status__in=["new", "accepted", "preparing"],
            )
            .order_by("-created_at")
            .first()
        )
        is_new_order = False
        if not order:
            order = Order.objects.create(
                restaurant_id=restaurant_id,
                table=table,
                session=session,
                order_type="dine_in",
                status="new",
                subtotal=0,
                total=0,
            )
            is_new_order = True

        item = OrderItem.objects.create(
            order=order,
            dish_name_en=dish.name_en,
            dish_name_bn=dish.name_bn or "",
            quantity=quantity,
            unit_price=dish.price,
            min_prep_time=dish.min_prep_time,
            max_prep_time=dish.max_prep_time,
        )

        # Update order total.
        from decimal import Decimal
        line_total = dish.price * quantity
        order.subtotal = (order.subtotal or Decimal("0")) + line_total
        order.total = (order.total or Decimal("0")) + line_total
        order.save(update_fields=["subtotal", "total", "updated_at"])

        # Notify the kitchen/restaurant about the new item.
        from apps.notifications.services import notify_restaurant
        from apps.restaurants.models import Restaurant
        rest = Restaurant.objects.filter(pk=restaurant_id).first()
        if rest:
            notify_restaurant(
                rest,
                kind="new_order" if is_new_order else "order_status",
                title_en=f"{'New order' if is_new_order else 'Order updated'} — Table {table.label or table.number}",
                title_bn=f"{'নতুন অর্ডার' if is_new_order else 'অর্ডার আপডেট'} — টেবিল {table.label or table.number}",
                body_en=f"{quantity}x {dish.name_en} added. Order #{order.order_number}",
                body_bn=f"{quantity}x {dish.name_bn or dish.name_en} যোগ করা হয়েছে। অর্ডার #{order.order_number}",
                metadata={"order_id": str(order.id), "table_id": str(table_id)},
            )

        return json.dumps({
            "success": True,
            "message": f"Added {quantity}x {dish.name_en} to your order.",
            "item_name": dish.name_en,
            "quantity": quantity,
            "line_total": str(line_total),
            "order_total": str(order.total),
            "order_id": str(order.id),
        }, default=str)

    return add_to_cart


def make_check_order_status(restaurant_id: str, table_id: str | None):
    """Create a branch-scoped check_order_status tool."""

    def check_order_status() -> str:
        if not table_id:
            return json.dumps({"orders": [], "message": "No table associated with this session."})

        from datetime import date
        from apps.ordering.models import Order
        from apps.tables.models import Table

        table = Table.objects.filter(pk=table_id, restaurant_id=restaurant_id).first()
        if not table:
            return json.dumps({"orders": [], "message": "Table not found."})

        today = date.today()
        orders = (
            Order.objects.filter(
                restaurant_id=restaurant_id,
                table=table,
                created_at__date=today,
            )
            .exclude(status__in=["cancelled", "rejected"])
            .order_by("-created_at")
            .values("id", "order_number", "status", "total", "created_at")[:5]
        )

        order_list = []
        for o in orders:
            age_min = int((__import__("datetime").datetime.now().timestamp() - o["created_at"].timestamp()) / 60)
            order_list.append({
                "id": str(o["id"]),
                "order_number": o["order_number"],
                "status": o["status"],
                "total": str(o["total"]),
                "minutes_ago": age_min,
            })

        if not order_list:
            return json.dumps({"orders": [], "message": "No orders found for today at your table."})

        return json.dumps({"orders": order_list}, default=str)

    return check_order_status


def make_trigger_waiter(restaurant_id: str, table_id: str | None):
    """Create a branch-scoped trigger_waiter tool."""

    def trigger_waiter(reason: str, urgency: str = "normal") -> str:
        if not table_id:
            return json.dumps({
                "success": False,
                "error": "No table associated. Please scan a QR code first.",
            })

        from apps.notifications.services import notify_restaurant
        from apps.restaurants.models import Restaurant

        restaurant = Restaurant.objects.filter(pk=restaurant_id).first()
        if not restaurant:
            return json.dumps({"success": False, "error": "Restaurant not found."})

        table_label = ""
        from apps.tables.models import Table
        table = Table.objects.filter(pk=table_id).first()
        if table:
            table_label = f"Table {table.label or table.number}"

        prefix = "🔴 URGENT: " if urgency == "high" else ""
        notify_restaurant(
            restaurant,
            kind="table_alert",
            title_en=f"{prefix}Waiter requested — {table_label}",
            title_bn=f"{prefix}ওয়েটার অনুরোধ — {table_label}",
            body_en=f"Reason: {reason}",
            body_bn=f"কারণ: {reason}",
            metadata={"table_id": str(table_id), "urgency": urgency, "reason": reason},
        )

        return json.dumps({
            "success": True,
            "message": f"A waiter has been notified and will be with you shortly. (Reason: {reason})",
        })

    return trigger_waiter


def build_all_tools(restaurant, table_id: str | None, query_vector_fn) -> dict[str, callable]:
    """Build all branch-scoped tools and return as {name: fn} dict."""
    rid = str(restaurant.id)
    tools = {
        "search_menu": make_search_menu(rid, query_vector_fn),
        "get_dish": make_get_dish(rid),
        "compare_prices": make_compare_prices(rid),
        "get_restaurant_info": make_get_restaurant_info(restaurant),
    }

    if table_id:
        tools["add_to_cart"] = make_add_to_cart(rid, table_id)
        tools["check_order_status"] = make_check_order_status(rid, table_id)
        tools["trigger_waiter"] = make_trigger_waiter(rid, table_id)

    return tools
