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
  const d = new Date(date + "T00:00:00");
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diff = Math.round((d.getTime() - today.getTime()) / 86400000);
  if (diff === 0) return "Today";
  if (diff === -1) return "Yesterday";
  if (diff === 1) return "Tomorrow";
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function fmtAt(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function fmtHour(date: Date): string {
  return date.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
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

  // Hour-window offset — 0 = "current hour" (last 60min), 1 = previous hour, etc.
  // Window is anchored to the picked date's "now-equivalent" — when date=today
  // it's a rolling 1h up to current time; for past days it's anchor = end-of-day.
  const [hourOffset, setHourOffset] = useState<number>(0);

  const [source, setSource] = useState<Source>("presignup");
  const [timeline, setTimeline] = useState<PulseRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const isToday = date === todayStr();

  // Compute the [from, to] window from date + hourOffset.
  // For today: anchor = now → window = [now - (offset+1)h, now - offset*h].
  // For past days: anchor = end of that day at 23:59 local.
  const { fromDate, toDate, windowLabel } = useMemo(() => {
    let anchor: Date;
    if (isToday) {
      anchor = new Date(); // now
    } else {
      const [y, m, d] = date.split("-").map(Number);
      anchor = new Date(y, m - 1, d, 23, 59, 59, 999);
    }
    const to = new Date(anchor.getTime() - hourOffset * 60 * 60 * 1000);
    const from = new Date(to.getTime() - 60 * 60 * 1000);
    return {
      fromDate: from,
      toDate: to,
      windowLabel: `${fmtHour(from)} – ${fmtHour(to)}`,
    };
  }, [date, hourOffset, isToday]);

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
            {fmtDateLabel(date)}{" "}
            <span className="text-muted-foreground ml-1.5">{date}</span>
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

          {/* Hour window stepper */}
          <button
            type="button"
            onClick={() => setHourOffset((h) => h + 1)}
            className="h-8 w-8 inline-flex items-center justify-center bg-secondary rounded-md text-muted-foreground hover:text-foreground ml-2"
            title="Earlier hour"
          >
            ‹
          </button>
          <div className="h-8 px-3 inline-flex items-center bg-secondary rounded-md text-xs font-medium tabular-nums">
            {windowLabel}
          </div>
          <button
            type="button"
            onClick={() => setHourOffset((h) => Math.max(0, h - 1))}
            disabled={hourOffset === 0}
            className="h-8 w-8 inline-flex items-center justify-center bg-secondary rounded-md text-muted-foreground hover:text-foreground disabled:opacity-40 disabled:cursor-not-allowed"
            title="Later hour"
          >
            ›
          </button>
        </div>

        {/* Source toggle — 2 icons */}
        <div className="inline-flex items-center gap-0.5 p-0.5 bg-secondary rounded-lg">
          <button
            type="button"
            onClick={() => setSource("presignup")}
            title="Landing + Auth + Onboarding"
            className={
              "h-8 w-10 inline-flex items-center justify-center rounded-md transition-colors text-base " +
              (source === "presignup"
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground")
            }
          >
            🌐
          </button>
          <button
            type="button"
            onClick={() => setSource("dashboard")}
            title="Dashboard activity"
            className={
              "h-8 w-10 inline-flex items-center justify-center rounded-md transition-colors text-base " +
              (source === "dashboard"
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground")
            }
          >
            📊
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
