import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { api } from "@/lib/api";
import { formatBDT, localized, localizedDescription } from "@/lib/format";
import { useRestaurant } from "@/context/RestaurantContext";
import { LoadingState, ErrorState } from "@/components/States";
import type { Subscription, SubscriptionPlan } from "@/types";

export function SubscriptionPage() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language === "bn" ? "bn" : "en";
  const { restaurant } = useRestaurant();

  const plansQuery = useQuery({
    queryKey: ["subscription-plans"],
    queryFn: async () => {
      const res = await api.get("/subscription-plans/");
      const list = res.data;
      return (Array.isArray(list) ? list : list.results) as SubscriptionPlan[];
    },
  });

  const subscriptionQuery = useQuery({
    queryKey: ["subscription", restaurant?.slug],
    queryFn: async () => {
      const res = await api.get("/subscriptions/");
      const list = res.data;
      const items = (Array.isArray(list) ? list : list.results) as Subscription[];
      return items[0] ?? null;
    },
    enabled: !!restaurant,
  });

  if (plansQuery.isLoading || subscriptionQuery.isLoading) return <LoadingState />;
  if (plansQuery.isError)
    return <ErrorState onRetry={() => void plansQuery.refetch()} />;

  const plans = plansQuery.data ?? [];
  const subscription = subscriptionQuery.data;

  return (
    <section aria-labelledby="billing-heading">
      <h2 id="billing-heading" className="mb-4 text-lg font-semibold text-ink-900">
        {t("nav.billing")}
      </h2>

      {subscription && (
        <div className="mb-6 overflow-hidden rounded-2xl bg-gradient-to-r from-brand-800 to-brand-900 p-6 text-white shadow-soft">
          <p className="text-sm text-white/70">{t("nav.billing")}</p>
          <p className="mt-1 text-xl font-bold">
            {localized(subscription.plan, lang)} —{" "}
            <span className="tabular-nums">
              {formatBDT(subscription.plan.price, lang)}
              {t("landing.perMonth")}
            </span>
          </p>
          <p className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold">
            <span
              className={`h-1.5 w-1.5 rounded-full ${
                subscription.is_entitled ? "bg-emerald-300" : "bg-amber-300"
              }`}
              aria-hidden="true"
            />
            {subscription.is_entitled ? subscription.status : t("common.error")}
          </p>
        </div>
      )}

      <h3 className="mb-3 text-sm font-semibold text-ink-900">
        {t("landing.pricingTitle")}
      </h3>
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
        {plans.map((plan) => {
          const isCurrent = subscription?.plan.id === plan.id;
          return (
            <div
              key={plan.id}
              className={`card flex flex-col overflow-hidden transition-shadow hover:shadow-lift ${
                isCurrent ? "ring-2 ring-brand-500" : ""
              }`}
            >
              <div className="flex items-center justify-between bg-[#EDF6F5] px-5 py-2.5 text-xs font-semibold text-brand-800">
                <span>{t("landing.pricingTrial", { days: plan.trial_days })}</span>
                {isCurrent && (
                  <span className="rounded-full bg-brand-600 px-2 py-0.5 text-[10px] font-bold text-white">
                    {subscription?.status}
                  </span>
                )}
              </div>
              <div className="flex flex-1 flex-col p-5">
                <h4 className="text-base font-semibold text-ink-900">
                  {localized(plan, lang)}
                </h4>
                <p className="mt-2 text-3xl font-bold text-brand-700 tabular-nums">
                  {formatBDT(plan.price, lang)}
                  <span className="text-sm font-normal text-ink-500">
                    {t("landing.perMonth")}
                  </span>
                </p>
                <p className="mt-2 flex-1 text-sm text-ink-500">
                  {localizedDescription(plan, lang)}
                </p>
                <ul className="mt-4 space-y-2 text-sm text-ink-700">
                  {[
                    `${t("tables.title")}: ${plan.max_tables}`,
                    `${t("nav.staff")}: ${plan.max_staff}`,
                    `${t("menu.title")}: ${plan.max_dishes}`,
                  ].map((line) => (
                    <li key={line} className="flex items-center gap-2">
                      <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 shrink-0 text-brand-600" aria-hidden="true">
                        <path fillRule="evenodd" d="M16.7 5.3a1 1 0 0 1 0 1.4l-7 7a1 1 0 0 1-1.4 0l-3-3a1 1 0 1 1 1.4-1.4L9 11.6l6.3-6.3a1 1 0 0 1 1.4 0z" clipRule="evenodd" />
                      </svg>
                      {line}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
