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
import { CheckIcon } from "./icons";
import { EmptyState, Modal } from "./ui";
import { formatElapsedHMS } from "./helpers";
import { getMlWithFallback } from "./i18n";
import { patchOrder } from "./api";
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
}: KitchenPageProps) {
  const t = useTranslations("dashboard.orders");
  const [, setTick] = useState(0);
  const [statusFilter, setStatusFilter] = useState<OrderItemStatus[]>([]);
  const [categoryFilter, setCategoryFilter] = useState<string[]>([]);
  const [openFilter, setOpenFilter] = useState<null | "status" | "category">(null);

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

  function filterItems(items: OrderItem[]): OrderItem[] {
    return items.filter((it) => {
      if (statusFilter.length > 0 && !statusFilter.includes(it.status)) return false;
      if (categoryFilter.length > 0 && !categoryFilter.includes(dishToCategory[it.dishId])) return false;
      return true;
    });
  }

  type TableGroup = {
    key: string;
    tableId: string | null;
    tableNumber: number | string | null;
    items: { item: OrderItem; orderId: string }[];
    oldestCreatedAt: string;
  };
  const groupsMap = new Map<string, TableGroup>();
  for (const o of orders) {
    if (o.status !== "active") continue;
    const its = filterItems(o.items);
    if (its.length === 0) continue;
    const key = o.tableId ?? (o.tableNumber != null ? `n:${o.tableNumber}` : `o:${o.id}`);
    const g = groupsMap.get(key) ?? {
      key,
      tableId: o.tableId ?? null,
      tableNumber: o.tableNumber ?? null,
      items: [],
      oldestCreatedAt: o.createdAt,
    };
    for (const it of its) g.items.push({ item: it, orderId: o.id });
    if (new Date(o.createdAt).getTime() < new Date(g.oldestCreatedAt).getTime()) {
      g.oldestCreatedAt = o.createdAt;
    }
    groupsMap.set(key, g);
  }
  const visibleGroups = [...groupsMap.values()].sort(
    (a, b) => new Date(a.oldestCreatedAt).getTime() - new Date(b.oldestCreatedAt).getTime(),
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
    <div>
      <div
        className="sticky z-10 -mx-4 md:-mx-6 -mt-5 md:-mt-4 bg-subheader/90 backdrop-blur-md border-b border-border md:border-border/60"
        style={{ top: "var(--topbar-h, 0px)" }}
      >
        <div
          className={
            (fullWidthFilterBar ? "" : "max-w-5xl mx-auto md:px-6 ") +
            "flex items-center gap-2 px-4 py-2"
          }
        >
          <button
            type="button"
            onClick={() => setOpenFilter("status")}
            className={filterBtnBase + " " + (statusFilter.length > 0 ? filterBtnOn : filterBtnOff)}
          >
            {t("filterByStatus")}
            {statusFilter.length > 0 ? ` (${statusFilter.length})` : ""}
          </button>
          {categories.length > 0 ? (
            <button
              type="button"
              onClick={() => setOpenFilter("category")}
              className={filterBtnBase + " " + (categoryFilter.length > 0 ? filterBtnOn : filterBtnOff)}
            >
              {t("filterByCategory")}
              {categoryFilter.length > 0 ? ` (${categoryFilter.length})` : ""}
            </button>
          ) : null}
          {filterBarExtras ? <div className="ml-auto flex items-center gap-1.5">{filterBarExtras}</div> : null}
        </div>
      </div>

      <FilterModal
        open={openFilter === "status"}
        title={t("filterStatus")}
        onClose={() => setOpenFilter(null)}
        applyLabel={t("apply")}
        resetLabel={t("reset")}
        options={STATUS_FILTERS.map((s) => ({ id: s.id, label: t(s.labelKey) }))}
        selected={statusFilter}
        onApply={(ids) => {
          setStatusFilter(ids as OrderItemStatus[]);
          setOpenFilter(null);
        }}
        onReset={() => {
          setStatusFilter([]);
          setOpenFilter(null);
        }}
      />
      <FilterModal
        open={openFilter === "category"}
        title={t("filterCategory")}
        onClose={() => setOpenFilter(null)}
        applyLabel={t("apply")}
        resetLabel={t("reset")}
        options={categories.map((c) => ({
          id: c.id,
          label: getMlWithFallback(c.name, defaultLang, defaultLang),
        }))}
        selected={categoryFilter}
        onApply={(ids) => {
          setCategoryFilter(ids);
          setOpenFilter(null);
        }}
        onReset={() => {
          setCategoryFilter([]);
          setOpenFilter(null);
        }}
      />

      {visibleGroups.length === 0 ? (
        <div className="max-w-5xl mx-auto md:px-6 pt-7 md:pt-6">
          <EmptyState title={t("kitchenClear")} subtitle={t("kitchenClearSub")} />
        </div>
      ) : (
        <div className="-mx-4 md:-mx-6 mt-4 md:mt-3">
          <div className="overflow-x-auto pb-1 px-4 md:px-6">
            <div className="flex items-start gap-3" style={{ width: "max-content" }}>
              {visibleGroups.map((g) => (
                <KitchenTableCard
                  key={g.key}
                  entries={g.items}
                  table={g.tableId ? tables.find((t) => t.id === g.tableId) || null : null}
                  tableNumberFallback={g.tableNumber}
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

function KitchenTableCard({
  entries,
  table,
  tableNumberFallback,
  defaultLang,
  onItemAdvance,
}: {
  entries: { item: OrderItem; orderId: string }[];
  table: TableEntity | null;
  tableNumberFallback: number | string | null;
  defaultLang: string;
  onItemAdvance: (orderId: string, itemId: string) => void;
}) {
  const t = useTranslations("dashboard.orders");
  const allReady = entries.length > 0 && entries.every((e) => e.item.status === "ready");
  const cardCls = allReady
    ? "bg-emerald-50 border-emerald-300 dark:bg-emerald-950/40 dark:border-emerald-700/60"
    : "bg-card border-border";
  const tableNumber = table ? table.number : tableNumberFallback ?? "?";

  return (
    <div className={"w-72 shrink-0 rounded-xl border overflow-hidden " + cardCls + " flex flex-col"}>
      <div className="px-3.5 py-3 border-b border-border/60 bg-subheader rounded-t-xl">
        <div className="text-base font-medium text-foreground">
          {t("tableLabel", { number: tableNumber })}
        </div>
        {table?.name ? <div className="text-xs text-muted-foreground mt-0.5">{table.name}</div> : null}
      </div>

      <div className="flex-1 divide-y divide-border">
        {[...entries]
          .sort((a, b) => {
            const sa = a.item.status === "served" ? 1 : 0;
            const sb = b.item.status === "served" ? 1 : 0;
            if (sa !== sb) return sa - sb;
            return new Date(a.item.createdAt).getTime() - new Date(b.item.createdAt).getTime();
          })
          .map(({ item, orderId }) => (
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
      onClick={onAdvance}
      className={"w-full text-left px-3.5 py-2.5 transition-colors " + (isServed ? "opacity-50" : "")}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
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

function FilterModal({
  open,
  title,
  onClose,
  options,
  selected,
  onApply,
  onReset,
  applyLabel,
  resetLabel,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  options: { id: string; label: string }[];
  selected: string[];
  onApply: (ids: string[]) => void;
  onReset: () => void;
  applyLabel: string;
  resetLabel: string;
}) {
  const [draft, setDraft] = useState<string[]>(selected);
  useEffect(() => {
    if (open) setDraft(selected);
  }, [open, selected]);
  function toggle(id: string) {
    setDraft((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));
  }
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      size="sm"
      footer={
        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onReset}
            className="h-8 px-3 text-xs font-medium text-foreground bg-card border border-border rounded-lg transition-colors"
          >
            {resetLabel}
          </button>
          <button
            type="button"
            onClick={() => onApply(draft)}
            className="inline-flex items-center gap-1.5 h-8 px-3 text-xs font-medium text-primary-foreground bg-primary-gradient rounded-lg transition-colors"
          >
            {applyLabel}
          </button>
        </div>
      }
    >
      <div className="-m-5 divide-y divide-border">
        {options.map((o) => {
          const on = draft.includes(o.id);
          return (
            <button
              key={o.id}
              type="button"
              onClick={() => toggle(o.id)}
              className={
                "w-full flex items-center gap-3 px-5 py-3 text-left transition-colors " +
                (on ? "bg-primary/5" : "")
              }
            >
              <span
                className={
                  "w-4 h-4 rounded border inline-flex items-center justify-center shrink-0 " +
                  (on ? "bg-primary border-primary text-primary-foreground" : "border-input")
                }
              >
                {on ? <CheckIcon size={10} /> : null}
              </span>
              <span className="min-w-0 flex-1 text-sm text-foreground truncate">{o.label}</span>
            </button>
          );
        })}
      </div>
    </Modal>
  );
}
