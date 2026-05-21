"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  fetchRestaurantList,
  setActiveRestaurant as apiSetActiveRestaurant,
  type ApiRestaurant,
} from "./api";
import { setActiveRestaurantId, getActiveRestaurantId } from "@/lib/active-restaurant";

interface RestaurantsContextValue {
  list: ApiRestaurant[];
  activeId: string | null;
  isPaid: boolean;
  switching: boolean;
  setActive: (id: string) => Promise<void>;
  refresh: () => Promise<void>;
}

const RestaurantsContext = createContext<RestaurantsContextValue | null>(null);

export function RestaurantsProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  const [switching, setSwitching] = useState(false);
  const [optimisticActiveId, setOptimisticActiveId] = useState<string | null>(null);

  const { data, refetch } = useQuery({
    queryKey: ["restaurants", "list"],
    queryFn: fetchRestaurantList,
    staleTime: 60_000,
  });

  // Keep client-side active id (sessionStorage/cookie) in sync with server's
  // resolved id — covers the bootstrap case where the client had nothing
  // stored and AuthGuard defaulted to primary.
  useEffect(() => {
    if (data?.activeId && getActiveRestaurantId() !== data.activeId) {
      setActiveRestaurantId(data.activeId);
    }
  }, [data?.activeId]);

  const setActive = useCallback(
    async (id: string) => {
      if (!id) return;
      setSwitching(true);
      setOptimisticActiveId(id);
      try {
        setActiveRestaurantId(id);
        await apiSetActiveRestaurant(id);
        // Drop every cached query that scopes to a restaurant — the server
        // now returns data for a different one. TanStack Query keys do not
        // embed activeId in this codebase yet; the simplest robust fix is
        // to invalidate everything except the restaurants list itself.
        await qc.invalidateQueries({
          predicate: (q) => !(Array.isArray(q.queryKey) && q.queryKey[0] === "restaurants"),
        });
        await refetch();
      } finally {
        setSwitching(false);
        setOptimisticActiveId(null);
      }
    },
    [qc, refetch],
  );

  const value = useMemo<RestaurantsContextValue>(
    () => ({
      list: data?.restaurants ?? [],
      activeId: optimisticActiveId ?? data?.activeId ?? null,
      isPaid: data?.isPaid ?? false,
      switching,
      setActive,
      refresh: async () => {
        await refetch();
      },
    }),
    [data, optimisticActiveId, switching, setActive, refetch],
  );

  return <RestaurantsContext.Provider value={value}>{children}</RestaurantsContext.Provider>;
}

export function useRestaurants(): RestaurantsContextValue {
  const ctx = useContext(RestaurantsContext);
  if (!ctx) throw new Error("useRestaurants must be used inside RestaurantsProvider");
  return ctx;
}

export function useRestaurantsOrNull(): RestaurantsContextValue | null {
  return useContext(RestaurantsContext);
}
