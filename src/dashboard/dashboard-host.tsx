import { useQueries } from "@tanstack/react-query";
import { useNavigate, useParams } from "@tanstack/react-router";
import { useEffect } from "react";
import { Loader2 } from "lucide-react";
import { api } from "@/lib/api";
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

interface AuthCheck {
  authenticated: boolean;
  email?: string;
  userId?: string;
  companyId?: string;
  onboardingStep?: number;
  legacyDashboard?: boolean;
  impersonatedBy?: string | null;
}

interface SubData {
  plan: string | null;
  subscriptionStatus: string | null;
  trialEndsAt: string | null;
  aiImagesUsed?: number;
  aiImagesLimit?: number | null;
}

export function DashboardHost() {
  const navigate = useNavigate();
  const { locale } = useParams({ strict: false }) as { locale?: string };

  const auth = useQueries({
    queries: [
      { queryKey: ["auth"], queryFn: () => api<AuthCheck>("/auth/check"), staleTime: 60_000 },
    ],
  })[0];

  const authData = auth.data;

  useEffect(() => {
    if (auth.isLoading || !authData) return;
    if (!authData.authenticated) {
      navigate({ to: "/$locale/login", params: { locale: locale || "en" }, replace: true });
      return;
    }
    // The legacyDashboard flag is honoured only on /login (post-sign-in)
    // and NOT here, otherwise users who clicked "Try new dashboard" from
    // the old monolith would bounce straight back. Once they've reached
    // the new SPA we let them stay.
  }, [auth.isLoading, authData, navigate, locale]);

  const enabled = !!authData?.authenticated;

  const data = useQueries({
    queries: [
      { queryKey: ["restaurant"], queryFn: () => api<ApiRestaurant>("/restaurant"), enabled },
      { queryKey: ["categories"], queryFn: () => api<ApiCategory[]>("/categories"), enabled },
      { queryKey: ["items"], queryFn: () => api<ApiItem[]>("/items"), enabled },
      { queryKey: ["tables"], queryFn: () => api<ApiTable[]>("/tables"), enabled },
      { queryKey: ["orders"], queryFn: () => api<ApiOrder[]>("/orders"), enabled, refetchInterval: 30_000 },
      { queryKey: ["reservations"], queryFn: () => api<ApiReservation[]>("/reservations"), enabled, refetchInterval: 30_000 },
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
          impersonatedBy={authData.impersonatedBy ?? null}
        />
      </DashboardChrome>
    </DashboardSpaWrapper>
  );
}

function FullPageLoader() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
    </div>
  );
}
