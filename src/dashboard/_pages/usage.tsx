"use client";

import { useState } from "react";
import { SubpageStickyBar } from "../_v2/ui";
import { useDashboardRouter } from "../_spa/router";
import { UsageEventsTable } from "./usage-events-table";

function todayUtcStr(): string {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

function shiftDate(d: string, days: number): string {
  const [y, m, day] = d.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, day + days));
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, "0")}-${String(dt.getUTCDate()).padStart(2, "0")}`;
}

function fmtDateLabel(d: string): string {
  const [, m, day] = d.split("-");
  return `${day}.${m}`;
}

export function UsagePage() {
  const router = useDashboardRouter();
  const [date, setDate] = useState<string>(() => todayUtcStr());
  const [count, setCount] = useState<number | null>(null);
  const isToday = date === todayUtcStr();
  return (
    <div>
      <SubpageStickyBar onBack={() => router.push({ name: "settings" })} hideSave>
        {/* Centred total — absolute relative to the sticky bar. */}
        <span className="absolute left-1/2 -translate-x-1/2 text-xs text-muted-foreground tabular-nums">
          {count === null ? "" : `Total: ${count}`}
        </span>
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
              if (next <= todayUtcStr()) setDate(next);
            }}
            disabled={isToday}
            className="h-8 w-8 inline-flex items-center justify-center bg-secondary rounded-md text-muted-foreground hover:text-foreground disabled:opacity-40 disabled:cursor-not-allowed"
            title="Next day"
          >
            ›
          </button>
        </div>
      </SubpageStickyBar>
      <div
        className="max-w-2xl mx-auto pt-5 md:pt-4"
        style={{ "--events-sticky-top": "calc(var(--topbar-h, 0px) + 56px)" } as React.CSSProperties}
      >
        <UsageEventsTable date={date} onDateChange={setDate} onCountChange={setCount} />
      </div>
    </div>
  );
}
