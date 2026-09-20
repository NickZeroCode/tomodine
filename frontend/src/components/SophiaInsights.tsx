import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { api } from "@/lib/api";
import { useRestaurant } from "@/context/RestaurantContext";
import type { AiInsight } from "@/types";
import { SectionCard, InsightRow, type InsightTone } from "@/components/Insights";

/* Map each insight type to a restrained tone (dot color only — no pastel cards).
 * The API sends an emoji in `icon`; we render a consistent SVG per type instead. */
const TYPE_TONE: Record<string, InsightTone> = {
  revenue: "success",
  sales: "warning",
  operations: "info",
  menu: "neutral",
  loyalty: "danger",
};

function TypeIcon({ type }: { type: string }) {
  const cls = "h-4 w-4";
  switch (type) {
    case "revenue":
      return (
        <svg viewBox="0 0 20 20" fill="none" className={cls}>
          <path d="M3 16l4-6 4 3 6-9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case "sales":
      return (
        <svg viewBox="0 0 20 20" fill="none" className={cls}>
          <path d="M3 4h14l-2 9H6L3 4z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
          <circle cx="7" cy="16.5" r="1.2" fill="currentColor" />
          <circle cx="13" cy="16.5" r="1.2" fill="currentColor" />
        </svg>
      );
    case "menu":
      return (
        <svg viewBox="0 0 20 20" fill="none" className={cls}>
          <path d="M4 3h12v14H4z" stroke="currentColor" strokeWidth="1.5" />
          <path d="M7 7h6M7 10h6M7 13h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      );
    case "loyalty":
      return (
        <svg viewBox="0 0 20 20" fill="none" className={cls}>
          <path d="M10 16s-6-3.6-6-8a3.5 3.5 0 016-2.4A3.5 3.5 0 0116 8c0 4.4-6 8-6 8z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
        </svg>
      );
    default: // operations
      return (
        <svg viewBox="0 0 20 20" fill="none" className={cls}>
          <circle cx="10" cy="10" r="7" stroke="currentColor" strokeWidth="1.5" />
          <path d="M10 6v4l3 2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      );
  }
}

function HeaderIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4">
      <circle cx="10" cy="10" r="8" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="10" cy="10" r="3" fill="currentColor" />
      <path d="M10 2v2M10 16v2M2 10h2M16 10h2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function InsightsSkeleton() {
  return (
    <div className="divide-y divide-ink-100">
      {[0, 1, 2].map((i) => (
        <div key={i} className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
          <span className="mt-1.5 h-2 w-2 shrink-0 animate-pulse rounded-full bg-ink-100" />
          <div className="flex-1 space-y-2">
            <div className="h-3.5 w-2/5 animate-pulse rounded bg-ink-100" />
            <div className="h-3 w-11/12 animate-pulse rounded bg-ink-100" />
            <div className="h-3 w-1/3 animate-pulse rounded bg-ink-100" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function SophiaInsights() {
  const { t } = useTranslation();
  const { restaurant } = useRestaurant();

  const { data: insights, isLoading, isError, refetch } = useQuery({
    queryKey: ["analytics", "ai-insights", restaurant?.slug],
    queryFn: async () => (await api.get<AiInsight[]>("/analytics/ai_insights/")).data,
    enabled: !!restaurant,
  });

  return (
    <SectionCard title={t("dashboard.sophiaInsights")} icon={<HeaderIcon />}>
      {isLoading ? (
        <InsightsSkeleton />
      ) : isError ? (
        <div className="flex items-center justify-between gap-3 py-1">
          <p className="text-sm text-ink-500">{t("dashboard.insightsError", "Couldn't load insights.")}</p>
          <button onClick={() => refetch()} className="btn-ghost text-xs">
            {t("common.retry", "Retry")}
          </button>
        </div>
      ) : !insights || insights.length === 0 ? (
        <div className="flex flex-col items-center py-6 text-center">
          <span className="text-ink-200">
            <svg viewBox="0 0 24 24" fill="none" className="h-8 w-8">
              <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.5" />
              <path d="M12 8v4l2.5 1.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </span>
          <p className="mt-2 text-sm font-medium text-ink-500">
            {t("dashboard.noInsights", "No insights yet")}
          </p>
          <p className="mt-0.5 text-xs text-ink-400">
            {t("dashboard.noInsightsHint", "Insights appear as orders and sales data accumulate.")}
          </p>
        </div>
      ) : (
        <div className="divide-y divide-ink-100">
          {insights.map((insight, i) => (
            <div key={i} className="flex items-start gap-3">
              <span className="mt-3 hidden text-ink-300 sm:block">
                <TypeIcon type={insight.type} />
              </span>
              <div className="min-w-0 flex-1">
                <InsightRow
                  tone={TYPE_TONE[insight.type] ?? "neutral"}
                  title={insight.title}
                  body={insight.body}
                  recommendation={insight.recommendation}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </SectionCard>
  );
}
