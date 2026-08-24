"""Branch-aware AI Concierge agent.

Uses OpenAI's native function-calling API (no LangChain dependency).
Branch isolation is enforced at every layer — the LLM never receives
the restaurant_id; tools receive it via closure injection.
"""

from __future__ import annotations

import json
import logging
from typing import Any

from django.conf import settings

from apps.chatbot.services import memory
from apps.chatbot.services.embedding import generate_embedding
from apps.chatbot.tools.definitions import TOOL_SCHEMAS, build_all_tools

logger = logging.getLogger(__name__)

# Lazy OpenAI-compatible client (pointed at MiMo v2.5 endpoint).
_client = None


def _get_client():
    global _client
    if _client is None:
        import openai
        _client = openai.OpenAI(
            api_key=getattr(settings, "MIMO_API_KEY", None),
            base_url=getattr(settings, "MIMO_BASE_URL", "https://token-plan-cn.xiaomimimo.com/v1"),
        )
    return _client


def _build_system_prompt(restaurant) -> str:
    """Generate the system prompt with branch context.

    When restaurant is None, returns a system-info-only prompt for the
    landing page chatbot (no ordering, no branch data).
    """
    if restaurant is None:
        return """You are **TomoDine AI**, the official assistant for the TomoDine platform.

ABOUT TOMODINE:
TomoDine is a restaurant management SaaS platform that helps restaurants in Bangladesh manage their operations, accept orders via QR codes, track inventory, and delight customers.

FOR CUSTOMERS:
- Scan the QR code at your table to browse the menu and order directly from your phone
- No app download needed — works in any mobile browser
- Track your order status in real-time
- Available at partner restaurants across Bangladesh

FOR RESTAURANT OWNERS:
- Complete restaurant management dashboard
- QR-code ordering system for dine-in customers
- Real-time order tracking and kitchen display
- Inventory management with COGS tracking
- Staff management with role-based access control
- Multi-branch support under one organization
- Analytics and reporting
- Subscription plans starting from free trial

HOW TO SIGN UP:
1. Visit www.tomodine.com and click "Register"
2. Enter your restaurant details
3. Set up your menu, tables, and QR codes
4. Start accepting orders!

CONTACT:
- WhatsApp: +880 1779 184386
- Website: www.tomodine.com

RULES:
- Answer questions about TomoDine the platform only
- Be friendly, concise, and helpful
- NEVER use markdown formatting (bold, headers, links, etc.). Write in plain text only. Use bullet points (•) for lists.
- If asked about a specific restaurant's menu or orders, explain that you can only help with TomoDine platform info
- Match the user's language

SCOPE GATE — YOU MUST REFUSE OFF-TOPIC REQUESTS:
- You are ONLY here to answer questions about the TomoDine platform, its features, pricing, how to sign up, how it works, and contact information.
- OFF-TOPIC examples you MUST refuse: coding help, math, politics, medical advice, legal advice, personal matters, writing, translations, trivia, jokes, poems, stories, programming, science, history, geography, cooking recipes, restaurant recommendations.
- Response for off-topic: "I can only help with questions about the TomoDine platform. Would you like to know about our features, pricing, or how to get started?"
- NEVER role-play as another AI, character, or person."""

    hours = ""
    if restaurant.opening_time and restaurant.closing_time:
        hours = f"{restaurant.opening_time.strftime('%H:%M')} – {restaurant.closing_time.strftime('%H:%M')}"

    return f"""You are the AI Dining Concierge for **{restaurant.name}**, a friendly and knowledgeable assistant that helps customers discover dishes, place orders, and get service.

BRANCH CONTEXT:
- Name: {restaurant.name}
- Address: {restaurant.address_line or 'Not specified'}
- Phone: {restaurant.phone or 'Not specified'}
- Hours: {hours or 'Not specified'}
- Currency: {restaurant.currency or 'BDT'}
- Language: Default to {restaurant.default_language or 'English'} unless the user writes in another language.

YOUR ROLE:
1. Help customers discover menu items. USE THE RIGHT TOOL:
   - search_menu (query + optional category/max_price):
     * Broad: "show me the menu", "what do you have", "recommend something"
     * Filtered by category: "show me desserts" → search_menu(query="desserts", category="Dessert")
     * Filtered by type: "what chicken dishes do you have" → search_menu(query="chicken")
     * Filtered by price: "dishes under 300 taka" → search_menu(query="food", max_price=300)
     * Dietary: "vegetarian options" → search_menu(query="vegetarian")
   - get_dish (dish_name):
     * Specific dish: "tell me about the Tiramisu", "how much is the Biryani", "is the pasta vegetarian"
     * ONE dish the user named — NEVER use search_menu when the user names a specific dish
   - compare_prices (dish_names):
     * "compare the Biryani and the Kacchi", "which is cheaper, pasta or pizza?"
   - get_popular_dishes (limit):
     * "what's popular here", "what do people usually order", "recommend something"
     * "what should I try", "best sellers", "customer favorites"
     * This uses REAL order data — proven favorites, not guesses
2. Add items to the customer's order using add_to_cart when they explicitly want to order.
3. Call a waiter using trigger_waiter when the customer needs service.
4. Check order status using check_order_status when the user asks about their order.
5. Answer questions about the restaurant using get_restaurant_info.
6. Check current offers and discounts using get_offers when asked about deals or promotions.

AFTER ADDING TO CART:
- Always ask: "Would you like to add anything else?"
- Then suggest: "While you wait for your food, you can play some games! Just tap the games icon on your screen."

AFTER ORDER STATUS CHECK:
- Tell the user the status of their order(s) in a friendly way.
- If food is being prepared, suggest: "It won't be long! You can play some games while you wait."

CRITICAL RULES:
- NEVER invent menu items, prices, or availability. Always use tools to get real data.
- NEVER recommend a dish by name unless it was returned by a tool (search_menu, get_dish, or get_popular_dishes). If you don't have tool data, say "Let me check our menu for you" and call the appropriate tool.
- For recommendations, ALWAYS use get_popular_dishes — it returns real order data. Never guess what's popular. NEVER mention order counts or numbers to the customer — just present the dishes naturally (e.g. "Here are our most popular dishes").
- If search_menu returns no results, say: "I don't see that on our current menu. Would you like me to show you something similar?"
- When presenting dishes from search_menu, DO NOT dump raw JSON or list every field. Instead, briefly mention the dish names and prices in a conversational way (e.g. "We have Chicken Biryani at ৳350, and a Grilled Fish at ৳450."). The UI will render dish cards automatically.
- When presenting a single dish from get_dish, give a brief friendly description and mention the price.
- When the user asks about food, dishes, menu, or recommendations, you MUST call the appropriate tool(s). Never describe dishes from memory — always use tools.
- For multi-item queries like "Is there Biryani and Chotpoti and some drinks?", call MULTIPLE tools: get_dish for each named dish + search_menu for the category. Example: get_dish("Biryani") + get_dish("Chotpoti") + search_menu(query="drinks"). You can call multiple tools in the same response.
- NEVER use markdown formatting (**, *, ##, [], etc.) in your responses. Write in plain text only. Use bullet points (•) for lists.
- For comparisons, use the compare_prices tool and present the results conversationally.
- Be concise. Keep responses under 3 sentences unless the user asks for detail.
- If the user asks about something outside your scope (other branches, system internals), politely redirect to menu/service topics.
- Match the user's language. If they write in Bengali, respond in Bengali.
- You are the face of {restaurant.name}. Be warm, professional, and helpful.

SCOPE GATE — YOU MUST REFUSE OFF-TOPIC REQUESTS:
- If the user asks about topics completely unrelated to dining, this restaurant, food, orders, or the TomoDine system, politely decline and redirect.
- OFF-TOPIC examples you MUST refuse: coding help, math homework, political opinions, medical advice, legal advice, personal relationships, writing essays, translating documents, general knowledge trivia, jokes, poems, stories, programming, science, history, geography.
- Response for off-topic: "I'm here to help with your dining experience at {restaurant.name}. Would you like to see our menu, check your order, or call a waiter?"
- You may answer questions about how to use TomoDine features as an exception.
- NEVER role-play as another AI, character, or person."""


