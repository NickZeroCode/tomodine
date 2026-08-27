/**
 * OrdersPage — corporate dashboard for order management.
 *
 * Layout (per DESIGN_SYSTEM.md):
 *   KPI cards → filter tabs → data table → expandable order detail
 *
 * Follows the design system: rounded-xl cards, ink-100 borders,
 * uppercase tracking-wider headers, tabular-nums, status pills with dots.
 */

import { useMemo, useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { api } from "@/lib/api";
import { formatBDT } from "@/lib/format";
import { useRestaurant } from "@/context/RestaurantContext";
import { useRestaurantSocket } from "@/hooks/useRestaurantSocket";
import { LoadingState, ErrorState, EmptyState } from "@/components/States";
import { showToast } from "@/components/Toast";
import { ImageWithFallback } from "@/components/ImageWithFallback";
import type { Order, OrderStatus } from "@/types";

/* ── Constants ──────────────────────────────────────────────── */

type FilterKey = "ALL" | OrderStatus;

const STATUS_CFG: Record<OrderStatus, { bg: string; text: string; dot: string }> = {
  NEW:       { bg: "bg-blue-50",    text: "text-blue-700",    dot: "bg-blue-500" },
  ACCEPTED:  { bg: "bg-indigo-50",  text: "text-indigo-700",  dot: "bg-indigo-500" },
  PREPARING: { bg: "bg-amber-50",   text: "text-amber-700",   dot: "bg-amber-500" },
  READY:     { bg: "bg-violet-50",  text: "text-violet-700",  dot: "bg-violet-500" },
  SERVED:    { bg: "bg-teal-50",    text: "text-teal-700",    dot: "bg-teal-500" },
  PAID:      { bg: "bg-ink-50",     text: "text-ink-500",     dot: "bg-ink-400" },
  REJECTED:  { bg: "bg-red-50",     text: "text-red-600",     dot: "bg-red-500" },
  CANCELLED: { bg: "bg-ink-50",     text: "text-ink-400",     dot: "bg-ink-300" },
};

const FILTER_ORDER: FilterKey[] = ["ALL", "NEW", "PREPARING", "READY", "SERVED", "PAID"];

const STATUS_I18N: Record<OrderStatus, string> = {
  NEW: "orders.new", ACCEPTED: "orders.accepted", PREPARING: "orders.preparing",
  READY: "orders.ready", SERVED: "orders.served", PAID: "orders.paid",
  REJECTED: "orders.rejected", CANCELLED: "orders.cancelled",
};

/** Quick-action: the single most likely next step per status. */
const QUICK_ACTION: Partial<Record<OrderStatus, { to: OrderStatus; label: string; style: string }>> = {
  NEW:       { to: "PREPARING", label: "orders.startPreparing", style: "bg-blue-600 hover:bg-blue-700 text-white shadow-sm" },
  PREPARING: { to: "READY",     label: "orders.markReady",      style: "bg-amber-500 hover:bg-amber-600 text-white shadow-sm" },
  READY:     { to: "SERVED",    label: "orders.markServed",     style: "bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm" },
  SERVED:    { to: "PAID",      label: "orders.markPaid",       style: "bg-teal-600 hover:bg-teal-700 text-white shadow-sm" },
};

/** Secondary actions — rare paths only. */
const SECONDARY_ACTIONS: Partial<Record<OrderStatus, Array<{ to: OrderStatus; label: string }>>> = {
  NEW: [{ to: "REJECTED", label: "orders.reject" }],
  PREPARING: [{ to: "CANCELLED", label: "orders.cancelOrder" }],
  READY: [{ to: "CANCELLED", label: "orders.cancelOrder" }],
};

/* ── Helpers ────────────────────────────────────────────────── */

function timeAgo(iso: string, lang: "en" | "bn"): string {
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (seconds < 60) return lang === "bn" ? "এইমাত্র" : "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return lang === "bn" ? `${minutes} মিনিট আগে` : `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return lang === "bn" ? `${hours} ঘন্টা আগে` : `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return lang === "bn" ? `${days} দিন আগে` : `${days}d ago`;
}

function elapsedMinutes(iso: string): number {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
}

function elapsedColor(mins: number): string {
  if (mins < 10) return "text-emerald-600";
  if (mins < 30) return "text-amber-600";
  return "text-red-500";
}

/* ── Page ───────────────────────────────────────────────────── */

export function OrdersPage() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language === "bn" ? "bn" : "en";
  const { restaurant } = useRestaurant();
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<FilterKey>("ALL");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [menuOpen, setMenuOpen] = useState<string | null>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const close = () => setMenuOpen(null);
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, [menuOpen]);

  /* ── Data ── */

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["orders", restaurant?.slug],
    queryFn: async () => {
      const res = await api.get("/orders/");
      const list = res.data;
      return (Array.isArray(list) ? list : list.results) as Order[];
    },
    enabled: !!restaurant,
    refetchInterval: 10_000,
  });

  useRestaurantSocket(restaurant?.slug ?? null, (event) => {
    const type = String(event.type ?? "");
    if (type === "order" || type === "order.event") {
      void queryClient.invalidateQueries({ queryKey: ["orders", restaurant?.slug] });
      void queryClient.invalidateQueries({ queryKey: ["tables", restaurant?.slug] });
    }
  });

  const transition = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: OrderStatus }) => {
      // Fail fast if browser reports offline — don't let the request hang.
      if (!navigator.onLine) {
        throw new Error("offline");
      }
      // Wrap the request with a timeout so it doesn't hang when the
      // network silently drops (browser queues the request indefinitely).
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);
      try {
        await api.post(`/orders/${id}/transition/`, { status: status.toLowerCase() }, { signal: controller.signal });
      } finally {
        clearTimeout(timeout);
      }
    },
    onMutate: async ({ id, status: newStatus }) => {
      // Optimistic update: immediately update the order status in cache.
      const key = ["orders", restaurant?.slug];
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<Order[]>(key);
      queryClient.setQueryData<Order[]>(key, (old) =>
        (old ?? []).map((o) => (o.id === id ? { ...o, status: newStatus } : o))
      );
      return { previous };
    },
    onError: (_err, _vars, context) => {
      // Roll back on error.
      if (context?.previous) {
        queryClient.setQueryData(["orders", restaurant?.slug], context.previous);
      }
      showToast({ kind: "error", title: t("common.error"), body: "Could not update order status. Please check your connection and try again." });
    },
    onSettled: () => {
      // Refetch to ensure consistency after the round-trip.
      void queryClient.invalidateQueries({ queryKey: ["orders", restaurant?.slug] });
    },
  });

  /* ── Derived ── */

  const orders = useMemo(() => {
    return (data ?? []).map((o) => ({ ...o, _status: o.status.toUpperCase() as OrderStatus }));
  }, [data]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { ALL: orders.length };
    for (const o of orders) c[o._status] = (c[o._status] ?? 0) + 1;
    return c;
  }, [orders]);

  const kpis = useMemo(() => {
    const today = new Date().toDateString();
    const todays = orders.filter((o) => new Date(o.created_at).toDateString() === today);
    const paid = todays.filter((o) => o._status === "PAID");
    const active = orders.filter((o) => !["PAID", "REJECTED", "CANCELLED"].includes(o._status));
    const revenue = paid.reduce((sum, o) => sum + (parseFloat(String(o.total)) || 0), 0);
    return {
      todayCount: todays.length,
      revenue,
      avgOrder: paid.length > 0 ? revenue / paid.length : 0,
      activeCount: active.length,
    };
  }, [orders]);

  const filtered = useMemo(() => {
    return filter === "ALL" ? orders : orders.filter((o) => o._status === filter);
  }, [orders, filter]);

  function toggleExpand(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function printReceipt(order: Order) {
    const items = order.items
      .map(
        (item) =>
          `<tr><td>${item.quantity}× ${item.dish_name_en || item.dish_name_bn}${item.selected_modifiers?.length ? ` (${item.selected_modifiers.map((m) => m.name_en).join(", ")})` : ""}</td><td style="text-align:right">${formatBDT(item.unit_price, lang)}</td></tr>`
      )
      .join("");
    const tableLabel = order.table_label ? `${t("orders.table")} ${order.table_label}` : "";
    const html = `<!doctype html><html><head><title>${t("receipt.title")}</title>
      <style>body{font-family:monospace;max-width:320px;margin:40px auto;padding:0 10px}
      table{width:100%;border-collapse:collapse}td{padding:4px 0;font-size:13px}
      hr{border:none;border-top:1px dashed #ccc;margin:12px 0}.total{font-weight:bold;font-size:15px}
      h2{text-align:center;margin:0 0 4px}p{text-align:center;font-size:12px;color:#666}</style></head>
      <body><h2>${restaurant?.name ?? ""}</h2>${tableLabel ? `<p>${tableLabel}</p>` : ""}<hr>
      <p>${t("receipt.orderNumber")} #${order.order_number} · ${new Date(order.created_at).toLocaleString(lang === "bn" ? "bn-BD" : "en-GB")}</p><hr>
      <table>${items}</table><hr>
      <table><tr><td class="total">${t("receipt.total")}</td><td class="total" style="text-align:right">${formatBDT(order.total, lang)}</td></tr></table><hr>
      <p>${t("receipt.thankYou")}</p></body></html>`;
    const win = window.open("", "_blank", "width=380,height=600");
    if (!win) return;
    win.document.write(html);
    win.document.close();
    win.onload = () => win.print();
  }

  /* ── Guards ── */

  if (!restaurant) return <EmptyState />;
  if (isLoading) return <LoadingState />;
  if (isError) return <ErrorState onRetry={() => void refetch()} />;

  /* ── Render ── */

  return (
    <section aria-labelledby="orders-heading" className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <h2 id="orders-heading" className="text-lg font-semibold text-ink-900">
          {t("orders.title")}
        </h2>
        <span className="text-sm text-ink-500">
          {orders.length} {t("orders.total")}
        </span>
      </div>

      {/* ── KPI cards ── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-xl border border-ink-100 bg-white p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-ink-400">{t("orders.todayOrders")}</span>
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50">
              <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-4 w-4 text-blue-600">
                <rect x="3" y="2" width="14" height="16" rx="2" /><path d="M7 6h6M7 10h6M7 14h4" />
              </svg>
            </span>
          </div>
          <p className="mt-2 font-display text-2xl font-bold tabular-nums text-ink-900">{kpis.todayCount}</p>
          <p className="mt-0.5 text-[0.65rem] text-ink-400">{t("orders.todayOrders")}</p>
        </div>

        <div className="rounded-xl border border-ink-100 bg-white p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-ink-400">{t("orders.revenue")}</span>
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50">
              <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-4 w-4 text-emerald-600">
                <path d="M10 2v16M6 6l4-4 4 4M14 14l-4 4-4-4" />
              </svg>
            </span>
          </div>
          <p className="mt-2 font-display text-2xl font-bold tabular-nums text-ink-900">{formatBDT(kpis.revenue, lang)}</p>
          <p className="mt-0.5 text-[0.65rem] text-ink-400">{t("orders.revenue")}</p>
        </div>

        <div className="rounded-xl border border-ink-100 bg-white p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-ink-400">{t("orders.avgOrder")}</span>
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-50">
              <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-4 w-4 text-violet-600">
                <circle cx="10" cy="10" r="8" /><path d="M10 6v4l3 2" />
              </svg>
            </span>
          </div>
          <p className="mt-2 font-display text-2xl font-bold tabular-nums text-ink-900">{formatBDT(kpis.avgOrder, lang)}</p>
          <p className="mt-0.5 text-[0.65rem] text-ink-400">{t("orders.avgOrder")}</p>
        </div>

        <div className={`rounded-xl border p-4 ${kpis.activeCount > 0 ? "border-amber-200 bg-amber-50/50" : "border-ink-100 bg-white"}`}>
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-ink-400">{t("orders.activeOrders")}</span>
            <span className={`flex h-8 w-8 items-center justify-center rounded-lg ${kpis.activeCount > 0 ? "bg-amber-100" : "bg-ink-50"}`}>
              <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" className={`h-4 w-4 ${kpis.activeCount > 0 ? "text-amber-600" : "text-ink-400"}`}>
                <path d="M10 2c0 4-4 6-4 10a4 4 0 0 0 8 0c0-4-4-6-4-10z" /><path d="M10 18v2M8 22h4" />
              </svg>
            </span>
          </div>
          <p className={`mt-2 font-display text-2xl font-bold tabular-nums ${kpis.activeCount > 0 ? "text-amber-700" : "text-ink-900"}`}>{kpis.activeCount}</p>
          <p className="mt-0.5 text-[0.65rem] text-ink-400">{t("orders.activeOrders")}</p>
        </div>
      </div>

      {/* ── Filter tabs ── */}
      <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
        {FILTER_ORDER.map((key) => {
          const count = counts[key] ?? 0;
          const active = filter === key;
          const cfg = key !== "ALL" ? STATUS_CFG[key] : null;
          return (
            <button
              key={key}
              type="button"
              onClick={() => setFilter(key)}
              className={`flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
                active ? "bg-brand-600 text-white shadow-sm" : "bg-ink-50 text-ink-600 hover:bg-ink-100"
              }`}
            >
              {cfg && <span className={`h-1.5 w-1.5 rounded-full ${cfg.dot}`} aria-hidden="true" />}
              {key === "ALL" ? t("orders.total") : t(STATUS_I18N[key])}
              <span className={`ml-0.5 rounded-full px-1.5 py-0.5 text-[0.6rem] font-bold ${
                active ? "bg-white/20 text-white" : "bg-ink-100 text-ink-500"
              }`}>{count}</span>
            </button>
          );
        })}
      </div>

      {/* ── Orders table ── */}
      {filtered.length === 0 ? (
        <EmptyState title={t("orders.noOrders")} />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-ink-100 bg-white">
          <table className="w-full min-w-[800px] text-sm">
            <thead>
              <tr className="border-b border-ink-100 bg-ink-50/70 text-left text-[0.65rem] font-semibold uppercase tracking-wider text-ink-400">
                <th className="w-10 px-4 py-2.5" />
                <th className="px-3 py-2.5">{t("orders.title")}</th>
                <th className="px-3 py-2.5">{t("cart.orderType")}</th>
                <th className="px-3 py-2.5">{t("orders.table")}</th>
                <th className="px-3 py-2.5 text-right">{t("cart.subtotal")}</th>
                <th className="px-3 py-2.5 text-center">{t("orders.status")}</th>
                <th className="px-4 py-2.5 text-right">{t("common.actions")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-50">
              {filtered.map((order) => {
                const cfg = STATUS_CFG[order._status] ?? STATUS_CFG.NEW;
                const isExpanded = expanded.has(order.id);
                const quick = QUICK_ACTION[order._status];
                const secondaries = SECONDARY_ACTIONS[order._status] ?? [];
                const isActive = !["PAID", "REJECTED", "CANCELLED"].includes(order._status);
                const mins = elapsedMinutes(order.created_at);

                return (
                  <>
                    <tr
                      key={order.id}
                      className={`transition-colors hover:bg-ink-25 ${!isActive ? "opacity-50" : ""} ${order._status === "NEW" ? "bg-blue-50/40" : ""}`}
                    >
                      {/* Expand */}
                      <td className="px-4 py-3">
                        <button
                          type="button"
                          onClick={() => toggleExpand(order.id)}
                          className="flex h-6 w-6 items-center justify-center rounded text-ink-400 hover:text-ink-700"
                          aria-label="Toggle details"
                        >
                          <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" className={`h-3.5 w-3.5 transition-transform ${isExpanded ? "rotate-90" : ""}`}>
                            <path d="M7 5l5 5-5 5" />
                          </svg>
                        </button>
                      </td>

                      {/* Order # + time + first dish */}
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-ink-900">#{order.order_number}</span>
                          <span className={`text-[0.65rem] font-semibold tabular-nums ${elapsedColor(mins)}`}>
                            {timeAgo(order.created_at, lang)}
                          </span>
                        </div>
                        {order.items.length > 0 && (
                          <p className="mt-0.5 truncate text-[0.6rem] text-ink-500">
                            {lang === "bn" ? order.items[0].dish_name_bn || order.items[0].dish_name_en : order.items[0].dish_name_en || order.items[0].dish_name_bn}
                            {order.items.length > 1 && (
                              <span className="text-ink-400"> +{order.items.length - 1}</span>
                            )}
                          </p>
                        )}
                      </td>

                      {/* Type */}
                      <td className="px-3 py-3">
                        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[0.6rem] font-semibold ${
                          order.order_type === "take_away" ? "bg-purple-50 text-purple-700" : "bg-blue-50 text-blue-600"
                        }`}>
                          {order.order_type === "take_away" ? t("cart.takeAway") : t("cart.dineIn")}
                        </span>
                      </td>

                      {/* Table */}
                      <td className="px-3 py-3 text-sm text-ink-600">
                        {order.table_label ? `${t("orders.table")} ${order.table_label}` : "—"}
                      </td>

                      {/* Total */}
                      <td className="px-3 py-3 text-right text-sm font-bold tabular-nums text-ink-900">
                        {formatBDT(order.total, lang)}
                      </td>

                      {/* Status */}
                      <td className="px-3 py-3 text-center">
                        <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[0.65rem] font-semibold ${cfg.bg} ${cfg.text}`}>
                          <span className={`h-1.5 w-1.5 rounded-full ${cfg.dot}`} />
                          {t(STATUS_I18N[order._status])}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3">
                        <div className="relative flex items-center justify-end gap-1.5">
                          {quick && (
                            <button
                              type="button"
                              disabled={transition.isPending}
                              onClick={() => transition.mutate({ id: order.id, status: quick.to })}
                              className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-all active:scale-95 ${quick.style}`}
                            >
                              {t(quick.label)}
                            </button>
                          )}
                          {order._status === "PAID" && (
                            <button
                              type="button"
                              onClick={() => printReceipt(order)}
                              className="rounded-lg px-2.5 py-1.5 text-xs font-semibold text-ink-600 hover:bg-ink-100"
                            >
                              {t("customer.printReceipt")}
                            </button>
                          )}
                          {secondaries.length > 0 && (
                            <div className="relative">
                              <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); setMenuOpen(menuOpen === order.id ? null : order.id); }}
                                className="flex h-7 w-7 items-center justify-center rounded-lg text-ink-400 hover:bg-ink-100 hover:text-ink-700"
                                aria-label="More actions"
                              >
                                <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                                  <circle cx="10" cy="4" r="1.5" /><circle cx="10" cy="10" r="1.5" /><circle cx="10" cy="16" r="1.5" />
                                </svg>
                              </button>
                              {menuOpen === order.id && (
                                <div
                                  className="absolute right-0 top-9 z-30 w-40 overflow-hidden rounded-xl border border-ink-100 bg-white py-1 shadow-lift"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  {secondaries.map((sec) => (
                                    <button
                                      key={sec.to}
                                      type="button"
                                      disabled={transition.isPending}
                                      onClick={() => { transition.mutate({ id: order.id, status: sec.to }); setMenuOpen(null); }}
                                      className="flex w-full items-center px-3 py-2 text-xs font-medium text-red-600 hover:bg-red-50"
                                    >
                                      {t(sec.label)}
                                    </button>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>

                    {/* Expanded detail row */}
                    {isExpanded && (
                      <tr key={`${order.id}-detail`}>
                        <td colSpan={7} className="bg-ink-50/60 px-6 py-4">
                          <div className="grid gap-4 sm:grid-cols-2">
                            {/* Items list */}
                            <div>
                              <h4 className="mb-2 text-[0.65rem] font-semibold uppercase tracking-wider text-ink-400">
                                {t("orders.items")}
                              </h4>
                              <ul className="space-y-2">
                                {order.items.map((item) => (
                                  <li key={item.id} className="flex items-center gap-3">
                                    <div className="h-10 w-10 shrink-0 overflow-hidden rounded-lg">
                                      <ImageWithFallback src={item.dish_image || undefined} alt="" className="h-full w-full object-cover" placeholder="dish" />
                                    </div>
                                    <div className="min-w-0 flex-1">
                                      <p className="truncate text-sm font-medium text-ink-900">
                                        {lang === "bn" ? item.dish_name_bn || item.dish_name_en : item.dish_name_en || item.dish_name_bn}
                                      </p>
                                      {item.selected_modifiers?.length > 0 && (
                                        <p className="text-[0.65rem] text-ink-400">
                                          {item.selected_modifiers.map((m) => lang === "bn" ? m.name_bn || m.name_en : m.name_en).join(", ")}
                                        </p>
                                      )}
                                      <p className="text-xs text-ink-400">
                                        {item.quantity}× {formatBDT(item.unit_price, lang)}
                                        {item.variant_name && ` · ${item.variant_name}`}
                                      </p>
                                      {item.special_instructions && (
                                        <p className="mt-0.5 truncate text-xs italic text-ink-400">📝 {item.special_instructions}</p>
                                      )}
                                    </div>
                                    <span className="shrink-0 text-sm font-bold tabular-nums text-ink-900">
                                      {formatBDT(parseFloat(String(item.unit_price)) * item.quantity, lang)}
                                    </span>
                                  </li>
                                ))}
                              </ul>
                            </div>

                            {/* Order meta */}
                            <div className="space-y-3">
                              <div>
                                <h4 className="mb-1 text-[0.65rem] font-semibold uppercase tracking-wider text-ink-400">{t("orders.details")}</h4>
                                <dl className="space-y-1.5 text-sm">
                                  <div className="flex justify-between">
                                    <dt className="text-ink-500">{t("receipt.orderNumber")}</dt>
                                    <dd className="font-semibold text-ink-900">#{order.order_number}</dd>
                                  </div>
                                  <div className="flex justify-between">
                                    <dt className="text-ink-500">{t("orders.table")}</dt>
                                    <dd className="text-ink-900">{order.table_label || "—"}</dd>
                                  </div>
                                  <div className="flex justify-between">
                                    <dt className="text-ink-500">{t("cart.orderType")}</dt>
                                    <dd className="text-ink-900">
                                      {order.order_type === "take_away" ? t("cart.takeAway") : t("cart.dineIn")}
                                    </dd>
                                  </div>
                                  <div className="flex justify-between">
                                    <dt className="text-ink-500">{t("orders.createdAt")}</dt>
                                    <dd className="text-ink-900">
                                      {new Date(order.created_at).toLocaleString(lang === "bn" ? "bn-BD" : "en-GB")}
                                    </dd>
                                  </div>
                                  {order.customer_note && (
                                    <div className="flex justify-between">
                                      <dt className="text-ink-500">{t("orders.note")}</dt>
                                      <dd className="max-w-[200px] truncate italic text-ink-600">{order.customer_note}</dd>
                                    </div>
                                  )}
                                </dl>
                              </div>

                              {/* Total */}
                              <div className="rounded-lg border border-ink-100 bg-white px-4 py-3">
                                <div className="flex items-center justify-between">
                                  <span className="text-sm font-medium text-ink-500">{t("receipt.total")}</span>
                                  <span className="font-display text-xl font-bold tabular-nums text-ink-900">
                                    {formatBDT(order.total, lang)}
                                  </span>
                                </div>
                              </div>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
