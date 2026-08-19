import { useEffect, useRef, useState, useCallback } from "react";
import { tokenStore, refreshAccessToken } from "@/lib/api";

export type WsEvent =
  | { type: "order_event"; event: string; order: unknown }
  | { type: "table_event"; event: string; table: unknown }
  | { type: string; [key: string]: unknown };

export type WsStatus = "connecting" | "open" | "closed";

const RECONNECT_DELAY_MS = 3000;
const MAX_RECONNECT_DELAY_MS = 30000;

/**
 * Subscribe to a restaurant's real-time event channel.
 * Reconnects with exponential backoff until unmounted or slug/token removed.
 */
export function useRestaurantSocket(
  slug: string | null,
  onEvent: (event: WsEvent) => void
): WsStatus {
  const [status, setStatus] = useState<WsStatus>("closed");
  const wsRef = useRef<WebSocket | null>(null);
  const onEventRef = useRef(onEvent);
  const retriesRef = useRef(0);
  onEventRef.current = onEvent;

  const connect = useCallback(() => {
    const token = tokenStore.access;
    if (!slug || !token) return;

    // In production, connect directly to the backend (Vercel rewrites don't
    // forward WebSocket upgrade headers). In dev, Vite proxy handles it.
    const apiBase = import.meta.env.VITE_API_BASE_URL as string | undefined;
    let wsUrl: string;
    if (apiBase) {
      // e.g. https://tomodine-backend.vercel.app → wss://tomodine-backend.vercel.app
      const wsBase = apiBase.replace(/^http/, "ws");
      wsUrl = `${wsBase}/api/ws/restaurants/${slug}/events/?token=${token}`;
    } else {
      const protocol = window.location.protocol === "https:" ? "wss" : "ws";
      wsUrl = `${protocol}://${window.location.host}/api/ws/restaurants/${slug}/events/?token=${token}`;
    }
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;
    setStatus("connecting");

    ws.onopen = () => {
      retriesRef.current = 0;
      setStatus("open");
    };
    ws.onmessage = (msg) => {
      try {
        const data = JSON.parse(msg.data) as WsEvent;
        onEventRef.current(data);
      } catch {
        /* malformed frame — ignore */
      }
    };
    ws.onclose = async (event) => {
      setStatus("closed");
      wsRef.current = null;
      // 4403 = not a restaurant member — don't retry.
      if (event.code === 4403) return;
      // 4401 = token expired/invalid — try refreshing the token once
      // before giving up.
      if (event.code === 4401) {
        const fresh = await refreshAccessToken();
        if (!fresh) return; // refresh failed — user must re-login
        // Token refreshed — reconnect immediately.
        retriesRef.current = 0;
        connect();
        return;
      }
      const delay = Math.min(
        RECONNECT_DELAY_MS * 2 ** retriesRef.current,
        MAX_RECONNECT_DELAY_MS
      );
      retriesRef.current += 1;
      setTimeout(connect, delay);
    };
  }, [slug]);

  useEffect(() => {
    connect();
    return () => {
      wsRef.current?.close();
      wsRef.current = null;
    };
  }, [connect]);

  return status;
}