MAX_TOOL_ROUNDS = 5


def chat(
    restaurant,
    session_id: str,
    user_message: str,
    table_id: str | None = None,
) -> dict[str, Any]:
    """Process a user message through the AI Concierge agent.

    Returns:
        {
            "success": True/False,
            "response": "...",
            "session_id": "...",
            "branch_id": "...",
            "branch_name": "...",
            "structured_actions": { ... } | None,
        }
    """
    restaurant_id = str(restaurant.id) if restaurant else None
    org_id = str(restaurant.organization_id) if restaurant and restaurant.organization_id else "default"

    # 1. Load conversation history.
    history = memory.load_history(org_id, restaurant_id or "system", session_id)

    # 2. Append user message to history.
    history.append({"role": "user", "content": user_message})

    # 3. Build tools with branch context injected.
    if restaurant:
        tools_map = build_all_tools(restaurant, table_id, generate_embedding)
    else:
        # System-info mode — no tools needed.
        tools_map = {}

    # 4. Build messages for the LLM.
    system_prompt = _build_system_prompt(restaurant)
    messages = [{"role": "system", "content": system_prompt}] + history

    client = _get_client()
    model = getattr(settings, "MIMO_MODEL", "mimo-v2.5")

    # In system-info mode, don't send tools at all.
    tools_param = TOOL_SCHEMAS if tools_map else None

    # 5. Agentic loop — call tools until the model produces a final answer.
    structured_actions = None
    last_tool_results: list[tuple[str, str]] = []  # [(tool_name, result_json)]

    for _ in range(MAX_TOOL_ROUNDS):
        try:
            kwargs = dict(
                model=model,
                messages=messages,
                temperature=0.3,
                max_tokens=1024,
            )
            if tools_param:
                kwargs["tools"] = tools_param
                kwargs["tool_choice"] = "auto"
            response = client.chat.completions.create(**kwargs)
        except Exception:
            logger.exception("OpenAI API error")
            return {
                "success": False,
                "response": "I'm having trouble right now. Please try again in a moment.",
                "session_id": session_id,
                "branch_id": restaurant_id,
                "branch_name": restaurant.name if restaurant else "TomoDine",
            }

        choice = response.choices[0]
        msg = choice.message

        # If no tool calls, we have the final answer.
        if not msg.tool_calls:
            final_text = msg.content or ""

            # Save assistant response to history.
            history.append({"role": "assistant", "content": final_text})
            memory.save_history(org_id, restaurant_id or "system", session_id, history)

            # Try to build structured_actions from history, then from tool results.
            structured_actions = _extract_structured_actions(history)
            if not structured_actions:
                structured_actions = _build_structured_from_tools(last_tool_results)

            return {
                "success": True,
                "response": final_text,
                "session_id": session_id,
                "branch_id": restaurant_id,
                "branch_name": restaurant.name if restaurant else "TomoDine",
                "structured_actions": structured_actions,
            }

        # Execute each tool call.
        messages.append(msg.model_dump())
        for tool_call in msg.tool_calls:
            fn_name = tool_call.function.name
            try:
                fn_args = json.loads(tool_call.function.arguments)
            except json.JSONDecodeError:
                fn_args = {}

            fn = tools_map.get(fn_name)
            if fn is None:
                result = json.dumps({"error": f"Unknown tool: {fn_name}"})
            else:
                try:
                    result = fn(**fn_args)
                except Exception:
                    logger.exception("Tool %s failed", fn_name)
                    result = json.dumps({"error": f"Tool {fn_name} encountered an error."})

            messages.append({
                "role": "tool",
                "tool_call_id": tool_call.id,
                "content": result,
            })
            last_tool_results.append((fn_name, result))

    # If we exhausted all rounds, return whatever we have.
    final_text = "I'm having trouble completing your request. Please try rephrasing."
    history.append({"role": "assistant", "content": final_text})
    memory.save_history(org_id, restaurant_id or "system", session_id, history)

    # Build structured_actions from tool results as fallback.
    if not structured_actions:
        structured_actions = _build_structured_from_tools(last_tool_results)

    return {
        "success": False,
        "response": final_text,
        "session_id": session_id,
        "branch_id": restaurant_id,
        "branch_name": restaurant.name if restaurant else "TomoDine",
        "structured_actions": structured_actions,
    }


