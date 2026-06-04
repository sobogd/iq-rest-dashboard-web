"use client";

// Standalone Kitchen-tab view. Lives in its own module so the kitchen.*
// subdomain bundle can import this without pulling OrdersPage's order-
// creation wizard / table-change modal / split modal in alongside.
//
// Reused by:
//   - admin dashboard Shell (Kitchen tab)
//   - kitchen.* kiosk bundle (standalone planshet UI)
//
// Mutation surface: `patchOrder` from _v2/api. In kitchen-host mode the
// shared apiFetch wrapper rewrites that to `/api/devices/orders/:id`
// transparently — this file doesn't care which credential it runs under.

import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { showApiError } from "@/lib/show-api-error";
import { EmptyState } from "./ui";
import { formatElapsedHMS } from "./helpers";
import { getMlWithFallback } from "./i18n";
import { patchOrder } from "./api";
import { useFlip } from "./use-flip";
import type {
  Category,
  Order,
  OrderItem,
  OrderItemStatus,
  TableEntity,
} from "./types";
import {
  ITEM_STATUS_KEYS,
  STATUS_DOT_CLS,
  STATUS_TEXT_CLS,
  calcOrderTotal,
} from "./orders-shared";

interface KitchenPageProps {
  orders: Order[];
  setOrders: React.Dispatch<React.SetStateAction<Order[]>>;
  tables: TableEntity[];
  categories: Category[];
  defaultLang: string;
  // Fired AFTER a local tap advances an item to a new status. Used by the
  // kitchen.* kiosk to chime on waiter-targeted transitions (→ ready).
  // Admin host doesn't need it.
  onItemAdvanced?: (prev: OrderItemStatus, next: OrderItemStatus) => void;
  // Lifts pending-mutation tracking up to the outer kiosk shell so it can
  // suppress SSE echoes of our own writes (otherwise the server's own
  // /api/orders/stream broadcast races our next optimistic tap and rolls
  // it back). When `pending=true` the outer layer should ignore any SSE
  // updates for `orderId`; when `pending=false` it can resume applying.
  onOrderPendingChange?: (orderId: string, pending: boolean) => void;
  // Extra controls rendered to the right of the filter buttons in the
  // sticky sub-header. The kitchen kiosk uses this for zoom +/- buttons;
  // admin host passes nothing.
  filterBarExtras?: React.ReactNode;
  // Drops the max-w-5xl container on the sticky filter bar. Kitchen
  // kiosk uses full viewport width to fit more table cards per row;
  // admin host keeps the constrained width for visual consistency
  // with the rest of the dashboard.
  fullWidthFilterBar?: boolean;
  // Kiosk layout: switches to kanban-style rendering — the page itself
  // never scrolls vertically, each table card scrolls internally. Filter
  // bar becomes inline (not sticky) at the top of the column so the
  // notch backplate sits flush behind it. Admin host (false) keeps the
  // document-scroll layout the rest of the dashboard uses.
  kioskLayout?: boolean;
  // Pushes the current filter state up to the kiosk shell so it can
  // decide whether an incoming SSE item deserves a chime. Empty arrays
  // mean "no filter" — every item passes.
  onFiltersChange?: (state: KitchenFilterState) => void;
  // Public landing demo: keep the optimistic tap UX but never call the API
  // (there's no device token). Taps advance status on local state only.
  demoMode?: boolean;
}

export interface KitchenFilterState {
  statuses: OrderItemStatus[];
  categoryIds: string[];
  // dishId → categoryId so the chime predicate can resolve an item's
  // category without re-walking the categories tree on every SSE event.
  dishToCategory: Record<string, string>;
}

const KITCHEN_NEXT: Record<OrderItemStatus, OrderItemStatus> = {
  pending: "cooking",
  cooking: "ready",
  ready: "served",
  served: "pending",
};

