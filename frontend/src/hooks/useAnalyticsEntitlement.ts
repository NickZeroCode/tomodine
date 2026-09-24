import { useSubscription } from "@/hooks/useSubscription";

/**
 * Proactive analytics entitlement check.
 *
 * Reads the shared subscription state (see useSubscription — the single
 * source of truth, shared with SubscriptionPage via one queryKey) and
 * resolves a tri-state so analytics pages can decide BEFORE firing analytics
 * queries:
 *
 *   - "validating" → subscription still loading; show a checking state, do
 *     NOT fire analytics queries yet (avoids a guaranteed-failing request).
 *   - "locked"     → no subscription, plan has no analytics, or the
 *     subscription is no longer entitled; render the locked-tier state and
 *     skip analytics queries entirely (proactive, not reactive).
 *   - "entitled"   → analytics allowed; fire queries as normal.
 *
 * Fail-safe: if the subscription REQUEST errors (transport/server), we treat
 * the restaurant as entitled and let the backend's authoritative
 * `plan_upgrade_required` response drive the reactive PlanGate fallback — we
 * never claim "no subscription" on a transient failure. The backend
 * enforcement is unchanged and remains the source of truth; this hook only
 * avoids a known-pointless request and improves perceived UX.
 */
export type AnalyticsEntitlement = "validating" | "locked" | "entitled";

export function useAnalyticsEntitlement(): {
  state: AnalyticsEntitlement;
  planName: string | null;
} {
  const { subscription, isLoading, isError } = useSubscription();

  if (isLoading) {
    return { state: "validating", planName: null };
  }

  // Transport/server error: do NOT claim "no subscription" — stay fail-safe
  // and let the backend's authoritative plan_gate response drive PlanGate.
  if (isError) {
    return { state: "entitled", planName: null };
  }

  // An empty subscription response is a real, explainable state: this
  // restaurant has not started a plan yet. Do not fire analytics and turn
  // that state into a generic 403/error screen.
  if (!subscription) {
    return { state: "locked", planName: null };
  }

  // Not entitled (trial/period over, past due, cancelled): lock proactively
  // so we never fire queries the backend is guaranteed to refuse.
  if (!subscription.is_entitled) {
    return { state: "locked", planName: subscription.plan?.name_en ?? null };
  }

  if (!subscription.plan.has_analytics) {
    return { state: "locked", planName: subscription.plan.name_en ?? null };
  }
  return { state: "entitled", planName: subscription.plan.name_en ?? null };
}