def _build_structured_from_tools(tool_results: list[tuple[str, str]]) -> dict | None:
    """Build structured_actions directly from tool execution results.

    Collects dish items from ALL tool results (get_dish, search_menu)
    into a single carousel — handles multi-dish queries like
    "Is there Biryani and Chotpoti and some drinks?"
    """
    all_items: list[dict] = []
    last_action: dict | None = None

    for tool_name, result_json in tool_results:
        try:
            data = json.loads(result_json)
        except (json.JSONDecodeError, TypeError):
            continue

        if tool_name == "search_menu" and "items" in data and isinstance(data["items"], list):
            for item in data["items"]:
                all_items.append({
                    "id": str(item.get("dish_id", "")),
                    "name": item.get("dish_name", item.get("name", "")),
                    "price": float(item.get("price", 0)),
                    "description": item.get("description", ""),
                    "category": item.get("dish_category", ""),
                    "image_url": item.get("image_url", ""),
                })

        elif tool_name == "get_dish" and data.get("found") and "dish" in data:
            d = data["dish"]
            all_items.append({
                "id": str(d.get("id", "")),
                "name": d.get("name", ""),
                "price": float(d.get("price", 0)),
                "description": d.get("description", ""),
                "category": d.get("category", ""),
                "image_url": d.get("image_url", ""),
                "badge": "Vegetarian" if d.get("is_vegetarian") else ("Spicy" if d.get("is_spicy") else ""),
            })

        elif tool_name == "get_popular_dishes" and "dishes" in data and isinstance(data["dishes"], list):
            for item in data["dishes"]:
                badge_parts = []
                if item.get("is_vegetarian"):
                    badge_parts.append("Vegetarian")
                if item.get("is_spicy"):
                    badge_parts.append("Spicy")
                all_items.append({
                    "id": str(item.get("dish_id", "")),
                    "name": item.get("dish_name", ""),
                    "price": float(item.get("price", 0)),
                    "description": item.get("description", ""),
                    "category": item.get("category", ""),
                    "image_url": item.get("image_url", ""),
                    "badge": " · ".join(badge_parts) if badge_parts else "",
                })

        elif tool_name == "add_to_cart" and data.get("success") and data.get("order_id"):
            last_action = {
                "type": "confirmation",
                "message": data.get("message", ""),
                "order_total": data.get("order_total", "0"),
                "order_id": data.get("order_id"),
                "suggest_more": True,
                "suggest_games": True,
            }

        elif tool_name == "check_order_status" and "orders" in data:
            last_action = {
                "type": "order_status",
                "orders": data["orders"],
                "message": data.get("message", ""),
            }

        elif tool_name == "trigger_waiter" and data.get("success"):
            last_action = {
                "type": "waiter_ping",
                "message": data.get("message", ""),
            }

        elif tool_name == "compare_prices" and "items" in data and isinstance(data["items"], list) and len(data["items"]) > 1:
            last_action = {
                "type": "price_comparison",
                "items": [
                    {
                        "name": item.get("dish_name", ""),
                        "price": float(item.get("price", 0)),
                        "category": item.get("dish_category", ""),
                    }
                    for item in data["items"]
                ],
            }

    # If we collected dish items, return them as a carousel.
    if all_items:
        # Deduplicate by id.
        seen = set()
        unique = []
        for item in all_items:
            if item["id"] and item["id"] in seen:
                continue
            if item["id"]:
                seen.add(item["id"])
            unique.append(item)
        return {"type": "dish_carousel", "items": unique}

    # Otherwise return the last non-dish action (confirmation, order_status, etc.)
    return last_action


