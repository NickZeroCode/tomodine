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
 *   - "locked"     → current plan has no analytics; render the locked-tier
 *     state and skip analytics queries entirely (proactive, not reactive).
 *   - "entitled"   → analytics allowed; fire queries as normal.
 *
 * Fail-safe: if the subscription request errors or returns nothing, we treat
 * the restaurant as entitled and let the backend's authoritative
 * `plan_upgrade_required` response drive the reactive PlanGate fallback. The
 * backend enforcement is unchanged and remains the source of truth; this hook
 * only avoids a known-pointless request and improves perceived UX.
 */
export type AnalyticsEntitlement = "validating" | "locked" | "entitled";

export function useAnalyticsEntitlement(): {
  state: AnalyticsEntitlement;
  planName: string | null;
} {
  const { subscription, isLoading } = useSubscription();

  if (isLoading) {
    return { state: "validating", planName: null };
  }

  if (subscription && subscription.is_entitled) {
    if (!subscription.plan.has_analytics) {
      return { state: "locked", planName: subscription.plan.name_en ?? null };
    }
  }
  return { state: "entitled", planName: subscription?.plan.name_en ?? null };
}
