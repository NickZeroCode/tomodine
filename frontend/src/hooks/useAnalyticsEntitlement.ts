import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useRestaurant } from "@/context/RestaurantContext";
import type { Subscription } from "@/types";

/**
 * Proactive analytics entitlement check.
 *
 * Reads the current subscription (the SAME queryKey as SubscriptionPage, so
 * the result is served from the TanStack Query cache once either page has
 * loaded it — no extra request) and resolves a tri-state so analytics pages
 * can decide BEFORE firing analytics queries:
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
  const { restaurant } = useRestaurant();

  const query = useQuery({
    queryKey: ["subscription", restaurant?.slug],
    queryFn: async () => {
      const res = await api.get("/subscriptions/");
      const list = res.data;
      const items = (Array.isArray(list) ? list : list.results) as Subscription[];
      return items[0] ?? null;
    },
    enabled: !!restaurant,
    // Reasonable freshness — plan changes are rare; the cache is shared with
    // the subscription page so this rarely triggers a network call.
    staleTime: 60_000,
  });

  if (query.isLoading) {
    return { state: "validating", planName: null };
  }

  const subscription = query.data;
  if (subscription && subscription.is_entitled) {
    if (!subscription.plan.has_analytics) {
      return { state: "locked", planName: subscription.plan.name_en ?? null };
    }
  }
  return { state: "entitled", planName: subscription?.plan.name_en ?? null };
}
