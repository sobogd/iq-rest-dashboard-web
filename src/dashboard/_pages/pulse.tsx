"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { apiUrl } from "@/lib/api";
import { SubpageStickyBar } from "../_v2/ui";
import { RefreshIcon } from "../_v2/icons";
import { useDashboardRouter } from "../_spa/router";

type Tab = "top" | "timeline";

interface TopRow {
  event: string;
  hits: number;
}

interface PulseRow {
  at: string;
  event: string;
  country: string;
  region: string;
  gclid: string | null;
}

function countryToFlag(code: string): string {
  if (!code || code === "XX" || code.length !== 2) return "🌐";
  const A = 0x1f1e6;
  const a = "A".charCodeAt(0);
  return String.fromCodePoint(A + code.charCodeAt(0) - a, A + code.charCodeAt(1) - a);
}

function todayStr(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Build ISO from a YYYY-MM-DD date and a HH:MM time, using the user's local TZ. */
function toIsoLocal(dateStr: string, timeStr: string): string {
  const [y, m, d] = dateStr.split("-").map((s) => parseInt(s, 10));
  const [hh, mm] = timeStr.split(":").map((s) => parseInt(s, 10));
  return new Date(y, m - 1, d, hh, mm, 0, 0).toISOString();
}

function fmtAt(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

type Source = "presignup" | "dashboard";

// Event-name prefixes that classify a row as pre-signup. Anything else
// (dash_*, clicked_*, refresh_*, etc) is classified as dashboard.
const PRESIGNUP_PREFIXES = ["land_", "auth_", "create_flow_", "onboarding_", "wizard_"];
function isPresignup(eventName: string): boolean {
  return PRESIGNUP_PREFIXES.some((p) => eventName.startsWith(p));
}

export function PulsePage() {
  const router = useDashboardRouter();
  const [tab, setTab] = useState<Tab>("timeline");
  const [source, setSource] = useState<Source>("presignup");
  const [date, setDate] = useState<string>(() => todayStr());
  const [timeFrom, setTimeFrom] = useState<string>("00:00");
  const [timeTo, setTimeTo] = useState<string>("23:59");

  const [top, setTop] = useState<TopRow[]>([]);
  const [timeline, setTimeline] = useState<PulseRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(
    async (mode: "initial" | "refresh") => {
      if (mode === "initial") setLoading(true);
      else setRefreshing(true);
      try {
        // Local-TZ pickers → UTC ISO. Backend stores `hour` as UTC, so passing UTC
        // ISO makes the day boundary line up with what the user picked locally.
        const from = toIsoLocal(date, timeFrom);
        const to = toIsoLocal(date, timeTo);
        const qs = new URLSearchParams({ from, to });
        const [topRes, timelineRes] = await Promise.all([
          fetch(apiUrl(`/api/admin/pulse/top?${qs.toString()}&limit=20`), {
            credentials: "include",
          }),
          fetch(apiUrl(`/api/admin/pulse/timeline?${qs.toString()}&limit=1000`), {
            credentials: "include",
          }),
        ]);
        if (topRes.ok) {
          const j = (await topRes.json()) as { events: TopRow[] };
          setTop(j.events || []);
        }
        if (timelineRes.ok) {
          const j = (await timelineRes.json()) as { events: PulseRow[] };
          setTimeline(j.events || []);
        }
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [date, timeFrom, timeTo],
  );

  useEffect(() => {
    void load("initial");
  }, [load]);

  // ── Top tab: bar chart ─────────────────────────────────────────────────────
  // Filter by source. Done client-side because backend pulse_events table
  // doesn't have a source column — we infer from event name prefix.
  const filteredTop =
    source === "presignup"
      ? top.filter((r) => isPresignup(r.event))
      : top.filter((r) => !isPresignup(r.event));
  const topMax = filteredTop.length ? filteredTop[0].hits : 0;

  // Backend already returns newest-first ordered by `at`.
  const timelineRows =
    source === "presignup"
      ? timeline.filter((r) => isPresignup(r.event))
      : timeline.filter((r) => !isPresignup(r.event));

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

      <div className="max-w-2xl mx-auto px-3 py-3 space-y-3">
        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="date"
            value={date}
            max={todayStr()}
            onChange={(e) => setDate(e.target.value)}
            className="pulse-filter-input h-8 px-2 text-xs bg-secondary border border-border rounded-md tabular-nums"
            style={{ width: 130 }}
          />
          <input
            type="time"
            value={timeFrom}
            onChange={(e) => setTimeFrom(e.target.value)}
            className="pulse-filter-input h-8 px-2 text-xs bg-secondary border border-border rounded-md tabular-nums"
            style={{ width: 90 }}
          />
          <input
            type="time"
            value={timeTo}
            onChange={(e) => setTimeTo(e.target.value)}
            className="pulse-filter-input h-8 px-2 text-xs bg-secondary border border-border rounded-md tabular-nums"
            style={{ width: 90 }}
          />
          <style>{`
            .pulse-filter-input::-webkit-calendar-picker-indicator {
              padding: 0;
              margin-left: 2px;
              opacity: 0.6;
            }
            .pulse-filter-input::-webkit-inner-spin-button,
            .pulse-filter-input::-webkit-clear-button {
              display: none;
            }
          `}</style>
        </div>

        {/* Source filter — pre-signup (land+auth+onboarding) vs dashboard */}
        <div className="flex items-center gap-1 p-0.5 bg-secondary rounded-lg w-fit">
          {(
            [
              { value: "presignup" as Source, label: "Land + Auth + Onboarding" },
              { value: "dashboard" as Source, label: "Dashboard" },
            ]
          ).map((opt) => {
            const isActive = source === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => setSource(opt.value)}
                className={
                  "h-7 px-2.5 text-[11px] font-medium rounded-md transition-colors " +
                  (isActive ? "bg-card text-foreground shadow-sm" : "text-muted-foreground")
                }
              >
                {opt.label}
              </button>
            );
          })}
        </div>

        {loading ? (
          <div className="text-xs text-muted-foreground py-8 text-center">Loading…</div>
        ) : tab === "top" ? (
          filteredTop.length === 0 ? (
            <div className="text-xs text-muted-foreground py-8 text-center">No events</div>
          ) : (
            <div className="bg-card border border-border rounded-xl overflow-hidden divide-y divide-border">
              {filteredTop.map((row) => {
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
          <div className="bg-card border border-border rounded-xl overflow-hidden divide-y divide-border">
            {timelineRows.map((row, i) => (
              <div
                key={`${row.at}-${row.event}-${i}`}
                className="flex items-center gap-2 px-3 py-1.5 text-xs"
              >
                <span className="text-base shrink-0" title={row.country}>
                  {countryToFlag(row.country)}
                </span>
                <span className="font-mono text-foreground truncate flex-1">{row.event}</span>
                {row.gclid ? (
                  <button
                    type="button"
                    title={`Google Ads click — tap to copy gclid:\n${row.gclid}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      navigator.clipboard?.writeText(row.gclid!);
                    }}
                    className="inline-flex items-center justify-center w-3.5 h-3.5 rounded-full bg-[#4285f4] text-[8px] font-bold text-white shrink-0 hover:scale-110 transition-transform cursor-pointer"
                  >
                    G
                  </button>
                ) : null}
                <span className="text-[10px] text-muted-foreground tabular-nums shrink-0">
                  {fmtAt(row.at)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

