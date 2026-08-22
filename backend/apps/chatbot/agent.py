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

# Lazy OpenAI client.
_client = None


def _get_client():
    global _client
    if _client is None:
        import openai
        _client = openai.OpenAI(api_key=getattr(settings, "OPENAI_API_KEY", None))
    return _client


def _build_system_prompt(restaurant) -> str:
    """Generate the system prompt with branch context."""
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
1. Help customers discover menu items using the search_menu tool.
2. Compare dishes using the compare_prices tool when asked.
3. Add items to the customer's order using add_to_cart when they explicitly want to order.
4. Call a waiter using trigger_waiter when the customer needs service.
5. Answer questions about the restaurant using get_restaurant_info.

CRITICAL RULES:
- NEVER invent menu items, prices, or availability. Always use tools to get real data.
- If search_menu returns no results, say: "I don't see that on our current menu. Would you like me to show you something similar?"
- Be concise. Keep responses under 3 sentences unless the user asks for detail.
- When presenting dishes, format them clearly with name and price.
- If the user asks about something outside your scope (other branches, system internals), politely redirect to menu/service topics.
- Match the user's language. If they write in Bengali, respond in Bengali.
- You are the face of {restaurant.name}. Be warm, professional, and helpful."""


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
    restaurant_id = str(restaurant.id)
    org_id = str(restaurant.organization_id) if restaurant.organization_id else "default"

    # 1. Load conversation history.
    history = memory.load_history(org_id, restaurant_id, session_id)

    # 2. Append user message to history.
    history.append({"role": "user", "content": user_message})

    # 3. Build tools with branch context injected.
    tools_map = build_all_tools(restaurant, table_id, generate_embedding)

    # 4. Build messages for the LLM.
    system_prompt = _build_system_prompt(restaurant)
    messages = [{"role": "system", "content": system_prompt}] + history

    client = _get_client()
    model = getattr(settings, "OPENAI_MODEL", "gpt-4o-mini")

    # 5. Agentic loop — call tools until the model produces a final answer.
    structured_actions = None

    for _ in range(MAX_TOOL_ROUNDS):
        try:
            response = client.chat.completions.create(
                model=model,
                messages=messages,
                tools=TOOL_SCHEMAS,
                tool_choice="auto",
                temperature=0.3,
                max_tokens=1024,
            )
        except Exception:
            logger.exception("OpenAI API error")
            return {
                "success": False,
                "response": "I'm having trouble right now. Please try again in a moment.",
                "session_id": session_id,
                "branch_id": restaurant_id,
                "branch_name": restaurant.name,
            }

        choice = response.choices[0]
        msg = choice.message

        # If no tool calls, we have the final answer.
        if not msg.tool_calls:
            final_text = msg.content or ""

            # Save assistant response to history.
            history.append({"role": "assistant", "content": final_text})
            memory.save_history(org_id, restaurant_id, session_id, history)

            # Try to build structured_actions from the last tool result.
            structured_actions = _extract_structured_actions(history)

            return {
                "success": True,
                "response": final_text,
                "session_id": session_id,
                "branch_id": restaurant_id,
                "branch_name": restaurant.name,
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

    # If we exhausted all rounds, return whatever we have.
    final_text = "I'm having trouble completing your request. Please try rephrasing."
    history.append({"role": "assistant", "content": final_text})
    memory.save_history(org_id, restaurant_id, session_id, history)

    return {
        "success": False,
        "response": final_text,
        "session_id": session_id,
        "branch_id": restaurant_id,
        "branch_name": restaurant.name,
    }


def _extract_structured_actions(history: list[dict]) -> dict | None:
    """Look at recent tool results and build structured_actions for the frontend."""
    # Walk backwards to find the last tool result.
    for msg in reversed(history):
        if msg.get("role") != "tool":
            continue
        try:
            data = json.loads(msg["content"])
        except (json.JSONDecodeError, TypeError):
            continue

        # search_menu result → dish_carousel
        if "items" in data and isinstance(data["items"], list) and data["items"]:
            first = data["items"][0]
            if "dish_name" in first or "name" in first:
                return {
                    "type": "dish_carousel",
                    "items": [
                        {
                            "id": str(item.get("dish_id", "")),
                            "name": item.get("dish_name", item.get("name", "")),
                            "price": float(item.get("price", 0)),
                            "description": item.get("description", ""),
                            "category": item.get("dish_category", ""),
                        }
                        for item in data["items"]
                    ],
                }

        # compare_prices result → price_comparison
        if "items" in data and isinstance(data["items"], list) and len(data["items"]) > 1:
            return {
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

        # add_to_cart result → confirmation
        if data.get("success") and data.get("order_id"):
            return {
                "type": "confirmation",
                "message": data.get("message", ""),
                "order_total": data.get("order_total", "0"),
                "order_id": data.get("order_id"),
            }

        # trigger_waiter result → waiter_ping
        if data.get("success") and "waiter" in data.get("message", "").lower():
            return {
                "type": "waiter_ping",
                "message": data.get("message", ""),
            }

    return None
