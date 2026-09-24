import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useRestaurant } from "@/context/RestaurantContext";
import type { Subscription } from "@/types";

/**
 * Single source of truth for the active restaurant's subscription.
 *
 * Every surface that needs subscription state (Subscription page, analytics
 * entitlement gate, plan gates) reads through this ONE queryKey so they share
 * a single cache entry. The subscribe mutation writes the fresh subscription
 * directly into the cache (setQueryData) on success — synchronously — so the
 * UI updates immediately and cannot race a throttled refetch, then invalidates
 * as a backstop so any other observers refetch in the background.
 */
export function subscriptionKey(slug: string | undefined) {
  return ["subscription", slug] as const;
}

async function fetchSubscription(): Promise<Subscription | null> {
  const res = await api.get("/subscriptions/");
  const list = res.data;
  const items = (Array.isArray(list) ? list : list.results) as Subscription[];
  return items[0] ?? null;
}

export type SubscriptionStatus = "trialing" | "active" | "past_due" | "expired" | "cancelled";

export interface SubscriptionState {
  /** Raw subscription, or null when the restaurant has none. */
  subscription: Subscription | null;
  /** True while the very first load is in flight. */
  isLoading: boolean;
  /** True when the request failed (distinct from "no subscription"). */
  isError: boolean;
  /**
   * High-level lifecycle for UI:
   *  - "none"      → no subscription row at all (show onboarding/trial CTA)
   *  - "trialing"  → in free trial, entitled
   *  - "active"    → paid & entitled
   *  - "past_due"  → payment failed; entitled until period end
   *  - "expired"   → trial/period ended; NOT entitled
   *  - "cancelled" → cancelled; entitled until period end
   */
  status: "none" | SubscriptionStatus;
  /** Convenience: premium features unlocked right now. */
  isEntitled: boolean;
  refetch: () => void;
}

export function useSubscription(): SubscriptionState {
  const { restaurant } = useRestaurant();

  const query = useQuery({
    queryKey: subscriptionKey(restaurant?.slug),
    queryFn: fetchSubscription,
    enabled: !!restaurant,
    // Shared across pages; subscription changes are rare and are written back
    // on subscribe, so a moderate staleTime avoids redundant fetches without
    // going stale after a subscribe (we setQueryData on success).
    staleTime: 60_000,
  });

  const subscription = query.data ?? null;
  const status = (subscription?.status ?? "none") as SubscriptionState["status"];

  return {
    subscription,
    isLoading: query.isLoading,
    isError: query.isError,
    status,
    isEntitled: subscription?.is_entitled ?? false,
    refetch: () => void query.refetch(),
  };
}

/** Subscribe the active restaurant to a plan and update the shared cache. */
export function useSubscribe() {
  const { restaurant } = useRestaurant();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (planId: string) => {
      const res = await api.post("/subscriptions/subscribe/", { plan_id: planId });
      return res.data as Subscription;
    },
    onSuccess: (data) => {
      // Write the fresh subscription into the shared cache synchronously so
      // every observer (this page, entitlement hook, plan gates) re-renders
      // with the new state immediately — no waiting on a refetch round-trip.
      queryClient.setQueryData(subscriptionKey(restaurant?.slug), data);
      // Backstop: invalidate so any other listeners refetch in the background.
      void queryClient.invalidateQueries({ queryKey: ["subscription"] });
    },
  });
}
