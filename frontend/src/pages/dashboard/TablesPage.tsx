import { useCallback, useMemo, useRef, useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { api } from "@/lib/api";
import { formatBDT } from "@/lib/format";
import { useRestaurant } from "@/context/RestaurantContext";
import { useRestaurantSocket } from "@/hooks/useRestaurantSocket";
import { OrderStatusBadge } from "@/components/OrderStatusBadge";
import { FloorMap } from "@/components/FloorMap";
import { KanbanSidebar } from "@/components/KanbanSidebar";
import { LoadingState, ErrorState, EmptyState } from "@/components/States";
import { Modal } from "@/components/Modal";
import { Icon } from "@/components/Icon";
import { TextField } from "@/components/FormField";
import type { ApiError, Order, OrderStatus, QRCodeInfo, Table } from "@/types";

interface TableFormState {
  number: string;
  label: string;
  seats: string;
  floor: string;
}

const EMPTY_FORM: TableFormState = { number: "", label: "", seats: "4", floor: "" };

/* ── Urgency scoring (client-side derived state) ──────────────
   Surfaces true emergencies instead of a wall of blinking lights.
   +40 new order waiting · +25 dining > 90 min · +15 > 60 min
   · +10 per guest (capped) · +5 per open order. */
function urgencyScore(table: Table): number {
  let score = 0;
  if (table.has_new_orders > 0) score += 40;
  const mins = table.dining_minutes ?? 0;
  if (mins >= 90) score += 25;
  else if (mins >= 60) score += 15;
  score += 10 * Math.min(table.seats, 6);
  score += 5 * Math.min(table.active_orders, 4);
  return Math.min(score, 100);
}

const CRITICAL_THRESHOLD = 70;

export function TablesPage() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language === "bn" ? "bn" : "en";
  const { restaurant } = useRestaurant();
  const queryClient = useQueryClient();

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Table | null>(null);
  const [form, setForm] = useState<TableFormState>(EMPTY_FORM);
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [qrFor, setQrFor] = useState<Table | null>(null);
  const [copied, setCopied] = useState(false);
  const [ordersForTable, setOrdersForTable] = useState<Table | null>(null);
  const [criticalOnly, setCriticalOnly] = useState(false);
  const [pulseId, setPulseId] = useState<string | null>(null);

  const tablesKey = ["tables", restaurant?.slug];

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: tablesKey,
    queryFn: async () => {
      const res = await api.get("/tables/");
      const list = res.data;
      return (Array.isArray(list) ? list : list.results) as Table[];
    },
    enabled: !!restaurant,
  });

  // ── Real-time reconciliation ──────────────────────────────────
  // WS events carry compact diffs; we patch the react-query cache in place
  // instead of refetching. On reconnect (or a missed event) we fall back to
  // the version-based /tables/sync/ endpoint which replays only newer
  // entities — no full page reloads, minimal payloads.
  const minVersionRef = useRef(0);

  const reconcile = useCallback(async () => {
    try {
      const res = await api.get<Table[] | { results: Table[] }>("/tables/sync/", {
        params: { since: minVersionRef.current },
      });
      const fresh = Array.isArray(res.data) ? res.data : res.data.results;
      if (!fresh?.length) return;
      queryClient.setQueryData<Table[]>(tablesKey, (old) => {
        const map = new Map((old ?? []).map((t) => [t.id, t]));
        for (const t of fresh) {
          const prev = map.get(t.id);
          // Never regress to an older version.
          if (!prev || t.version >= prev.version) map.set(t.id, t);
        }
        return [...map.values()];
      });
      for (const t of fresh) {
        if (t.version > minVersionRef.current) minVersionRef.current = t.version;
      }
    } catch {
      // Reconciliation is best-effort; the periodic refetch covers outages.
    }
  }, [queryClient, tablesKey]);

  useRestaurantSocket(restaurant?.slug ?? null, (event) => {
    const type = String(event.type ?? "");
    if (type === "table.event" || type === "table") {
      const payload = ((event as Record<string, unknown>).payload ?? event) as {
        table_id?: string;
        version?: number;
        status?: Table["status"];
        seated_at?: string | null;
        dining_minutes?: number | null;
      };
      if (payload.table_id && typeof payload.version === "number") {
        // Patch just this table's mutable fields from the diff.
        queryClient.setQueryData<Table[]>(tablesKey, (old) =>
          (old ?? []).map((t) =>
            t.id === payload.table_id && t.version < (payload.version ?? 0)
              ? {
                  ...t,
                  status: payload.status ?? t.status,
                  seated_at:
                    payload.seated_at !== undefined ? payload.seated_at : t.seated_at,
                  dining_minutes:
                    payload.dining_minutes !== undefined
                      ? payload.dining_minutes
                      : t.dining_minutes,
                  version: payload.version ?? t.version,
                }
              : t
          )
        );
        if ((payload.version ?? 0) > minVersionRef.current)
          minVersionRef.current = payload.version ?? 0;
      } else {
        // Layout change or unknown shape — pull only what changed.
        void reconcile();
      }
    }
    if (type === "order" || type === "order.event") {
      void queryClient.invalidateQueries({ queryKey: ["table-orders"] });
      void queryClient.invalidateQueries({ queryKey: ["orders"] });
      void reconcile();
    }
  });

  // Orders for the selected table (for the orders modal).
  const tableOrdersQuery = useQuery({
    queryKey: ["table-orders", ordersForTable?.id],
    queryFn: async () => {
      const today = new Date().toISOString().slice(0, 10);
      const res = await api.get("/orders/", { params: { table: ordersForTable!.id, created_after: today } });
      const list = res.data;
      const orders = (Array.isArray(list) ? list : list.results) as Order[];
      return orders.map((o) => ({ ...o, status: o.status.toUpperCase() as OrderStatus }));
    },
    enabled: !!ordersForTable,
  });

  const transition = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: OrderStatus }) =>
      api.post(`/orders/${id}/transition/`, { status: status.toLowerCase() }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["table-orders"] });
      void queryClient.invalidateQueries({ queryKey: tablesKey });
      void queryClient.invalidateQueries({ queryKey: ["orders"] });
    },
  });

  const invalidate = () =>
    void queryClient.invalidateQueries({ queryKey: tablesKey });

  // Floor-map layout persistence — one batched request per drag session.
  const saveLayout = useMutation({
    mutationFn: async (
      layout: Array<{ id: string; x: number; y: number; w: number; h: number }>
    ) => api.post("/tables/layout/", { layout }),
    onSuccess: () => void reconcile(),
  });

  const save = useMutation({
    mutationFn: async (input: TableFormState) => {
      const payload = {
        number: input.number,
        label: input.label,
        seats: parseInt(input.seats, 10) || 4,
        floor: input.floor,
      };
      if (editing) return api.patch(`/tables/${editing.id}/`, payload);
      return api.post("/tables/", payload);
    },
    onSuccess: () => {
      setFormOpen(false);
      setEditing(null);
      setForm(EMPTY_FORM);
      setErrors({});
      invalidate();
    },
    onError: (err) => {
      const apiErr = err as unknown as ApiError;
      setErrors(apiErr.errors ?? { non_field_errors: [apiErr.message] });
    },
  });

  const remove = useMutation({
    mutationFn: async (id: string) => api.delete(`/tables/${id}/`),
    onSuccess: invalidate,
  });

  const generateQr = useMutation({
    mutationFn: async (table: Table) =>
      (await api.post<QRCodeInfo>(`/tables/${table.id}/generate_qr/`)).data,
    onSuccess: (qr, table) => {
      invalidate();
      setQrFor({ ...table, qr_code: qr });
    },
  });

  const regenerateQr = useMutation({
    mutationFn: async (id: string) =>
      (await api.post<QRCodeInfo>(`/tables/${id}/regenerate_qr/`)).data,
    onSuccess: (qr) => {
      invalidate();
      setQrFor((prev) => (prev ? { ...prev, qr_code: qr } : prev));
    },
  });

  function openCreate() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setErrors({});
    setFormOpen(true);
  }

  function openEdit(table: Table) {
    setEditing(table);
    setForm({
      number: table.number,
      label: table.label,
      seats: String(table.seats),
      floor: table.floor,
    });
    setErrors({});
    setFormOpen(true);
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    save.mutate(form);
  }

  function orderUrl(token: string): string {
    return `${window.location.origin}/order/${token}`;
  }

  function qrImageUrl(qr: QRCodeInfo): string {
    // Prefer the backend-rendered data URI; fall back to the external API.
    if (qr.image_data_uri) return qr.image_data_uri;
    return `https://api.qrserver.com/v1/create-qr-code/?size=640x640&margin=16&data=${encodeURIComponent(
      orderUrl(qr.token)
    )}`;
  }

  function downloadQr(table: Table) {
    if (!table.qr_code) return;
    const a = document.createElement("a");
    a.href = qrImageUrl(table.qr_code);
    a.download = `table-${table.number}-qr.png`;
    a.target = "_blank";
    a.rel = "noreferrer";
    a.click();
  }

  function printQr(table: Table) {
    if (!table.qr_code) return;
    const url = qrImageUrl(table.qr_code);
    const win = window.open("", "_blank", "width=420,height=560");
    if (!win) return;
    win.document.write(
      `<!doctype html><html><head><title>${t("tables.printQr")}</title></head>` +
        `<body style="margin:0;display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100vh;font-family:sans-serif">` +
        `<h2 style="margin:0 0 4px">${restaurant?.name ?? ""}</h2>` +
        `<p style="margin:0 0 16px;color:#555">${t("orders.table")} ${
          table.label || table.number
        }</p>` +
        `<img src="${url}" style="width:320px;height:320px" onload="window.print()"/>` +
        `</body></html>`
    );
    win.document.close();
  }

  async function copyOrderLink(table: Table) {
    if (!table.qr_code) return;
    const link = orderUrl(table.qr_code.token);
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt(t("tables.copyLink"), link);
    }
  }

  // NOTE: All hooks must run unconditionally — the derived/scored memo and
  // any other hooks live ABOVE the early returns below.
  const tables = data ?? [];

  // Derived: sorted by urgency (most urgent first).
  const scored = useMemo(
    () =>
      tables
        .map((t) => ({ table: t, score: urgencyScore(t) }))
        .sort((a, b) => b.score - a.score || a.table.number.localeCompare(b.table.number)),
    [tables]
  );
  const criticalCount = scored.filter((s) => s.score >= CRITICAL_THRESHOLD).length;

  // Live-floor KPIs (derived, no extra requests).
  const kpis = useMemo(() => {
    const seated = tables.filter((t) => (t.guests ?? 0) > 0 || t.active_orders > 0);
    const totalSeats = seated.reduce((sum, t) => sum + t.seats, 0);
    const occupiedSeats = seated.reduce((sum, t) => sum + Math.min(t.guests ?? t.seats, t.seats), 0);
    const billTables = tables.filter((t) => t.status === "awaiting_payment");
    const serviceTables = scored.filter(
      ({ table }) => table.status === "ready" || table.status === "awaiting_service" || table.has_new_orders > 0
    );
    return {
      seatedCount: seated.length,
      totalActive: tables.length,
      occupiedSeats,
      totalSeats,
      billCount: billTables.length,
      billTotal: billTables.reduce(
        (sum, t) => sum + (parseFloat(String(t.total ?? "0")) || 0),
        0
      ),
      attention: [
        ...billTables.map((t) => ({ table: t, kind: "bill" as const })),
        ...serviceTables
          .filter(({ table }) => !billTables.includes(table))
          .map(({ table }) => ({
            table,
            kind: (table.has_new_orders > 0 ? "order" : "service") as "order" | "service",
          })),
      ].slice(0, 6),
    };
  }, [tables, scored]);

  if (!restaurant) return <EmptyState />;
  if (isLoading) return <LoadingState />;
  if (isError) return <ErrorState onRetry={() => void refetch()} />;

  return (
    <section aria-labelledby="tables-heading">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 id="tables-heading" className="text-lg font-semibold text-ink-900">
          {t("tables.title")}
        </h2>
        <div className="flex items-center gap-2">
          {/* Critical filter — fades noise, surfaces emergencies */}
          <button
            type="button"
            onClick={() => setCriticalOnly((v) => !v)}
            className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
              criticalOnly
                ? "bg-red-600 text-white shadow-sm"
                : "border border-ink-200 bg-white text-ink-600 hover:bg-ink-50"
            }`}
            aria-pressed={criticalOnly}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${criticalOnly ? "bg-white" : "bg-red-500"}`} />
            {t("tables.criticalOnly")}
            {criticalCount > 0 && (
              <span className={`rounded-full px-1.5 text-[0.6rem] font-bold ${
                criticalOnly ? "bg-white/20" : "bg-red-100 text-red-700"
              }`}>
                {criticalCount}
              </span>
            )}
          </button>
          <button type="button" className="btn-primary" onClick={openCreate}>
            {t("tables.addTable")}
          </button>
        </div>
      </div>

      {tables.length === 0 ? (
        <EmptyState
          title={t("common.empty")}
          action={
            <button type="button" className="btn-primary" onClick={openCreate}>
              {t("tables.addTable")}
            </button>
          }
        />
      ) : (
        <>
          {/* ── Live KPI cards — corporate dashboard style ── */}
          <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {/* Tables seated */}
            <div className="rounded-xl border border-ink-100 bg-white p-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-ink-400">{t("tables.kpiTables")}</span>
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-teal-50">
                  <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-4 w-4 text-teal-600">
                    <rect x="3" y="3" width="14" height="14" rx="2" /><path d="M3 8h14M8 3v14" />
                  </svg>
                </span>
              </div>
              <p className="mt-2 font-display text-2xl font-bold tabular-nums text-ink-900">
                {kpis.seatedCount}<span className="text-sm font-normal text-ink-300">/{kpis.totalActive}</span>
              </p>
              <p className="mt-0.5 text-[0.65rem] text-ink-400">{t("tables.kpiSeated")}</p>
            </div>

            {/* Chairs occupied */}
            <div className="rounded-xl border border-ink-100 bg-white p-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-ink-400">{t("tables.kpiChairs")}</span>
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-sky-50">
                  <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-4 w-4 text-sky-600">
                    <circle cx="10" cy="6" r="3" /><path d="M4 18v-1a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v1" />
                  </svg>
                </span>
              </div>
              <p className="mt-2 font-display text-2xl font-bold tabular-nums text-ink-900">
                {kpis.occupiedSeats}<span className="text-sm font-normal text-ink-300">/{kpis.totalSeats}</span>
              </p>
              <p className="mt-0.5 text-[0.65rem] text-ink-400">{t("tables.kpiChairs")}</p>
            </div>

            {/* Bill requests */}
            <div className={`rounded-xl border p-4 ${kpis.billCount > 0 ? "border-red-200 bg-red-50/50" : "border-ink-100 bg-white"}`}>
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-ink-400">{t("tables.kpiBills")}</span>
                <span className={`flex h-8 w-8 items-center justify-center rounded-lg ${kpis.billCount > 0 ? "bg-red-100" : "bg-ink-50"}`}>
                  <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" className={`h-4 w-4 ${kpis.billCount > 0 ? "text-red-600" : "text-ink-400"}`}>
                    <rect x="3" y="2" width="14" height="16" rx="2" /><path d="M7 6h6M7 10h4M7 14h2" />
                  </svg>
                </span>
              </div>
              <p className={`mt-2 font-display text-2xl font-bold tabular-nums ${kpis.billCount > 0 ? "text-red-700" : "text-ink-900"}`}>
                {kpis.billCount}
              </p>
              <p className="mt-0.5 text-[0.65rem] text-ink-400">{kpis.billCount > 0 ? `${formatBDT(kpis.billTotal, lang)} ${t("tables.pending")}` : t("tables.kpiBills")}</p>
            </div>

            {/* Critical / alerts */}
            <div className={`rounded-xl border p-4 ${criticalCount > 0 ? "border-orange-200 bg-orange-50/50" : "border-ink-100 bg-white"}`}>
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-ink-400">{t("tables.criticalOnly")}</span>
                <span className={`flex h-8 w-8 items-center justify-center rounded-lg ${criticalCount > 0 ? "bg-orange-100" : "bg-ink-50"}`}>
                  <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" className={`h-4 w-4 ${criticalCount > 0 ? "text-orange-600" : "text-ink-400"}`}>
                    <path d="M10 2L2 18h16L10 2z" /><path d="M10 8v4M10 14.5v.5" />
                  </svg>
                </span>
              </div>
              <p className={`mt-2 font-display text-2xl font-bold tabular-nums ${criticalCount > 0 ? "text-orange-700" : "text-ink-900"}`}>
                {criticalCount}
              </p>
              <p className="mt-0.5 text-[0.65rem] text-ink-400">{criticalCount > 0 ? t("tables.needsAttention") : t("tables.allClear")}</p>
            </div>
          </div>

          {/* ── Wait List — tables awaiting service/payment in queue order ── */}
          {(() => {
            const waiting = scored.filter(
              ({ table }) =>
                table.status === "awaiting_payment" ||
                table.status === "ready" ||
                table.status === "awaiting_service"
            );
            if (waiting.length === 0) return null;
            return (
              <div className="mb-4 rounded-xl border border-ink-100 bg-white p-4">
                <div className="mb-3 flex items-center gap-2">
                  <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-50">
                    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-3.5 w-3.5 text-amber-600">
                      <circle cx="10" cy="10" r="8" /><path d="M10 6v4l3 2" />
                    </svg>
                  </span>
                  <h3 className="text-sm font-semibold text-ink-800">{t("tables.waitList")}</h3>
                  <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[0.6rem] font-bold text-amber-700">
                    {waiting.length}
                  </span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {waiting.map(({ table }) => {
                    const mins = table.dining_minutes ?? 0;
                    const isBill = table.status === "awaiting_payment";
                    return (
                      <button
                        key={table.id}
                        type="button"
                        onClick={() => setOrdersForTable(table)}
                        onMouseEnter={() => setPulseId(table.id)}
                        onMouseLeave={() => setPulseId(null)}
                        className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-left transition-all hover:shadow-sm ${
                          isBill
                            ? "border-red-200 bg-red-50"
                            : "border-amber-200 bg-amber-50"
                        }`}
                      >
                        <span className={`flex h-8 w-8 items-center justify-center rounded-lg text-xs font-bold text-white ${
                          isBill ? "bg-red-500" : "bg-amber-500"
                        }`}>
                          {table.number}
                        </span>
                        <div>
                          <p className="text-xs font-semibold text-ink-900">
                            T-{table.number}
                            {table.label && <span className="ml-1 font-normal text-ink-400">· {table.label}</span>}
                          </p>
                          <p className="text-[0.65rem] text-ink-500">
                            {isBill ? t("tables.wantsBill") : t("tables.laneReady")}
                            {mins > 0 && ` · ${t("tables.waitTime", { time: `${mins}m` })}`}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })()}

          {/* ── Split-screen: 2D floor map (left) + Kanban (right) ── */}
          <div className="flex flex-col gap-4 lg:flex-row">
            {/* Floor map — 70% on desktop */}
            <div className="min-w-0 flex-1 lg:basis-[70%]">
              <FloorMap
                tables={scored}
                criticalThreshold={CRITICAL_THRESHOLD}
                criticalOnly={criticalOnly}
                selectedId={ordersForTable?.id ?? null}
                pulseId={pulseId}
                onSelect={setOrdersForTable}
                onLayoutSave={(layout) => saveLayout.mutate(layout)}
              />
            </div>
            {/* Kanban swimlanes — 30% on desktop, below map on mobile */}
            <div className="w-full shrink-0 lg:w-72 xl:w-80">
              <KanbanSidebar
                tables={scored}
                onSelect={setOrdersForTable}
                onHover={setPulseId}
                selectedId={ordersForTable?.id ?? null}
              />
            </div>
          </div>

          {/* ── Management card list (edit / QR / delete) ── */}
          <details className="group rounded-lg border border-ink-100 bg-white">
            <summary className="cursor-pointer select-none px-4 py-3 text-sm font-semibold text-ink-700 transition-colors hover:bg-ink-25">
              {t("tables.manageTables")} ({tables.length})
            </summary>
            <ul className="grid grid-cols-1 gap-3 border-t border-ink-100 p-4 sm:grid-cols-2 lg:grid-cols-3">
              {scored.map(({ table }) => {
                const isNew = table.has_new_orders > 0;
                const isActive = table.active_orders > 0;
                return (
                  <li key={table.id} className="card overflow-hidden">
                    <div className={`flex items-center gap-3 p-3 ${
                      isNew ? "bg-blue-50" : isActive ? "bg-amber-50" : "bg-emerald-50"
                    }`}>
                      <span className={`flex h-11 w-11 shrink-0 items-center justify-center text-lg font-bold shadow-sm ${
                        isNew ? "bg-blue-500 text-white" : isActive ? "bg-amber-500 text-white" : "bg-emerald-600 text-white"
                      }`} style={{ borderRadius: "4px" }}>
                        {table.number}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-ink-900">
                          {table.label || `${t("tables.tableNumber")} ${table.number}`}
                        </p>
                        <p className="text-xs text-ink-500">
                          {t("tables.seats")}: {table.seats}{table.floor ? ` · ${table.floor}` : ""}
                          {table.dining_minutes != null && ` · ${table.dining_minutes}m`}
                        </p>
                      </div>
                      {table.qr_code && (
                        <img
                          src={qrImageUrl(table.qr_code)}
                          alt=""
                          className="h-11 w-11 shrink-0 border border-ink-100 bg-white object-cover"
                          style={{ borderRadius: "4px", cursor: "pointer" }}
                          onClick={(e) => { e.stopPropagation(); setQrFor(table); }}
                        />
                      )}
                    </div>
                    <div className="flex flex-wrap gap-1.5 p-3">
                      {table.active_orders > 0 && (
                        <button
                          type="button"
                          className="rounded-lg bg-orange-500 px-2 py-1 text-xs font-semibold text-white transition-colors hover:bg-orange-600"
                          onClick={() => setOrdersForTable(table)}
                        >
                          <Icon name="orders" className="mr-1 inline h-3 w-3" />
                          {t("tables.tableOrders")}
                        </button>
                      )}
                      <button type="button" className="btn-secondary px-2 py-1 text-xs" onClick={() => openEdit(table)}>
                        {t("common.edit")}
                      </button>
                      <button
                        type="button"
                        className="btn-ghost px-2 py-1 text-xs text-red-600"
                        disabled={remove.isPending}
                        onClick={() => {
                          if (window.confirm(t("tables.deleteConfirm"))) remove.mutate(table.id);
                        }}
                      >
                        {t("common.delete")}
                      </button>
                      {table.qr_code ? (
                        <button type="button" className="btn-primary px-2 py-1 text-xs" onClick={() => setQrFor(table)}>
                          QR
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="btn-primary px-2 py-1 text-xs"
                          disabled={generateQr.isPending}
                          onClick={() => generateQr.mutate(table)}
                        >
                          {t("tables.generateQr")}
                        </button>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          </details>
        </>
      )}

      {formOpen && (
        <Modal
          title={editing ? t("tables.editTable") : t("tables.addTable")}
          onClose={() => setFormOpen(false)}
        >
          <form onSubmit={onSubmit} className="space-y-4" noValidate>
            <TextField
              label={t("tables.tableNumber")}
              value={form.number}
              required
              error={errors.number?.[0]}
              onChange={(v) => setForm((f) => ({ ...f, number: v }))}
            />
            <TextField
              label={t("tables.label")}
              value={form.label}
              error={errors.label?.[0]}
              onChange={(v) => setForm((f) => ({ ...f, label: v }))}
            />
            <TextField
              label={t("tables.seats")}
              type="number"
              value={form.seats}
              error={errors.seats?.[0]}
              onChange={(v) => setForm((f) => ({ ...f, seats: v }))}
            />
            <TextField
              label={t("tables.floor")}
              value={form.floor}
              error={errors.floor?.[0]}
              onChange={(v) => setForm((f) => ({ ...f, floor: v }))}
            />
            {errors.non_field_errors && (
              <p className="text-sm text-red-600" role="alert">
                {errors.non_field_errors[0]}
              </p>
            )}
            <div className="flex justify-end gap-2">
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setFormOpen(false)}
              >
                {t("common.cancel")}
              </button>
              <button type="submit" className="btn-primary" disabled={save.isPending}>
                {save.isPending ? t("common.loading") : t("common.save")}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {qrFor && qrFor.qr_code && (
        <Modal
          title={`${t("orders.table")} ${qrFor.label || qrFor.number}`}
          onClose={() => setQrFor(null)}
        >
          <div className="flex flex-col items-center gap-4">
            <img
              src={qrImageUrl(qrFor.qr_code)}
              alt={`QR ${qrFor.label || qrFor.number}`}
              className="h-56 w-56 rounded-card border border-ink-100"
            />
            <div className="flex w-full flex-wrap justify-center gap-2">
              <button
                type="button"
                className="btn-secondary text-xs"
                onClick={() => downloadQr(qrFor)}
              >
                {t("tables.downloadQr")}
              </button>
              <button
                type="button"
                className="btn-secondary text-xs"
                onClick={() => printQr(qrFor)}
              >
                {t("tables.printQr")}
              </button>
              <button
                type="button"
                className="btn-secondary text-xs"
                onClick={() => void copyOrderLink(qrFor)}
              >
                {copied ? t("tables.linkCopied") : t("tables.copyLink")}
              </button>
              <button
                type="button"
                className="btn-ghost text-xs text-red-600"
                disabled={regenerateQr.isPending}
                onClick={() => regenerateQr.mutate(qrFor.id)}
              >
                {t("tables.regenerateQr")}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Table orders modal */}
      {ordersForTable && (
        <Modal
          title={`${t("tables.tableOrders")} — ${ordersForTable.label || `${t("tables.tableNumber")} ${ordersForTable.number}`}`}
          onClose={() => setOrdersForTable(null)}
        >
          {tableOrdersQuery.isLoading ? (
            <LoadingState />
          ) : (tableOrdersQuery.data ?? []).length === 0 ? (
            <p className="py-6 text-center text-sm text-ink-500">{t("tables.noActiveOrdersToday")}</p>
          ) : (
            <ul className="max-h-96 space-y-3 overflow-y-auto">
              {(tableOrdersQuery.data ?? []).map((order) => {
                const orderAge = order.created_at ? Math.floor((Date.now() - new Date(order.created_at).getTime()) / 60_000) : 0;
                const maxPrep = order.items.reduce((max, item) => Math.max(max, item.max_prep_time ?? 30), 0);
                const isOverdue = orderAge > maxPrep && !["PAID", "SERVED", "REJECTED", "CANCELLED"].includes(order.status);
                return (
                <li key={order.id} className={`border p-3 ${isOverdue ? "border-red-300 bg-red-50/50" : "border-ink-100"}`} style={{ borderRadius: "4px" }}>
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-ink-900">#{order.order_number}</span>
                      {isOverdue && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-red-500 px-2 py-0.5 text-[0.6rem] font-bold text-white">
                          ⚠ {orderAge}m
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-[0.6rem] tabular-nums ${isOverdue ? "font-bold text-red-600" : "text-ink-400"}`}>
                        {orderAge}m ago
                      </span>
                      <OrderStatusBadge status={order.status} />
                    </div>
                  </div>
                  <ul className="mt-1.5 space-y-0.5">
                    {order.items.map((item) => (
                      <li key={item.id} className="flex items-center gap-2 text-xs text-ink-600">
                        {item.dish_image ? (
                          <img src={item.dish_image} alt="" className="h-6 w-6 shrink-0 rounded object-cover" />
                        ) : null}
                        <span className="min-w-0 flex-1 truncate">
                          {item.quantity}× {item.dish_name_en || item.dish_name_bn}
                        </span>
                        <span className="shrink-0 tabular-nums">{formatBDT(item.unit_price, lang)}</span>
                      </li>
                    ))}
                  </ul>
                  <div className="mt-2 flex items-center justify-between border-t border-ink-100 pt-2">
                    <span className="text-xs font-bold tabular-nums text-ink-900">{formatBDT(order.total, lang)}</span>
                    <div className="flex flex-wrap gap-1.5">
                      {order.status === "NEW" && (
                        <button
                          type="button"
                          disabled={transition.isPending}
                          onClick={() => transition.mutate({ id: order.id, status: "CANCELLED" })}
                          className="border border-red-200 bg-red-50 px-2 py-1 text-[0.65rem] font-semibold text-red-600 hover:bg-red-100"
                          style={{ borderRadius: "3px" }}
                        >
                          {t("orders.cancelOrder")}
                        </button>
                      )}
                      {order.status === "NEW" && (
                        <button
                          type="button"
                          disabled={transition.isPending}
                          onClick={() => transition.mutate({ id: order.id, status: "PREPARING" })}
                          className="bg-orange-500 px-2 py-1 text-[0.65rem] font-semibold text-white hover:bg-orange-600"
                          style={{ borderRadius: "3px" }}
                        >
                          {t("orders.startPreparing")}
                        </button>
                      )}
                      {order.status === "PREPARING" && (
                        <button
                          type="button"
                          disabled={transition.isPending}
                          onClick={() => transition.mutate({ id: order.id, status: "READY" })}
                          className="bg-emerald-600 px-2 py-1 text-[0.65rem] font-semibold text-white hover:bg-emerald-700"
                          style={{ borderRadius: "3px" }}
                        >
                          {t("orders.markReady")}
                        </button>
                      )}
                      {order.status === "READY" && (
                        <button
                          type="button"
                          disabled={transition.isPending}
                          onClick={() => transition.mutate({ id: order.id, status: "SERVED" })}
                          className="bg-teal-600 px-2 py-1 text-[0.65rem] font-semibold text-white hover:bg-teal-700"
                          style={{ borderRadius: "3px" }}
                        >
                          {t("orders.markServed")}
                        </button>
                      )}
                      {order.status === "SERVED" && (
                        <button
                          type="button"
                          disabled={transition.isPending}
                          onClick={() => transition.mutate({ id: order.id, status: "PAID" })}
                          className="bg-ink-600 px-2 py-1 text-[0.65rem] font-semibold text-white hover:bg-ink-700"
                          style={{ borderRadius: "3px" }}
                        >
                          {t("orders.markPaid")}
                        </button>
                      )}
                    </div>
                  </div>
                </li>
                );
              })}
            </ul>
          )}
        </Modal>
      )}
    </section>
  );
}
