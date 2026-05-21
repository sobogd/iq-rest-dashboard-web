"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { CreditCard, Armchair, ChevronRight, Download } from "lucide-react";
import { apiUrl } from "@/lib/api";
import { activeRestaurantHeader } from "@/lib/active-restaurant";
import { track } from "@/lib/dashboard-events";
import { Modal } from "../_v2/ui";
import { useRestaurant } from "../_v2/restaurant-context";
import { getMlWithFallback } from "../_v2/i18n";
import { parseDecimal } from "../_v2/helpers";
import type { OrderItem } from "../_v2/types";

interface OrderRow {
  id: string;
  dailyNumber: number;
  orderDate: string;
  createdAt: string;
  tableNumber: number | null;
  total: string | number;
  currency: string;
  status: string;
  statusBeforeClose: string | null;
  paymentMethodId: string | null;
  items: OrderItem[];
  customerName: string | null;
  customerPhone: string | null;
  customerAddress: string | null;
  comment: string | null;
}

function periodRange(period: string): { from: string; to: string } {
  const now = new Date();
  if (period === "today") {
    const d = now.toISOString().slice(0, 10);
    return { from: d, to: d };
  }
  if (period === "week") {
    const day = now.getUTCDay();
    const back = (day + 6) % 7;
    const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - back));
    const end = new Date(start);
    end.setUTCDate(end.getUTCDate() + 6);
    return { from: start.toISOString().slice(0, 10), to: end.toISOString().slice(0, 10) };
  }
  // period = "YYYY-MM"
  const [yStr, mStr] = period.split("-");
  const y = parseInt(yStr, 10);
  const m = parseInt(mStr, 10) - 1;
  const from = new Date(Date.UTC(y, m, 1));
  const to = new Date(Date.UTC(y, m + 1, 0));
  return { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) };
}

function fmtCurrency(amount: number, currency: string) {
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency }).format(amount);
  } catch {
    return `${amount.toFixed(2)} ${currency}`;
  }
}

function fmtTime(iso: string) {
  try {
    return new Date(iso).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "—";
  }
}

function fmtDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString(undefined, { day: "2-digit", month: "short" });
  } catch {
    return "—";
  }
}

interface ListProps {
  period: string;
  currency: string;
  onClose: () => void;
}

