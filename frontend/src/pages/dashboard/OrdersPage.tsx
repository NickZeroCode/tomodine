import { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { api } from "@/lib/api";
import { formatBDT } from "@/lib/format";
import { useRestaurant } from "@/context/RestaurantContext";
import { useRestaurantSocket } from "@/hooks/useRestaurantSocket";
import { Icon } from "@/components/Icon";
import { LoadingState, ErrorState, EmptyState } from "@/components/States";
import type { Order, OrderStatus } from "@/types";

/* ── Status config ──────────────────────────────────────────── */

type FilterKey = "ALL" | OrderStatus;

const STATUS_CFG: Record<OrderStatus, { bg: string; text: string; dot: string }> = {
  NEW:       { bg: "bg-blue-50",   text: "text-blue-700",   dot: "bg-blue-500" },
  ACCEPTED:  { bg: "bg-indigo-50", text: "text-indigo-700", dot: "bg-indigo-500" },
  PREPARING: { bg: "bg-amber-50",  text: "text-amber-700",  dot: "bg-amber-500" },
  READY:     { bg: "bg-emerald-50",text: "text-emerald-700",dot: "bg-emerald-500" },
  SERVED:    { bg: "bg-teal-50",   text: "text-teal-700",   dot: "bg-teal-500" },
  PAID:      { bg: "bg-ink-50",    text: "text-ink-500",    dot: "bg-ink-400" },
  REJECTED:  { bg: "bg-red-50",    text: "text-red-600",    dot: "bg-red-500" },
  CANCELLED: { bg: "bg-ink-50",    text: "text-ink-400",    dot: "bg-ink-300" },
};

const FILTER_ORDER: FilterKey[] = ["ALL", "NEW", "PREPARING", "READY", "SERVED", "PAID"];

const STATUS_I18N: Record<OrderStatus, string> = {
  NEW: "orders.new", ACCEPTED: "orders.accepted", PREPARING: "orders.preparing",
  READY: "orders.ready", SERVED: "orders.served", PAID: "orders.paid",
  REJECTED: "orders.rejected", CANCELLED: "orders.cancelled",
};

/** Quick-action: the single most likely next step per status. */
const QUICK_ACTION: Partial<Record<OrderStatus, { to: OrderStatus; label: string; style: string }>> = {
  NEW:       { to: "ACCEPTED",  label: "orders.accept",       style: "bg-blue-600 hover:bg-blue-700 text-white" },
  PREPARING: { to: "READY",     label: "orders.markReady",    style: "bg-amber-600 hover:bg-amber-700 text-white" },
  READY:     { to: "SERVED",    label: "orders.markServed",   style: "bg-emerald-600 hover:bg-emerald-700 text-white" },
  SERVED:    { to: "PAID",      label: "orders.markPaid",     style: "bg-teal-600 hover:bg-teal-700 text-white" },
};

/** Secondary actions — shown in kebab dropdown. */
const SECONDARY_ACTIONS: Partial<Record<OrderStatus, Array<{ to: OrderStatus; label: string }>>> = {
  NEW: [
    { to: "PREPARING", label: "orders.startPreparing" },
    { to: "REJECTED", label: "orders.reject" },
  ],
  ACCEPTED: [{ to: "PREPARING", label: "orders.startPreparing" }],
  PREPARING: [{ to: "CANCELLED", label: "orders.cancelOrder" }],
};

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

export function OrdersPage() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language === "bn" ? "bn" : "en";
  const { restaurant } = useRestaurant();
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<FilterKey>("ALL");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [menuOpen, setMenuOpen] = useState<string | null>(null);

  // Close kebab menu on any outside click.
  useEffect(() => {
    if (!menuOpen) return;
    const close = () => setMenuOpen(null);
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, [menuOpen]);

  function printReceipt(order: Order) {
    const items = order.items.map((item) =>
      `<tr><td>${item.quantity}× ${item.dish_name_en || item.dish_name_bn}</td><td style="text-align:right">${formatBDT(item.unit_price, lang)}</td></tr>`
    ).join("");
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

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["orders", restaurant?.slug],
    queryFn: async () => {
      const res = await api.get("/orders/");
      const list = res.data;
      const orders = (Array.isArray(list) ? list : list.results) as Order[];
      return orders.map((o) => ({ ...o, status: o.status.toUpperCase() as OrderStatus }));
    },
    enabled: !!restaurant,
    refetchInterval: 10_000,
  });

  useRestaurantSocket(restaurant?.slug ?? null, (event) => {
    if (event.type === "order" || event.type === "table") {
      void queryClient.invalidateQueries({ queryKey: ["orders", restaurant?.slug] });
      void queryClient.invalidateQueries({ queryKey: ["tables", restaurant?.slug] });
    }
  });

  const transition = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: OrderStatus }) =>
      api.post(`/orders/${id}/transition/`, { status: status.toLowerCase() }),
    onSuccess: () =>
      void queryClient.invalidateQueries({ queryKey: ["orders", restaurant?.slug] }),
  });

  if (!restaurant) return <EmptyState />;
  if (isLoading) return <LoadingState />;
  if (isError) return <ErrorState onRetry={() => void refetch()} />;

  const orders = data ?? [];

  // Counts per status for the filter tabs.
  const counts: Record<string, number> = { ALL: orders.length };
  for (const o of orders) counts[o.status] = (counts[o.status] ?? 0) + 1;

  const filtered = filter === "ALL" ? orders : orders.filter((o) => o.status === filter);

  function toggleExpand(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  return (
    <section aria-labelledby="orders-heading" className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <h2 id="orders-heading" className="text-lg font-semibold text-ink-900">
          {t("orders.title")}
        </h2>
        <span className="text-sm text-ink-500">{orders.length} {t("orders.total")}</span>
      </div>

      {/* Status filter tabs */}
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
                active
                  ? "bg-brand-600 text-white shadow-sm"
                  : "bg-ink-50 text-ink-600 hover:bg-ink-100"
              }`}
            >
              {cfg && <span className={`h-1.5 w-1.5 rounded-full ${cfg.dot}`} aria-hidden="true" />}
              {key === "ALL" ? t("orders.total") : t(STATUS_I18N[key])}
              <span className={`ml-0.5 rounded-full px-1.5 py-0.5 text-[0.6rem] font-bold ${
                active ? "bg-white/20 text-white" : "bg-ink-100 text-ink-500"
              }`}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Orders table */}
      {filtered.length === 0 ? (
        <EmptyState title={t("orders.noOrders")} />
      ) : (
        <div className="overflow-hidden rounded-xl border border-ink-100 bg-white">
          {/* Table header */}
          <div className="grid grid-cols-[2.5rem_1.2fr_0.6fr_0.8fr_0.7fr_0.9fr_5.5rem] gap-2 border-b border-ink-100 bg-ink-50/60 px-4 py-2.5 text-[0.65rem] font-semibold uppercase tracking-wider text-ink-400">
            <span />
            <span>{t("orders.title")}</span>
            <span>{t("cart.orderType")}</span>
            <span>{t("orders.table")}</span>
            <span className="text-right">{t("cart.subtotal")}</span>
            <span className="text-center">{t("orders.title")}</span>
            <span className="text-center">{t("common.actions")}</span>
          </div>

          {/* Rows */}
          <ul className="divide-y divide-ink-100/80">
            {filtered.map((order) => {
              const cfg = STATUS_CFG[order.status] ?? STATUS_CFG.NEW;
              const isExpanded = expanded.has(order.id);
              const quick = QUICK_ACTION[order.status];
              const secondaries = SECONDARY_ACTIONS[order.status] ?? [];
              const isActive = !["PAID", "REJECTED", "CANCELLED"].includes(order.status);

              return (
                <li key={order.id} className={isActive ? "" : "opacity-55"}>
                  {/* Main row */}
                  <div
                    className={`grid grid-cols-[2.5rem_1.2fr_0.6fr_0.8fr_0.7fr_0.9fr_5.5rem] items-center gap-2 px-4 py-3 transition-colors hover:bg-ink-50 ${
                      order.status === "NEW" ? "bg-blue-50" : ""
                    }`}
                  >
                    {/* Expand toggle */}
                    <button
                      type="button"
                      onClick={() => toggleExpand(order.id)}
                      className="flex h-6 w-6 items-center justify-center rounded text-ink-400 hover:text-ink-700"
                      aria-label="Toggle details"
                    >
                      <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" className={`h-3.5 w-3.5 transition-transform ${isExpanded ? "rotate-90" : ""}`}><path d="M7 5l5 5-5 5" /></svg>
                    </button>

                    {/* Order # + time + dishes */}
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-ink-900">#{order.order_number}</span>
                        <span className={`text-[0.65rem] font-semibold tabular-nums ${
                          (() => {
                            const mins = Math.floor((Date.now() - new Date(order.created_at).getTime()) / 60000);
                            if (mins < 10) return "text-emerald-600";
                            if (mins < 30) return "text-amber-600";
                            return "text-red-500";
                          })()
                        }`}>
                          {timeAgo(order.created_at, lang)}
                        </span>
                      </div>
                      {order.items.length > 0 && (
                        <p className="mt-0.5 truncate text-[0.6rem] text-ink-500">
                          {lang === "bn" ? order.items[0].dish_name_bn || order.items[0].dish_name_en : order.items[0].dish_name_en || order.items[0].dish_name_bn}
                          {order.items.length > 1 && (
                            <span className="text-ink-400"> {t("customer.otherDishes", { count: order.items.length - 1 })}</span>
                          )}
                        </p>
                      )}
                    </div>

                    {/* Order type */}
                    <span className={`inline-flex w-fit items-center gap-1 rounded-full px-2 py-0.5 text-[0.6rem] font-semibold ${
                      order.order_type === "take_away"
                        ? "bg-purple-50 text-purple-700"
                        : "bg-blue-50 text-blue-600"
                    }`}>
                      <Icon
                        name={order.order_type === "take_away" ? "takeAway" : "dineIn"}
                        className="h-3 w-3"
                      />
                      {order.order_type === "take_away" ? t("cart.takeAway") : t("cart.dineIn")}
                    </span>

                    {/* Table */}
                    <span className="truncate text-sm text-ink-600">
                      {order.table_label ? `${t("orders.table")} ${order.table_label}` : "—"}
                    </span>

                    {/* Total */}
                    <span className="text-right text-sm font-bold tabular-nums text-ink-900">
                      {formatBDT(order.total, lang)}
                    </span>

                    {/* Status badge */}
                    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[0.65rem] font-semibold ${cfg.bg} ${cfg.text}`}>
                      <span className={`h-1.5 w-1.5 rounded-full ${cfg.dot}`} />
                      {t(STATUS_I18N[order.status])}
                    </span>

                    {/* Actions */}
                    <div className="relative flex w-24 items-center justify-end gap-1">
                      {quick && (
                        <button
                          type="button"
                          disabled={transition.isPending}
                          onClick={() => transition.mutate({ id: order.id, status: quick.to })}
                          className={`rounded-lg px-2 py-1 text-[0.65rem] font-semibold transition-colors ${quick.style}`}
                        >
                          {t(quick.label)}
                        </button>
                      )}
                      {order.status === "PAID" && (
                        <button
                          type="button"
                          onClick={() => printReceipt(order)}
                          className="rounded-lg px-2 py-1 text-[0.65rem] font-semibold text-ink-600 hover:bg-ink-100"
                        >
                          {t("customer.printReceipt")}
                        </button>
                      )}
                      {secondaries.length > 0 && (
                        <>
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); setMenuOpen(menuOpen === order.id ? null : order.id); }}
                            className="flex h-6 w-6 items-center justify-center rounded text-ink-400 hover:bg-ink-100 hover:text-ink-700"
                            aria-label="More actions"
                          >
                            <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4"><circle cx="10" cy="4" r="1.5"/><circle cx="10" cy="10" r="1.5"/><circle cx="10" cy="16" r="1.5"/></svg>
                          </button>
                          {menuOpen === order.id && (
                            <div
                              className="absolute right-0 top-7 z-30 w-36 overflow-hidden rounded-xl border border-ink-100 bg-white py-1 shadow-lift"
                              onClick={(e) => e.stopPropagation()}
                            >
                              {secondaries.map((sec) => (
                                <button
                                  key={sec.to}
                                  type="button"
                                  disabled={transition.isPending}
                                  onClick={() => { transition.mutate({ id: order.id, status: sec.to }); setMenuOpen(null); }}
                                  className="flex w-full items-center px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50"
                                >
                                  {t(sec.label)}
                                </button>
                              ))}
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  </div>

                  {/* Expanded detail */}
                  {isExpanded && (
                    <div className="border-t border-ink-50 bg-ink-50 px-12 py-3">
                      <ul className="space-y-1.5">
                        {order.items.map((item) => (
                          <li key={item.id} className="flex items-center gap-2 text-xs">
                            {item.dish_image ? (
                              <img src={item.dish_image} alt="" className="h-7 w-7 shrink-0 rounded-lg object-cover" />
                            ) : (
                              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-ink-100 text-ink-300 text-[0.6rem]">🍽</span>
                            )}
                            <span className="min-w-0 flex-1 text-ink-700">
                              <span className="font-semibold tabular-nums">{item.quantity}×</span>{" "}
                              {lang === "bn" ? item.dish_name_bn || item.dish_name_en : item.dish_name_en || item.dish_name_bn}
                            </span>
                            {item.special_instructions && (
                              <span className="ml-2 truncate text-ink-400 italic">— {item.special_instructions}</span>
                            )}
                          </li>
                        ))}
                      </ul>
                      {order.customer_note && (
                        <p className="mt-2 text-xs text-ink-500 italic">📝 {order.customer_note}</p>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </section>
  );
}
