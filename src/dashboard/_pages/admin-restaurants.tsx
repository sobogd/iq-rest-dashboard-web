"use client";

// Admin: flat list of every restaurant in the system. Per-restaurant billing
// model — primary admin view. Clicking a row opens the restaurant detail page.

import { useCallback, useEffect, useMemo, useState } from "react";
import { apiUrl } from "@/lib/api";
import { EyeIcon, RefreshIcon } from "../_v2/icons";
import { SubpageStickyBar } from "../_v2/ui";
import { useDashboardRouter } from "../_spa/router";
import { AVAILABLE_LANGUAGES } from "../_v2/i18n";

const LANG_FLAG = new Map(AVAILABLE_LANGUAGES.map((l) => [l.code, l.flag]));

interface RestaurantRow {
  id: string;
  title: string;
  slug: string | null;
  defaultLanguage: string | null;
  plan: string | null;
  subscriptionStatus: string;
  trialEndsAt: string | null;
  scansToday: number;
  messagesCount: number;
  emailsSentCount: number;
  emailTemplatesTotal: number;
  hasAdminComment: boolean;
}

type Filter = "all" | "subscribed";

export function AdminRestaurantsPage({ onBack }: { onBack: () => void }) {
  const router = useDashboardRouter();
  const [rows, setRows] = useState<RestaurantRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>("all");

  const fetchRows = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(apiUrl("/api/admin/restaurants"), { credentials: "include" });
      if (!res.ok) return;
      const data = (await res.json()) as { restaurants: RestaurantRow[] };
      setRows(data.restaurants);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchRows();
  }, [fetchRows]);

  const visible = useMemo(() => {
    if (filter === "subscribed") return rows.filter((r) => r.subscriptionStatus === "ACTIVE");
    return rows;
  }, [rows, filter]);

  const filters: { id: Filter; label: string }[] = [
    { id: "all", label: "All" },
    { id: "subscribed", label: "Subscribed" },
  ];

  return (
    <div>
      <SubpageStickyBar onBack={onBack} hideSave>
        <span className="text-[10px] text-muted-foreground tabular-nums">
          {visible.length} / {rows.length}
        </span>
        <div className="flex items-center gap-0.5 bg-secondary rounded-md p-0.5">
          {filters.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setFilter(f.id)}
              className={
                "h-7 px-2.5 text-xs font-medium rounded transition-colors " +
                (filter === f.id ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")
              }
            >
              {f.label}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => void fetchRows()}
          disabled={loading}
          className="h-8 w-8 inline-flex items-center justify-center bg-secondary rounded-md text-muted-foreground hover:text-foreground disabled:opacity-60"
          title="Refresh"
        >
          <RefreshIcon size={14} className={loading ? "animate-spin" : ""} />
        </button>
      </SubpageStickyBar>
      <div className="max-w-5xl mx-auto md:px-6 pt-5 md:pt-4">
        {loading && rows.length === 0 ? (
          <div className="text-xs text-muted-foreground py-8 text-center">Loading…</div>
        ) : visible.length === 0 ? (
          <div className="text-xs text-muted-foreground py-8 text-center">No restaurants</div>
        ) : (
          <div className="bg-card border border-border rounded-xl overflow-hidden divide-y divide-border">
            {visible.map((r) => {
              const trialEndMs = r.trialEndsAt ? new Date(r.trialEndsAt).getTime() : null;
              const trialActive =
                r.subscriptionStatus !== "ACTIVE" && trialEndMs !== null && trialEndMs >= Date.now();
              const trialDaysLeft =
                trialActive && trialEndMs !== null
                  ? Math.max(1, Math.ceil((trialEndMs - Date.now()) / 86_400_000))
                  : null;
              const active = r.subscriptionStatus === "ACTIVE";
              const subChipColor =
                active && r.plan === "BASIC"
                  ? "bg-blue-500/10 text-blue-600 dark:text-blue-400"
                  : active
                  ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                  : trialActive
                  ? "bg-orange-500/10 text-orange-600 dark:text-orange-400"
                  : "bg-secondary text-muted-foreground";
              const subLabel = active ? r.plan || "Active" : trialActive ? "Trial" : r.subscriptionStatus;
              const scansChipColor =
                r.scansToday > 0
                  ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                  : "text-muted-foreground bg-secondary";
              return (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => router.push({ name: "settings.admin.restaurant", id: r.id })}
                  className="w-full flex items-center gap-2 px-3 py-2 text-xs text-left hover:bg-muted/40 transition-colors"
                >
                  <span className="text-base shrink-0" title={r.defaultLanguage || ""}>
                    {LANG_FLAG.get(r.defaultLanguage || "") || "🌐"}
                  </span>
                  {r.hasAdminComment ? (
                    <span className="inline-block w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" title="Has admin note" />
                  ) : null}
                  <span className="flex-1 min-w-0 flex items-center gap-1.5">
                    <span
                      className={
                        "text-[10px] rounded px-1.5 py-0.5 truncate min-w-0 bg-secondary " +
                        (r.title ? "text-foreground" : "text-muted-foreground italic")
                      }
                      title={r.slug || ""}
                    >
                      {r.title || "untitled"}
                    </span>
                    <span className={"text-[10px] rounded px-1.5 py-0.5 shrink-0 " + subChipColor}>
                      {subLabel}
                    </span>
                    {trialDaysLeft !== null ? (
                      <span className="text-[10px] rounded px-1.5 py-0.5 shrink-0 tabular-nums bg-orange-500/10 text-orange-600 dark:text-orange-400">
                        {trialDaysLeft}d
                      </span>
                    ) : null}
                  </span>
                  <span className="shrink-0 flex items-center gap-2">
                    <span
                      className={"inline-flex items-center gap-0.5 text-[10px] rounded px-1.5 py-0.5 tabular-nums " + scansChipColor}
                      title="Scans today"
                    >
                      <EyeIcon size={10} />
                      {r.scansToday}
                    </span>
                    <span
                      className="text-[10px] text-muted-foreground bg-secondary rounded px-1.5 py-0.5 tabular-nums"
                      title="Unique lifecycle emails sent to owner"
                    >
                      {r.emailsSentCount}/{r.emailTemplatesTotal}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
