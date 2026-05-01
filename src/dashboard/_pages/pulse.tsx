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

  // ── Timeline: chronological flat list ──────────────────────────────────────
  const timelineRows = useMemo(
    () => [...timeline].sort((a, b) => (a.bucket < b.bucket ? 1 : -1)),
    [timeline],
  );

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
        ) : timelineRows.length === 0 ? (
          <div className="text-xs text-muted-foreground py-8 text-center">No data</div>
        ) : (
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="grid grid-cols-[110px_1fr_auto] gap-2 px-3 py-2 text-[10px] font-medium text-muted-foreground uppercase border-b border-border">
              <span>Time</span>
              <span>Event</span>
              <span className="text-right">Hits</span>
            </div>
            <div className="divide-y divide-border">
              {timelineRows.slice(0, 1000).map((row, i) => (
                <div
                  key={`${row.bucket}-${row.event}-${i}`}
                  className="grid grid-cols-[110px_1fr_auto] gap-2 px-3 py-1.5 text-xs items-center"
                >
                  <span className="text-muted-foreground tabular-nums">
                    {fmtBucket(row.bucket, periodCfg.bucket)}
                  </span>
                  <span className="font-mono text-foreground truncate inline-flex items-center gap-1.5">
                    <span
                      className="inline-block w-2 h-2 rounded-sm shrink-0"
                      style={{ background: eventColor(row.event) }}
                    />
                    {row.event}
                  </span>
                  <span className="text-right tabular-nums">{row.hits}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

