"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { apiUrl } from "@/lib/api";
import { useTranslations } from "next-intl";
import { EmptyState, PageHeader } from "../_v2/ui";
import { AVAILABLE_LANGUAGES } from "../_v2/i18n";
import { track } from "@/lib/dashboard-events";

interface OrderItem { name: string; quantity: number; revenue: number }

interface OrderStats {
  revenue: number;
  revenuePrev: number;
  ordersCount: number;
  aov: number;
  itemsPerOrder: number;
  currency: string;
  byDay: { day: string; revenue: number; orders: number }[];
  byHour: { hour: number; revenue: number; orders: number }[];
  topByRevenue: OrderItem[];
  topByQuantity: OrderItem[];
  sizeBuckets: { "1": number; "2-3": number; "4-5": number; "6+": number };
  statusFunnel: { new: number; in_progress: number; completed: number; cancelled: number };
}

interface Stats {
  period: string;
  companyCreatedAt: string;
  totalScans: number;
  totalViews: number;
  byDay: { day: string; views: number; scans: number }[];
  byDayPrev: { day: string; views: number; scans: number }[];
  byLanguage: { language: string; scans: number; views: number }[];
  byPage: { page: string; views: number; sessions: number }[];
  orders: OrderStats;
}

type PageCategory = "home" | "menu" | "reserve" | "order" | "contacts" | "language" | "other";

const PAGE_CATEGORY_LABEL_KEY: Record<
  PageCategory,
  "pageHome" | "pageMenu" | "pageReserve" | "pageOrder" | "pageContacts" | "pageLanguage" | "pageOther"
> = {
  home: "pageHome",
  menu: "pageMenu",
  reserve: "pageReserve",
  order: "pageOrder",
  contacts: "pageContacts",
  language: "pageLanguage",
  other: "pageOther",
};

