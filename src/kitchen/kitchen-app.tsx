import { useCallback, useEffect, useRef, useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "sonner";
import i18n from "i18next";
import { useTranslations } from "next-intl";
import { ThemeProvider } from "@/components/theme-provider";
import { apiUrl } from "@/lib/api";
import { clearDeviceToken, getDeviceToken, setDeviceToken, getDemoLang } from "@/lib/device-mode";
import { buildKitchenDemoSnapshot } from "./demo-data";
import { PairingScreen } from "./pairing-screen";
import { KitchenShell } from "./kitchen-shell";
import { OfflineOverlay } from "./offline-overlay";
import {
  isSoundUnlocked,
  playOrderChime,
  releaseWakeLock,
  requestWakeLock,
  unlockSound,
} from "./sound";
import { SoundPrompt } from "./sound-prompt";
import { useKitchenStream, type KitchenOrderEvent } from "./use-kitchen-stream";
import { ZoomControls } from "./zoom-controls";
import { KitchenPage, type KitchenFilterState } from "@/dashboard/_v2/kitchen-page";
import { OrdersPage } from "@/dashboard/_v2/orders";
import { RestaurantProvider } from "@/dashboard/_v2/restaurant-context";
import { DashboardRouterProvider } from "@/dashboard/_spa/router";
import {
  apiOrderToOrder,
  apiTableToTable,
  apiRestaurantToRestaurant,
  buildCategories,
} from "@/dashboard/_v2/mappers";
import type {
  ApiCategory,
  ApiItem,
  ApiOrder,
  ApiRestaurant,
  ApiTable,
} from "@/dashboard/_v2/api";
import type {
  Category,
  Order,
  OrderItem,
  Restaurant,
  TableEntity,
} from "@/dashboard/_v2/types";

type DeviceType = "KITCHEN" | "WAITER";

interface BootstrapResponse {
  device: { id: string; type: DeviceType; restaurantId: string };
  restaurant: ApiRestaurant;
  categories: ApiCategory[];
  items: ApiItem[];
  tables: ApiTable[];
  orders: ApiOrder[];
}

interface KitchenSnapshot {
  deviceType: DeviceType;
  restaurant: Restaurant;
  categories: Category[];
  tables: TableEntity[];
  orders: Order[];
  tablesByNumber: Map<number, string>;
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30_000,
      refetchOnWindowFocus: false,
    },
  },
});

export function KitchenApp({ demo = false }: { demo?: boolean }) {
  return (
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        {demo ? <KitchenDemoBody /> : <KitchenAppBody />}
        <Toaster position="top-center" richColors closeButton />
      </QueryClientProvider>
    </ThemeProvider>
  );
}

// Public landing demo. No pairing, no bootstrap, no SSE/probe/wake-lock —
// just the real KitchenPage fed a hardcoded snapshot. Taps advance item
// status on local optimistic state only (KitchenPage `demoMode` skips the
// PATCH), so a reload resets the board.
function KitchenDemoBody() {
  const [snapshot] = useState(() => buildKitchenDemoSnapshot(getDemoLang() || "en"));
  const [orders, setOrders] = useState<Order[]>(snapshot.orders);

  useEffect(() => {
    const lang = getDemoLang();
    if (lang && i18n.language !== lang) void i18n.changeLanguage(lang);
  }, []);

  return (
    <KitchenShell>
      <KitchenPage
        orders={orders}
        setOrders={setOrders}
        tables={snapshot.tables}
        categories={snapshot.categories}
        defaultLang={snapshot.restaurant.defaultLang}
        filterBarExtras={<ZoomControls />}
        fullWidthFilterBar
        kioskLayout
        demoMode
      />
    </KitchenShell>
  );
}

