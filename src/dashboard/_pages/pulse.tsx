"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { apiUrl } from "@/lib/api";
import { SubpageStickyBar } from "../_v2/ui";
import { RefreshIcon } from "../_v2/icons";
import { useDashboardRouter } from "../_spa/router";

type Period = "24h" | "7d" | "30d";
type Tab = "top" | "timeline";

interface TopRow {
  event: string;
  hits: number;
}

interface BucketRow {
  bucket: string;
  event: string;
  hits: number;
}

const PERIODS: { value: Period; label: string; bucket: "hour" | "day" }[] = [
  { value: "24h", label: "24h", bucket: "hour" },
  { value: "7d", label: "7d", bucket: "day" },
  { value: "30d", label: "30d", bucket: "day" },
];

function periodRange(p: Period): { from: string; to: string } {
  const now = new Date();
  const ms = p === "24h" ? 86400000 : p === "7d" ? 7 * 86400000 : 30 * 86400000;
  return { from: new Date(now.getTime() - ms).toISOString(), to: now.toISOString() };
}

function fmtBucket(iso: string, bucket: "hour" | "day"): string {
  const d = new Date(iso);
  if (bucket === "hour") {
    return d.toLocaleString(undefined, { month: "short", day: "2-digit", hour: "2-digit" });
  }
  return d.toLocaleDateString(undefined, { month: "short", day: "2-digit" });
}

