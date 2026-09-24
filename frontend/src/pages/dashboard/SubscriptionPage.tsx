import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { api } from "@/lib/api";
import { formatBDT, localized, localizedDescription } from "@/lib/format";
import { useSubscription, useSubscribe } from "@/hooks/useSubscription";
import { LoadingState, ErrorState } from "@/components/States";
import type { SubscriptionPlan } from "@/types";

/** Whole days remaining until an ISO timestamp (0 when past). */
function daysUntil(iso: string | null): number {
  if (!iso) return 0;
  const ms = new Date(iso).getTime() - Date.now();
  return Math.max(0, Math.ceil(ms / 86_400_000));
}

export function SubscriptionPage() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language === "bn" ? "bn" : "en";
  const [toast, setToast] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const plansQuery = useQuery({
    queryKey: ["subscription-plans"],
    queryFn: async () => {
      const res = await api.get("/subscription-plans/");
      const list = res.data;
      return (Array.isArray(list) ? list : list.results) as SubscriptionPlan[];
    },
  });

  // Shared subscription state (single source of truth) + subscribe mutation
  // that writes the fresh subscription straight into the cache on success.
  const { subscription, isLoading: subLoading, isError: subError, status, isEntitled, refetch } = useSubscription();
  const subscribe = useSubscribe();

  const handleSubscribe = (planId: string) => {
    subscribe.mutate(planId, {
      onSuccess: (data) => {
        const planName = localized(data.plan, lang);
        const days = data.plan.trial_days || 14;
        setToast({
          type: "success",
          message: lang === "bn"
            ? `অভিনন্দন! আপনার ${days} দিনের ফ্রি ট্রায়াল সফলভাবে শুরু হয়েছে। প্ল্যান: ${planName}`
            : `Congratulations! Your ${days}-day free trial has started successfully. Plan: ${planName}`,
        });
        setTimeout(() => setToast(null), 6000);
      },
      onError: (err: unknown) => {
        const apiErr = err as { response?: { data?: { detail?: string } } };
        setToast({
          type: "error",
          message: apiErr?.response?.data?.detail || (lang === "bn" ? "সাবস্ক্রিপশন শুরু করা যায়নি" : "Could not start subscription"),
        });
        setTimeout(() => setToast(null), 5000);
      },
    });
  };

  if (plansQuery.isLoading || subLoading) return <LoadingState />;
  if (plansQuery.isError)
    return <ErrorState onRetry={() => void plansQuery.refetch()} />;

  const plans = plansQuery.data ?? [];
  const trialDaysLeft = status === "trialing" ? daysUntil(subscription?.trial_ends_at ?? null) : 0;

  return (
    <section aria-labelledby="billing-heading">
      {/* Toast notification */}
      {toast && (
        <div className={`fixed right-4 top-4 z-50 max-w-sm rounded-xl border p-4 shadow-lift transition-all ${
          toast.type === "success"
            ? "border-emerald-200 bg-emerald-50 text-emerald-800"
            : "border-red-200 bg-red-50 text-red-800"
        }`}>
          <div className="flex items-start gap-3">
            <span className="mt-0.5 text-lg">{toast.type === "success" ? "🎉" : "⚠️"}</span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold">{toast.type === "success" ? (lang === "bn" ? "সফল!" : "Success!") : (lang === "bn" ? "ত্রুটি" : "Error")}</p>
              <p className="mt-0.5 text-xs leading-relaxed">{toast.message}</p>
            </div>
            <button type="button" onClick={() => setToast(null)} className="shrink-0 text-ink-400 hover:text-ink-600">
              <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4"><path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
            </button>
          </div>
        </div>
      )}

      <h2 id="billing-heading" className="mb-4 text-lg font-semibold text-ink-900">
        {t("nav.billing")}
      </h2>

      {/* Error state — subscription fetch failed (distinct from "none") */}
      {subError && (
        <div className="mb-6 flex items-center justify-between gap-4 rounded-xl border border-red-200 bg-red-50 p-4">
          <p className="text-sm text-red-800">
            {lang === "bn"
              ? "আপনার সাবস্ক্রিপশন লোড করা যায়নি। সংযোগ পরীক্ষা করে আবার চেষ্টা করুন।"
              : "We couldn't load your subscription. Check your connection and try again."}
          </p>
          <button type="button" onClick={refetch} className="btn-ghost shrink-0 text-red-700">
            {t("common.retry", "Retry")}
          </button>
        </div>
      )}

      {/* Onboarding — no subscription yet */}
      {!subError && status === "none" && (
        <div className="mb-6 overflow-hidden rounded-2xl border border-brand-200 bg-gradient-to-br from-brand-50 to-emerald-50 p-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-100">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-8 w-8 text-brand-600">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
            </svg>
          </div>
          <h3 className="text-lg font-bold text-ink-900">
            {lang === "bn" ? "আপনার ফ্রি ট্রায়াল শুরু করুন" : "Start your free trial"}
          </h3>
          <p className="mx-auto mt-2 max-w-md text-sm text-ink-500">
            {lang === "bn"
              ? "এখনও কোনো সাবস্ক্রিপশন নেই। নিচের যেকোনো প্ল্যানে সাবস্ক্রাইব করলেই ১৪ দিনের ফ্রি ট্রায়াল শুরু হবে — কার্ড লাগবে না।"
              : "No subscription yet. Subscribe to any plan below and your 14-day free trial starts instantly — no card required."}
          </p>
          <p className="mt-3 text-xs font-medium text-brand-700">
            {lang === "bn" ? "↓ নিচে একটি প্ল্যান বেছে নিন" : "↓ Choose a plan below to begin"}
          </p>
        </div>
      )}

      {/* Active / trialing subscription banner */}
      {!subError && subscription && status !== "none" && (
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
              className={`h-1.5 w-1.5 rounded-full ${isEntitled ? "bg-emerald-300" : "bg-amber-300"}`}
              aria-hidden="true"
            />
            {status === "trialing"
              ? lang === "bn"
                ? `ফ্রি ট্রায়াল · ${trialDaysLeft} দিন বাকি`
                : `Free trial · ${trialDaysLeft} day${trialDaysLeft === 1 ? "" : "s"} left`
              : isEntitled
                ? subscription.status
                : t("common.error")}
          </p>
          {status === "trialing" && (
            <p className="mt-2 text-xs text-white/70">
              {lang === "bn"
                ? "ট্রায়াল শেষ হলে চালিয়ে যেতে একটি পেইড প্ল্যান বেছে নিন।"
                : "When the trial ends, choose a paid plan to keep premium features."}
            </p>
          )}
        </div>
      )}

      <h3 className="mb-3 text-sm font-semibold text-ink-900">
        {t("landing.pricingTitle")}
      </h3>

      {plans.length === 0 ? (
        <div className="card flex flex-col items-center justify-center gap-2 py-12 text-center">
          <p className="text-sm font-medium text-ink-700">
            {lang === "bn"
              ? "কোনো প্ল্যান পাওয়া যায়নি"
              : "No plans available at the moment"}
          </p>
          <p className="text-xs text-ink-500">
            {lang === "bn"
              ? "অনুগ্রহ করে পরে আবার চেষ্টা করুন বা সাহায্যের জন্য যোগাযোগ করুন।"
              : "Please try again later or contact support for assistance."}
          </p>
        </div>
      ) : (
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
                    {status === "trialing"
                      ? lang === "bn" ? "ট্রায়াল" : "Trial"
                      : subscription?.status}
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
                    plan.has_analytics
                      ? (lang === "bn" ? "অ্যানালিটিক্স ✓" : "Analytics ✓")
                      : (lang === "bn" ? "অ্যানালিটিক্স ✗" : "Analytics ✗"),
                  ].map((line) => (
                    <li key={line} className="flex items-center gap-2">
                      <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 shrink-0 text-brand-600" aria-hidden="true">
                        <path fillRule="evenodd" d="M16.7 5.3a1 1 0 0 1 0 1.4l-7 7a1 1 0 0 1-1.4 0l-3-3a1 1 0 1 1 1.4-1.4L9 11.6l6.3-6.3a1 1 0 0 1 1.4 0z" clipRule="evenodd" />
                      </svg>
                      {line}
                    </li>
                  ))}
                </ul>

                {isCurrent ? (
                  <p className="mt-4 text-center text-xs font-semibold text-brand-600">
                    {lang === "bn" ? "বর্তমান প্ল্যান" : "Current plan"}
                  </p>
                ) : (
                  <button
                    type="button"
                    className="btn-primary mt-4 w-full"
                    disabled={subscribe.isPending}
                    onClick={() => handleSubscribe(plan.id)}
                  >
                    {subscribe.isPending
                      ? t("common.loading")
                      : lang === "bn"
                        ? "সাবস্ক্রাইব করুন"
                        : "Subscribe"}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
      )}
    </section>
  );
}
