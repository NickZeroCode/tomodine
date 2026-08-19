import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { api } from "@/lib/api";
import { formatBDT } from "@/lib/format";
import { useRestaurant } from "@/context/RestaurantContext";
import { LoadingState, ErrorState, EmptyState } from "@/components/States";
import type { AnalyticsOverview, OrdersOverTimePoint, PopularDish, PeakHour } from "@/types";

function shortDate(iso: string, lang: "en" | "bn"): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(lang === "bn" ? "bn-BD" : "en-GB", { day: "numeric", month: "short" });
}

export function ReportsPage() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language === "bn" ? "bn" : "en";
  const { restaurant } = useRestaurant();
  const slug = restaurant?.slug;

  const overviewQuery = useQuery({
    queryKey: ["analytics", "overview", slug],
    queryFn: async () => (await api.get<AnalyticsOverview>("/analytics/overview/")).data,
    enabled: !!restaurant,
  });

  const trendQuery = useQuery({
    queryKey: ["analytics", "orders-over-time-30", slug],
    queryFn: async () =>
      (await api.get<OrdersOverTimePoint[]>("/analytics/orders_over_time/?days=30")).data,
    enabled: !!restaurant,
  });

  const dishesQuery = useQuery({
    queryKey: ["analytics", "popular-dishes", slug],
    queryFn: async () => (await api.get<PopularDish[]>("/analytics/popular_dishes/")).data,
    enabled: !!restaurant,
  });

  const hoursQuery = useQuery({
    queryKey: ["analytics", "peak-hours", slug],
    queryFn: async () => (await api.get<PeakHour[]>("/analytics/peak_hours/?days=30")).data,
    enabled: !!restaurant,
  });

  if (!restaurant) return <EmptyState />;
  if (overviewQuery.isLoading) return <LoadingState />;
  if (overviewQuery.isError) return <ErrorState onRetry={() => void overviewQuery.refetch()} />;

  const overview = overviewQuery.data!;
  const trend = trendQuery.data ?? [];
  const dishes = dishesQuery.data ?? [];
  const hours = hoursQuery.data ?? [];

  const revenuePaid = parseFloat(overview.revenue_paid) || 0;
  const avgOrder = overview.orders_total > 0 ? revenuePaid / overview.orders_total : 0;
  const maxTrend = Math.max(1, ...trend.map((p) => p.orders));
  const maxHour = Math.max(1, ...hours.map((h) => h.orders));

  // Revenue totals from trend data.
  const trendRevenue = trend.reduce((sum, p) => sum + parseFloat(p.revenue || "0"), 0);

  const summaryCards = [
    {
      label: t("reports.today"),
      value: formatBDT(overview.revenue_paid, lang),
      sub: `${overview.orders_total} ${t("dashboard.orders")}`,
      gradient: "from-emerald-600 to-emerald-800",
      icon: (
        <svg viewBox="0 0 24 24" fill="none" className="h-8 w-8 text-white/20">
          <rect x="3" y="5" width="18" height="16" rx="2" stroke="currentColor" strokeWidth="1.5" />
          <path d="M3 9h18" stroke="currentColor" strokeWidth="1.5" />
          <path d="M8 13h3M8 16h5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          <circle cx="17" cy="15" r="2" fill="currentColor" />
        </svg>
      ),
    },
    {
      label: t("reports.thisMonth"),
      value: formatBDT(String(trendRevenue), lang),
      sub: `${trend.reduce((s, p) => s + p.orders, 0)} ${t("dashboard.orders")}`,
      gradient: "from-teal-600 to-teal-800",
      icon: (
        <svg viewBox="0 0 24 24" fill="none" className="h-8 w-8 text-white/20">
          <path d="M12 2v20M17 5H9.5a3.5 3.5 0 1 0 0 7h5a3.5 3.5 0 1 1 0 7H6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ),
    },
    {
      label: t("reports.avgOrderValue"),
      value: formatBDT(avgOrder.toFixed(0), lang),
      sub: `${t("dashboard.orders")}: ${overview.orders_total}`,
      gradient: "from-green-600 to-green-800",
      icon: (
        <svg viewBox="0 0 24 24" fill="none" className="h-8 w-8 text-white/20">
          <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          <polyline points="16 7 22 7 22 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ),
    },
  ];

  return (
    <section aria-labelledby="reports-heading" className="space-y-4">
      <h2 id="reports-heading" className="text-lg font-semibold text-ink-900">
        {t("reports.title")}
      </h2>

      {/* Summary cards */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {summaryCards.map((card) => (
          <div
            key={card.label}
            className={`relative overflow-hidden bg-gradient-to-br ${card.gradient} p-5 text-white shadow-sm transition-shadow hover:shadow-md`}
            style={{ borderRadius: "4px" }}
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-medium text-white/60">{card.label}</p>
                <p className="mt-2 text-2xl font-bold tabular-nums">{card.value}</p>
                <p className="mt-1 text-xs text-white/50">{card.sub}</p>
              </div>
              <span className="shrink-0">{card.icon}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Revenue trend — stylish histogram */}
      <div className="card p-5">
        <h3 className="text-sm font-semibold text-ink-900">{t("reports.revenueTrend")}</h3>
        {trend.length === 0 ? (
          <p className="mt-4 text-sm text-ink-500">{t("reports.noData")}</p>
        ) : (
          <div className="mt-4 flex items-end gap-[3px]" style={{ height: "160px" }} role="img" aria-label={t("reports.revenueTrend")}>
            {trend.map((p, idx) => {
              const pct = maxTrend > 0 ? Math.max(4, (p.orders / maxTrend) * 100) : 4;
              const isLast = idx === trend.length - 1;
              return (
                <div key={p.date} className="group relative flex min-w-0 flex-1 flex-col items-center justify-end" style={{ height: "100%" }}>
                  <div className="pointer-events-none absolute -top-8 left-1/2 z-10 -translate-x-1/2 whitespace-nowrap bg-ink-900 px-2.5 py-1 text-[0.65rem] font-medium text-white opacity-0 shadow-lg transition-opacity group-hover:opacity-100" style={{ borderRadius: "3px" }}>
                    {p.orders} {t("dashboard.orders")}
                    <div className="absolute left-1/2 top-full -translate-x-1/2 border-4 border-transparent border-t-ink-900" />
                  </div>
                  <div className="flex w-full flex-1 items-end justify-center">
                    <div
                      className={`w-full max-w-[32px] transition-all duration-300 group-hover:brightness-110 ${
                        isLast
                          ? "bg-gradient-to-t from-orange-500 to-orange-400"
                          : "bg-gradient-to-t from-brand-500 to-brand-300"
                      }`}
                      style={{ height: `${pct}%`, borderRadius: "2px 2px 0 0" }}
                    />
                  </div>
                  <span className="mt-1.5 text-[0.6rem] text-ink-400">{shortDate(p.date, lang)}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Top dishes table */}
        <div className="card p-5">
          <h3 className="text-sm font-semibold text-ink-900">{t("reports.topDishes")}</h3>
          {dishes.length === 0 ? (
            <p className="mt-4 text-sm text-ink-500">{t("reports.noData")}</p>
          ) : (
            <div className="mt-3 overflow-hidden rounded-xl border border-ink-100">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-ink-50 text-[0.7rem] font-semibold uppercase tracking-wider text-ink-400">
                    <th className="px-4 py-2.5 text-left">#</th>
                    <th className="px-4 py-2.5 text-left">{t("menu.title")}</th>
                    <th className="px-4 py-2.5 text-right">{t("orders.items")}</th>
                    <th className="px-4 py-2.5 text-right">{t("reports.revenue")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink-100">
                  {dishes.map((d, i) => (
                    <tr key={d.dish} className="transition-colors hover:bg-ink-50">
                      <td className="px-4 py-2.5 tabular-nums text-ink-400">{i + 1}</td>
                      <td className="px-4 py-2.5 font-medium text-ink-900">{d.dish}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-ink-600">×{d.quantity}</td>
                      <td className="px-4 py-2.5 text-right font-semibold tabular-nums text-ink-900">{formatBDT(d.revenue, lang)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Peak hours — stylish histogram */}
        <div className="card p-5">
          <h3 className="text-sm font-semibold text-ink-900">{t("reports.peakHours")}</h3>
          {hours.length === 0 ? (
            <p className="mt-4 text-sm text-ink-500">{t("reports.noData")}</p>
          ) : (
            <div className="mt-4 flex items-end gap-[3px]" style={{ height: "160px" }} role="img" aria-label={t("reports.peakHours")}>
              {hours.map((h) => {
                const pct = maxHour > 0 ? Math.max(4, (h.orders / maxHour) * 100) : 4;
                return (
                  <div key={h.hour} className="group relative flex min-w-0 flex-1 flex-col items-center justify-end" style={{ height: "100%" }}>
                    <div className="pointer-events-none absolute -top-8 left-1/2 z-10 -translate-x-1/2 whitespace-nowrap bg-ink-900 px-2.5 py-1 text-[0.65rem] font-medium text-white opacity-0 shadow-lg transition-opacity group-hover:opacity-100" style={{ borderRadius: "3px" }}>
                      {h.orders} {t("dashboard.orders")}
                      <div className="absolute left-1/2 top-full -translate-x-1/2 border-4 border-transparent border-t-ink-900" />
                    </div>
                    <div className="flex w-full flex-1 items-end justify-center">
                      <div
                        className="w-full max-w-[24px] bg-gradient-to-t from-ink-500 to-ink-300 transition-all duration-300 group-hover:from-orange-500 group-hover:to-orange-400"
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
