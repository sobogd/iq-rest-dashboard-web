import { useQueries } from "@tanstack/react-query";
import { useParams } from "@tanstack/react-router";
import { useEffect } from "react";
import { api } from "@/lib/api";
import { FullPageLoader } from "@/components/full-page-loader";
import { landingUrl } from "@/lib/landing-url";
import { Shell } from "./_spa/shell";
import { DashboardSpaWrapper } from "./_spa/spa-wrapper";
import { DashboardChrome } from "./_v2/chrome";
import {
  apiOrderToOrder,
  apiReservationToBooking,
  apiRestaurantToRestaurant,
  apiTableToTable,
  buildCategories,
} from "./_v2/mappers";
import type {
  ApiCategory,
  ApiItem,
  ApiOrder,
  ApiReservation,
  ApiRestaurant,
  ApiTable,
} from "./_v2/api";
import { isAdminEmail } from "@/lib/admin";
import { useTheme } from "@/components/theme-provider";

interface AuthCheck {
  authenticated: boolean;
  email?: string;
  userId?: string;
  onboardingStep?: number;
  legacyDashboard?: boolean;
  isDemo?: boolean;
  // True for accounts created on/after the dark-default cutoff — the dashboard
  // defaults to dark for them (older accounts keep system-follow).
  defaultDark?: boolean;
  // Account creation time (ISO) — gates the daily trial reminder modal.
  accountCreatedAt?: string | null;
  impersonatedBy?: string | null;
}

interface SubData {
  plan: string | null;
  subscriptionStatus: string | null;
  trialEndsAt: string | null;
  aiImagesUsed?: number;
  aiImagesLimit?: number | null;
  canManageBilling?: boolean;
}

export function DashboardHost() {
  const { locale } = useParams({ strict: false }) as { locale?: string };
  const { setTheme } = useTheme();

  const auth = useQueries({
    queries: [
      { queryKey: ["auth"], queryFn: () => api<AuthCheck>("/auth/check"), staleTime: 60_000 },
    ],
  })[0];

  const authData = auth.data;

  useEffect(() => {
    if (auth.isLoading || !authData) return;
    if (!authData.authenticated) {
      window.location.assign(landingUrl(locale || "en"));
      return;
    }
    // The legacyDashboard flag is honoured only on /login (post-sign-in)
    // and NOT here, otherwise users who clicked "Try new dashboard" from
    // the old monolith would bounce straight back. Once they've reached
    // the new SPA we let them stay.
  }, [auth.isLoading, authData, locale]);

  // New accounts (created on/after the cutoff) default to dark. Only applied
  // when the user has never picked a theme — once "iq-theme" is in localStorage
  // (system/light/dark), their choice wins and we never override it.
  useEffect(() => {
    if (!authData?.authenticated || !authData.defaultDark) return;
    try {
      if (localStorage.getItem("iq-theme") === null) setTheme("dark");
    } catch {
      // ignore storage access errors
    }
  }, [authData, setTheme]);

  const enabled = !!authData?.authenticated;

  const data = useQueries({
    queries: [
      { queryKey: ["restaurant"], queryFn: () => api<ApiRestaurant>("/restaurant"), enabled },
      { queryKey: ["categories"], queryFn: () => api<ApiCategory[]>("/categories"), enabled },
      { queryKey: ["items"], queryFn: () => api<ApiItem[]>("/items"), enabled },
      { queryKey: ["tables"], queryFn: () => api<ApiTable[]>("/tables"), enabled },
      // SSE stream (use-orders-stream) is the primary source of order
      // updates; polling stays as a safety net for the rare case the stream
      // is disconnected. refetchIntervalInBackground keeps a KDS on a side
      // monitor up-to-date when the staff has the window in the background.
      {
        queryKey: ["orders"],
        // The board only renders open orders (completed/cancelled are filtered
        // out client-side and live in analytics) — fetch just those so the
        // payload doesn't grow unbounded with history.
        queryFn: () => api<ApiOrder[]>("/orders?open=1"),
        enabled,
        refetchInterval: 30_000,
        refetchIntervalInBackground: true,
        refetchOnReconnect: "always",
        refetchOnWindowFocus: "always",
      },
      {
        queryKey: ["reservations"],
        queryFn: () => api<ApiReservation[]>("/reservations"),
        enabled,
        refetchInterval: 30_000,
        refetchIntervalInBackground: true,
        refetchOnReconnect: "always",
        refetchOnWindowFocus: "always",
      },
      { queryKey: ["sub"], queryFn: () => api<SubData | null>("/restaurant/subscription").catch(() => null), enabled },
    ],
  });

  if (auth.isLoading || !authData) return <FullPageLoader />;
  if (!authData.authenticated) return <FullPageLoader />;
  if (data.some((q) => q.isLoading)) return <FullPageLoader />;

  const [restaurantQ, catsQ, itemsQ, tablesQ, ordersQ, reservationsQ, subQ] = data;
  const restaurant = restaurantQ.data;
  if (!restaurant) return <FullPageLoader />;

  const apiTables = (tablesQ.data || []) as ApiTable[];
  const tablesByNumber = new Map(apiTables.map((t) => [t.number, t.id]));

  const rawItems = (itemsQ.data || []) as (Omit<ApiItem, "price"> & { price: number | string })[];
  const items: ApiItem[] = rawItems.map((it) => ({ ...it, price: Number(it.price) }));
  const initialCategories = buildCategories(
    (catsQ.data || []) as ApiCategory[],
    items,
    restaurant.defaultLanguage || "en",
  );
  const initialOrders = ((ordersQ.data || []) as ApiOrder[]).map((o) => apiOrderToOrder(o, tablesByNumber));
  const initialBookings = ((reservationsQ.data || []) as ApiReservation[]).map(apiReservationToBooking);
  const initialTables = apiTables.map(apiTableToTable);

  const sub = subQ.data;
  const initialSub = sub
    ? {
        plan: sub.plan,
        subscriptionStatus: sub.subscriptionStatus,
        trialEndsAt: sub.trialEndsAt,
        aiImagesUsed: sub.aiImagesUsed ?? 0,
        aiImagesLimit: sub.aiImagesLimit ?? null,
        canManageBilling: sub.canManageBilling ?? true,
      }
    : null;

  const uiRestaurant = apiRestaurantToRestaurant(restaurant);

  return (
    <DashboardSpaWrapper locale={locale || "en"}>
      <DashboardChrome restaurant={uiRestaurant} sub={initialSub}>
        <Shell
          initialCategories={initialCategories}
          initialOrders={initialOrders}
          initialBookings={initialBookings}
          initialTables={initialTables}
          initialSub={initialSub}
          isAdmin={isAdminEmail(authData.email)}
          isDemo={!!authData.isDemo}
          impersonatedBy={authData.impersonatedBy ?? null}
          accountCreatedAt={authData.accountCreatedAt ?? null}
          onboardingNameDone={restaurant.onboardingNameDone ?? true}
          onboardingFillDone={restaurant.onboardingFillDone ?? true}
        />
      </DashboardChrome>
    </DashboardSpaWrapper>
  );
}

// FullPageLoader is the shared one in @/components/full-page-loader so the
// pre-Suspense fallback and the post-mount auth/data wait look identical
// (avoids the "small spinner → other small spinner" flicker on first load).
