// Symbols shared between the full OrdersPage (admin) and the standalone
// KitchenPage (admin "Kitchen" tab + kitchen.* subdomain kiosk). Extracted
// so the kitchen bundle can import KitchenPage without pulling in
// OrdersPage's order-create wizard, table change modal, etc.

import type { Order, OrderItem, OrderItemStatus } from "./types";
import { parseDecimal } from "./helpers";

export const ITEM_STATUS_KEYS: Record<
  OrderItemStatus,
  "statusPending" | "statusCooking" | "statusReady" | "statusServed"
> = {
  pending: "statusPending",
  cooking: "statusCooking",
  ready: "statusReady",
  served: "statusServed",
};

export const STATUS_DOT_CLS: Record<OrderItemStatus, string> = {
  pending: "bg-slate-700 dark:bg-slate-400",
  cooking: "bg-amber-500 dark:bg-amber-400",
  ready: "bg-blue-600 dark:bg-blue-500",
  served: "bg-emerald-600 dark:bg-emerald-500",
};

export const STATUS_TEXT_CLS: Record<OrderItemStatus, string> = {
  pending: "text-slate-700 dark:text-slate-400",
  cooking: "text-amber-600 dark:text-amber-400",
  ready: "text-blue-600 dark:text-blue-500",
  served: "text-emerald-600 dark:text-emerald-500",
};

export const STATUS_ORDER: OrderItemStatus[] = ["pending", "cooking", "ready", "served"];

export function calcItemPrice(item: OrderItem): number {
  const base = parseDecimal(item.basePriceSnapshot) || 0;
  const extras = item.options.reduce(
    (sum, o) => sum + (parseDecimal(o.priceDelta) || 0) * (o.quantity ?? 1),
    0,
  );
  return base + extras;
}

export function calcOrderTotal(order: Order): number {
  return order.items.reduce((sum, it) => sum + calcItemPrice(it), 0);
}
