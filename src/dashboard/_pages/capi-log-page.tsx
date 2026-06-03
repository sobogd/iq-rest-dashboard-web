"use client";

import { useState, useEffect } from "react";
import { Check } from "lucide-react";
import { apiUrl } from "@/lib/api";
import { SubpageStickyBar } from "../_v2/ui";
import { useDashboardRouter } from "../_spa/router";
import { fmtAt, type CapiEntry } from "./capi-shared";

export function CapiLogPage({ id }: { id: string }) {
  const router = useDashboardRouter();
  const [entry, setEntry] = useState<CapiEntry | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(apiUrl(`/api/admin/capi/entry/${encodeURIComponent(id)}`), { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((j: CapiEntry | null) => {
        if (!cancelled) setEntry(j);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  const ok = entry?.status === "success";

  return (
    <div>
      <SubpageStickyBar onBack={() => router.back()} hideSave />
      <div className="max-w-5xl mx-auto md:px-6 pt-5 md:pt-4 space-y-3">
        {loading ? (
          <div className="text-xs text-muted-foreground py-8 text-center">Loading…</div>
        ) : !entry ? (
          <div className="text-xs text-muted-foreground py-8 text-center">Entry not found</div>
        ) : (
          <>
            <div className="bg-card border border-border rounded-xl p-4 md:p-5 space-y-2">
              <div className="flex items-center gap-2">
                <span
                  className={
                    "text-[10px] font-semibold rounded px-1.5 py-0.5 " +
                    (ok ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" : "bg-red-500/10 text-red-600 dark:text-red-400")
                  }
                >
                  {ok ? "OK" : "ERR"}
                </span>
                <span className="text-sm font-semibold text-foreground">{entry.eventName}</span>
                <span className="flex-1" />
                <span className="text-[11px] text-muted-foreground tabular-nums">{fmtAt(entry.createdAt)}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-muted-foreground shrink-0 w-12">fbclid</span>
                <span className="text-[11px] font-mono text-foreground break-all">{entry.fbclid}</span>
              </div>
            </div>

            <div className="bg-card border border-border rounded-xl p-4">
              <div className="text-[11px] text-muted-foreground mb-2 inline-flex items-center gap-1">
                {ok ? <Check className="w-3 h-3 text-emerald-500" /> : null}
                Meta response
              </div>
              <pre className="p-2 text-[10px] font-mono bg-secondary rounded-md text-foreground overflow-auto max-h-[60vh] whitespace-pre-wrap break-all">
                {JSON.stringify(entry.response, null, 2)}
              </pre>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
