import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { api } from "@/lib/api";
import { useRestaurant } from "@/context/RestaurantContext";
import type { DemandForecast as ForecastType } from "@/types";
import { SectionCard, Metric, ConfidenceBadge } from "@/components/Insights";

function HeaderIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4">
      <path d="M3 17V7l4-4 4 4 4-6v16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ForecastSkeleton() {
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <div className="h-3 w-1/3 animate-pulse rounded bg-ink-100" />
        <div className="h-8 w-24 animate-pulse rounded bg-ink-100" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="h-12 animate-pulse rounded-lg bg-ink-100" />
        <div className="h-12 animate-pulse rounded-lg bg-ink-100" />
      </div>
      <div className="h-12 animate-pulse rounded-lg bg-ink-100" />
    </div>
  );
}

function PeakRow({
  label,
  start,
  end,
  orders,
}: {
  label: string;
  start: string;
  end: string;
  orders?: number;
}) {
  return (
    <div className="flex items-center justify-between gap-3 py-2.5">
      <div className="min-w-0">
        <p className="text-[0.65rem] font-medium uppercase tracking-wider text-ink-400">{label}</p>
        <p className="mt-0.5 text-sm font-semibold tabular-nums text-ink-900">
          {start} – {end}
        </p>
      </div>
      {typeof orders === "number" && (
        <span className="shrink-0 text-sm font-bold tabular-nums text-ink-500">{orders}</span>
      )}
    </div>
  );
}

export function DemandForecast() {
  const { t } = useTranslation();
  const { restaurant } = useRestaurant();

  const { data: forecast, isLoading, isError, refetch } = useQuery({
    queryKey: ["analytics", "demand-forecast", restaurant?.slug],
    queryFn: async () => (await api.get<ForecastType>("/analytics/demand_forecast/")).data,
    enabled: !!restaurant,
  });

  const confidence =
    forecast?.confidence === "high" || forecast?.confidence === "medium"
      ? (forecast.confidence as "high" | "medium")
      : "low";

  return (
    <SectionCard
      title={t("dashboard.demandForecast")}
      icon={<HeaderIcon />}
      action={
        forecast ? (
          <ConfidenceBadge
            level={confidence}
            label={t("dashboard.confidence", { level: forecast.confidence, defaultValue: `${forecast.confidence} confidence` })}
          />
        ) : undefined
      }
    >
      {isLoading ? (
        <ForecastSkeleton />
      ) : isError ? (
        <div className="flex items-center justify-between gap-3 py-1">
          <p className="text-sm text-ink-500">{t("dashboard.forecastError", "Couldn't load the forecast.")}</p>
          <button onClick={() => refetch()} className="btn-ghost text-xs">
            {t("common.retry", "Retry")}
          </button>
        </div>
      ) : !forecast ? (
        <div className="flex flex-col items-center py-6 text-center">
          <span className="text-ink-200">
            <svg viewBox="0 0 24 24" fill="none" className="h-8 w-8">
              <path d="M4 19V9l4-4 4 4 4-7v17" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
          <p className="mt-2 text-sm font-medium text-ink-500">
            {t("dashboard.noForecast", "No forecast available")}
          </p>
          <p className="mt-0.5 text-xs text-ink-400">
            {t("dashboard.noForecastHint", "A forecast is generated once there's enough order history.")}
          </p>
        </div>
      ) : (
        <div>
          {/* Hero metric: expected orders for the forecast day */}
          <Metric
            label={t("dashboard.tomorrowForecast", { date: forecast.date, weekday: forecast.weekday })}
            value={
              <>
                {forecast.expected_orders}
                <span className="ml-1.5 text-xs font-normal text-ink-400">
                  {t("dashboard.expectedOrders")}
                </span>
              </>
            }
          />

          {/* Peak service windows */}
          <div className="mt-3 divide-y divide-ink-100 border-y border-ink-100">
            <PeakRow
              label={t("dashboard.lunchPeak", "Lunch Peak")}
              start={forecast.lunch_peak.start}
              end={forecast.lunch_peak.end}
              orders={forecast.lunch_peak.orders}
            />
            <PeakRow
              label={t("dashboard.dinnerPeak", "Dinner Peak")}
              start={forecast.dinner_peak.start}
              end={forecast.dinner_peak.end}
              orders={forecast.dinner_peak.orders}
            />
          </div>

          {/* Staffing + top item */}
          <div className="mt-3 grid grid-cols-2 gap-4">
            <Metric
              label={t("dashboard.recommendedStaff", "Recommended Staff")}
              value={forecast.recommended_kitchen_staff}
            />
            <Metric
              label={t("dashboard.topItemForecast", "Top Item Forecast")}
              value={
                forecast.top_items_forecast[0]
                  ? `${forecast.top_items_forecast[0].dish} × ${forecast.top_items_forecast[0].expected_qty}`
                  : "—"
              }
            />
          </div>
        </div>
      )}
    </SectionCard>
  );
}
