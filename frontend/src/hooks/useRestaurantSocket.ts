import { useEffect, useRef, useState, useCallback } from "react";
import { tokenStore } from "@/lib/api";

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

    const protocol = window.location.protocol === "https:" ? "wss" : "ws";
    const url = `${protocol}://${window.location.host}/api/ws/restaurants/${slug}/events/?token=${token}`;
    const ws = new WebSocket(url);
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
    ws.onclose = (event) => {
      setStatus("closed");
      wsRef.current = null;
      // 4401/4403 are auth/permission closures — don't retry those.
      if (event.code === 4401 || event.code === 4403) return;
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
