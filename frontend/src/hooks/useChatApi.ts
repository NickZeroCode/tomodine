/**
 * useChatApi — hook for the AI Concierge chat endpoint.
 *
 * Sends messages to POST /api/v1/chat/ with branch context.
 * Returns streaming-friendly state for the ChatWidget.
 */

import { useCallback, useRef, useState } from "react";
import axios from "axios";

const chatApi = axios.create({ baseURL: "/api/v1" });

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  structuredActions?: StructuredActions | null;
  timestamp: number;
}

export interface StructuredActions {
  type: "dish_carousel" | "price_comparison" | "confirmation" | "waiter_ping" | "quick_replies" | "order_status";
  items?: Array<{
    id?: string;
    name: string;
    price?: number;
    description?: string;
    category?: string;
    badge?: string;
    image_url?: string;
    is_vegetarian?: boolean;
    is_spicy?: boolean;
    min_prep_time?: number;
    max_prep_time?: number;
  }>;
  message?: string;
  order_total?: string;
  order_id?: string;
  quick_replies?: string[];
  suggest_more?: boolean;
  suggest_games?: boolean;
  orders?: Array<{
    id?: string;
    order_number?: string;
    status?: string;
    total?: string;
    minutes_ago?: number;
  }>;
}

interface UseChatApiReturn {
  messages: ChatMessage[];
  isLoading: boolean;
  error: string | null;
  sendMessage: (text: string) => Promise<void>;
  resetSession: () => void;
  sessionId: string | null;
}

function uid(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

/** Fallback: detect add-to-cart confirmations from bot text when backend
 *  doesn't return structured_actions (LLM skipped tool call). */
function guessStructuredActions(response: string, sentText: string): StructuredActions | null {
  const lower = sentText.toLowerCase();
  const respLower = response.toLowerCase();

  // User tried to add something and bot confirmed it.
  if (
    (lower.includes("add") && lower.includes("order")) ||
    (respLower.includes("added") && (respLower.includes("cart") || respLower.includes("order")))
  ) {
    return {
      type: "confirmation",
      message: response,
      suggest_more: true,
      suggest_games: true,
    };
  }

  // User asked about order status and bot responded with status info.
  if (
    lower.includes("order") && (lower.includes("status") || lower.includes("where") || lower.includes("track")) &&
    (respLower.includes("preparing") || respLower.includes("ready") || respLower.includes("served") || respLower.includes("order"))
  ) {
    return {
      type: "order_status",
      orders: [],
      message: response,
    };
  }

  return null;
}

interface Props {
  tableId?: string;
  restaurantSlug?: string;
}

export function useChatApi({ tableId, restaurantSlug }: Props = {}): UseChatApiReturn {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sessionIdRef = useRef<string | null>(null);

  const sendMessage = useCallback(
    async (text: string) => {
      if (!text.trim() || isLoading) return;
      const sentText = text.trim();

      const userMsg: ChatMessage = {
        id: uid(),
        role: "user",
        content: sentText,
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, userMsg]);
      setIsLoading(true);
      setError(null);

      try {
        const payload: Record<string, unknown> = {
          message: sentText,
        };
        if (sessionIdRef.current) payload.session_id = sessionIdRef.current;
        if (tableId) payload.table_id = tableId;

        const headers: Record<string, string> = {};
        if (restaurantSlug) headers["X-Restaurant-Slug"] = restaurantSlug;

        const { data } = await chatApi.post("/chat/", payload, { headers });

        sessionIdRef.current = data.session_id;

        const botMsg: ChatMessage = {
          id: uid(),
          role: "assistant",
          content: data.response || "",
          structuredActions: data.structured_actions ?? guessStructuredActions(data.response, sentText),
          timestamp: Date.now(),
        };
        setMessages((prev) => [...prev, botMsg]);
      } catch (err: unknown) {
        const apiErr = err as { response?: { data?: { response?: string } }; message?: string };
        const errMsg = apiErr?.response?.data?.response || apiErr?.message || "Something went wrong.";
        setError(errMsg);

        const errorMsg: ChatMessage = {
          id: uid(),
          role: "assistant",
          content: errMsg,
          timestamp: Date.now(),
        };
        setMessages((prev) => [...prev, errorMsg]);
      } finally {
        setIsLoading(false);
      }
    },
    [isLoading, tableId]
  );

  const resetSession = useCallback(() => {
    if (sessionIdRef.current) {
      chatApi.post("/chat/reset/", { session_id: sessionIdRef.current }).catch(() => {});
    }
    sessionIdRef.current = null;
    setMessages([]);
    setError(null);
  }, []);

  return {
    messages,
    isLoading,
    error,
    sendMessage,
    resetSession,
    sessionId: sessionIdRef.current,
  };
}
