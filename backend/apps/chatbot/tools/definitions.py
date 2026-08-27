"""Branch-aware tool definitions for the AI Concierge.

Each tool is a plain Python function. Branch isolation is enforced
via closure injection — the LLM never sees the restaurant_id.

The OpenAI function-calling schemas are defined alongside each tool.
"""

from __future__ import annotations

import json
import logging
from decimal import Decimal
from typing import Any

logger = logging.getLogger(__name__)

# ── OpenAI function schemas ─────────────────────────────────────

TOOL_SCHEMAS: list[dict[str, Any]] = [
    {
        "type": "function",
        "function": {
            "name": "search_menu",
            "description": (
                "Search the restaurant menu using natural language. Returns matching dishes with names, prices, images, and descriptions. "
                "Supports filters: category (e.g. 'Dessert', 'Appetizer', 'Main'), max_price (number in BDT). "
                "Use for: broad menu browsing, category filtering ('show me desserts'), price filtering ('under 300 taka'), "
                "dietary queries ('vegetarian'), and ingredient searches ('chicken dishes'). "
                "Do NOT use for a single specific dish the user named — use get_dish instead."
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
            "name": "get_popular_dishes",
            "description": (
                "Get the most-ordered dishes at this restaurant based on real order data. "
                "Use when the customer asks for recommendations, popular items, best sellers, "
                "'what do people usually order', 'what's good here', or 'what should I try'. "
                "Returns dishes ranked by order frequency — these are proven favorites."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "limit": {
                        "type": "integer",
                        "description": "Number of popular dishes to return (default 3, max 5)",
                        "default": 3,
                    },
                },
                "required": [],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_offers",
            "description": (
                "Get current active offers and promotions at this restaurant. "
                "Use when the user asks about deals, discounts, promotions, offers, "
                "'any discounts?', 'what's on sale?', or 'do you have any offers?'."
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
                "Use ONLY when the user explicitly asks to order or add something. "
                "If the dish has modifiers (toppings, spice level, extras), ask the user "
                "which options they want before calling this tool. "
                "You can pass modifier_names to include specific modifier options."
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
                    "modifier_names": {
                        "type": "array",
                        "items": {"type": "string"},
                        "description": "Optional list of modifier option names the customer chose (e.g. ['Extra Cheese', 'Spicy']). Match to the modifier options available for this dish.",
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


def _abs_image_url(field) -> str:
    """Build an absolute URL for an ImageField (no request needed)."""
    if not field:
        return ""
    name = getattr(field, "name", None)
    if not name:
        return ""
    from django.conf import settings
    if getattr(settings, "AWS_STORAGE_BUCKET_NAME", None):
        try:
            return field.url
        except ValueError:
            return ""
    # Local storage — build URL from MEDIA_URL + relative path.
    media_url = getattr(settings, "MEDIA_URL", "/media/") or "/media/"
    try:
        return f"{media_url.rstrip('/')}/{name.lstrip('/')}"
    except Exception:
        return ""


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

        # Fetch modifier groups for all dishes in one query.
        from apps.menus.models import DishModifier, ModifierGroup
        groups_qs = ModifierGroup.objects.filter(dish_id__in=dish_ids, is_active=True).order_by("display_order")
        groups_by_dish: dict = {}
        for g in groups_qs:
            groups_by_dish.setdefault(str(g.dish_id), []).append(g)
        group_ids = [g.pk for g in groups_qs]
        options_qs = DishModifier.objects.filter(group_id__in=group_ids, is_available=True).order_by("display_order")
        options_by_group: dict = {}
        for o in options_qs:
            options_by_group.setdefault(o.group_id, []).append(o)

        for r in results:
            did = str(r.get("dish_id", ""))
            dish = dishes.get(did)
            r["image_url"] = _abs_image_url(dish.image) if dish and dish.image else ""
            r["is_vegetarian"] = bool(dish and dish.is_vegetarian)
            r["is_spicy"] = bool(dish and dish.is_spicy)
            # Attach modifier groups summary.
            mgroups = []
            for g in groups_by_dish.get(did, []):
                opts = options_by_group.get(g.pk, [])
                mgroups.append({
                    "group_name_en": g.name_en,
                    "min_selections": g.min_selections,
                    "max_selections": g.max_selections,
                    "option_count": len(opts),
                })
            r["modifier_groups"] = mgroups

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

        # Fetch the full Dish object for image, extra fields, and modifiers.
        from apps.menus.models import Dish, DishModifier, ModifierGroup
        dish = Dish.objects.filter(pk=emb.dish_id).select_related("category").first()

        image_url = ""
        if dish and dish.image:
            try:
                image_url = dish.image.url if hasattr(dish.image, "url") else str(dish.image)
            except Exception:
                pass

        # Fetch modifier groups and their options for this dish.
        modifier_groups = []
        if dish:
            groups = ModifierGroup.objects.filter(dish=dish, is_active=True).order_by("display_order")
            for g in groups:
                options = DishModifier.objects.filter(
                    group=g, is_available=True
                ).order_by("display_order").values("id", "name_en", "name_bn", "price_delta", "is_default")
                modifier_groups.append({
                    "group_name_en": g.name_en,
                    "group_name_bn": g.name_bn,
                    "min_selections": g.min_selections,
                    "max_selections": g.max_selections,
                    "options": [
                        {
                            "name_en": o["name_en"],
                            "name_bn": o["name_bn"],
                            "price_delta": float(o["price_delta"]),
                            "is_default": o["is_default"],
                        }
                        for o in options
                    ],
                })

            # Also include ungrouped modifiers.
            ungrouped = DishModifier.objects.filter(
                dish=dish, group__isnull=True, is_available=True
            ).values("name_en", "name_bn", "price_delta")
            if ungrouped:
                modifier_groups.append({
                    "group_name_en": "Extras",
                    "group_name_bn": "এক্সট্রা",
                    "min_selections": 0,
                    "max_selections": 99,
                    "options": [
                        {
                            "name_en": o["name_en"],
                            "name_bn": o["name_bn"],
                            "price_delta": float(o["price_delta"]),
                            "is_default": False,
                        }
                        for o in ungrouped
                    ],
                })

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
                "modifier_groups": modifier_groups,
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


def make_add_to_cart(restaurant_id: str, table_id: str | None, customer_session_token: str | None = None):
    """Create a branch-scoped add_to_cart tool.

    Uses the customer's own session (via customer_session_token) for complete
    device isolation. Falls back to table-level session lookup for backward compat.
    """

    def add_to_cart(dish_name: str, quantity: int = 1, modifier_names: list[str] | None = None) -> str:
        if not table_id:
            return json.dumps({
                "success": False,
                "error": "No table associated with this session. Please scan a QR code first.",
            })

        from apps.menus.models import Dish, DishModifier
        from apps.ordering.models import Cart, CartItem, CartItemModifier, CustomerSession, Order, OrderItem
        from apps.tables.models import Table

        # Find the dish.
        dish = (
            Dish.objects.filter(restaurant_id=restaurant_id, is_available=True)
            .filter(name_en__icontains=dish_name)
            .first()
        )
        if not dish:
            dish = (
                Dish.objects.filter(restaurant_id=restaurant_id, is_available=True, name_bn__icontains=dish_name)
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

        # Get session — prefer the customer's own session for device isolation.
        session = None
        if customer_session_token:
            session = CustomerSession.objects.filter(token=customer_session_token, is_active=True).first()
        if not session:
            session = CustomerSession.objects.filter(
                restaurant_id=restaurant_id, table=table, is_active=True,
            ).first()
        if not session:
            session = CustomerSession.objects.create(
                restaurant_id=restaurant_id, table=table, is_active=True,
            )

        # Resolve modifiers by name (fuzzy match, case-insensitive).
        resolved_modifiers: list[DishModifier] = []
        modifier_total = Decimal("0")
        if modifier_names:
            for mname in modifier_names:
                mod = (
                    DishModifier.objects.filter(
                        dish=dish, is_available=True, name_en__icontains=mname
                    ).first()
                    or DishModifier.objects.filter(
                        dish=dish, is_available=True, name_bn__icontains=mname
                    ).first()
                )
                if mod:
                    resolved_modifiers.append(mod)
                    modifier_total += mod.price_delta

        # --- Server-side pricing (same pipeline as customer API) ---
        unit_price = dish.price + modifier_total

        # Use Cart pipeline so pricing is identical to customer API.
        cart, _ = Cart.objects.get_or_create(restaurant_id=restaurant_id, session=session)
        item = CartItem.objects.create(
            cart=cart,
            dish=dish,
            quantity=quantity,
            unit_price=unit_price,
        )
        CartItemModifier.objects.bulk_create([
            CartItemModifier(cart_item=item, modifier=m, price_delta=m.price_delta)
            for m in resolved_modifiers
        ])

        line_total = unit_price * quantity

        # Find or create an active order for notification purposes.
        order = (
            Order.objects.filter(
                restaurant_id=restaurant_id, table=table, session=session,
                status__in=["new", "accepted", "preparing"],
            ).order_by("-created_at").first()
        )
        is_new_order = False
        if not order:
            from apps.ordering.services import create_order_from_cart, generate_order_number
            # Place order from cart immediately (chatbot flow).
            try:
                order = create_order_from_cart(session)
                is_new_order = True
            except ValueError:
                return json.dumps({"success": False, "error": "Could not place order."})
        else:
            # Append to existing order directly (bypassing cart for speed).
            existing_item = OrderItem.objects.filter(order=order, dish_name_en=dish.name_en).first()
            modifier_snapshot = [
                {"id": str(m.id), "name_en": m.name_en, "name_bn": m.name_bn, "price_delta": str(m.price_delta)}
                for m in resolved_modifiers
            ]
            if existing_item:
                existing_item.quantity += quantity
                existing_item.save(update_fields=["quantity", "updated_at"])
            else:
                OrderItem.objects.create(
                    order=order,
                    dish_name_en=dish.name_en,
                    dish_name_bn=dish.name_bn or "",
                    dish_image=dish.image.name if dish.image else "",
                    quantity=quantity,
                    unit_price=unit_price,
                    min_prep_time=dish.min_prep_time,
                    max_prep_time=dish.max_prep_time,
                    selected_modifiers=modifier_snapshot,
                    modifier_total=modifier_total,
                )
            order.subtotal = (order.subtotal or Decimal("0")) + line_total
            order.total = (order.total or Decimal("0")) + line_total
            order.save(update_fields=["subtotal", "total", "updated_at"])

            # Clear cart item since we already added to order.
            item.delete()

        # Notify the kitchen.
        from apps.notifications.services import notify_restaurant
        from apps.restaurants.models import Restaurant
        rest = Restaurant.objects.filter(pk=restaurant_id).first()
        if rest:
            mod_text = ""
            if resolved_modifiers:
                mod_text = f" ({', '.join(m.name_en for m in resolved_modifiers)})"
            notify_restaurant(
                rest,
                kind="new_order" if is_new_order else "order_status",
                title_en=f"{'New order' if is_new_order else 'Order updated'} — Table {table.label or table.number}",
                title_bn=f"{'নতুন অর্ডার' if is_new_order else 'অর্ডার আপডেট'} — টেবিল {table.label or table.number}",
                body_en=f"{quantity}x {dish.name_en}{mod_text} added. Order #{order.order_number}",
                body_bn=f"{quantity}x {dish.name_bn or dish.name_en}{mod_text} যোগ করা হয়েছে। অর্ডার #{order.order_number}",
                metadata={"order_id": str(order.id), "table_id": str(table_id)},
            )

        return json.dumps({
            "success": True,
            "message": f"Added {quantity}x {dish.name_en} to your order." + (
                f" Modifiers: {', '.join(m.name_en for m in resolved_modifiers)}." if resolved_modifiers else ""
            ),
            "item_name": dish.name_en,
            "quantity": quantity,
            "modifiers": [m.name_en for m in resolved_modifiers],
            "line_total": str(line_total),
            "order_total": str(order.total),
            "order_id": str(order.id),
        }, default=str)

    return add_to_cart


def make_check_order_status(restaurant_id: str, table_id: str | None, customer_session_token: str | None = None):
    """Create a branch-scoped check_order_status tool.

    If customer_session_token is provided, only returns orders from that session
    (complete device isolation). Falls back to table-level for backward compat.
    """

    def check_order_status() -> str:
        if not table_id:
            return json.dumps({"orders": [], "message": "No table associated with this session."})

        from apps.ordering.models import Order

        base_qs = Order.objects.filter(
            restaurant_id=restaurant_id,
        ).exclude(status__in=["cancelled", "rejected"])

        # Session-scoped: only this device's orders.
        if customer_session_token:
            from apps.ordering.models import CustomerSession
            session = CustomerSession.objects.filter(token=customer_session_token).first()
            if session:
                base_qs = base_qs.filter(session=session)
            else:
                # Fallback to table-level if session not found.
                from apps.tables.models import Table
                table = Table.objects.filter(pk=table_id, restaurant_id=restaurant_id).first()
                if table:
                    base_qs = base_qs.filter(table=table)
        else:
            from apps.tables.models import Table
            table = Table.objects.filter(pk=table_id, restaurant_id=restaurant_id).first()
            if not table:
                return json.dumps({"orders": [], "message": "Table not found."})
            base_qs = base_qs.filter(table=table)

        orders = (
            base_qs
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


def make_get_popular_dishes(restaurant_id: str):
    """Create a branch-scoped get_popular_dishes tool.

    Queries real order data to find the most-ordered dishes — no hallucination.
    """

    def get_popular_dishes(limit: int = 3) -> str:
        from django.db.models import Sum
        from apps.ordering.models import OrderItem
        from apps.menus.models import Dish

        limit = max(1, min(5, limit))

        # Aggregate order items by dish name for this restaurant.
        popular = (
            OrderItem.objects.filter(
                order__restaurant_id=restaurant_id,
                order__status__in=["paid", "served", "ready", "preparing", "new", "accepted"],
            )
            .values("dish_name_en")
            .annotate(total_qty=Sum("quantity"))
            .order_by("-total_qty")[:limit]
        )

        if not popular:
            return json.dumps({"dishes": [], "message": "No order data available yet."})

        # Enrich with current menu data (price, image, description).
        results = []
        for item in popular:
            name = item["dish_name_en"]
            dish = Dish.objects.filter(
                restaurant_id=restaurant_id, name_en__iexact=name, is_available=True
            ).select_related("category").first()

            image_url = _abs_image_url(dish.image) if dish and dish.image else ""

            results.append({
                "dish_id": str(dish.id) if dish else "",
                "dish_name": name,
                "description": (dish.description_en or "") if dish else "",
                "price": float(dish.price) if dish else 0,
                "category": getattr(getattr(dish, "category", None), "name_en", "") if dish else "",
                "image_url": image_url,
                "is_vegetarian": bool(dish and dish.is_vegetarian),
                "is_spicy": bool(dish and dish.is_spicy),
            })

        return json.dumps({"dishes": results}, default=str)

    return get_popular_dishes


def make_get_offers(restaurant_id: str):
    """Create a branch-scoped get_offers tool."""

    def get_offers() -> str:
        from django.db.models import Q
        from django.utils import timezone
        from apps.billing.models import Offer

        now = timezone.now()
        offers = Offer.objects.filter(
            restaurant_id=restaurant_id,
            is_active=True,
        ).filter(
            Q(start_date__isnull=True) | Q(start_date__lte=now),
        ).filter(
            Q(end_date__isnull=True) | Q(end_date__gte=now),
        ).select_related("dish")

        if not offers:
            return json.dumps({"offers": [], "message": "No active offers at the moment."})

        results = []
        for offer in offers:
            image_url = _abs_image_url(offer.dish.image) if offer.dish and offer.dish.image else ""
            results.append({
                "id": str(offer.id),
                "name": offer.name_en or "",
                "description": offer.description_en or "",
                "code": offer.code or "",
                "discount_type": offer.discount_type,
                "discount_value": str(offer.discount_value),
                "dish_name": offer.dish.name_en if offer.dish else None,
                "dish_price": float(offer.dish.price) if offer.dish else None,
                "dish_image": image_url,
            })

        return json.dumps({"offers": results}, default=str)

    return get_offers


def build_all_tools(restaurant, table_id: str | None, query_vector_fn, customer_session_token: str | None = None) -> dict[str, callable]:
    """Build all branch-scoped tools and return as {name: fn} dict."""
    rid = str(restaurant.id)
    tools = {
        "search_menu": make_search_menu(rid, query_vector_fn),
        "get_dish": make_get_dish(rid),
        "compare_prices": make_compare_prices(rid),
        "get_restaurant_info": make_get_restaurant_info(restaurant),
        "get_popular_dishes": make_get_popular_dishes(rid),
        "get_offers": make_get_offers(rid),
    }

    if table_id:
        tools["add_to_cart"] = make_add_to_cart(rid, table_id, customer_session_token)
        tools["check_order_status"] = make_check_order_status(rid, table_id, customer_session_token)
        tools["trigger_waiter"] = make_trigger_waiter(rid, table_id)

    return tools
