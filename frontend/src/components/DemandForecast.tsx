import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { api } from "@/lib/api";
import { useRestaurant } from "@/context/RestaurantContext";
import type { DemandForecast as ForecastType } from "@/types";

export function DemandForecast() {
  const { t } = useTranslation();
  const { restaurant } = useRestaurant();

  const { data: forecast, isLoading } = useQuery({
    queryKey: ["analytics", "demand-forecast", restaurant?.slug],
    queryFn: async () => (await api.get<ForecastType>("/analytics/demand_forecast/")).data,
    enabled: !!restaurant,
  });

  if (isLoading || !forecast) return null;

  return (
    <div className="card p-5" style={{ borderRadius: "4px" }}>
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center bg-blue-100" style={{ borderRadius: "4px" }}>
            <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4 text-blue-600">
              <path d="M3 17V7l4-4 4 4 4-6v16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
          <h3 className="text-sm font-semibold text-ink-900">{t("dashboard.demandForecast")}</h3>
        </div>
        <span className={`text-[0.6rem] font-medium uppercase tracking-wider ${
          forecast.confidence === "medium" ? "text-emerald-600" : "text-amber-600"
        }`}>
          {forecast.confidence} confidence
        </span>
      </div>

      <div className="mb-4 rounded-lg bg-blue-50 p-3" style={{ borderRadius: "4px" }}>
        <p className="text-xs font-medium text-blue-700">
          {t("dashboard.tomorrowForecast", { date: forecast.date, weekday: forecast.weekday })}
        </p>
        <p className="mt-1 text-2xl font-bold text-blue-900">
          {forecast.expected_orders} <span className="text-sm font-normal text-blue-600">{t("dashboard.expectedOrders")}</span>
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-lg bg-orange-50 p-3" style={{ borderRadius: "4px" }}>
          <p className="text-[0.6rem] font-medium uppercase tracking-wider text-orange-600">Lunch Peak</p>
          <p className="mt-1 text-sm font-bold text-orange-900">
            {forecast.lunch_peak.start} – {forecast.lunch_peak.end}
          </p>
        </div>
        <div className="rounded-lg bg-purple-50 p-3" style={{ borderRadius: "4px" }}>
          <p className="text-[0.6rem] font-medium uppercase tracking-wider text-purple-600">Dinner Peak</p>
          <p className="mt-1 text-sm font-bold text-purple-900">
            {forecast.dinner_peak.start} – {forecast.dinner_peak.end}
          </p>
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between rounded-lg bg-slate-50 p-3" style={{ borderRadius: "4px" }}>
        <div>
          <p className="text-[0.6rem] font-medium uppercase tracking-wider text-ink-400">Recommended Staff</p>
          <p className="text-lg font-bold text-ink-900">{forecast.recommended_kitchen_staff}</p>
        </div>
        <div>
          <p className="text-[0.6rem] font-medium uppercase tracking-wider text-ink-400">Top Item Forecast</p>
          <p className="text-sm font-semibold text-ink-900">
            {forecast.top_items_forecast[0]?.dish} × {forecast.top_items_forecast[0]?.expected_qty}
          </p>
        </div>
      </div>
    </div>
  );
}
