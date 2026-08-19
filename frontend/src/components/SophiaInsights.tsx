import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { api } from "@/lib/api";
import { useRestaurant } from "@/context/RestaurantContext";
import type { AiInsight } from "@/types";

const TYPE_COLORS: Record<string, { bg: string; border: string; icon: string }> = {
  revenue: { bg: "bg-emerald-50", border: "border-emerald-200", icon: "text-emerald-600" },
  sales: { bg: "bg-orange-50", border: "border-orange-200", icon: "text-orange-600" },
  operations: { bg: "bg-blue-50", border: "border-blue-200", icon: "text-blue-600" },
  menu: { bg: "bg-purple-50", border: "border-purple-200", icon: "text-purple-600" },
  loyalty: { bg: "bg-pink-50", border: "border-pink-200", icon: "text-pink-600" },
};

export function SophiaInsights() {
  const { t } = useTranslation();
  const { restaurant } = useRestaurant();

  const { data: insights, isLoading } = useQuery({
    queryKey: ["analytics", "ai-insights", restaurant?.slug],
    queryFn: async () => (await api.get<AiInsight[]>("/analytics/ai_insights/")).data,
    enabled: !!restaurant,
  });

  if (isLoading || !insights || insights.length === 0) return null;

  return (
    <div className="card p-5" style={{ borderRadius: "4px" }}>
      <div className="mb-4 flex items-center gap-2">
        <span className="flex h-7 w-7 items-center justify-center bg-brand-100" style={{ borderRadius: "4px" }}>
          <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4 text-brand-600">
            <circle cx="10" cy="10" r="8" stroke="currentColor" strokeWidth="1.5" />
            <circle cx="10" cy="10" r="3" fill="currentColor" />
            <path d="M10 2v2M10 16v2M2 10h2M16 10h2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </span>
        <h3 className="text-sm font-semibold text-ink-900">{t("dashboard.sophiaInsights")}</h3>
      </div>
      <div className="space-y-3">
        {insights.map((insight, i) => {
          const colors = TYPE_COLORS[insight.type] || TYPE_COLORS.operations;
          return (
            <div
              key={i}
              className={`${colors.bg} border ${colors.border} p-4`}
              style={{ borderRadius: "4px" }}
            >
              <div className="flex items-start gap-3">
                <span className={`mt-0.5 text-lg ${colors.icon}`}>{insight.icon}</span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-ink-900">{insight.title}</p>
                  <p className="mt-1 text-xs leading-relaxed text-ink-600">{insight.body}</p>
                  <div className="mt-2 flex items-start gap-1.5">
                    <svg viewBox="0 0 16 16" fill="none" className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand-600">
                      <path d="M8 2l1.5 3.5L14 6l-3 2.5.5 4L8 10.5 4.5 12.5l.5-4L2 6l4.5-.5L8 2z" fill="currentColor" />
                    </svg>
                    <p className="text-xs font-medium text-brand-700">{insight.recommendation}</p>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
