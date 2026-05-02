"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { apiUrl } from "@/lib/api";
import { SubpageStickyBar } from "../_v2/ui";
import { RefreshIcon } from "../_v2/icons";
import { useDashboardRouter } from "../_spa/router";

type Source = "presignup" | "dashboard";

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
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function fmtDateLabel(date: string): string {
  // dd/mm — short, no year, no "today/yesterday"
  const [, m, d] = date.split("-");
  return `${d}/${m}`;
}

function fmtAt(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function shiftDate(date: string, days: number): string {
  const d = new Date(date + "T00:00:00");
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function PulsePage() {
  const router = useDashboardRouter();

  // Date — defaults to today, chevrons shift by ±1 day
  const [date, setDate] = useState<string>(() => todayStr());

  // Clock-hour for the END of the window (24h, 0–23). Window = [hour-1, hour].
  // Default for today = current hour (e.g. now=12:40 → window 11–12, hour=12).
  // For past days = end-of-day (23, window 22–23).
  const [hourEnd, setHourEnd] = useState<number>(() => new Date().getHours());

  const [source, setSource] = useState<Source>("presignup");
  const [timeline, setTimeline] = useState<PulseRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const isToday = date === todayStr();
  const currentHour = new Date().getHours();

  // When user switches date, reset hour to default for that day.
  // Today → current hour. Past → 23 (end of day). Done via effect on `date`.
  useEffect(() => {
    setHourEnd(date === todayStr() ? new Date().getHours() : 23);
  }, [date]);

  const { fromDate, toDate, windowLabel } = useMemo(() => {
    const [y, m, d] = date.split("-").map(Number);
    // Window covers the FULL clock hour [hourEnd-1 : 00 ... hourEnd : 00]
    const to = new Date(y, m - 1, d, hourEnd, 0, 0, 0);
    const from = new Date(y, m - 1, d, hourEnd - 1, 0, 0, 0);
    const startH = String(Math.max(0, hourEnd - 1)).padStart(2, "0");
    const endH = String(hourEnd).padStart(2, "0");
    return { fromDate: from, toDate: to, windowLabel: `${startH}–${endH}` };
  }, [date, hourEnd]);

  const load = useCallback(
    async (mode: "initial" | "refresh") => {
      if (mode === "initial") setLoading(true);
      else setRefreshing(true);
      try {
        const qs = new URLSearchParams({
          from: fromDate.toISOString(),
          to: toDate.toISOString(),
          source,
          limit: "500",
        });
        const res = await fetch(apiUrl(`/api/admin/pulse/timeline?${qs.toString()}`), {
          credentials: "include",
        });
        if (res.ok) {
          const j = (await res.json()) as { events: PulseRow[] };
          setTimeline(j.events || []);
        }
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [fromDate, toDate, source],
  );

  useEffect(() => {
    void load("initial");
  }, [load]);

  return (
    <div>
      <SubpageStickyBar onBack={() => router.push({ name: "settings" })} hideSave>
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
        {/* Date stepper */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setDate((d) => shiftDate(d, -1))}
            className="h-8 w-8 inline-flex items-center justify-center bg-secondary rounded-md text-muted-foreground hover:text-foreground"
            title="Previous day"
          >
            ‹
          </button>
          <div className="h-8 px-3 inline-flex items-center bg-secondary rounded-md text-xs font-medium tabular-nums">
            {fmtDateLabel(date)}
          </div>
          <button
            type="button"
            onClick={() => {
              const next = shiftDate(date, 1);
              if (new Date(next + "T00:00:00") <= new Date()) setDate(next);
            }}
            disabled={isToday}
            className="h-8 w-8 inline-flex items-center justify-center bg-secondary rounded-md text-muted-foreground hover:text-foreground disabled:opacity-40 disabled:cursor-not-allowed"
            title="Next day"
          >
            ›
          </button>

          {/* Hour-window stepper */}
          <button
            type="button"
            onClick={() => setHourEnd((h) => Math.max(1, h - 1))}
            disabled={hourEnd <= 1}
            className="h-8 w-8 inline-flex items-center justify-center bg-secondary rounded-md text-muted-foreground hover:text-foreground ml-2 disabled:opacity-40 disabled:cursor-not-allowed"
            title="Earlier hour"
          >
            ‹
          </button>
          <div className="h-8 px-3 inline-flex items-center bg-secondary rounded-md text-xs font-medium tabular-nums">
            {windowLabel}
          </div>
          <button
            type="button"
            onClick={() => {
              const max = isToday ? currentHour : 23;
              setHourEnd((h) => Math.min(max, h + 1));
            }}
            disabled={isToday ? hourEnd >= currentHour : hourEnd >= 23}
            className="h-8 w-8 inline-flex items-center justify-center bg-secondary rounded-md text-muted-foreground hover:text-foreground disabled:opacity-40 disabled:cursor-not-allowed"
            title="Later hour"
          >
            ›
          </button>
        </div>

        {/* Source toggle — text labels */}
        <div className="inline-flex items-center gap-0.5 p-0.5 bg-secondary rounded-lg">
          <button
            type="button"
            onClick={() => setSource("presignup")}
            className={
              "h-8 px-3 inline-flex items-center rounded-md text-[11px] font-medium transition-colors " +
              (source === "presignup"
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground")
            }
          >
            Landing + Auth + Onboarding
          </button>
          <button
            type="button"
            onClick={() => setSource("dashboard")}
            className={
              "h-8 px-3 inline-flex items-center rounded-md text-[11px] font-medium transition-colors " +
              (source === "dashboard"
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground")
            }
          >
            Dashboard
          </button>
        </div>

        {loading ? (
          <div className="text-xs text-muted-foreground py-8 text-center">Loading…</div>
        ) : timeline.length === 0 ? (
          <div className="text-xs text-muted-foreground py-8 text-center">No events in this window</div>
        ) : (
          <div className="bg-card border border-border rounded-xl overflow-hidden divide-y divide-border">
            {timeline.map((row, i) => (
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