function KitchenAppBody() {
  const t = useTranslations("dashboard.kitchen");
  // Source of truth for auth state. Null until bootstrap succeeds.
  const [token, setToken] = useState<string | null>(() => getDeviceToken());
  const [snapshot, setSnapshot] = useState<KitchenSnapshot | null>(null);
  const [bootstrapping, setBootstrapping] = useState<boolean>(!!token);
  const [error, setError] = useState<string | null>(null);
  const [soundReady, setSoundReady] = useState<boolean>(isSoundUnlocked());
  // Modal dismissal for this page load only. Resets on every reload so
  // staff sees the prompt again next time — silent auto-unlock proved
  // unreliable in Safari, and an explicit prompt is the simplest
  // contract.
  const [soundDismissed, setSoundDismissed] = useState<boolean>(false);

  // Kept current so SSE event handlers (created via useKitchenStream) can
  // read the latest state without re-binding the stream effect on every
  // re-render. The stream effect only re-binds when `token` changes.
  const snapshotRef = useRef<KitchenSnapshot | null>(null);
  snapshotRef.current = snapshot;

  // Orders with un-flushed / in-flight optimistic mutations. KitchenPage
  // populates this via onOrderPendingChange; we use it in onSseOrder to
  // skip the server's broadcast of our own write — otherwise the SSE
  // echo arrives while the staff is mid-tap-burst and rolls back the
  // still-pending second tap. Stored as a ref because it's read inside
  // the SSE handler and shouldn't trigger re-renders.
  const pendingOrderIdsRef = useRef<Set<string>>(new Set());
  const handleOrderPendingChange = useCallback((orderId: string, pending: boolean) => {
    if (pending) pendingOrderIdsRef.current.add(orderId);
    else pendingOrderIdsRef.current.delete(orderId);
  }, []);

  // Mirror of the kitchen-page filter state. Used by the chime policy so
  // a kitchen station that's narrowed its view (e.g. only the cold-pasta
  // category) doesn't get pinged for hot-pasta items it can't see.
  const filterStateRef = useRef<KitchenFilterState | null>(null);
  const handleFiltersChange = useCallback((state: KitchenFilterState) => {
    filterStateRef.current = state;
  }, []);

  const handleLogout = useCallback(() => {
    clearDeviceToken();
    setToken(null);
    setSnapshot(null);
    setError(null);
  }, []);

  const handlePaired = useCallback((nextToken: string) => {
    setDeviceToken(nextToken);
    setToken(nextToken);
    setBootstrapping(true);
  }, []);

  // Full bootstrap on (re)pair. Used both on initial token mount and as a
  // fallback when an SSE event arrives whose action we can't apply locally.
  const fetchBootstrap = useCallback(
    async (signal?: AbortSignal): Promise<BootstrapResponse | "unauthorized" | "error"> => {
      if (!token) return "error";
      try {
        const res = await fetch(apiUrl("/devices/bootstrap"), {
          headers: { Authorization: `Bearer ${token}` },
          signal,
        });
        if (res.status === 401) return "unauthorized";
        if (!res.ok) return "error";
        return (await res.json()) as BootstrapResponse;
      } catch {
        return "error";
      }
    },
    [token],
  );

  // Initial bootstrap on token change.
  useEffect(() => {
    if (!token) {
      setSnapshot(null);
      setBootstrapping(false);
      return;
    }
    const controller = new AbortController();
    setBootstrapping(true);
    setError(null);
    void (async () => {
      const result = await fetchBootstrap(controller.signal);
      if (controller.signal.aborted) return;
      if (result === "unauthorized") {
        handleLogout();
        return;
      }
      if (result === "error") {
        setError(t("failedToLoad"));
        setBootstrapping(false);
        return;
      }
      applySnapshot(result);
      setBootstrapping(false);
    })();
    return () => controller.abort();
  }, [token, fetchBootstrap, handleLogout]);

  function applySnapshot(data: BootstrapResponse) {
    const restaurant = apiRestaurantToRestaurant(data.restaurant);
    const items = data.items.map((it) => ({
      ...it,
      price: typeof it.price === "string" ? Number(it.price) : it.price,
    })) as ApiItem[];
    const categories = buildCategories(data.categories, items, restaurant.defaultLang || "en");
    const tables = data.tables.map(apiTableToTable);
    const tablesByNumber = new Map(data.tables.map((t) => [t.number, t.id]));
    const orders = data.orders.map((o) => apiOrderToOrder(o, tablesByNumber));
    setSnapshot({
      deviceType: data.device.type,
      restaurant,
      categories,
      tables,
      orders,
      tablesByNumber,
    });
    // Switch UI language to restaurant's default once we know it. i18next
    // lazy-loads the locale chunk on first changeLanguage; subsequent
    // identical calls are no-ops.
    if (restaurant.defaultLang && i18n.language !== restaurant.defaultLang) {
      void i18n.changeLanguage(restaurant.defaultLang);
    }
  }

  // Wake lock — keep the screen alive while the kiosk is logged in.
  useEffect(() => {
    if (!token) return;
    void requestWakeLock();
    return () => {
      void releaseWakeLock();
    };
  }, [token]);

  // Active reachability probe. SSE alone can lie — the EventSource can
  // sit in OPEN long after Wi-Fi died because the browser doesn't
  // proactively detect dead TCP. So we poll /devices/me every 7s with a
  // tight timeout. Side effects:
  //   - Doubles as a server-side lastSeenAt heartbeat (the admin "online"
  //     dot stays fresh even during idle kitchen periods).
  //   - On a 401, the token has been revoked → force logout.
  //   - On any other failure (network, 5xx, timeout) flip `probeFailed`
  //     so the offline overlay shows immediately, without waiting for the
  //     20s SSE watchdog.
  const [probeFailed, setProbeFailed] = useState(false);
  useEffect(() => {
    if (!token) {
      setProbeFailed(false);
      return;
    }
    let cancelled = false;
    let consecutiveFailures = 0;
    const probe = async () => {
      if (cancelled) return;
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 4_000);
      try {
        const res = await fetch(apiUrl("/devices/me"), {
          headers: { Authorization: `Bearer ${token}` },
          signal: controller.signal,
        });
        clearTimeout(timeout);
        if (res.status === 401) {
          handleLogout();
          return;
        }
        if (!res.ok) {
          consecutiveFailures++;
        } else {
          consecutiveFailures = 0;
          if (!cancelled) setProbeFailed(false);
        }
      } catch {
        clearTimeout(timeout);
        consecutiveFailures++;
      }
      // Two-failure threshold absorbs single-probe flakes (a packet drop
      // during the 4s window) while still flagging real outages quickly.
      if (consecutiveFailures >= 2 && !cancelled) {
        setProbeFailed(true);
      }
    };
    void probe();
    const id = setInterval(probe, 7_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [token, handleLogout]);

  // SSE event → incremental cache patch. The full-bootstrap fallback runs
  // only when the event payload is incomplete (server omitted `order`
  // because the NOTIFY payload exceeded Postgres' 8000-char limit).
  const onSseOrder = useCallback(
    (event: KitchenOrderEvent) => {
      const snap = snapshotRef.current;
      if (!snap) return;

      if (event.action === "deleted") {
        if (!event.orderId) return;
        setSnapshot((cur) =>
          cur ? { ...cur, orders: cur.orders.filter((o) => o.id !== event.orderId) } : cur,
        );
        return;
      }

      const incoming = collectIncoming(event);
      if (incoming.length === 0) {
        // Slim payload — full `order` body was stripped because the
        // pg_notify size limit kicked in. Re-fetch the snapshot for
        // state, but use the lightweight itemSummary (if shipped) to
        // run the chime predicate now so the kiosk doesn't go silent
        // for orders whose full body would have overflowed.
        if (
          event.itemSummary &&
          event.orderId &&
          snap.deviceType === "KITCHEN" &&
          soundReady &&
          !pendingOrderIdsRef.current.has(event.orderId)
        ) {
          if (slimSummaryPassesFilter(snap.orders, event.orderId, event.itemSummary, filterStateRef.current)) {
            playOrderChime();
          }
        }
        void fetchBootstrap().then((res) => {
          if (res === "unauthorized") handleLogout();
          else if (res !== "error") applySnapshot(res);
        });
        return;
      }

      const mapped = incoming
        .map((raw) => apiOrderToOrder(raw, snap.tablesByNumber))
        // Skip echoes of orders we still have local pending writes for.
        // The SSE broadcast from our own PATCH would otherwise replace
        // the optimistic state mid-tap-burst — staff sees an item snap
        // back to its server status, lose the most recent tap.
        .filter((m) => !pendingOrderIdsRef.current.has(m.id));
      const prevOrdersById = new Map(snap.orders.map((o) => [o.id, o]));

      if (mapped.length === 0) return;

      setSnapshot((cur) => {
        if (!cur) return cur;
        const byId = new Map(cur.orders.map((o) => [o.id, o]));
        for (const m of mapped) byId.set(m.id, m);
        return { ...cur, orders: [...byId.values()] };
      });

      // Sound policy. Chime decisions are based on the device type AND the
      // shape of the transition; firing happens after state update so we
      // can diff against the previous snapshot's items.
      if (!soundReady) return;
      if (snap.deviceType === "KITCHEN") {
        // Cooks care about anything new landing on the pass — a brand-new
        // order, or a single dessert appended to an existing check. The
        // industry convention (Square/Toast/Lightspeed) is one chime per
        // "new item hits kitchen". When the station has narrowed its
        // view via the filter bar (e.g. only their own category), we
        // respect that — chime only when at least one new item also
        // passes the active filter. Empty filters = chime on anything
        // new.
        const fires = didAnyNewItemPassFilter(
          prevOrdersById,
          mapped,
          filterStateRef.current,
        );
        // eslint-disable-next-line no-console
        console.debug("[k] chime", {
          action: event.action,
          fires,
          filter: filterStateRef.current
            ? {
                statuses: filterStateRef.current.statuses,
                categoryIds: filterStateRef.current.categoryIds,
                dishToCatSize: Object.keys(filterStateRef.current.dishToCategory).length,
              }
            : null,
          incomingIds: mapped.map((o) => ({
            orderId: o.id,
            items: o.items.map((it) => ({ id: it.id, dishId: it.dishId, status: it.status })),
          })),
        });
        if (fires) playOrderChime();
        return;
      }
      if (snap.deviceType === "WAITER") {
        // Waiters care about items transitioning to "ready" — that's when
        // food needs to be picked up from the pass. Created orders alone
        // don't matter (kitchen has to cook first).
        if (didAnyItemBecomeReady(prevOrdersById, mapped)) playOrderChime();
      }
    },
    [fetchBootstrap, handleLogout, soundReady],
  );

  const { state: streamState, reconnect } = useKitchenStream({
    token,
    onOrder: onSseOrder,
    onRevoked: handleLogout,
    onForceReload: () => {
      // Admin pressed "Reload all tablets" — usually right after deploying
      // a hotfix. Tear down the cached shell so the SW doesn't serve the
      // stale index.html on the way back in, then hard-reload to pull the
      // new bundle.
      void (async () => {
        try {
          if ("caches" in window) {
            const keys = await caches.keys();
            await Promise.all(keys.map((k) => caches.delete(k)));
          }
          if ("serviceWorker" in navigator) {
            const regs = await navigator.serviceWorker.getRegistrations();
            await Promise.all(regs.map((r) => r.update().catch(() => undefined)));
          }
        } catch {
          // best-effort — fall through to reload regardless
        }
        window.location.reload();
      })();
    },
  });

  if (!token) {
    return <PairingScreen onPaired={handlePaired} />;
  }

  if (bootstrapping && !snapshot) {
    return (
      <div className="min-h-dvh bg-background flex items-center justify-center text-sm text-muted-foreground">
        {t("loading")}
      </div>
    );
  }

  if (!snapshot) {
    return (
      <div className="min-h-dvh bg-background flex items-center justify-center px-6 text-center">
        <div>
          <div className="text-sm text-muted-foreground mb-3">{error || t("loading")}</div>
          <button
            type="button"
            onClick={() => {
              setBootstrapping(true);
              setError(null);
              void fetchBootstrap().then((res) => {
                if (res === "unauthorized") handleLogout();
                else if (res !== "error") applySnapshot(res);
                else setError(t("failedToLoad"));
                setBootstrapping(false);
              });
            }}
            className="h-10 px-4 text-sm font-medium text-primary-foreground bg-primary-gradient rounded-lg"
          >
            {t("retry")}
          </button>
        </div>
      </div>
    );
  }

  const updateOrders = (updater: React.SetStateAction<Order[]>) => {
    setSnapshot((cur) =>
      cur
        ? {
            ...cur,
            orders:
              typeof updater === "function"
                ? (updater as (prev: Order[]) => Order[])(cur.orders)
                : updater,
          }
        : cur,
    );
  };

  return (
    <>
      <KitchenShell>
        {snapshot.deviceType === "WAITER" ? (
          // Waiter kiosk reuses the admin OrdersPage verbatim — its own
          // internal navigation between table list / order detail / item
          // wizard rides on the dashboard SPA router, which we provide
          // here scoped to this single tab. RestaurantProvider satisfies
          // OrdersPage's useRestaurant() call.
          <RestaurantProvider restaurant={snapshot.restaurant}>
            <DashboardRouterProvider initialPath="/dashboard/orders" locale="en">
              <OrdersPage
                orders={snapshot.orders}
                setOrders={updateOrders}
                tables={snapshot.tables}
                categories={snapshot.categories}
                defaultLang={snapshot.restaurant.defaultLang}
                currency={snapshot.restaurant.currency}
                kioskLayout
              />
            </DashboardRouterProvider>
          </RestaurantProvider>
        ) : (
          <KitchenPage
            orders={snapshot.orders}
            setOrders={updateOrders}
            tables={snapshot.tables}
            categories={snapshot.categories}
            defaultLang={snapshot.restaurant.defaultLang}
            onItemAdvanced={(_prev, next) => {
              // Local-tap chime: kitchen station already knows what it
              // just tapped. Sound only fires from SSE-driven changes.
              void _prev;
              void next;
            }}
            onOrderPendingChange={handleOrderPendingChange}
            filterBarExtras={<ZoomControls />}
            fullWidthFilterBar
            kioskLayout
            onFiltersChange={handleFiltersChange}
          />
        )}
      </KitchenShell>
      <OfflineOverlay
        streamState={streamState}
        onReconnect={() => {
          setProbeFailed(false);
          reconnect();
        }}
        forceOffline={probeFailed}
      />
      <SoundPrompt
        open={!soundReady && !soundDismissed}
        onEnable={async () => {
          await unlockSound();
          const ok = isSoundUnlocked();
          setSoundReady(ok);
          if (ok) {
            // Audible confirmation that the toggle worked. Without this the
            // staff has to wait for an actual new order to know if sound
            // really came on.
            playOrderChime();
          }
          setSoundDismissed(true);
        }}
        onDismiss={() => setSoundDismissed(true)}
      />
    </>
  );
}

function collectIncoming(event: KitchenOrderEvent): ApiOrder[] {
  const out: ApiOrder[] = [];
  if (event.order && typeof event.order === "object") out.push(event.order as ApiOrder);
  if (event.createdOrder && typeof event.createdOrder === "object") {
    out.push(event.createdOrder as ApiOrder);
  }
  return out;
}

// True when an incoming order contains any item id that the previous
// snapshot's version of the order didn't have AND that item passes the
// current kitchen filter (status + category). Filter null/empty means
// "no filter" — every new item passes. Covers both "brand new order
// just appeared" (prev=null, every item counts as new) and "dessert
// added to an existing tab" (prev exists, only new ids count).
//
// Unknown category lookup (dishToCat[dishId] === undefined) is treated
// as a match: better to chime a false positive than swallow a real one
// because the kitchen's cached menu happens to be a few seconds behind
// a freshly-created dish.
// Same predicate as didAnyNewItemPassFilter but works on a slim itemSummary
// payload — used when pg_notify stripped the full order body so the
// kitchen-app still has to decide whether to chime.
function slimSummaryPassesFilter(
  prevOrders: Order[],
  orderId: string,
  summary: { id: string; dishId: string; status: string }[],
  filter: KitchenFilterState | null,
): boolean {
  const statuses = filter?.statuses ?? [];
  const categoryIds = filter?.categoryIds ?? [];
  const dishToCat = filter?.dishToCategory ?? {};
  const prev = prevOrders.find((o) => o.id === orderId);
  const prevIds = prev ? new Set(prev.items.map((it) => it.id)) : null;
  for (const it of summary) {
    if (prevIds && prevIds.has(it.id)) continue;
    if (statuses.length > 0 && !statuses.includes(it.status as never)) continue;
    if (categoryIds.length > 0) {
      const cat = dishToCat[it.dishId];
      if (cat !== undefined && !categoryIds.includes(cat)) continue;
    }
    return true;
  }
  return false;
}

function didAnyNewItemPassFilter(
  prevOrdersById: Map<string, Order>,
  incoming: Order[],
  filter: KitchenFilterState | null,
): boolean {
  const statuses = filter?.statuses ?? [];
  const categoryIds = filter?.categoryIds ?? [];
  const dishToCat = filter?.dishToCategory ?? {};
  for (const order of incoming) {
    const prev = prevOrdersById.get(order.id);
    const prevIds = prev ? new Set(prev.items.map((it) => it.id)) : null;
    for (const it of order.items) {
      if (prevIds && prevIds.has(it.id)) continue;
      if (statuses.length > 0 && !statuses.includes(it.status)) continue;
      if (categoryIds.length > 0) {
        const cat = dishToCat[it.dishId];
        // No category mapping yet → match (avoid silently missing the
        // chime). Otherwise require explicit membership.
        if (cat !== undefined && !categoryIds.includes(cat)) continue;
      }
      return true;
    }
  }
  return false;
}

function didAnyItemBecomeReady(
  prevOrdersById: Map<string, Order>,
  incoming: Order[],
): boolean {
  for (const order of incoming) {
    const prev = prevOrdersById.get(order.id);
    const prevReady = new Set<string>();
    if (prev) {
      for (const it of prev.items) {
        if (it.status === "ready") prevReady.add(it.id);
      }
    }
    for (const it of order.items as OrderItem[]) {
      if (it.status === "ready" && !prevReady.has(it.id)) {
        return true;
      }
    }
  }
  return false;
}
