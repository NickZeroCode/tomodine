import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { api } from "@/lib/api";
import { formatBDT } from "@/lib/format";
import { useRestaurant } from "@/context/RestaurantContext";
import { useRestaurantSocket } from "@/hooks/useRestaurantSocket";
import { LoadingState, ErrorState, EmptyState } from "@/components/States";
import { SophiaInsights } from "@/components/SophiaInsights";
import { DemandForecast } from "@/components/DemandForecast";
import type {
  AnalyticsOverview,
  EnhancedOverview,
  OrdersOverTimePoint,
  PopularDish,
  PeakHour,
} from "@/types";

function shortDate(iso: string, lang: "en" | "bn"): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(lang === "bn" ? "bn-BD" : "en-GB", {
    day: "numeric",
    month: "short",
  });
}

/** Eased count-up that respects reduced-motion. */
function useCountUp(target: number, duration = 900): number {
  const [value, setValue] = useState(0);
  const fromRef = useRef(0);
  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced || !Number.isFinite(target)) {
      setValue(target);
      fromRef.current = target;
      return;
    }
    const from = fromRef.current;
    const start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setValue(from + (target - from) * eased);
      if (t < 1) raf = requestAnimationFrame(tick);
      else fromRef.current = target;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);
  return value;
}

function AnimatedNumber({
  value,
  format,
}: {
  value: number;
  format?: (n: number) => string;
}) {
  const animated = useCountUp(value);
  const text = format ? format(animated) : String(Math.round(animated));
  return <span className="tabular-nums">{text}</span>;
}

