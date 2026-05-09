"use client";

import { useState } from "react";
import { SubpageStickyBar } from "../_v2/ui";
import { useDashboardRouter } from "../_spa/router";
import { UsageEventsTable } from "./usage-events-table";

export function UsagePage() {
  const router = useDashboardRouter();
  const [toolbarHost, setToolbarHost] = useState<HTMLDivElement | null>(null);
  return (
    <div>
      <SubpageStickyBar onBack={() => router.push({ name: "settings" })} hideSave>
        <div ref={setToolbarHost} className="flex items-center gap-1" />
      </SubpageStickyBar>
      <div
        className="max-w-2xl mx-auto pt-5 md:pt-4"
        style={{ "--events-sticky-top": "calc(var(--topbar-h, 0px) + 56px)" } as React.CSSProperties}
      >
        <UsageEventsTable toolbarHost={toolbarHost} />
      </div>
    </div>
  );
}
