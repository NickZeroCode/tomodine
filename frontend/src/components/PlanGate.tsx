import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { isPlanUpgradeRequired } from "@/types";

function LockIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6">
      <rect x="5" y="10" width="14" height="10" rx="2" stroke="currentColor" strokeWidth="1.5" />
      <path d="M8 10V7a4 4 0 118 0v3" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="12" cy="15" r="1.5" fill="currentColor" />
    </svg>
  );
}

/**
 * Full-screen subscription-expired paywall. Rendered at the layout level so an
 * expired trial/subscription locks the whole dashboard, not just one feature.
 * The ONLY reachable route is /dashboard/subscription (to renew). Fail-open:
 * callers must NOT render this while subscription state is loading/errored.
 */
export function SubscriptionExpiredScreen() {
  const { t } = useTranslation();
  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-ink-50 px-4"
      role="alert"
      aria-live="assertive"
    >
      <div className="card mx-auto flex w-full max-w-md flex-col items-center gap-4 p-10 text-center">
        <span className="flex h-14 w-14 items-center justify-center rounded-full bg-brand-50 text-brand-600">
          <span className="scale-[1.35]">
            <LockIcon />
          </span>
        </span>
        <h1 className="text-xl font-semibold text-ink-900">{t("planGate.expiredTitle")}</h1>
        <p className="max-w-sm text-sm leading-relaxed text-ink-500">
          {t("planGate.expiredBody")}
        </p>
        <Link to="/dashboard/subscription" className="btn-primary mt-1 w-full">
          {t("planGate.expiredRenew")}
        </Link>
        <p className="text-xs text-ink-400">{t("planGate.expiredNote")}</p>
      </div>
    </div>
  );
}

/**
 * Proactive locked-tier state. Rendered BEFORE any analytics query fires when
 * the current plan is known to exclude analytics. Designed, not a bare alert:
 * icon, title, body, and a clear upgrade action — on the design system.
 */
export function LockedState({
  feature,
  planName,
}: {
  feature?: string;
  planName?: string | null;
}) {
  const { t } = useTranslation();
  return (
    <div className="card mx-auto flex max-w-md flex-col items-center gap-3 p-8 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-50 text-brand-600">
        <LockIcon />
      </span>
      <h2 className="text-base font-semibold text-ink-900">{t("planGate.title")}</h2>
      <p className="max-w-sm text-sm leading-relaxed text-ink-500">
        {!planName
          ? t("planGate.noSubscriptionBody", {
              defaultValue:
                "This restaurant does not have an active subscription yet — a subscription applies to all of its branches. Choose a plan to unlock analytics and reports.",
            })
          : feature
          ? t("planGate.lockedFeature", {
              feature,
              plan: planName ?? t("planGate.currentPlan"),
              defaultValue: `${feature} isn't included on your current plan${planName ? ` (${planName})` : ""}. Upgrade to unlock it.`,
            })
          : t("planGate.lockedGeneric", {
              plan: planName ?? t("planGate.currentPlan"),
              defaultValue: `This feature isn't included on your current plan${planName ? ` (${planName})` : ""}. Upgrade to unlock it.`,
            })}
      </p>
      <Link to="/dashboard/subscription" className="btn-primary mt-1">
        {t("planGate.upgrade")}
      </Link>
    </div>
  );
}

/**
 * Reactive plan-gate fallback. Rendered when an analytics request actually
 * fails with the backend's authoritative `plan_upgrade_required` error. Kept
 * for backward compatibility and as the fail-safe when the proactive check
 * couldn't determine the plan (e.g. subscription fetch failed).
 */
export function PlanGate({ error }: { error: unknown }) {
  const { t } = useTranslation();
  if (!isPlanUpgradeRequired(error)) return null;
  return (
    <div className="card mx-auto flex max-w-md flex-col items-center gap-3 p-8 text-center" role="alert">
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-50 text-brand-600">
        <LockIcon />
      </span>
      <h2 className="text-base font-semibold text-ink-900">{t("planGate.title")}</h2>
      <p className="max-w-sm text-sm leading-relaxed text-ink-500">{error.message}</p>
      <Link to="/dashboard/subscription" className="btn-primary mt-1">
        {t("planGate.upgrade")}
      </Link>
    </div>
  );
}
