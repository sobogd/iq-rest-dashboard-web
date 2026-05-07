"use client";

import { useEffect, useRef, useState } from "react";
import { apiUrl } from "@/lib/api";
import { useTranslations } from "next-intl";
import { EmptyState, PageHeader } from "../_v2/ui";
import { AVAILABLE_LANGUAGES } from "../_v2/i18n";
import { track } from "@/lib/dashboard-events";

interface Stats {
 period: string;
 totalScans: number;
 totalViews: number;
 byDay: { day: string; views: number; scans: number }[];
 byDayPrev: { day: string; views: number; scans: number }[];
 byLanguage: { language: string; scans: number; views: number }[];
 byPage: { page: string; views: number; sessions: number }[];
 monthlyScans: number;
 plan: string | null;
 scanLimit: number | null;
}

const PERIODS: { id: string; labelKey: "periodToday" | "period7d" | "period30d" }[] = [
 { id: "today", labelKey: "periodToday" },
 { id: "7d", labelKey: "period7d" },
 { id: "30d", labelKey: "period30d" },
];

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

// Path looks like `/<locale>/m/<slug>` or `/<locale>/m/<slug>/<sub>...`.
// Bucket the URL by its sub-page so the chart shows logical sections, not
// raw URLs.
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

export function AnalyticsClient() {
 const t = useTranslations("dashboard.analyticsDashboard");
 const [period, setPeriod] = useState("7d");
 const [stats, setStats] = useState<Stats | null>(null);
 const [loading, setLoading] = useState(true);

 useEffect(() => {
 }, []);

 useEffect(() => {
 let cancelled = false;
 setLoading(true);
 fetch(apiUrl(`/api/analytics/stats?period=${period}`), {
        credentials: "include", cache: "no-store" })
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

 return (
 <div className="max-w-2xl mx-auto">
 <PageHeader
 title={t("title")}
 subtitle={t("subtitle")}
 action={
 <PeriodDropdown
 period={period}
 onChange={(p) => {
 track("dash_analytics_click_select_period");
 setPeriod(p);
 }}
 />
 }
 />

 {loading && !stats ? (
 <div className="bg-card border border-border rounded-xl min-h-[280px] flex items-center justify-center">
 <div className="w-5 h-5 border-2 border-input border-t-foreground rounded-full animate-spin" />
 </div>
 ) : !stats || stats.totalViews === 0 ? (
 <EmptyState
 title={t("noData")}
 subtitle={t("noDataLong")}
 />
 ) : (
 <div className="space-y-4">
 <KpiGrid stats={stats} />
 <DayChart byDay={stats.byDay} byDayPrev={stats.byDayPrev} />
 <LanguageBreakdown byLanguage={stats.byLanguage} />
 <PageBreakdown byPage={stats.byPage} />
 </div>
 )}
 </div>
 );
}

function PeriodDropdown({
 period,
 onChange,
}: {
 period: string;
 onChange: (id: string) => void;
}) {
 const t = useTranslations("dashboard.analyticsDashboard");
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

 const active = PERIODS.find((p) => p.id === period) || PERIODS[0];

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
 <span>{t(active.labelKey)}</span>
 <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
 <polyline points="6 9 12 15 18 9" />
 </svg>
 </button>
 {open ? (
 <div
 role="listbox"
 className="absolute right-0 mt-1 z-20 min-w-[180px] max-h-64 overflow-y-auto bg-card border border-border rounded-lg shadow-lg py-1"
 >
 {PERIODS.map((p) => {
 const isActive = p.id === period;
 return (
 <button
 key={p.id}
 type="button"
 role="option"
 aria-selected={isActive}
 onClick={() => {
 onChange(p.id);
 setOpen(false);
 }}
 className={
 "w-full flex items-center justify-between gap-3 px-3 h-8 text-[12px] text-left transition-colors " +
 (isActive ? "text-foreground" : "text-muted-foreground")
 }
 >
 <span className="truncate">{t(p.labelKey)}</span>
 </button>
 );
 })}
 </div>
 ) : null}
 </div>
 );
}

function KpiGrid({ stats }: { stats: Stats }) {
 const t = useTranslations("dashboard.analyticsDashboard");
 const items = [
 { labelKey: "scans" as const, value: stats.totalScans },
 { labelKey: "pageViews" as const, value: stats.totalViews },
 ];
 return (
 <div className="grid grid-cols-2 gap-2.5">
 {items.map((i) => (
 <div
 key={i.labelKey}
 className="bg-card border border-border rounded-2xl p-4"
 >
 <div className="text-xs text-muted-foreground">{t(i.labelKey)}</div>
 <div className="text-2xl font-medium text-foreground tabular-nums mt-1">
 {i.value}
 </div>
 </div>
 ))}
 </div>
 );
}

function DayChart({ byDay, byDayPrev }: { byDay: Stats["byDay"]; byDayPrev: Stats["byDayPrev"] }) {
 const t = useTranslations("dashboard.analyticsDashboard");
 const containerRef = useRef<HTMLDivElement | null>(null);
 const [labelStep, setLabelStep] = useState(1);

 // Build dense daily series so missing days still render as zero columns and
 // the previous-period bar lines up with the current bar by index.
 const dense = denseDailySeries(byDay, byDayPrev);

 // Adaptive label thinning: a horizontal date label like "01 May" needs
 // ~38px to stay readable. If columns are narrower, snap step to nice values
 // (1 → 2 → 3 → 5 → 7) so labels don't overlap on 30/90-day views.
 useEffect(() => {
 const el = containerRef.current;
 if (!el || dense.length === 0) return;
 const NICE_STEPS = [1, 2, 3, 5, 7, 10, 14];
 const compute = () => {
 // Use scrollWidth so the chart can scroll horizontally on narrow viewports
 // and still show every label — clientWidth would be capped to the viewport
 // and trigger label thinning even when the bars themselves fit.
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
 const max = Math.max(
 ...dense.map((d) => Math.max(d.scans, d.prevScans)),
 1,
 );
 // Anchor the visible labels to the LAST column so the latest day is always
 // shown, regardless of step.
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
 // Pair by index: current i ↔ previous i. If current period has no rows
 // (all days zero), fall back to prev length to still render columns.
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
 <div className="text-xs text-foreground w-24 truncate shrink-0">
 {label}
 </div>
 <div className="flex-1 h-2 bg-secondary rounded-full overflow-hidden">
 <div
 className="h-full bg-primary/80 rounded-full"
 style={{ width: `${pct}%` }}
 />
 </div>
 <div className="text-xs text-muted-foreground tabular-nums w-12 text-right shrink-0">
 {l.scans}
 </div>
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
 <div className="text-xs text-foreground w-28 truncate shrink-0">
 {label}
 </div>
 <div className="flex-1 h-2 bg-secondary rounded-full overflow-hidden">
 <div
 className="h-full bg-primary/80 rounded-full"
 style={{ width: `${pct}%` }}
 />
 </div>
 <div className="text-xs text-muted-foreground tabular-nums w-12 text-right shrink-0">
 {r.views}
 </div>
 </div>
 );
 })}
 </div>
 </div>
 );
}

function LimitCard({ stats }: { stats: Stats }) {
 const t = useTranslations("dashboard.analyticsDashboard");
 const limit = stats.scanLimit ?? 0;
 const used = stats.monthlyScans;
 const pct = limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 0;
 return (
 <div className="bg-card border border-border rounded-2xl p-4 md:p-5">
 <div className="flex items-center justify-between gap-3 mb-2">
 <div>
 <div className="text-sm font-medium text-foreground">{t("freePlanUsage")}</div>
 <div className="text-xs text-muted-foreground mt-0.5">
 {t("scansThisMonth")}
 </div>
 </div>
 <div className="text-sm font-medium text-foreground tabular-nums">
 {used} / {limit}
 </div>
 </div>
 <div className="h-2 bg-secondary rounded-full overflow-hidden">
 <div
 className={
 "h-full rounded-full " + (pct >= 100 ? "bg-red-500" : "bg-primary/80")
 }
 style={{ width: `${pct}%` }}
 />
 </div>
 </div>
 );
}