/** Pure-SVG donut for order-status composition. */
function StatusDonut({
  slices,
}: {
  slices: Array<{ label: string; count: number; color: string }>;
}) {
  const total = Math.max(1, slices.reduce((s, x) => s + x.count, 0));
  const R = 52;
  const C = 2 * Math.PI * R;
  let offset = 0;
  return (
    <div className="flex flex-wrap items-center gap-5">
      <svg viewBox="0 0 140 140" className="h-32 w-32" role="img" aria-hidden="true">
        <g transform="rotate(-90 70 70)">
          <circle cx="70" cy="70" r={R} fill="none" strokeWidth="16" className="stroke-ink-100" />
          {slices.map((s) => {
            const frac = s.count / total;
            const dash = frac * C;
            const el = (
              <circle
                key={s.label}
                cx="70"
                cy="70"
                r={R}
                fill="none"
                stroke={s.color}
                strokeWidth="16"
                strokeDasharray={`${dash} ${C - dash}`}
                strokeDashoffset={-offset}
                className="transition-all duration-700"
              />
            );
            offset += dash;
            return el;
          })}
        </g>
        <text
          x="70"
          y="70"
          textAnchor="middle"
          dominantBaseline="central"
          className="fill-ink-900 text-xl font-bold"
        >
          {total}
        </text>
      </svg>
      <ul className="min-w-40 flex-1 space-y-1.5">
        {slices.map((s) => (
          <li key={s.label} className="flex items-center gap-2 text-sm">
            <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: s.color }} />
            <span className="truncate text-ink-600">{s.label}</span>
            <span className="ml-auto pl-4 font-semibold tabular-nums text-ink-900">{s.count}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

const STATUS_COLORS: Record<string, string> = {
  NEW: "#3b82f6",
  ACCEPTED: "#8b5cf6",
  PREPARING: "#f59e0b",
  READY: "#10b981",
  SERVED: "#059669",
  PAID: "#0d9488",
  REJECTED: "#ef4444",
  CANCELLED: "#94a3b8",
};

const DONUT_ORDER = ["NEW", "ACCEPTED", "PREPARING", "READY", "SERVED"];

export function OverviewPage() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language === "bn" ? "bn" : "en";
  const { restaurant } = useRestaurant();
  const slug = restaurant?.slug;
  const queryClient = useQueryClient();

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["analytics", "overview", slug],
    queryFn: async () => (await api.get<AnalyticsOverview>("/analytics/overview/")).data,
    enabled: !!restaurant,
  });

  const enhancedQuery = useQuery({
    queryKey: ["analytics", "enhanced-overview", slug],
    queryFn: async () => (await api.get<EnhancedOverview>("/analytics/enhanced_overview/")).data,
    enabled: !!restaurant,
  });

  const trendQuery = useQuery({
    queryKey: ["analytics", "orders-over-time", slug],
    queryFn: async () =>
      (await api.get<OrdersOverTimePoint[]>("/analytics/orders_over_time/?days=14")).data,
    enabled: !!restaurant,
  });

  const dishesQuery = useQuery({
    queryKey: ["analytics", "popular-dishes", slug],
    queryFn: async () =>
      (await api.get<PopularDish[]>("/analytics/popular_dishes/")).data,
    enabled: !!restaurant,
  });

  const hoursQuery = useQuery({
    queryKey: ["analytics", "peak-hours", slug],
    queryFn: async () =>
      (await api.get<PeakHour[]>("/analytics/peak_hours/?days=30")).data,
    enabled: !!restaurant,
  });

  // Live updates — new orders refresh the overview in real time.
  useRestaurantSocket(slug ?? null, (event) => {
    if (event.type === "order" || event.type === "table") {
      void queryClient.invalidateQueries({ queryKey: ["analytics"] });
    }
  });

  if (!restaurant) return <EmptyState />;
  if (isLoading) return <LoadingState />;
  if (isError || !data) return <ErrorState onRetry={() => void refetch()} />;

  const tablesByStatus = data.tables_by_status as Record<string, number>;
  const activeTables = Object.entries(tablesByStatus)
    .filter(([status]) => !["available", "offline"].includes(status))
    .reduce((sum, [, count]) => sum + count, 0);

  const ordersTotal = data.orders_total;
  const revenuePaid = parseFloat(data.revenue_paid) || 0;
  const avgOrder = ordersTotal > 0 ? revenuePaid / ordersTotal : 0;

  // Normalize status keys — API returns lowercase, UI uses uppercase.
  const ordersByStatus: Record<string, number> = {};
  for (const [k, v] of Object.entries(data.orders_by_status)) {
    ordersByStatus[k.toUpperCase()] = v as number;
  }

  // Orders that need a human right now.
  const newCount = ordersByStatus.NEW ?? 0;
  const acceptedCount = ordersByStatus.ACCEPTED ?? 0;
  const needsAttention = newCount + acceptedCount;

  // Day-over-day trend from the 14-day series.
  const trend = trendQuery.data ?? [];
  const todayOrders = trend.length > 0 ? trend[trend.length - 1].orders : ordersTotal;
  const yesterdayOrders = trend.length > 1 ? trend[trend.length - 2].orders : 0;
  const deltaPct =
    yesterdayOrders > 0 ? ((todayOrders - yesterdayOrders) / yesterdayOrders) * 100 : null;

  const maxOrders = Math.max(1, ...trend.map((p) => p.orders));
  const dishes = dishesQuery.data ?? [];
  const hours = hoursQuery.data ?? [];
  const maxHourOrders = Math.max(1, ...hours.map((h) => h.orders));

  const donutSlices = DONUT_ORDER.map((status) => ({
    label: t(`orders.${status.toLowerCase()}`, status),
    count: ordersByStatus[status] ?? 0,
    color: STATUS_COLORS[status],
  })).filter((s) => s.count > 0);

  const stats = [
    {
      label: t("dashboard.todayOrders"),
      render: <AnimatedNumber value={ordersTotal} />,
      gradient: "from-emerald-600 to-emerald-800",
      icon: (
        <svg viewBox="0 0 24 24" fill="none" className="h-8 w-8 text-white/25">
          <rect x="3" y="5" width="18" height="16" rx="2" stroke="currentColor" strokeWidth="1.5" />
          <path d="M3 9h18" stroke="currentColor" strokeWidth="1.5" />
          <path d="M8 13h3M8 16h5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          <circle cx="17" cy="15" r="2" fill="currentColor" />
        </svg>
      ),
      delta: deltaPct,
    },
    {
      label: t("dashboard.revenue"),
      render: <AnimatedNumber value={revenuePaid} format={(n) => formatBDT(n.toFixed(0), lang)} />,
      gradient: "from-teal-600 to-teal-800",
      icon: (
        <svg viewBox="0 0 24 24" fill="none" className="h-8 w-8 text-white/25">
          <path d="M12 2v20M17 5H9.5a3.5 3.5 0 1 0 0 7h5a3.5 3.5 0 1 1 0 7H6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ),
      delta: null,
    },
    {
      label: t("dashboard.activeTables"),
      render: <AnimatedNumber value={activeTables} />,
      gradient: "from-green-600 to-green-800",
      icon: (
        <svg viewBox="0 0 24 24" fill="none" className="h-8 w-8 text-white/25">
          <rect x="2" y="8" width="20" height="3" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
          <path d="M5 11v7M19 11v7M9 11v7M15 11v7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          <circle cx="7" cy="6" r="1.5" fill="currentColor" />
          <circle cx="17" cy="6" r="1.5" fill="currentColor" />
        </svg>
      ),
      delta: null,
    },
  ];

  return (
    <section aria-labelledby="overview-heading" className="space-y-4">
      <h2 id="overview-heading" className="sr-only">
        {t("nav.overview")}
      </h2>

      {/* Needs-attention banner — blinking when orders wait on the team */}
      {needsAttention > 0 && (
        <Link
          to="/dashboard/orders"
          className="group flex items-center gap-4 overflow-hidden border border-amber-200 bg-gradient-to-r from-amber-50 to-orange-50 p-4 shadow-sm transition-shadow hover:shadow-lift"
          style={{ borderRadius: "4px" }}
          role="alert"
        >
          <span className="relative flex h-11 w-11 shrink-0 items-center justify-center bg-amber-500 text-white shadow-sm" style={{ borderRadius: "4px" }}>
            <span className="absolute inset-0 animate-ping bg-amber-400 opacity-40" style={{ borderRadius: "4px" }} aria-hidden="true" />
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="relative h-6 w-6" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.4-1.4A2 2 0 0 1 18 14.2V11a6 6 0 1 0-12 0v3.2a2 2 0 0 1-.6 1.4L4 17h5m6 0v1a3 3 0 1 1-6 0v-1m6 0H9" />
            </svg>
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-bold text-amber-900">
              {needsAttention} {t("dashboard.needsAttention")}
            </span>
            <span className="block truncate text-xs text-amber-700">
              {t("dashboard.needsAttentionBody")}
            </span>
          </span>
          <span className="shrink-0 rounded-full bg-amber-500 px-3 py-1.5 text-xs font-semibold text-white transition-transform group-hover:translate-x-0.5">
            {t("dashboard.viewOrders")} →
          </span>
        </Link>
      )}

      {/* Stat cards — full green gradient */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className={`group relative overflow-hidden bg-gradient-to-br ${stat.gradient} p-5 text-white shadow-sm transition-shadow hover:shadow-md`}
            style={{ borderRadius: "4px" }}
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-medium text-white/60">{stat.label}</p>
                <p className="mt-2 text-2xl font-bold text-white">{stat.render}</p>
                {stat.delta !== null && (
                  <p className={`mt-1 inline-flex items-center gap-1 text-xs font-semibold ${stat.delta >= 0 ? "text-white/80" : "text-red-200"}`}>
                    <span aria-hidden="true">{stat.delta >= 0 ? "▲" : "▼"}</span>
                    {Math.abs(stat.delta).toFixed(0)}% {t("dashboard.vsYesterday")}
                  </p>
                )}
              </div>
              <span className="shrink-0">{stat.icon}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Enhanced metrics row */}
      {enhancedQuery.data && (() => {
        const en = enhancedQuery.data;
        const extraStats = [
          {
            label: t("dashboard.customersToday"),
            value: en.customers_today,
            icon: <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4"><circle cx="10" cy="7" r="3" stroke="currentColor" strokeWidth="1.5" /><path d="M4 17v-1a4 4 0 0 1 8 0v1" stroke="currentColor" strokeWidth="1.5" /></svg>,
          },
          {
            label: t("dashboard.tableOccupancy"),
            value: `${en.table_occupancy_pct}%`,
            icon: <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4"><rect x="2" y="7" width="16" height="2" rx="1" stroke="currentColor" strokeWidth="1.5" /><path d="M4 9v6M16 9v6M8 9v6M12 9v6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>,
          },
          {
            label: t("dashboard.avgPrepTime"),
            value: `${en.avg_prep_time_min}–${en.avg_prep_time_max}m`,
            icon: <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4"><circle cx="10" cy="10" r="7.5" stroke="currentColor" strokeWidth="1.5" /><path d="M10 6v4l3 2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>,
          },
          {
            label: t("dashboard.repeatCustomers"),
            value: `${en.repeat_customer_pct}%`,
            icon: <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4"><path d="M3 10a7 7 0 0 1 13-3M17 10a7 7 0 0 1-13 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /><path d="M16 4v3h-3M4 16v-3h3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>,
          },
          {
            label: t("dashboard.revVsYesterday"),
            value: en.revenue_vs_yesterday_pct !== null ? `${en.revenue_vs_yesterday_pct > 0 ? "+" : ""}${en.revenue_vs_yesterday_pct.toFixed(0)}%` : "–",
            icon: <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4"><polyline points="3 14 8 9 12 12 17 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /><polyline points="13 5 17 5 17 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>,
          },
          {
            label: t("dashboard.revVsLastWeek"),
            value: en.revenue_vs_last_week_pct !== null ? `${en.revenue_vs_last_week_pct > 0 ? "+" : ""}${en.revenue_vs_last_week_pct.toFixed(0)}%` : "–",
            icon: <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4"><rect x="3" y="10" width="3" height="7" rx="1" stroke="currentColor" strokeWidth="1.2" /><rect x="8.5" y="6" width="3" height="11" rx="1" stroke="currentColor" strokeWidth="1.2" /><rect x="14" y="3" width="3" height="14" rx="1" stroke="currentColor" strokeWidth="1.2" /></svg>,
          },
        ];
        return (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
            {extraStats.map((s) => (
              <div key={s.label} className="card flex items-center gap-2.5 p-3" style={{ borderRadius: "4px" }}>
                <span className="text-ink-400">{s.icon}</span>
                <div className="min-w-0">
                  <p className="truncate text-[0.6rem] font-medium uppercase tracking-wider text-ink-400">{s.label}</p>
                  <p className="text-sm font-bold tabular-nums text-ink-900">{s.value}</p>
                </div>
              </div>
            ))}
          </div>
        );
      })()}

      {/* Sophia AI Insights */}
      <SophiaInsights />

      {/* Demand Forecast */}
      <DemandForecast />

      {/* Composition + average order */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
        <div className="card p-5 lg:col-span-3">
          <h3 className="text-sm font-semibold text-ink-900">{t("orders.title")}</h3>
          <div className="mt-4">
            {donutSlices.length === 0 ? (
              <p className="text-sm text-ink-500">{t("dashboard.noAnalyticsData")}</p>
            ) : (
              <StatusDonut slices={donutSlices} />
            )}
          </div>
        </div>
        <div className="card flex flex-col justify-center bg-gradient-to-br from-brand-800 to-brand-900 p-6 text-white lg:col-span-2" style={{ borderRadius: "4px" }}>
          <p className="text-sm text-white/70">{t("dashboard.avgOrderValue")}</p>
          <p className="mt-2 text-3xl font-bold tabular-nums">
            <AnimatedNumber value={avgOrder} format={(n) => formatBDT(n.toFixed(0), lang)} />
          </p>
          <p className="mt-3 text-xs text-white/60">
            {ordersTotal} {t("dashboard.orders")} · {formatBDT(data.revenue_paid, lang)}
          </p>
        </div>
      </div>

      {/* Orders over time */}
      <div className="card p-5">
        <h3 className="text-sm font-semibold text-ink-900">{t("dashboard.ordersTrend")}</h3>
        {trend.length === 0 ? (
          <p className="mt-4 text-sm text-ink-500">{t("dashboard.noAnalyticsData")}</p>
        ) : (
          <div
            className="mt-4 flex h-40 items-end gap-1.5"
            role="img"
            aria-label={t("dashboard.ordersTrend")}
          >
            {trend.map((p) => (
              <div
                key={p.date}
                className="group flex min-w-0 flex-1 flex-col items-center"
              >
                <span className="mb-1 text-[10px] font-medium tabular-nums text-ink-500 opacity-0 transition group-hover:opacity-100">
                  {p.orders}
                </span>
                <div className="relative w-full" style={{ height: "128px" }}>
                  <div
                    className="absolute inset-x-0 bottom-0 rounded-t bg-gradient-to-t from-brand-600 to-brand-400"
                    style={{ height: `${Math.max(3, (p.orders / maxOrders) * 100)}%` }}
                    title={`${shortDate(p.date, lang)}: ${p.orders}`}
                  />
                </div>
                <span className="truncate text-[10px] text-ink-400">
                  {shortDate(p.date, lang)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Trending dishes */}
        <div className="card p-5">
          <h3 className="text-sm font-semibold text-ink-900">
            {t("dashboard.trendingDishes")}
          </h3>
          {dishes.length === 0 ? (
            <p className="mt-4 text-sm text-ink-500">{t("dashboard.noAnalyticsData")}</p>
          ) : (
            <ul className="mt-3 space-y-1">
              {dishes.map((d, i) => (
                <li
                  key={d.dish}
                  className="flex items-center gap-3 rounded-card px-2 py-2.5 transition-colors hover:bg-ink-50"
                >
                  <span
                    className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold tabular-nums ${
                      i === 0
                        ? "bg-amber-100 text-amber-700"
                        : i === 1
                          ? "bg-ink-100 text-ink-600"
                          : i === 2
                            ? "bg-orange-100 text-orange-700"
                            : "text-ink-400"
                    }`}
                  >
                    {i + 1}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm font-medium text-ink-900">
                    {d.dish}
                  </span>
                  {i === 0 && (
                    <span className="shrink-0 text-red-500">
                      <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4" aria-hidden="true"><path d="M10 2c0 4-3 5-3 8a4 4 0 0 0 8 0c0-3-3-4-3-8z" /></svg>
                    </span>
                  )}
                  <span className="shrink-0 text-xs tabular-nums text-ink-500">
                    ×{d.quantity}
                  </span>
                  <span className="shrink-0 text-sm font-semibold tabular-nums text-ink-900">
                    {formatBDT(d.revenue, lang)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Peak hours — stylish histogram */}
        <div className="card p-5">
          <h3 className="text-sm font-semibold text-ink-900">{t("dashboard.peakHours")}</h3>
          {hours.length === 0 ? (
            <p className="mt-4 text-sm text-ink-500">{t("dashboard.noAnalyticsData")}</p>
          ) : (
            <div className="mt-4 flex items-end gap-[3px]" style={{ height: "160px" }} role="img" aria-label={t("dashboard.peakHours")}>
              {hours.map((h) => {
                const pct = maxHourOrders > 0 ? Math.max(4, (h.orders / maxHourOrders) * 100) : 4;
                return (
                  <div key={h.hour} className="group relative flex min-w-0 flex-1 flex-col items-center justify-end" style={{ height: "100%" }}>
                    <div className="pointer-events-none absolute -top-8 left-1/2 z-10 -translate-x-1/2 whitespace-nowrap rounded-lg bg-ink-900 px-2.5 py-1 text-[0.65rem] font-medium text-white opacity-0 shadow-lg transition-opacity group-hover:opacity-100">
                      {h.orders} {t("dashboard.orders")}
                      <div className="absolute left-1/2 top-full -translate-x-1/2 border-4 border-transparent border-t-ink-900" />
                    </div>
                    <div className="flex w-full flex-1 items-end justify-center">
                      <div
                        className="w-full max-w-[24px] rounded-t-md bg-gradient-to-t from-ink-500 to-ink-300 transition-all duration-300 group-hover:from-orange-500 group-hover:to-orange-400"
                        style={{ height: `${pct}%` }}
                      />
                    </div>
                    <span className="mt-1.5 text-[0.6rem] text-ink-400">{h.hour}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
