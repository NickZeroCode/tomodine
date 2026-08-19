# Bhojon — Restaurant Management SaaS for Bangladesh

A multi-tenant Restaurant Management SaaS built for the Bangladesh market:
bilingual (English / বাংলা), BDT (৳) pricing, Asia/Dhaka timezone, QR-code
table ordering, a live kitchen order board, and subscription billing.

## Stack

| Layer    | Technology |
|----------|------------|
| Frontend | Vite · React 18 · TypeScript (strict) · Tailwind CSS · i18next · TanStack Query |
| Backend  | Django 5 · Django REST Framework · SimpleJWT · Channels (WebSockets) |
| Database | SQLite (dev) / PostgreSQL (production-ready) |
| Realtime | Channels + Redis channel layer (InMemory in dev) |

## Repository layout

```
backend/    Django project (config + apps/*)
frontend/   Vite React application
requirements.txt
```

## Quick start (Windows / PowerShell)

### Backend

```powershell
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
cd backend
copy .env.example .env   # optional; dev defaults work out of the box
..\.venv\Scripts\python.exe manage.py migrate
..\.venv\Scripts\python.exe manage.py seed    # plans, permissions, system roles
..\.venv\Scripts\python.exe manage.py runserver
```

API docs (Swagger UI): http://localhost:8000/api/docs/

### Frontend

```powershell
cd frontend
npm install
npm run dev
```

App: http://localhost:5173 (proxies `/api` and `/ws` to the Django server on :8000).

### Tests

```powershell
# Backend — 11 tests
cd backend; ..\.venv\Scripts\python.exe manage.py test apps

# Frontend — 14 tests
cd frontend; npx vitest run
```

## Architecture notes

### Multi-tenancy & authorization

- Every tenant-owned model uses `TenantManager` / `TenantQuerySet.for_restaurant()`
  and is exposed through `TenantScopedViewSet`, which scopes all querysets to the
  restaurant resolved from the `X-Restaurant-Slug` header.
- **Membership is resolved lazily in the DRF permission layer**
  (`apps/core/permissions.py::_resolve_membership`), not in Django middleware.
  Reason: DRF's JWT authentication runs *after* Django middleware, so
  `request.user` is still anonymous at middleware time. The resolved membership
  is cached on `request._resolved_membership`.
- `IsRestaurantMember` gates tenant endpoints; `HasRestaurantPermission` checks
  fine-grained permission codenames (owner bypass).

### Order state machine

`NEW → ACCEPTED → PREPARING → READY → SERVED → PAID` (plus `REJECTED`,
`CANCELLED`). All transitions go through
`apps/ordering/services.py::transition_order_status`, which validates against
`_ALLOWED_TRANSITIONS`, writes an `OrderStatusHistory` audit row, and syncs the
table status (e.g. `PAID → table available`). Invalid transitions raise
`ValueError` and are surfaced as 400s.

### Bilingual from the foundation

- Every user-facing content model stores `name_en` / `name_bn` (and
  `description_en` / `description_bn`) with Bangla-fallback helpers.
- The frontend uses i18next with full key-parity between `en.json` and
  `bn.json` (enforced by a test), switches `<html lang>`, and swaps to the
  Hind Siliguri / Noto Sans Bengali typeface when Bangla is active.

### Localization

- Currency: `DEFAULT_CURRENCY = "BDT"`, symbol `৳`; frontend formats via
  `Intl.NumberFormat("en-BD" | "bn-BD")` (Bangla digits in bn).
- Timezone: `TIME_ZONE = "Asia/Dhaka"`, `USE_TZ = True`.
- Phone validation: `+8801XXXXXXXXX` normalization in
  `apps/core/validators.py::validate_bd_phone`.
- Addresses: Division / District / Upazila / Area fields on `Restaurant`.

### Realtime

- WebSocket endpoint: `ws://…/ws/restaurants/<slug>/events/?token=<jwt>`
  (`apps/notifications/consumers.py`). Auth via JWT query param
  (`JwtAuthMiddleware`); non-members are rejected with close code 4403.
- Events: `order.event`, `table.event`, broadcast via
  `apps/notifications/services.py::broadcast_to_restaurant` (never raises).
- Frontend hook: `frontend/src/hooks/useRestaurantSocket.ts` with exponential
  backoff reconnect.

### Production channel layer (Redis)

Development uses Django's `InMemoryChannelLayer` (single process only). For
production, switch to the Redis-backed layer so multiple ASGI workers can
share events:

1. Run Redis. Easiest is the bundled compose service:
   ```powershell
   docker compose up -d redis
   ```
   (or install Redis / Memurai natively on Windows).
2. Set env vars (see `backend/.env.example`):
   ```
   USE_REDIS_CHANNEL_LAYER=true
   REDIS_URL=redis://localhost:6379/0
   ```
3. Serve with an ASGI server (not `runserver`). Both are in
   `requirements.txt`:
   ```powershell
   cd backend
   daphne -b 0.0.0.0 -p 8000 config.asgi:application
   # or
   uvicorn config.asgi:application --host 0.0.0.0 --port 8000
   ```

The setting lives in `backend/config/settings.py` (`USE_REDIS_CHANNEL_LAYER`
flag); when false it falls back to the in-memory layer for local dev/tests.

### Customer QR ordering (public)

Unauthenticated flow under `/api/v1/public/`:

1. `POST /session/` — QR token → customer session (+ server cart)
2. `GET /menu/` — active bilingual menu for the QR's restaurant
3. `POST /cart/items/` — add dish/variant to the session cart
4. `POST /order/` — atomically convert cart → order (totals computed server-side), broadcast `order.event`
5. `GET /order/status/` — poll order status

Frontend route: `/order/:qrToken` (mobile-first, sticky cart bar, 5s status polling).

## Seed data

`manage.py seed` is idempotent and creates:

- 9 permissions (orders/tables/menu/staff/billing/analytics/settings, bilingual names)
- 4 system roles: Manager (all), Waiter, Kitchen, Cashier
- 3 subscription plans: Trial (৳0, 14 days) · Standard (৳1,500/mo) · Pro (৳3,500/mo)
