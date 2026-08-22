"""Redis-backed conversation memory.

Stores chat history as a JSON list in Redis, keyed by
`chat:{org_id}:{restaurant_id}:{session_id}`.  TTL: 4 hours.
"""

from __future__ import annotations

import json
import logging
from typing import Any

from django.conf import settings

logger = logging.getLogger(__name__)

_redis = None


def _get_redis():
    global _redis
    if _redis is None:
        import redis as _redis_lib
        url = getattr(settings, "REDIS_URL", "redis://localhost:6379/0")
        _redis = _redis_lib.from_url(url, decode_responses=True)
    return _redis


TTL = 14400  # 4 hours


def _key(org_id: str, restaurant_id: str, session_id: str) -> str:
    return f"chat:{org_id}:{restaurant_id}:{session_id}"


def load_history(org_id: str, restaurant_id: str, session_id: str) -> list[dict[str, str]]:
    """Return the conversation history as a list of {role, content} dicts."""
    try:
        r = _get_redis()
        raw = r.get(_key(org_id, restaurant_id, session_id))
        if raw:
            return json.loads(raw)
    except Exception:
        logger.warning("Failed to load chat history from Redis", exc_info=True)
    return []


def save_history(
    org_id: str,
    restaurant_id: str,
    session_id: str,
    history: list[dict[str, str]],
) -> None:
    """Persist the full conversation history to Redis."""
    try:
        r = _get_redis()
        r.setex(_key(org_id, restaurant_id, session_id), TTL, json.dumps(history))
    except Exception:
        logger.warning("Failed to save chat history to Redis", exc_info=True)


def append_message(
    org_id: str,
    restaurant_id: str,
    session_id: str,
    role: str,
    content: str,
) -> list[dict[str, str]]:
    """Append a single message and return the updated history."""
    history = load_history(org_id, restaurant_id, session_id)
    history.append({"role": role, "content": content})
    # Cap at 50 messages to avoid unbounded growth.
    if len(history) > 50:
        history = history[-50:]
    save_history(org_id, restaurant_id, session_id, history)
    return history


def clear_history(org_id: str, restaurant_id: str, session_id: str) -> None:
    """Delete a conversation session."""
    try:
        r = _get_redis()
        r.delete(_key(org_id, restaurant_id, session_id))
    except Exception:
        logger.warning("Failed to clear chat history from Redis", exc_info=True)