export function PulsePage() {
  const router = useDashboardRouter();
  const [tab, setTab] = useState<Tab>("top");
  const [period, setPeriod] = useState<Period>("7d");
  const [country, setCountry] = useState<string>("");
  const [eventFilter, setEventFilter] = useState<string>("");

  const [top, setTop] = useState<TopRow[]>([]);
  const [timeline, setTimeline] = useState<BucketRow[]>([]);
  const [allEvents, setAllEvents] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const periodCfg = PERIODS.find((p) => p.value === period)!;

  const load = useCallback(
    async (mode: "initial" | "refresh") => {
      if (mode === "initial") setLoading(true);
      else setRefreshing(true);
      try {
        const r = periodRange(period);
        const qs = new URLSearchParams({ from: r.from, to: r.to });
        if (country) qs.set("country", country);
        const [topRes, eventsRes, timelineRes] = await Promise.all([
          fetch(apiUrl(`/api/admin/pulse/top?${qs.toString()}&limit=20`), {
            credentials: "include",
          }),
          fetch(apiUrl(`/api/admin/pulse/events?from=${r.from}&to=${r.to}`), {
            credentials: "include",
          }),
          fetch(
            apiUrl(
              `/api/admin/pulse/timeline?${qs.toString()}&bucket=${periodCfg.bucket}` +
                (eventFilter ? `&events=${encodeURIComponent(eventFilter)}` : ""),
            ),
            { credentials: "include" },
          ),
        ]);
        if (topRes.ok) {
          const j = (await topRes.json()) as { events: TopRow[] };
          setTop(j.events || []);
        }
        if (eventsRes.ok) {
          const j = (await eventsRes.json()) as { events: string[] };
          setAllEvents(j.events || []);
        }
        if (timelineRes.ok) {
          const j = (await timelineRes.json()) as { buckets: BucketRow[] };
          setTimeline(j.buckets || []);
        }
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [period, country, eventFilter, periodCfg.bucket],
  );

  useEffect(() => {
    void load("initial");
  }, [load]);

  // ── Top tab: bar chart ─────────────────────────────────────────────────────
  const topMax = top.length ? top[0].hits : 0;

  // ── Timeline: stacked bars per bucket ──────────────────────────────────────
  const timelineGrouped = useMemo(() => {
    const byBucket = new Map<string, Map<string, number>>();
    const eventTotals = new Map<string, number>();
    for (const row of timeline) {
      let m = byBucket.get(row.bucket);
      if (!m) {
        m = new Map();
        byBucket.set(row.bucket, m);
      }
      m.set(row.event, (m.get(row.event) || 0) + row.hits);
      eventTotals.set(row.event, (eventTotals.get(row.event) || 0) + row.hits);
    }
    const buckets = Array.from(byBucket.keys()).sort();
    const events = Array.from(eventTotals.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([e]) => e);
    let maxBucketTotal = 0;
    const bucketTotals = buckets.map((b) => {
      let total = 0;
      const m = byBucket.get(b)!;
      for (const v of m.values()) total += v;
      if (total > maxBucketTotal) maxBucketTotal = total;
      return total;
    });
    return { byBucket, buckets, events, bucketTotals, maxBucketTotal };
  }, [timeline]);

  const eventColor = useCallback((event: string): string => {
    let h = 0;
    for (let i = 0; i < event.length; i++) h = (h * 31 + event.charCodeAt(i)) | 0;
    const hue = Math.abs(h) % 360;
    return `hsl(${hue} 65% 55%)`;
  }, []);

  return (
    <div>
      <SubpageStickyBar onBack={() => router.push({ name: "settings" })} hideSave>
        <div className="inline-flex items-center gap-0.5 p-0.5 bg-secondary rounded-lg">
          {(["top", "timeline"] as Tab[]).map((t) => {
            const isActive = tab === t;
            return (
              <button
                key={t}
                type="button"
                onClick={() => setTab(t)}
                className={
                  "h-7 px-2.5 text-[11px] font-medium rounded-md transition-colors capitalize " +
                  (isActive ? "bg-card text-foreground shadow-sm" : "text-muted-foreground")
                }
              >
                {t}
              </button>
            );
          })}
        </div>
        <button
          type="button"
          onClick={() => void load("refresh")}
          disabled={refreshing}
          className="inline-flex items-center gap-1.5 h-9 px-3 text-xs font-medium text-muted-foreground bg-secondary rounded-md transition-colors shrink-0 disabled:opacity-60"
        >
          <RefreshIcon size={14} className={refreshing ? "animate-spin" : ""} />
        </button>
      </SubpageStickyBar>

      <div className="px-3 py-3 space-y-3">
        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2">
          {PERIODS.map((p) => (
            <button
              key={p.value}
              type="button"
              onClick={() => setPeriod(p.value)}
              className={
                "h-8 px-3 text-xs font-medium rounded-md transition-colors " +
                (period === p.value
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary text-muted-foreground")
              }
            >
              {p.label}
            </button>
          ))}
          <input
            type="text"
            placeholder="Country (e.g. ES)"
            value={country}
            onChange={(e) => setCountry(e.target.value.toUpperCase().slice(0, 2))}
            className="h-8 w-32 px-2 text-xs bg-secondary border border-border rounded-md"
          />
          {tab === "timeline" ? (
            <select
              value={eventFilter}
              onChange={(e) => setEventFilter(e.target.value)}
              className="h-8 px-2 text-xs bg-secondary border border-border rounded-md min-w-[140px]"
            >
              <option value="">All events</option>
              {allEvents.map((e) => (
                <option key={e} value={e}>
                  {e}
                </option>
              ))}
            </select>
          ) : null}
        </div>

        {loading ? (
          <div className="text-xs text-muted-foreground py-8 text-center">Loading…</div>
        ) : tab === "top" ? (
          top.length === 0 ? (
            <div className="text-xs text-muted-foreground py-8 text-center">No events</div>
          ) : (
            <div className="bg-card border border-border rounded-xl overflow-hidden divide-y divide-border">
              {top.map((row) => {
                const pct = topMax ? (row.hits / topMax) * 100 : 0;
                return (
                  <div key={row.event} className="px-3 py-2">
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="font-mono truncate text-foreground">{row.event}</span>
                      <span className="tabular-nums text-muted-foreground ml-2">{row.hits}</span>
                    </div>
                    <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
                      <div
                        className="h-full"
                        style={{
                          width: `${pct}%`,
                          background: eventColor(row.event),
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )
        ) : timelineGrouped.buckets.length === 0 ? (
          <div className="text-xs text-muted-foreground py-8 text-center">No data</div>
        ) : (
          <div className="space-y-3">
            {/* Legend */}
            <div className="flex flex-wrap gap-2">
              {timelineGrouped.events.slice(0, 12).map((e) => (
                <div key={e} className="inline-flex items-center gap-1.5 text-[11px]">
                  <span
                    className="inline-block w-2.5 h-2.5 rounded-sm"
                    style={{ background: eventColor(e) }}
                  />
                  <span className="font-mono text-muted-foreground">{e}</span>
                </div>
              ))}
            </div>

            {/* Stacked bars */}
            <div className="bg-card border border-border rounded-xl p-3 overflow-x-auto">
              <div className="flex items-end gap-0.5 h-48 min-w-fit">
                {timelineGrouped.buckets.map((b, idx) => {
                  const m = timelineGrouped.byBucket.get(b)!;
                  const total = timelineGrouped.bucketTotals[idx];
                  const heightPct = timelineGrouped.maxBucketTotal
                    ? (total / timelineGrouped.maxBucketTotal) * 100
                    : 0;
                  return (
                    <div
                      key={b}
                      className="flex flex-col items-center gap-1 min-w-[24px]"
                      title={`${fmtBucket(b, periodCfg.bucket)}: ${total} hits`}
                    >
                      <div className="flex flex-col-reverse w-4 rounded-sm overflow-hidden" style={{ height: `${Math.max(heightPct, 2)}%` }}>
                        {timelineGrouped.events.map((e) => {
                          const v = m.get(e) || 0;
                          if (v === 0) return null;
                          const pct = total ? (v / total) * 100 : 0;
                          return (
                            <div
                              key={e}
                              style={{ height: `${pct}%`, background: eventColor(e) }}
                            />
                          );
                        })}
                      </div>
                      <span className="text-[9px] text-muted-foreground rotate-45 origin-left whitespace-nowrap mt-1">
                        {fmtBucket(b, periodCfg.bucket)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Table */}
            <div className="bg-card border border-border rounded-xl overflow-hidden">
              <div className="grid grid-cols-[1fr_auto_auto] gap-2 px-3 py-2 text-[10px] font-medium text-muted-foreground uppercase border-b border-border">
                <span>Time</span>
                <span>Event</span>
                <span className="text-right">Hits</span>
              </div>
              <div className="divide-y divide-border max-h-[400px] overflow-y-auto">
                {[...timeline]
                  .sort((a, b) => (a.bucket < b.bucket ? 1 : -1))
                  .slice(0, 200)
                  .map((row, i) => (
                    <div
                      key={`${row.bucket}-${row.event}-${i}`}
                      className="grid grid-cols-[1fr_auto_auto] gap-2 px-3 py-1.5 text-xs"
                    >
                      <span className="text-muted-foreground tabular-nums">
                        {fmtBucket(row.bucket, periodCfg.bucket)}
                      </span>
                      <span className="font-mono text-foreground truncate">{row.event}</span>
                      <span className="text-right tabular-nums">{row.hits}</span>
                    </div>
                  ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
