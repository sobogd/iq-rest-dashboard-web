"use client";

import { useEffect, useRef, useState } from "react";
import { apiUrl } from "@/lib/api";
import { useTranslations } from "next-intl";
import { EmptyState, PageHeader } from "../_v2/ui";
import { DashboardEvent, track } from "@/lib/dashboard-events";

interface Stats {
 period: string;
 totalScans: number;
 totalViews: number;
 avgPagesPerSession: number;
 returningScans: number;
 byDay: { day: string; views: number; scans: number }[];
 byLanguage: { language: string; scans: number; views: number }[];
 byPage: { page: string; views: number; sessions: number }[];
 monthlyScans: number;
 plan: string | null;
 scanLimit: number | null;
}

const PERIODS: { id: string; labelKey: "periodToday" | "period7d" | "period30d" | "period90d" }[] = [
 { id: "today", labelKey: "periodToday" },
 { id: "7d", labelKey: "period7d" },
 { id: "30d", labelKey: "period30d" },
 { id: "90d", labelKey: "period90d" },
];

const PAGE_LABEL_KEYS: Record<string, "pageHome" | "pageLanguage" | "pageContacts" | "pageMenu"> = {
 home: "pageHome",
 language: "pageLanguage",
 contacts: "pageContacts",
 menu: "pageMenu",
};

export function AnalyticsClient() {
 const t = useTranslations("dashboard.analyticsDashboard");
 const [period, setPeriod] = useState("7d");
 const [stats, setStats] = useState<Stats | null>(null);
 const [loading, setLoading] = useState(true);

 useEffect(() => {
 track(DashboardEvent.SHOWED_ANALYTICS);
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
 track(DashboardEvent.ERROR_FETCH);
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
 track(DashboardEvent.CHANGED_ANALYTICS_PERIOD, { period: p });
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
 <DayChart byDay={stats.byDay} />
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
 onClick={() => setOpen((v) => !v)}
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
 className="absolute right-0 mt-1 z-20 min-w-[140px] bg-card border border-border rounded-lg shadow-lg py-1"
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
 "w-full text-left px-3 h-8 text-[12px] transition-colors " +
 (isActive ? "text-foreground" : "text-muted-foreground")
 }
 >
 {t(p.labelKey)}
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
 { labelKey: "pagesPerScan" as const, value: stats.avgPagesPerSession.toFixed(1) },
 { labelKey: "returning" as const, value: stats.returningScans },
 ];
 return (
 <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
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

function DayChart({ byDay }: { byDay: Stats["byDay"] }) {
 const t = useTranslations("dashboard.analyticsDashboard");
 if (byDay.length === 0) return null;
 const max = Math.max(...byDay.map((d) => d.scans), 1);
 return (
 <div className="bg-card border border-border rounded-2xl p-4 md:p-5">
 <div className="text-sm font-medium text-foreground mb-3">{t("scansPerDay")}</div>
 <div className="flex items-end gap-1 h-32">
 {byDay.map((d) => {
 const h = Math.round((d.scans / max) * 100);
 return (
 <div key={d.day} className="flex-1 flex flex-col items-center gap-1.5 min-w-0">
 <div
 className="w-full bg-primary/80 rounded-sm relative group"
 style={{ height: `${Math.max(h, 2)}%`, minHeight: "2px" }}
 title={t("dayTooltip", { day: d.day, scans: d.scans, views: d.views })}
 />
 <div className="text-[9px] text-muted-foreground tabular-nums truncate w-full text-center">
 {formatDayShort(d.day)}
 </div>
 </div>
 );
 })}
 </div>
 </div>
 );
}

function formatDayShort(iso: string): string {
 const d = new Date(iso + "T00:00:00Z");
 return d.toLocaleDateString([], { day: "numeric", month: "short" });
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
 return (
 <div key={l.language} className="flex items-center gap-3">
 <div className="text-xs text-foreground uppercase tabular-nums w-8 shrink-0">
 {l.language}
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
 const max = Math.max(...byPage.map((p) => p.views), 1);
 return (
 <div className="bg-card border border-border rounded-2xl p-4 md:p-5">
 <div className="text-sm font-medium text-foreground mb-3">{t("pages")}</div>
 <div className="space-y-2">
 {byPage.map((p) => {
 const pct = Math.round((p.views / max) * 100);
 const labelKey = PAGE_LABEL_KEYS[p.page];
 const label = labelKey ? t(labelKey) : p.page;
 return (
 <div key={p.page} className="flex items-center gap-3">
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
 {p.views}
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

