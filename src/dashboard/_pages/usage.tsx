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
        <span className="text-xs text-muted-foreground tabular-nums">
          {count === null ? "" : `${count} event${count === 1 ? "" : "s"}`}
        </span>
      </SubpageStickyBar>
      <div className="max-w-3xl mx-auto px-3 py-3">
        <UsageEventsTable onCountChange={setCount} />
      </div>
    </div>
  );
}
