import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { api } from "@/lib/api";
import { useRestaurant } from "@/context/RestaurantContext";
import { formatBDT } from "@/lib/format";
import { LoadingState, ErrorState } from "@/components/States";
import type { MenuEngineering as METype, MenuEngineeringItem } from "@/types";

const QUADRANTS = [
  {
    key: "stars" as const,
    label: "Stars",
    subtitle: "High popularity + High profit",
    action: "Promote heavily",
    color: "bg-emerald-50 border-emerald-200",
    badge: "bg-emerald-600",
    icon: <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 text-emerald-500"><path d="m10 1 2.5 5.5 6 .7-4.5 4.2 1.2 6L10 14.8 4.8 17.4l1.2-6L1.5 7.2l6-.7L10 1z" /></svg>,
  },
  {
    key: "plow_horses" as const,
    label: "Plow Horses",
    subtitle: "High popularity + Low profit",
    action: "Increase price / Reduce cost",
    color: "bg-amber-50 border-amber-200",
    badge: "bg-amber-600",
    icon: <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4 text-amber-500"><path d="M4 17l3-10h6l3 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /><circle cx="10" cy="5" r="2" stroke="currentColor" strokeWidth="1.5" /></svg>,
  },
  {
    key: "puzzles" as const,
    label: "Puzzles",
    subtitle: "Low popularity + High profit",
    action: "Improve marketing",
    color: "bg-blue-50 border-blue-200",
    badge: "bg-blue-600",
    icon: <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4 text-blue-500"><path d="M7 2h6v4l3 2-3 2v4H7v-4l-3-2 3-2V2z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" /><circle cx="10" cy="10" r="1.5" fill="currentColor" /></svg>,
  },
  {
    key: "dogs" as const,
    label: "Dogs",
    subtitle: "Low popularity + Low profit",
    action: "Consider removing",
    color: "bg-red-50 border-red-200",
    badge: "bg-red-600",
    icon: <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4 text-red-400"><path d="M10 18v-4M6 10a4 4 0 0 1 8 0M3 10a7 7 0 0 1 14 0" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>,
  },
];

function ItemRow({ item, lang }: { item: MenuEngineeringItem; lang: "en" | "bn" }) {
  return (
    <div className="flex items-center justify-between border-b border-ink-100/50 py-2 last:border-0">
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-ink-900">{lang === "bn" ? item.dish_bn || item.dish : item.dish}</p>
        <p className="text-[0.65rem] text-ink-400">{formatBDT(item.price, lang)} · {item.quantity} sold</p>
      </div>
      <span className="shrink-0 text-xs font-bold tabular-nums text-ink-700">{formatBDT(item.revenue, lang)}</span>
    </div>
  );
}

export function MenuEngineeringPage() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language === "bn" ? "bn" : "en";
  const { restaurant } = useRestaurant();

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["analytics", "menu-engineering", restaurant?.slug],
    queryFn: async () => (await api.get<METype>("/analytics/menu_engineering/")).data,
    enabled: !!restaurant,
  });

  if (isLoading) return <LoadingState />;
  if (isError || !data) return <ErrorState onRetry={() => void refetch()} />;

  return (
    <section aria-labelledby="menu-eng-heading" className="space-y-4">
      <h2 id="menu-eng-heading" className="text-lg font-semibold text-ink-900">
        {t("dashboard.menuEngineering")}
      </h2>
      <p className="text-xs text-ink-500">{t("dashboard.menuEngineeringIntro")}</p>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {QUADRANTS.map((q) => {
          const items = data[q.key];
          return (
            <div key={q.key} className={`card border ${q.color} p-4`} style={{ borderRadius: "4px" }}>
              <div className="mb-2 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {q.icon}
                  <div>
                    <h3 className="text-sm font-bold text-ink-900">{q.label}</h3>
                    <p className="text-[0.6rem] text-ink-500">{q.subtitle}</p>
                  </div>
                </div>
                <span className={`${q.badge} px-2 py-0.5 text-[0.6rem] font-semibold text-white`} style={{ borderRadius: "3px" }}>
                  {q.action}
                </span>
              </div>
              {items.length === 0 ? (
                <p className="py-4 text-center text-xs text-ink-400">No items in this category</p>
              ) : (
                <div>
                  {items.map((item) => (
                    <ItemRow key={item.dish} item={item} lang={lang} />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
