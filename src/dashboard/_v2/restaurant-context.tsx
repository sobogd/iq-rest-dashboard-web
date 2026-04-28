"use client";

import { createContext, useContext, ReactNode } from "react";
import type { Restaurant } from "./types";

const RestaurantContext = createContext<Restaurant | null>(null);

export function RestaurantProvider({
 restaurant,
 children,
}: {
 restaurant: Restaurant;
 children: ReactNode;
}) {
 return (
 <RestaurantContext.Provider value={restaurant}>
 {children}
 </RestaurantContext.Provider>
 );
}

export function useRestaurant(): Restaurant {
 const ctx = useContext(RestaurantContext);
 if (!ctx) throw new Error("useRestaurant must be used inside RestaurantProvider");
 return ctx;
}

export function useRestaurantOrNull(): Restaurant | null {
 return useContext(RestaurantContext);
}
