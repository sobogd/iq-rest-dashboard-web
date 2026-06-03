"use client";

// Admin: flat list of every restaurant in the system. Per-restaurant billing
// model — primary admin view. Clicking a row opens the restaurant detail page.

import { useCallback, useEffect, useMemo, useState } from "react";
import { apiUrl } from "@/lib/api";
import { EyeIcon, MessageIcon, RefreshIcon } from "../_v2/icons";
import { SubpageStickyBar } from "../_v2/ui";
import { formatDateShort } from "./_admin-helpers";
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
  lastVisit: string | null;
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
              const nameColor =
                active && r.plan === "PRO"
                  ? "text-emerald-600"
                  : active && r.plan === "BASIC"
                  ? "text-blue-500"
                  : trialActive
                  ? "text-orange-500"
                  : "text-muted-foreground";
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
                  <span
                    className={"font-medium truncate flex-1 " + (r.title ? nameColor : "text-muted-foreground italic")}
                    title={r.slug || ""}
                  >
                    {r.title}
                    {trialDaysLeft !== null ? ` (${trialDaysLeft}d)` : ""}
                  </span>
                  <span className="inline-flex items-center gap-2 text-[10px] text-muted-foreground tabular-nums shrink-0">
                    <span className="inline-flex items-center gap-0.5" title="Support messages — total (admin + restaurant)">
                      <MessageIcon size={10} />
                      {r.messagesCount}
                    </span>
                    <span className="inline-flex items-center gap-0.5" title="Scans today">
                      <EyeIcon size={10} />
                      {r.scansToday}
                    </span>
                    {r.lastVisit ? (
                      <span className="tabular-nums" title="Last visit">{formatDateShort(r.lastVisit)}</span>
                    ) : (
                      <span className="tabular-nums" title="No visits yet">—</span>
                    )}
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