export function OrdersListModal({ period, currency, onClose }: ListProps) {
  const t = useTranslations("dashboard.analyticsDashboard");
  const tpm = useTranslations("dashboard.paymentMethods");
  const restaurant = useRestaurant();
  const defaultLang = restaurant.defaultLang;
  const [orders, setOrders] = useState<OrderRow[] | null>(null);
  const [selected, setSelected] = useState<OrderRow | null>(null);

  useEffect(() => {
    const { from, to } = periodRange(period);
    fetch(apiUrl(`/api/orders?from=${from}&to=${to}`), { credentials: "include", cache: "no-store", headers: activeRestaurantHeader() })
      .then((r) => (r.ok ? r.json() : []))
      .then((data: OrderRow[]) => setOrders(Array.isArray(data) ? data : []))
      .catch(() => setOrders([]));
  }, [period]);

  // Body scroll lock.
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  const sorted = useMemo(() => {
    if (!orders) return [];
    return [...orders]
      // Analytics only cares about closed orders (completed/cancelled).
      // Active/new/in_progress orders live on the orders page.
      .filter((o) => {
        const s = String(o.status || "").toLowerCase();
        return s === "completed" || s === "cancelled";
      })
      .sort((a, b) => {
        // Newest day first; within a day, highest daily number first.
        const dCmp = +new Date(b.orderDate) - +new Date(a.orderDate);
        if (dCmp !== 0) return dCmp;
        return b.dailyNumber - a.dailyNumber;
      });
  }, [orders]);

  function pmLabel(code: string | null): string {
    if (!code) return "—";
    return tpm(code as never, { defaultValue: code });
  }

  function exportCsv() {
    if (sorted.length === 0) return;
    track("dash_analytics_orders_export_csv");
    // CSV cell helper — RFC 4180-style escaping for cells containing comma,
    // quote, or newline. Excel/Sheets open this fine; the BOM up-front
    // forces UTF-8 detection for non-Latin content (cyrillic, arabic, ...).
    const esc = (v: string | number | null | undefined): string => {
      if (v === null || v === undefined) return "";
      const s = String(v);
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const maxItems = sorted.reduce((m, o) => Math.max(m, (o.items || []).length), 0);
    const itemHeaders: string[] = [];
    for (let i = 0; i < maxItems; i++) itemHeaders.push(`${t("colItems", { defaultValue: "Item" })} ${i + 1}`);
    const header = [
      t("colDate", { defaultValue: "Date" }),
      t("colTime", { defaultValue: "Time" }),
      "#",
      t("colTable", { defaultValue: "Table" }),
      t("colTotal", { defaultValue: "Total" }),
      t("colPayment", { defaultValue: "Payment" }),
      ...itemHeaders,
    ].map(esc).join(",");
    const lines = [header];
    for (const o of sorted) {
      const dateIso = o.orderDate ? new Date(o.orderDate).toISOString().slice(0, 10) : "";
      const timeIso = o.createdAt
        ? new Date(o.createdAt).toISOString().slice(11, 16)
        : "";
      const itemCells: string[] = [];
      for (const it of o.items || []) {
        const name = getMlWithFallback(it.dishNameSnapshot, defaultLang, defaultLang);
        const base = parseDecimal(it.basePriceSnapshot) || 0;
        const optionsTotal = (it.options || []).reduce(
          (s, op) => s + (parseDecimal(op.priceDelta) || 0) * (op.quantity ?? 1),
          0,
        );
        const price = base + optionsTotal;
        itemCells.push(`${name} (${price.toFixed(2)})`);
      }
      while (itemCells.length < maxItems) itemCells.push("");
      const row = [
        dateIso,
        timeIso,
        String(o.dailyNumber),
        o.tableNumber === null ? "" : String(o.tableNumber),
        Number(o.total).toFixed(2),
        o.paymentMethodId ? tpm(o.paymentMethodId as never, { defaultValue: o.paymentMethodId }) : "",
        ...itemCells,
      ].map(esc).join(",");
      lines.push(row);
    }
    const blob = new Blob(["﻿" + lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `orders-${period}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return (
    <>
      <Modal
        open
        onClose={onClose}
        title={t("ordersListTitle", { defaultValue: "Orders" })}
        size="sm"
        footer={
          sorted.length > 0 ? (
            <button
              type="button"
              onClick={exportCsv}
              className="w-full h-9 inline-flex items-center justify-center gap-1.5 text-xs font-medium text-foreground bg-card border border-border rounded-lg transition-colors hover:bg-muted/40"
            >
              <Download className="w-3.5 h-3.5" />
              {t("exportCsv", { defaultValue: "Export CSV" })}
            </button>
          ) : undefined
        }
      >
        {!orders ? (
          <div className="py-8 text-center text-xs text-muted-foreground">…</div>
        ) : sorted.length === 0 ? (
          <div className="py-8 text-center text-xs text-muted-foreground">
            {t("noOrdersInPeriod", { defaultValue: "No orders in this period." })}
          </div>
        ) : (
          <div className="-m-5 p-3 space-y-2">
            {sorted.map((o) => (
              <button
                key={o.id}
                type="button"
                onClick={() => { track("dash_analytics_click_order_row"); setSelected(o); }}
                className="w-full bg-card border border-border rounded-xl p-3 text-left hover:border-muted-foreground/40 transition-colors flex items-center gap-3"
              >
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-foreground mb-1 tabular-nums">
                    {fmtDate(o.orderDate)}, {fmtTime(o.createdAt)} · #{o.dailyNumber}
                  </div>
                  <div className="flex items-center flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                    <span className="tabular-nums">{fmtCurrency(Number(o.total), o.currency || currency)}</span>
                    {o.tableNumber !== null ? (
                      <span className="inline-flex items-center gap-1">
                        <Armchair className="w-3 h-3" />
                        <span className="tabular-nums">{o.tableNumber}</span>
                      </span>
                    ) : null}
                    <span className="inline-flex items-center gap-1">
                      <CreditCard className="w-3 h-3" />
                      {pmLabel(o.paymentMethodId)}
                    </span>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground/60 shrink-0 self-center" />
              </button>
            ))}
          </div>
        )}
      </Modal>

      {selected ? (
        <OrderDetailModal
          order={selected}
          currency={currency}
          onClose={() => setSelected(null)}
          onReopened={(updated) => {
            setOrders((prev) =>
              prev ? prev.map((o) => (o.id === updated.id ? updated : o)) : prev,
            );
            setSelected(null);
          }}
        />
      ) : null}
    </>
  );
}

interface DetailProps {
  order: OrderRow;
  currency: string;
  onClose: () => void;
  onReopened: (next: OrderRow) => void;
}

function OrderDetailModal({ order, currency, onClose, onReopened }: DetailProps) {
  const t = useTranslations("dashboard.analyticsDashboard");
  const tpm = useTranslations("dashboard.paymentMethods");
  const restaurant = useRestaurant();
  const defaultLang = restaurant.defaultLang;
  const [busy, setBusy] = useState(false);

  // Defensive lowercasing — legacy orders may have status stored in a
  // different case. Any non-active/in_progress/new status is treated as
  // closed and gets the Return-to-kitchen button.
  const status = String(order.status || "").toLowerCase();
  const isClosed = status !== "new" && status !== "in_progress" && status !== "active";

  async function reopen() {
    if (busy) return;
    track("dash_analytics_order_reopen");
    setBusy(true);
    try {
      const res = await fetch(apiUrl(`/api/orders/${order.id}/reopen`), {
        credentials: "include",
        method: "POST",
        headers: activeRestaurantHeader(),
      });
      if (res.ok) {
        const updated = await res.json();
        onReopened(updated);
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={`#${order.dailyNumber} · ${fmtDate(order.orderDate)} · ${fmtTime(order.createdAt)}`}
      size="sm"
      footer={
        isClosed ? (
          <button
            type="button"
            onClick={reopen}
            disabled={busy}
            className="w-full h-9 text-xs font-medium text-foreground bg-card border border-border rounded-lg transition-colors disabled:opacity-60"
          >
            {busy ? "…" : t("returnToKitchen", { defaultValue: "Return to kitchen" })}
          </button>
        ) : undefined
      }
    >
      <div className="space-y-4">
          <div className="flex items-center flex-nowrap gap-x-3 text-[11px] text-muted-foreground whitespace-nowrap">
            <span className="tabular-nums">{fmtCurrency(Number(order.total), order.currency || currency)}</span>
            {order.tableNumber !== null ? (
              <span className="inline-flex items-center gap-1">
                <Armchair className="w-3 h-3" />
                <span className="tabular-nums">{order.tableNumber}</span>
              </span>
            ) : null}
            <span className="inline-flex items-center gap-1">
              <CreditCard className="w-3 h-3" />
              {order.paymentMethodId ? tpm(order.paymentMethodId as never, { defaultValue: order.paymentMethodId }) : "—"}
            </span>
          </div>

          <div>
            <ul className="divide-y divide-border text-sm">
              {(order.items || []).map((it, i) => {
                const name = getMlWithFallback(it.dishNameSnapshot, defaultLang, defaultLang);
                const base = parseDecimal(it.basePriceSnapshot) || 0;
                const optionsTotal = (it.options || []).reduce(
                  (s, o) => s + (parseDecimal(o.priceDelta) || 0) * (o.quantity ?? 1),
                  0,
                );
                const lineTotal = base + optionsTotal;
                return (
                  <li key={it.id || i} className="py-2 flex items-baseline justify-between gap-3">
                    <span className="flex-1 truncate">{name}</span>
                    <span className="tabular-nums">{fmtCurrency(lineTotal, order.currency || currency)}</span>
                  </li>
                );
              })}
            </ul>
          </div>
      </div>
    </Modal>
  );
}