function categorizePage(path: string): PageCategory {
  const m = path.match(/^\/[a-z]{2,3}\/m\/[^/?#]+(.*)$/i);
  const suffix = (m?.[1] || "").replace(/[?#].*$/, "").replace(/\/+$/, "");
  if (suffix === "" || suffix === "/") return "home";
  if (suffix.startsWith("/menu")) return "menu";
  if (suffix.startsWith("/reserve")) return "reserve";
  if (suffix.startsWith("/order")) return "order";
  if (suffix.startsWith("/contacts")) return "contacts";
  if (suffix.startsWith("/language")) return "language";
  return "other";
}

const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function currentPeriod(): string {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** Build a descending list of YYYY-MM ids from `now` back to the company's
 *  registration month. Used to populate the period dropdown — replaces the
 *  legacy today/7d/30d preset list now that analytics is calendar-bucketed. */
function buildMonths(companyCreatedAt: string): { id: string; label: string }[] {
  const start = new Date(companyCreatedAt);
  const startY = start.getUTCFullYear();
  const startM = start.getUTCMonth();
  const now = new Date();
  const endY = now.getUTCFullYear();
  const endM = now.getUTCMonth();
  const months: { id: string; label: string }[] = [];
  let y = endY;
  let m = endM;
  while (y > startY || (y === startY && m >= startM)) {
    const id = `${y}-${String(m + 1).padStart(2, "0")}`;
    const label = `${MONTH_NAMES[m]} ${y}`;
    months.push({ id, label });
    m--;
    if (m < 0) { m = 11; y--; }
  }
  return months;
}

function formatCurrency(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency,
      maximumFractionDigits: amount >= 1000 ? 0 : 2,
    }).format(amount);
  } catch {
    return `${amount.toFixed(2)} ${currency}`;
  }
}

function formatDelta(current: number, prev: number, currency: string): { text: string; sign: "up" | "down" | "flat" } {
  const diff = current - prev;
  const sign = diff > 0.001 ? "up" : diff < -0.001 ? "down" : "flat";
  const arrow = sign === "up" ? "▲" : sign === "down" ? "▼" : "·";
  const abs = Math.abs(diff);
  const text = `${arrow} ${formatCurrency(abs, currency)}`;
  return { text, sign };
}

export function AnalyticsClient() {
  const t = useTranslations("dashboard.analyticsDashboard");
  const [period, setPeriod] = useState<string>(() => currentPeriod());
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(apiUrl(`/api/analytics/stats?period=${period}`), {
      credentials: "include",
      cache: "no-store",
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!cancelled) {
          setStats(data);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [period]);

  const months = useMemo(
    () => (stats?.companyCreatedAt ? buildMonths(stats.companyCreatedAt) : []),
    [stats?.companyCreatedAt],
  );

  const isEmpty =
    !stats || (stats.totalViews === 0 && stats.orders.ordersCount === 0);

  return (
    <div className="max-w-2xl mx-auto">
      <PageHeader
        title={t("title")}
        subtitle={t("subtitle")}
        action={
          months.length > 0 ? (
            <PeriodDropdown
              months={months}
              period={period}
              onChange={(p) => {
                track("dash_analytics_click_select_period");
                setPeriod(p);
              }}
            />
          ) : null
        }
      />

      {loading && !stats ? (
        <div className="bg-card border border-border rounded-xl min-h-[280px] flex items-center justify-center">
          <div className="w-5 h-5 border-2 border-input border-t-foreground rounded-full animate-spin" />
        </div>
      ) : isEmpty ? (
        <EmptyState title={t("noData")} subtitle={t("noDataLong")} />
      ) : (
        stats && (
          <div className="space-y-4">
            <OrdersKpis orders={stats.orders} />
            <RevenueByDayChart byDay={stats.orders.byDay} currency={stats.orders.currency} />
            <RevenueByHourChart byHour={stats.orders.byHour} currency={stats.orders.currency} />
            <TopItemsList
              title="Top items by revenue"
              items={stats.orders.topByRevenue}
              valueKey="revenue"
              currency={stats.orders.currency}
            />
            <TopItemsList
              title="Top items by quantity"
              items={stats.orders.topByQuantity}
              valueKey="quantity"
              currency={stats.orders.currency}
            />
            <OrderSizes sizeBuckets={stats.orders.sizeBuckets} />
            <StatusFunnel funnel={stats.orders.statusFunnel} />
            {/* Existing scan/view sections kept below — same monthly filter
                drives them so the page is internally consistent. */}
            {stats.totalScans > 0 || stats.totalViews > 0 ? (
              <>
                <ScanKpis stats={stats} />
                <DayChart byDay={stats.byDay} byDayPrev={stats.byDayPrev} />
                <LanguageBreakdown byLanguage={stats.byLanguage} />
                <PageBreakdown byPage={stats.byPage} />
              </>
            ) : null}
          </div>
        )
      )}
    </div>
  );
}

function PeriodDropdown({
  months,
  period,
  onChange,
}: {
  months: { id: string; label: string }[];
  period: string;
  onChange: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      if (!ref.current) return;
      if (!ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onEsc(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onEsc);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onEsc);
    };
  }, [open]);

  const active = months.find((m) => m.id === period) ?? months[0];

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => {
          setOpen((v) => {
            if (!v) track("dash_analytics_click_period");
            return !v;
          });
        }}
        className="inline-flex items-center gap-1 h-8 px-2.5 text-xs font-medium bg-secondary text-foreground rounded-md transition-colors"
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span>{active?.label}</span>
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>
      {open ? (
        <div
          role="listbox"
          className="absolute right-0 mt-1 z-20 min-w-[160px] max-h-72 overflow-y-auto bg-card border border-border rounded-lg shadow-lg py-1"
        >
          {months.map((m) => {
            const isActive = m.id === period;
            return (
              <button
                key={m.id}
                type="button"
                role="option"
                aria-selected={isActive}
                onClick={() => {
                  onChange(m.id);
                  setOpen(false);
                }}
                className={
                  "w-full flex items-center justify-between gap-3 px-3 h-8 text-[12px] text-left transition-colors " +
                  (isActive ? "text-foreground" : "text-muted-foreground")
                }
              >
                <span className="truncate">{m.label}</span>
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

function OrdersKpis({ orders }: { orders: OrderStats }) {
  const delta = formatDelta(orders.revenue, orders.revenuePrev, orders.currency);
  const deltaColor =
    delta.sign === "up" ? "text-emerald-500/80" :
    delta.sign === "down" ? "text-red-500/80" :
    "text-muted-foreground";
  return (
    <div className="grid grid-cols-2 gap-2.5">
      <div className="col-span-2 bg-card border border-border rounded-2xl p-4">
        <div className="text-xs text-muted-foreground">Revenue</div>
        <div className="flex items-baseline gap-2 mt-1">
          <div className="text-2xl font-medium text-foreground tabular-nums">
            {formatCurrency(orders.revenue, orders.currency)}
          </div>
          {orders.revenuePrev > 0 || orders.revenue > 0 ? (
            <div className={`text-[11px] tabular-nums ${deltaColor}`}>
              {delta.text} <span className="text-muted-foreground">vs prev</span>
            </div>
          ) : null}
        </div>
      </div>
      <div className="bg-card border border-border rounded-2xl p-4">
        <div className="text-xs text-muted-foreground">Orders</div>
        <div className="text-2xl font-medium text-foreground tabular-nums mt-1">
          {orders.ordersCount}
        </div>
      </div>
      <div className="bg-card border border-border rounded-2xl p-4">
        <div className="text-xs text-muted-foreground">Avg order</div>
        <div className="text-2xl font-medium text-foreground tabular-nums mt-1">
          {formatCurrency(orders.aov, orders.currency)}
        </div>
      </div>
      <div className="bg-card border border-border rounded-2xl p-4 col-span-2">
        <div className="text-xs text-muted-foreground">Items per order</div>
        <div className="text-2xl font-medium text-foreground tabular-nums mt-1">
          {orders.itemsPerOrder.toFixed(1)}
        </div>
      </div>
    </div>
  );
}

function RevenueByDayChart({ byDay, currency }: { byDay: OrderStats["byDay"]; currency: string }) {
  if (byDay.every((d) => d.revenue === 0)) return null;
  const max = Math.max(...byDay.map((d) => d.revenue), 1);
  return (
    <div className="bg-card border border-border rounded-2xl p-4 md:p-5">
      <div className="text-sm font-medium text-foreground mb-3">Revenue by day</div>
      <div className="overflow-x-auto -mx-4 md:-mx-5 px-4 md:px-5">
        <div className="flex items-stretch gap-1">
          {byDay.map((d) => {
            const h = Math.round((d.revenue / max) * 100);
            return (
              <div key={d.day} className="flex-1 flex flex-col gap-1.5 min-w-[12px]">
                <div className="h-32 flex items-end justify-center">
                  <div
                    className="bg-primary rounded-sm w-full"
                    style={{ height: `${Math.max(h, d.revenue > 0 ? 4 : 1)}%` }}
                    title={`${d.day}: ${formatCurrency(d.revenue, currency)} (${d.orders} orders)`}
                  />
                </div>
                <div className="h-3 text-[9px] text-muted-foreground tabular-nums text-center">
                  {d.day.slice(8, 10)}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function RevenueByHourChart({ byHour, currency }: { byHour: OrderStats["byHour"]; currency: string }) {
  if (byHour.every((h) => h.revenue === 0)) return null;
  const max = Math.max(...byHour.map((h) => h.revenue), 1);
  return (
    <div className="bg-card border border-border rounded-2xl p-4 md:p-5">
      <div className="text-sm font-medium text-foreground mb-3">Revenue by hour</div>
      <div className="flex items-stretch gap-1">
        {byHour.map((h) => {
          const height = Math.round((h.revenue / max) * 100);
          return (
            <div key={h.hour} className="flex-1 flex flex-col gap-1.5">
              <div className="h-24 flex items-end justify-center">
                <div
                  className="bg-primary/80 rounded-sm w-full"
                  style={{ height: `${Math.max(height, h.revenue > 0 ? 4 : 1)}%` }}
                  title={`${h.hour}:00 — ${formatCurrency(h.revenue, currency)} (${h.orders} orders)`}
                />
              </div>
              <div className="h-3 text-[8px] text-muted-foreground tabular-nums text-center">
                {h.hour % 3 === 0 ? h.hour : ""}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function TopItemsList({
  title,
  items,
  valueKey,
  currency,
}: {
  title: string;
  items: OrderItem[];
  valueKey: "revenue" | "quantity";
  currency: string;
}) {
  if (items.length === 0) return null;
  const max = Math.max(...items.map((i) => i[valueKey]), 1);
  return (
    <div className="bg-card border border-border rounded-2xl p-4 md:p-5">
      <div className="text-sm font-medium text-foreground mb-3">{title}</div>
      <div className="space-y-2">
        {items.map((it) => {
          const v = it[valueKey];
          const pct = Math.round((v / max) * 100);
          return (
            <div key={it.name} className="flex items-center gap-3">
              <div className="text-xs text-foreground flex-1 truncate">
                {it.name}
              </div>
              <div className="flex-1 h-2 bg-secondary rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary/80 rounded-full"
                  style={{ width: `${pct}%` }}
                />
              </div>
              <div className="text-xs text-muted-foreground tabular-nums w-20 text-right shrink-0">
                {valueKey === "revenue" ? formatCurrency(v, currency) : `${v} pcs`}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function OrderSizes({ sizeBuckets }: { sizeBuckets: OrderStats["sizeBuckets"] }) {
  const total = sizeBuckets["1"] + sizeBuckets["2-3"] + sizeBuckets["4-5"] + sizeBuckets["6+"];
  if (total === 0) return null;
  const rows: [string, number][] = [
    ["1 item", sizeBuckets["1"]],
    ["2-3 items", sizeBuckets["2-3"]],
    ["4-5 items", sizeBuckets["4-5"]],
    ["6+ items", sizeBuckets["6+"]],
  ];
  return (
    <div className="bg-card border border-border rounded-2xl p-4 md:p-5">
      <div className="text-sm font-medium text-foreground mb-3">Order size</div>
      <div className="space-y-2">
        {rows.map(([label, n]) => {
          const pct = total > 0 ? Math.round((n / total) * 100) : 0;
          return (
            <div key={label} className="flex items-center gap-3">
              <div className="text-xs text-foreground w-20 truncate shrink-0">{label}</div>
              <div className="flex-1 h-2 bg-secondary rounded-full overflow-hidden">
                <div className="h-full bg-primary/80 rounded-full" style={{ width: `${pct}%` }} />
              </div>
              <div className="text-xs text-muted-foreground tabular-nums w-16 text-right shrink-0">
                {n} ({pct}%)
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function StatusFunnel({ funnel }: { funnel: OrderStats["statusFunnel"] }) {
  const total = funnel.new + funnel.in_progress + funnel.completed + funnel.cancelled;
  if (total === 0) return null;
  const rows: [string, number][] = [
    ["New", funnel.new],
    ["In progress", funnel.in_progress],
    ["Completed", funnel.completed],
    ["Cancelled", funnel.cancelled],
  ];
  return (
    <div className="bg-card border border-border rounded-2xl p-4 md:p-5">
      <div className="text-sm font-medium text-foreground mb-3">Order status</div>
      <div className="space-y-2">
        {rows.map(([label, n]) => {
          const pct = total > 0 ? Math.round((n / total) * 100) : 0;
          return (
            <div key={label} className="flex items-center gap-3">
              <div className="text-xs text-foreground w-24 truncate shrink-0">{label}</div>
              <div className="flex-1 h-2 bg-secondary rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full ${label === "Cancelled" ? "bg-red-500/60" : "bg-primary/80"}`}
                  style={{ width: `${pct}%` }}
                />
              </div>
              <div className="text-xs text-muted-foreground tabular-nums w-16 text-right shrink-0">
                {n} ({pct}%)
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ScanKpis({ stats }: { stats: Stats }) {
  const t = useTranslations("dashboard.analyticsDashboard");
  const items = [
    { labelKey: "scans" as const, value: stats.totalScans },
    { labelKey: "pageViews" as const, value: stats.totalViews },
  ];
  return (
    <div className="grid grid-cols-2 gap-2.5">
      {items.map((i) => (
        <div key={i.labelKey} className="bg-card border border-border rounded-2xl p-4">
          <div className="text-xs text-muted-foreground">{t(i.labelKey)}</div>
          <div className="text-2xl font-medium text-foreground tabular-nums mt-1">{i.value}</div>
        </div>
      ))}
    </div>
  );
}

function DayChart({ byDay, byDayPrev }: { byDay: Stats["byDay"]; byDayPrev: Stats["byDayPrev"] }) {
  const t = useTranslations("dashboard.analyticsDashboard");
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [labelStep, setLabelStep] = useState(1);

  const dense = denseDailySeries(byDay, byDayPrev);

  useEffect(() => {
    const el = containerRef.current;
    if (!el || dense.length === 0) return;
    const NICE_STEPS = [1, 2, 3, 5, 7, 10, 14];
    const compute = () => {
      const width = el.scrollWidth;
      const colWidth = width / dense.length;
      const minColForLabel = 30;
      const raw = Math.max(1, Math.ceil(minColForLabel / Math.max(colWidth, 1)));
      const next = NICE_STEPS.find((n) => n >= raw) ?? raw;
      setLabelStep(next);
    };
    compute();
    const ro = new ResizeObserver(compute);
    ro.observe(el);
    return () => ro.disconnect();
  }, [dense.length]);

  if (byDay.length === 0 && byDayPrev.length === 0) return null;
  const max = Math.max(...dense.map((d) => Math.max(d.scans, d.prevScans)), 1);
  const lastIdx = dense.length - 1;
  return (
    <div className="bg-card border border-border rounded-2xl p-4 md:p-5">
      <div className="text-sm font-medium text-foreground mb-3">{t("scansPerDay")}</div>
      <div className="overflow-x-auto -mx-4 md:-mx-5 px-4 md:px-5">
        <div ref={containerRef} className="flex items-stretch gap-2">
          {dense.map((d, i) => {
            const hCur = Math.round((d.scans / max) * 100);
            const hPrev = Math.round((d.prevScans / max) * 100);
            const showLabel = (lastIdx - i) % labelStep === 0;
            return (
              <div key={d.day} className="flex-1 flex flex-col gap-1.5 min-w-[28px]">
                <div className="h-32 flex items-end justify-center gap-1">
                  <div
                    className="bg-muted-foreground/50 rounded-sm w-[10px]"
                    style={{ height: `${Math.max(hPrev, 2)}%` }}
                    title={`Prev ${d.prevDay ?? "—"}: ${d.prevScans}`}
                  />
                  <div
                    className="bg-primary rounded-sm w-[10px]"
                    style={{ height: `${Math.max(hCur, 2)}%` }}
                    title={t("dayTooltip", { day: d.day, scans: d.scans, views: d.views })}
                  />
                </div>
                <div className="h-3 text-[9px] text-muted-foreground tabular-nums text-center truncate">
                  {showLabel ? formatDayShort(d.day) : null}
                </div>
              </div>
            );
          })}
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block w-2.5 h-2.5 rounded-sm bg-muted-foreground/50" />
          {t("prevPeriod")}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block w-2.5 h-2.5 rounded-sm bg-primary" />
          {t("currentPeriod")}
        </span>
      </div>
    </div>
  );
}

interface DenseDay {
  day: string;
  prevDay: string | null;
  scans: number;
  views: number;
  prevScans: number;
}

function denseDailySeries(curr: Stats["byDay"], prev: Stats["byDayPrev"]): DenseDay[] {
  const length = Math.max(curr.length, prev.length);
  if (length === 0) return [];
  const result: DenseDay[] = [];
  for (let i = 0; i < length; i++) {
    const c = curr[i];
    const p = prev[i];
    result.push({
      day: c?.day ?? p?.day ?? String(i),
      prevDay: p?.day ?? null,
      scans: c?.scans ?? 0,
      views: c?.views ?? 0,
      prevScans: p?.scans ?? 0,
    });
  }
  return result;
}

function formatDayShort(iso: string): string {
  const [, m, day] = iso.split("-");
  return `${day}.${m}`;
}

function LanguageBreakdown({ byLanguage }: { byLanguage: Stats["byLanguage"] }) {
  const t = useTranslations("dashboard.analyticsDashboard");
  if (byLanguage.length === 0) return null;
  const max = Math.max(...byLanguage.map((l) => l.scans), 1);
  return (
    <div className="bg-card border border-border rounded-2xl p-4 md:p-5">
      <div className="text-sm font-medium text-foreground mb-3">{t("languages")}</div>
      <div className="space-y-2">
        {byLanguage.map((l) => {
          const pct = Math.round((l.scans / max) * 100);
          const meta = AVAILABLE_LANGUAGES.find((al) => al.code === l.language);
          const label = meta?.label ?? l.language.toUpperCase();
          return (
            <div key={l.language} className="flex items-center gap-3">
              <div className="text-xs text-foreground w-24 truncate shrink-0">{label}</div>
              <div className="flex-1 h-2 bg-secondary rounded-full overflow-hidden">
                <div className="h-full bg-primary/80 rounded-full" style={{ width: `${pct}%` }} />
              </div>
              <div className="text-xs text-muted-foreground tabular-nums w-12 text-right shrink-0">{l.scans}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function PageBreakdown({ byPage }: { byPage: Stats["byPage"] }) {
  const t = useTranslations("dashboard.analyticsDashboard");
  if (byPage.length === 0) return null;

  const grouped = new Map<PageCategory, { views: number; sessions: number }>();
  for (const p of byPage) {
    const cat = categorizePage(p.page);
    const cur = grouped.get(cat) ?? { views: 0, sessions: 0 };
    cur.views += p.views;
    cur.sessions += p.sessions;
    grouped.set(cat, cur);
  }
  const rows = [...grouped.entries()]
    .map(([cat, agg]) => ({ cat, ...agg }))
    .sort((a, b) => b.views - a.views);
  const max = Math.max(...rows.map((r) => r.views), 1);

  return (
    <div className="bg-card border border-border rounded-2xl p-4 md:p-5">
      <div className="text-sm font-medium text-foreground mb-3">{t("pages")}</div>
      <div className="space-y-2">
        {rows.map((r) => {
          const pct = Math.round((r.views / max) * 100);
          const label = t(PAGE_CATEGORY_LABEL_KEY[r.cat]);
          return (
            <div key={r.cat} className="flex items-center gap-3">
              <div className="text-xs text-foreground w-28 truncate shrink-0">{label}</div>
              <div className="flex-1 h-2 bg-secondary rounded-full overflow-hidden">
                <div className="h-full bg-primary/80 rounded-full" style={{ width: `${pct}%` }} />
              </div>
              <div className="text-xs text-muted-foreground tabular-nums w-12 text-right shrink-0">{r.views}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
