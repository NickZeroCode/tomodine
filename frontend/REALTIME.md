# Realtime Freshness Model

How TomoDine keeps data live: **WebSocket is the source of truth; polling is a
safety net, never the primary mechanism.** This doc records the intended
freshness contract per surface so future changes stay coherent.

## Transport

- **One WebSocket endpoint** — `api/ws/restaurants/<slug>/events/`
  (`RestaurantEventsConsumer`, membership-gated). Staff/dashboard only.
- Client: [src/hooks/useRestaurantSocket.ts](src/hooks/useRestaurantSocket.ts)
  — exponential backoff, `4401` → token refresh + retry, `4403` → no retry
  (forbidden). Events are compact diffs (id + version + changed fields).

## Freshness contract per surface

| Surface | Primary | Safety-net poll | Notes |
|---|---|---|---|
| Orders ([OrdersPage](src/pages/dashboard/OrdersPage.tsx)) | WS `order` / `order.event` → invalidate | **10s** | 10s is the documented minimum interval. |
| Tables ([TablesPage](src/pages/dashboard/TablesPage.tsx)) | WS `table.event` patches by `version` | version-diff sync | Never regresses to an older `version`. |
| Notifications ([NotificationBell](src/components/NotificationBell.tsx)) | WS any event → invalidate | **30s** | Bell is not latency-critical; WS covers toasts. |
| Inventory ([InventoryPage](src/pages/dashboard/InventoryPage.tsx)) | WS `inventory.event` / `menu.event` | **60s** | Safety net only. |
| Overview ([OverviewPage](src/pages/dashboard/OverviewPage.tsx)) | WS `order`/`table` → invalidate analytics | — | Analytics also cached 60s server-side. |
| **Customer order status** ([CustomerOrderPage](src/pages/customer/CustomerOrderPage.tsx)) | **polling** | **5s** | ⚠️ See below. |

## The customer exception (intentional)

There is **no customer/guest WebSocket** — the only endpoint is staff-only.
For a diner watching their order move from *received → preparing → ready*,
the **5s poll is the only freshness source**, so it is deliberately aggressive
and must NOT be relaxed without a replacement.

If a customer-facing channel is ever added (a session-scoped
`GuestEventsConsumer` keyed by `session_token`), then — and only then — drop
the customer poll to a 15–30s safety net like the staff surfaces.

## Rules

1. **Never** poll faster than 10s on any staff surface (WS already covers it).
2. Adding a new live surface → wire WS invalidation first; add a ≥10s poll
   only as a fallback, and comment that it is a safety net.
3. When WS covers a surface, prefer `invalidateQueries` (refetch) or
   `setQueryData` (patch by version) over increasing poll frequency.
4. Polling <10s is reserved exclusively for the WS-less customer page.
