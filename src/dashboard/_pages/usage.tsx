"use client";

import { useState } from "react";
import { SubpageStickyBar } from "../_v2/ui";
import { useDashboardRouter } from "../_spa/router";
import { UsageEventsTable } from "./usage-events-table";

export function UsagePage() {
  const router = useDashboardRouter();
  const [count, setCount] = useState<number | null>(null);
  return (
    <div>
      <SubpageStickyBar onBack={() => router.push({ name: "settings" })} hideSave>
        <span className="absolute left-1/2 -translate-x-1/2 text-xs text-muted-foreground tabular-nums">
          {count === null ? "" : `Total: ${count}`}
        </span>
      </SubpageStickyBar>
      <div
        className="max-w-2xl mx-auto pt-5 md:pt-4"
        style={{ "--events-sticky-top": "calc(var(--topbar-h, 0px) + 56px)" } as React.CSSProperties}
      >
        <UsageEventsTable onCountChange={setCount} />
      </div>
    </div>
  );
}