export function KitchenPage({
  orders,
  setOrders,
  tables,
  categories,
  defaultLang,
  onItemAdvanced,
  onOrderPendingChange,
  filterBarExtras,
  fullWidthFilterBar,
  kioskLayout,
  onFiltersChange,
  demoMode,
}: KitchenPageProps) {
  const t = useTranslations("dashboard.orders");
  const [, setTick] = useState(0);
  const [statusFilter, setStatusFilter] = useState<OrderItemStatus[]>([]);
  const [categoryFilter, setCategoryFilter] = useState<string[]>([]);

  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, []);

  // Synchronously-tracked mirror of `orders` so rapid taps can read the very
  // latest optimistic state without waiting for React to flush the previous
  // render.
  const ordersRef = useRef<Order[]>(orders);
  useEffect(() => {
    ordersRef.current = orders;
  }, [orders]);

  // Per-order PATCH debounce. We also stash the pre-tap items snapshot so
  // a failed PATCH can roll the UI back — without it the optimistic state
  // sticks forever after a server reject (token revoked, network blip,
  // 500, etc.) and the staff thinks an item is "ready" while the server
  // still has it "pending".
  interface Pending {
    timer: ReturnType<typeof setTimeout>;
    snapshotItems: OrderItem[];
  }
  const pendingPatch = useRef<Map<string, Pending>>(new Map());

  function rollbackOrder(orderId: string, items: OrderItem[]) {
    const cur = ordersRef.current.find((o) => o.id === orderId);
    if (!cur) return;
    const restored: Order = { ...cur, items };
    ordersRef.current = ordersRef.current.map((o) => (o.id === orderId ? restored : o));
    setOrders((all) => all.map((o) => (o.id === orderId ? restored : o)));
  }

  function advanceItemStatus(orderId: string, itemId: string) {
    const order = ordersRef.current.find((o) => o.id === orderId);
    if (!order) return;
    let prevStatus: OrderItemStatus | null = null;
    let nextStatus: OrderItemStatus | null = null;
    // Capture pre-optimistic items once per debounce window so rollback
    // restores the staff to where they were before this burst of taps,
    // not to the intermediate state mid-burst.
    const existing = pendingPatch.current.get(orderId);
    const snapshotItems = existing ? existing.snapshotItems : order.items;
    const items = order.items.map((it) => {
      if (it.id !== itemId) return it;
      prevStatus = it.status;
      nextStatus = KITCHEN_NEXT[it.status];
      return { ...it, status: nextStatus };
    });
    const updated: Order = { ...order, items };
    ordersRef.current = ordersRef.current.map((o) => (o.id === orderId ? updated : o));
    setOrders((all) => all.map((o) => (o.id === orderId ? updated : o)));
    schedulePatch(orderId, snapshotItems);
    if (prevStatus && nextStatus && onItemAdvanced) {
      onItemAdvanced(prevStatus, nextStatus);
    }
  }

  function schedulePatch(orderId: string, snapshotItems: OrderItem[]) {
    // Demo mode: optimistic state is the whole story — there's no device
    // token to PATCH against. Skip the network round-trip entirely.
    if (demoMode) return;
    const prev = pendingPatch.current.get(orderId);
    if (prev) {
      clearTimeout(prev.timer);
    } else {
      // First scheduled patch in this debounce window — start treating
      // this order as "locally owned" so the outer shell stops applying
      // SSE echoes of our own writes back over the optimistic state.
      onOrderPendingChange?.(orderId, true);
    }
    const release = () => {
      // Only release if no new tap has queued another debounce window
      // during the PATCH inflight. Otherwise the second window's own
      // resolve will release later.
      if (!pendingPatch.current.has(orderId)) {
        onOrderPendingChange?.(orderId, false);
      }
    };
    const timer = setTimeout(() => {
      pendingPatch.current.delete(orderId);
      const snapshot = ordersRef.current.find((o) => o.id === orderId);
      if (!snapshot) {
        release();
        return;
      }
      patchOrder(orderId, {
        items: snapshot.items,
        total: calcOrderTotal(snapshot),
      })
        .then(release)
        .catch((err) => {
          rollbackOrder(orderId, snapshotItems);
          showApiError(err, "kitchenItemStatus");
          release();
        });
    }, 300);
    pendingPatch.current.set(orderId, { timer, snapshotItems });
  }

  useEffect(() => {
    return () => {
      for (const p of pendingPatch.current.values()) clearTimeout(p.timer);
      pendingPatch.current.clear();
    };
  }, []);

  const dishToCategory = useMemo(() => {
    const map: Record<string, string> = {};
    categories.forEach((cat) => {
      cat.dishes.forEach((d) => {
        map[d.id] = cat.id;
      });
    });
    return map;
  }, [categories]);

  // Surface filter state to the kiosk shell so it can decide whether an
  // incoming SSE item is in-scope for a chime.
  useEffect(() => {
    onFiltersChange?.({
      statuses: statusFilter,
      categoryIds: categoryFilter,
      dishToCategory,
    });
  }, [statusFilter, categoryFilter, dishToCategory, onFiltersChange]);

  function filterItems(items: OrderItem[]): OrderItem[] {
    return items.filter((it) => {
      if (statusFilter.length > 0 && !statusFilter.includes(it.status)) return false;
      if (categoryFilter.length > 0 && !categoryFilter.includes(dishToCategory[it.dishId])) return false;
      return true;
    });
  }

  // One column per ORDER (not per table). A table with two open orders shows
  // as two separate columns, both tinted with the same table colour.
  type OrderColumn = {
    orderId: string;
    dailyNumber: number;
    tableId: string | null;
    tableNumber: number | string | null;
    items: OrderItem[];
    createdAt: string;
  };
  const columns: OrderColumn[] = [];
  for (const o of orders) {
    if (o.status !== "active") continue;
    const its = filterItems(o.items);
    if (its.length === 0) continue;
    columns.push({
      orderId: o.id,
      dailyNumber: o.dailyNumber,
      tableId: o.tableId ?? null,
      tableNumber: o.tableNumber ?? null,
      items: its,
      createdAt: o.createdAt,
    });
  }
  const visibleGroups = columns.sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
  );

  const STATUS_FILTERS: {
    id: OrderItemStatus;
    labelKey: "statusPending" | "statusCooking" | "statusReady" | "statusServed";
  }[] = [
    { id: "pending", labelKey: "statusPending" },
    { id: "cooking", labelKey: "statusCooking" },
    { id: "ready", labelKey: "statusReady" },
    { id: "served", labelKey: "statusServed" },
  ];

  const filterBtnBase =
    "shrink-0 inline-flex items-center gap-1.5 h-8 px-2.5 rounded-md text-xs font-medium transition-colors";
  const filterBtnOn = "bg-foreground text-background";
  const filterBtnOff = "bg-secondary text-muted-foreground hover:text-foreground";

  return (
    <div className={kioskLayout ? "h-full flex flex-col min-h-0" : undefined}>
      <div
        className={
          (kioskLayout
            ? "shrink-0 bg-subheader/90 backdrop-blur-md border-b border-border md:border-border/60"
            : "sticky z-10 -mx-4 md:-mx-6 -mt-5 md:-mt-4 bg-subheader/90 backdrop-blur-md border-b border-border md:border-border/60")
        }
        style={kioskLayout ? undefined : { top: "var(--topbar-h, 0px)" }}
      >
        <div
          className={
            (fullWidthFilterBar ? "" : "max-w-5xl mx-auto md:px-6 ") +
            "flex items-center gap-2 px-4 py-2"
          }
        >
          <div className="flex items-center gap-2 flex-nowrap overflow-x-auto min-w-0 flex-1">
          {STATUS_FILTERS.map((s) => {
            const on = statusFilter.includes(s.id);
            return (
              <button
                key={s.id}
                type="button"
                onClick={() =>
                  setStatusFilter((cur) =>
                    cur.includes(s.id) ? cur.filter((x) => x !== s.id) : [...cur, s.id],
                  )
                }
                className={filterBtnBase + " " + (on ? filterBtnOn : filterBtnOff)}
              >
                <span className={"w-1.5 h-1.5 rounded-full shrink-0 " + STATUS_DOT_CLS[s.id]} aria-hidden />
                {t(s.labelKey)}
              </button>
            );
          })}
          {categories.length > 0 ? (
            <>
              <span className="w-px h-5 bg-border shrink-0 mx-0.5" aria-hidden />
              {categories.map((c) => {
                const on = categoryFilter.includes(c.id);
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() =>
                      setCategoryFilter((cur) =>
                        cur.includes(c.id) ? cur.filter((x) => x !== c.id) : [...cur, c.id],
                      )
                    }
                    className={filterBtnBase + " " + (on ? filterBtnOn : filterBtnOff)}
                  >
                    {getMlWithFallback(c.name, defaultLang, defaultLang)}
                  </button>
                );
              })}
            </>
          ) : null}
          {/* Phone: zoom rides inside the scrolling chip row. */}
          {filterBarExtras ? <div className="md:hidden shrink-0 flex items-center gap-1.5">{filterBarExtras}</div> : null}
          </div>
          {/* Tablet/desktop: zoom pinned to the right, outside the scroll. */}
          {filterBarExtras ? <div className="hidden md:flex shrink-0 items-center gap-1.5 pl-2">{filterBarExtras}</div> : null}
        </div>
      </div>

      {visibleGroups.length === 0 ? (
        <div className={kioskLayout ? "flex-1 min-h-0 flex items-center justify-center" : "max-w-5xl mx-auto md:px-6 pt-7 md:pt-6"}>
          <EmptyState title={t("kitchenClear")} subtitle={t("kitchenClearSub")} />
        </div>
      ) : kioskLayout ? (
        <div className="flex-1 min-h-0 overflow-x-auto pb-1 px-4 md:px-6 mt-3">
          <div className="flex items-start gap-3 h-full" style={{ width: "max-content" }}>
            {visibleGroups.map((g) => (
              <KitchenOrderCard
                key={g.orderId}
                orderId={g.orderId}
                dailyNumber={g.dailyNumber}
                items={g.items}
                table={g.tableId ? tables.find((t) => t.id === g.tableId) || null : null}
                tableNumberFallback={g.tableNumber}
                createdAt={g.createdAt}
                defaultLang={defaultLang}
                onItemAdvance={advanceItemStatus}
                fullHeight
              />
            ))}
          </div>
        </div>
      ) : (
        <div className="-mx-4 md:-mx-6 mt-4 md:mt-3">
          <div className="overflow-x-auto pb-1 px-4 md:px-6">
            <div className="flex items-start gap-3" style={{ width: "max-content" }}>
              {visibleGroups.map((g) => (
                <KitchenOrderCard
                  key={g.orderId}
                  orderId={g.orderId}
                  dailyNumber={g.dailyNumber}
                  items={g.items}
                  table={g.tableId ? tables.find((t) => t.id === g.tableId) || null : null}
                  tableNumberFallback={g.tableNumber}
                  createdAt={g.createdAt}
                  defaultLang={defaultLang}
                  onItemAdvance={advanceItemStatus}
                />
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function KitchenOrderCard({
  orderId,
  dailyNumber,
  items,
  table,
  tableNumberFallback,
  createdAt,
  defaultLang,
  onItemAdvance,
  fullHeight,
}: {
  orderId: string;
  dailyNumber: number;
  items: OrderItem[];
  table: TableEntity | null;
  tableNumberFallback: number | string | null;
  createdAt: string;
  defaultLang: string;
  onItemAdvance: (orderId: string, itemId: string) => void;
  fullHeight?: boolean;
}) {
  const t = useTranslations("dashboard.orders");
  const tableNumber = table ? table.number : tableNumberFallback ?? "?";

  // Order-level status = the least-advanced item (so the chip shows the stage
  // the whole order is still waiting on). Drives the dot + label next to the
  // table number.
  const orderStatus = items.reduce<OrderItemStatus>(
    (acc, it) => (STATUS_PRIORITY[it.status] < STATUS_PRIORITY[acc] ? it.status : acc),
    items[0]?.status ?? "pending",
  );

  // Column header chip tinted with the table's admin colour, semi-transparent
  // so the hue reads clearly while white text stays legible (text-shadow
  // guards against light colours). No colour → neutral card chip. There's no
  // outer card box around the column anymore; the cards stand free in a
  // column, the chip is the only chrome identifying the order/table.
  // Header reads as a plain column TITLE — no card box, no rule.
  const headerCls = "shrink-0 px-1 mb-3";

  // Served items sink to the bottom; within a status group keep oldest-first.
  const sorted = [...items].sort((a, b) => {
    const sa = a.status === "served" ? 1 : 0;
    const sb = b.status === "served" ? 1 : 0;
    if (sa !== sb) return sa - sb;
    return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
  });
  // FLIP: animate cards sliding to their new slot when the sort order changes
  // (e.g. an item tapped to "served" glides down to the bottom). Re-runs
  // whenever the ordered id+status signature changes.
  const flipRef = useFlip<HTMLDivElement>([sorted.map((i) => i.id + i.status).join(",")]);

  return (
    <div className={"w-72 shrink-0 flex flex-col" + (fullHeight ? " max-h-full" : "")}>
      <div className={headerCls}>
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="text-base font-semibold leading-tight">
              {t("orderLabel", { number: dailyNumber })}
            </div>
            <div className="flex items-center gap-1.5 text-xs mt-1.5 text-muted-foreground">
              <span className="inline-flex items-center gap-1 shrink-0">
                <span className={"w-1.5 h-1.5 rounded-full shrink-0 " + STATUS_DOT_CLS[orderStatus]} aria-hidden />
                <span className={"font-medium " + STATUS_TEXT_CLS[orderStatus]}>
                  {t(ITEM_STATUS_KEYS[orderStatus] || ITEM_STATUS_KEYS.pending)}
                </span>
              </span>
              <span aria-hidden className="shrink-0">·</span>
              <span className="truncate">
                <span style={table?.color ? { color: table.color } : undefined}>
                  {t("tableLabel", { number: tableNumber })}
                </span>
                {table?.name ? " · " + table.name : ""}
              </span>
            </div>
          </div>
          <div className="text-xs font-medium tabular-nums shrink-0 mt-0.5 text-muted-foreground">
            {formatElapsedHMS(createdAt)}
          </div>
        </div>
      </div>

      <div
        ref={flipRef}
        className={
          "flex flex-col gap-2 " +
          (fullHeight ? "flex-1 min-h-0 overflow-y-auto pb-1" : "flex-1")
        }
      >
        {sorted.map((item) => (
          <KitchenItem
            key={`${orderId}:${item.id}`}
            item={item}
            defaultLang={defaultLang}
            onAdvance={() => onItemAdvance(orderId, item.id)}
          />
        ))}
      </div>
    </div>
  );
}

// Ordering of item statuses by kitchen stage — used to derive the order-level
// status (the least-advanced item).
const STATUS_PRIORITY: Record<OrderItemStatus, number> = {
  pending: 0,
  cooking: 1,
  ready: 2,
  served: 3,
};

// Per-status left accent on each dish card, matching the dot/text palette.
const STATUS_ACCENT_CLS: Record<OrderItemStatus, string> = {
  pending: "border-l-slate-700 dark:border-l-slate-400",
  cooking: "border-l-amber-500 dark:border-l-amber-400",
  ready: "border-l-blue-600 dark:border-l-blue-500",
  served: "border-l-emerald-600 dark:border-l-emerald-500",
};

function KitchenItem({
  item,
  defaultLang,
  onAdvance,
}: {
  item: OrderItem;
  defaultLang: string;
  onAdvance: () => void;
}) {
  const t = useTranslations("dashboard.orders");
  const statusKey = ITEM_STATUS_KEYS[item.status] || ITEM_STATUS_KEYS.pending;
  const isServed = item.status === "served";
  return (
    <button
      type="button"
      data-flip-id={item.id}
      onClick={onAdvance}
      className={
        "w-full text-left rounded-lg border border-border border-l-4 bg-card px-3 py-2.5 shadow-sm " +
        "transition-[opacity,box-shadow] hover:shadow-md active:scale-[0.99] " +
        STATUS_ACCENT_CLS[item.status] +
        (isServed ? " opacity-55" : "")
      }
    >
      <div className="flex items-center justify-between gap-2">
        {/* key=status remounts on every transition so the badge re-runs the
            slide-in — only the status animates, the card stays put. */}
        <div
          key={item.status}
          className="flex items-center gap-1.5 animate-in fade-in slide-in-from-left-4 duration-300"
        >
          <span
            className={"shrink-0 w-2 h-2 rounded-full " + STATUS_DOT_CLS[item.status]}
            aria-hidden="true"
          />
          <span
            className={
              "text-[11px] font-medium uppercase tracking-wide " + STATUS_TEXT_CLS[item.status]
            }
          >
            {t(statusKey)}
          </span>
        </div>
        {!isServed ? (
          <span className="text-[11px] font-medium text-muted-foreground tabular-nums">
            {formatElapsedHMS(item.createdAt)}
          </span>
        ) : null}
      </div>
      <div className="text-sm font-medium text-foreground leading-6 mt-2 truncate">
        {getMlWithFallback(item.dishNameSnapshot, defaultLang, defaultLang)}
      </div>

      {item.options.length > 0 ? (
        <div className="text-xs text-muted-foreground mt-0.5 space-y-0.5 pl-2">
          {item.options.map((o, i) => {
            const varName = getMlWithFallback(o.variantName, defaultLang, defaultLang);
            const qty = o.quantity ?? 1;
            return (
              <div key={i} className="flex gap-1.5">
                <span aria-hidden>•</span>
                <span>
                  {qty > 1 ? `${qty}× ` : ""}
                  {varName}
                </span>
              </div>
            );
          })}
        </div>
      ) : null}

      {item.notes ? (
        <div className="text-xs text-muted-foreground mt-0.5 pl-2 flex gap-1.5">
          <span aria-hidden>•</span>
          <span>{item.notes}</span>
        </div>
      ) : null}
    </button>
  );
}

