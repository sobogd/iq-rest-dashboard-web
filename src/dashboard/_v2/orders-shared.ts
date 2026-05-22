// Symbols shared between the full OrdersPage (admin) and the standalone
// KitchenPage (admin "Kitchen" tab + kitchen.* subdomain kiosk). Extracted
// so the kitchen bundle can import KitchenPage without pulling in
// OrdersPage's order-create wizard, table change modal, etc.

import type { Discount, Order, OrderItem, OrderItemStatus } from "./types";
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

// Item subtotal before any discount. Used by SplitOrderModal and other
// callers that still think of "the item's price" as the base + options.
export function calcItemPrice(item: OrderItem): number {
  const base = parseDecimal(item.basePriceSnapshot) || 0;
  const extras = item.options.reduce(
    (sum, o) => sum + (parseDecimal(o.priceDelta) || 0) * (o.quantity ?? 1),
    0,
  );
  return base + extras;
}

// Apply a discount to `base`. Mirrors the server-side logic so client-side
// totals stay in lockstep with what the patch endpoint will recompute.
// Percent values clamp at 100, fixed values clamp at base so the price
// can never drop below zero.
export function applyDiscount(base: number, discount: Discount | null | undefined): number {
  if (!discount) return 0;
  const value = Number(discount.value);
  if (!Number.isFinite(value) || value <= 0) return 0;
  if (discount.type === "percent") {
    return round2(base * (Math.min(100, value) / 100));
  }
  return round2(Math.min(base, value));
}

export function calcItemFinalPrice(item: OrderItem): number {
  const sub = calcItemPrice(item);
  return Math.max(0, round2(sub - applyDiscount(sub, item.discount ?? null)));
}

export function calcOrderSubtotal(order: Order): number {
  return round2(order.items.reduce((sum, it) => sum + calcItemFinalPrice(it), 0));
}

export function calcOrderTotal(order: Order): number {
  const sub = calcOrderSubtotal(order);
  return Math.max(0, round2(sub - applyDiscount(sub, order.discount ?? null)));
}

export function calcOrderItemDiscountSum(order: Order): number {
  return round2(order.items.reduce((sum, it) => sum + applyDiscount(calcItemPrice(it), it.discount ?? null), 0));
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
