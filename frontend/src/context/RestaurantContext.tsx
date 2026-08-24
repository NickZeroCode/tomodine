import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useQuery } from "@tanstack/react-query";
import { api, setTenantSlug } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import type { Restaurant } from "@/types";

interface RestaurantContextValue {
  restaurant: Restaurant | null;
  restaurants: Restaurant[];
  isLoading: boolean;
  selectRestaurant: (slug: string) => void;
  refetch: () => void;
}

const RestaurantContext = createContext<RestaurantContextValue | null>(null);

export function RestaurantProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useAuth();
  // Initialize from localStorage so branch switching persists across reloads.
  const [selectedSlug, setSelectedSlug] = useState<string | null>(() => {
    try {
      return localStorage.getItem("tenant.slug") || null;
    } catch {
      return null;
    }
  });

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["restaurants"],
    queryFn: async () => {
      const res = await api.get("/restaurants/");
      const list = res.data;
      return (Array.isArray(list) ? list : list.results) as Restaurant[];
    },
    enabled: isAuthenticated,
  });

  const restaurants = useMemo(() => data ?? [], [data]);

  useEffect(() => {
    if (restaurants.length > 0 && !selectedSlug) {
      const slug = restaurants[0].slug;
      setSelectedSlug(slug);
      setTenantSlug(slug);
    }
  }, [restaurants, selectedSlug]);

  useEffect(() => {
    setTenantSlug(selectedSlug);
  }, [selectedSlug]);

  const restaurant =
    restaurants.find((r) => r.slug === selectedSlug) ?? null;

  const selectRestaurant = (slug: string) => {
    setSelectedSlug(slug);
    setTenantSlug(slug);
  };

  const value = useMemo(
    () => ({
      restaurant,
      restaurants,
      isLoading,
      selectRestaurant,
      refetch: () => {
        void refetch();
      },
    }),
    [restaurant, restaurants, isLoading, refetch]
  );

  return (
    <RestaurantContext.Provider value={value}>
      {children}
    </RestaurantContext.Provider>
  );
}

export function useRestaurant(): RestaurantContextValue {
  const ctx = useContext(RestaurantContext);
  if (!ctx) throw new Error("useRestaurant must be used within RestaurantProvider");
  return ctx;
}