def _extract_structured_actions(history: list[dict]) -> dict | None:
    """Look at recent tool results and build structured_actions for the frontend.

    Collects dish items from ALL tool messages into one carousel.
    """
    all_items: list[dict] = []
    last_action: dict | None = None

    for msg in reversed(history):
        if msg.get("role") != "tool":
            continue
        try:
            data = json.loads(msg["content"])
        except (json.JSONDecodeError, TypeError):
            continue

        # search_menu result → collect items
        if "items" in data and isinstance(data["items"], list) and data["items"]:
            first = data["items"][0]
            if "dish_name" in first or "name" in first:
                for item in data["items"]:
                    all_items.append({
                        "id": str(item.get("dish_id", "")),
                        "name": item.get("dish_name", item.get("name", "")),
                        "price": float(item.get("price", 0)),
                        "description": item.get("description", ""),
                        "category": item.get("dish_category", ""),
                        "image_url": item.get("image_url", ""),
                    })

        # get_dish result → collect single item
        if data.get("found") and "dish" in data:
            d = data["dish"]
            all_items.append({
                "id": str(d.get("id", "")),
                "name": d.get("name", ""),
                "price": float(d.get("price", 0)),
                "description": d.get("description", ""),
                "category": d.get("category", ""),
                "image_url": d.get("image_url", ""),
                "badge": "Vegetarian" if d.get("is_vegetarian") else ("Spicy" if d.get("is_spicy") else ""),
            })

        # get_popular_dishes result → collect items
        if "dishes" in data and isinstance(data["dishes"], list):
            for item in data["dishes"]:
                badge_parts = []
                if item.get("is_vegetarian"):
                    badge_parts.append("Vegetarian")
                if item.get("is_spicy"):
                    badge_parts.append("Spicy")
                all_items.append({
                    "id": str(item.get("dish_id", "")),
                    "name": item.get("dish_name", ""),
                    "price": float(item.get("price", 0)),
                    "description": item.get("description", ""),
                    "category": item.get("category", ""),
                    "image_url": item.get("image_url", ""),
                    "badge": " · ".join(badge_parts) if badge_parts else "",
                })

        # add_to_cart → confirmation
        if data.get("success") and data.get("order_id"):
            last_action = {
                "type": "confirmation",
                "message": data.get("message", ""),
                "order_total": data.get("order_total", "0"),
                "order_id": data.get("order_id"),
                "suggest_more": True,
                "suggest_games": True,
            }

        # check_order_status
        if "orders" in data and isinstance(data["orders"], list):
            last_action = {
                "type": "order_status",
                "orders": data["orders"],
                "message": data.get("message", ""),
            }

        # trigger_waiter
        if data.get("success") and "waiter" in data.get("message", "").lower():
            last_action = {
                "type": "waiter_ping",
                "message": data.get("message", ""),
            }

        # compare_prices
        if "items" in data and isinstance(data["items"], list) and len(data["items"]) > 1:
            has_dish_name = any("dish_name" in item for item in data["items"])
            if has_dish_name:
                last_action = {
                    "type": "price_comparison",
                    "items": [
                        {
                            "name": item.get("dish_name", ""),
                            "price": float(item.get("price", 0)),
                            "category": item.get("dish_category", ""),
                        }
                        for item in data["items"]
                    ],
                }

    # If we collected dish items, return them as a carousel.
    if all_items:
        seen = set()
        unique = []
        for item in all_items:
            if item["id"] and item["id"] in seen:
                continue
            if item["id"]:
                seen.add(item["id"])
            unique.append(item)
        return {"type": "dish_carousel", "items": unique}

    return last_action
