"use client";

// Admin: flat list of every user in the system with their attached
// restaurants. Lets the admin see who-owns-what without drilling through
// Company. Clicking a restaurant inside a user opens the company modal as
// a drill-down (the modal still works against the legacy company id).

import { useCallback, useEffect, useMemo, useState } from "react";
import { apiUrl } from "@/lib/api";
import { AdminCompanyPage } from "./admin-company";
import { useScrollLock } from "../_v2/use-scroll-lock";

interface UserRow {
  id: string;
  email: string;
  preferredLocale: string | null;
  createdAt: string;
  hasStripeCustomer: boolean;
  restaurantsCount: number;
  hasPaying: boolean;
  hasActiveTrial: boolean;
  restaurants: {
    id: string;
    title: string;
    slug: string | null;
    plan: string | null;
    subscriptionStatus: string;
    hasStripeSub: boolean;
  }[];
}

type Filter = "all" | "paying" | "trial" | "multi" | "noRestaurant";

export function AdminUsersPage() {
  const [rows, setRows] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>("all");
  const [modalCompanyId, setModalCompanyId] = useState<string | null>(null);
  const [expandedUserId, setExpandedUserId] = useState<string | null>(null);
  useScrollLock(Boolean(modalCompanyId));

  const fetchRows = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(apiUrl("/api/admin/users"), { credentials: "include" });
      if (!res.ok) return;
      const data = (await res.json()) as { users: UserRow[] };
      setRows(data.users);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchRows();
  }, [fetchRows]);

  const visible = useMemo(() => {
    if (filter === "all") return rows;
    if (filter === "paying") return rows.filter((u) => u.hasPaying);
    if (filter === "trial") return rows.filter((u) => u.hasActiveTrial);
    if (filter === "multi") return rows.filter((u) => u.restaurantsCount > 1);
    if (filter === "noRestaurant") return rows.filter((u) => u.restaurantsCount === 0);
    return rows;
  }, [rows, filter]);

  const filters: { id: Filter; label: string }[] = [
    { id: "all", label: "All" },
    { id: "paying", label: "Paying" },
    { id: "trial", label: "Trial" },
    { id: "multi", label: "Multi-restaurant" },
    { id: "noRestaurant", label: "No restaurant" },
  ];

  return (
    <div>
      <div className="max-w-5xl mx-auto md:px-6 pt-5 md:pt-4">
        <div className="flex flex-wrap items-center gap-1.5 mb-3">
          {filters.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setFilter(f.id)}
              className={
                "h-7 px-3 text-xs font-medium rounded-md transition-colors " +
                (filter === f.id
                  ? "bg-primary-gradient text-primary-foreground"
                  : "bg-secondary text-muted-foreground hover:text-foreground")
              }
            >
              {f.label}
            </button>
          ))}
          <span className="ml-auto text-[10px] text-muted-foreground tabular-nums">
            {visible.length} / {rows.length}
          </span>
        </div>

        {loading && rows.length === 0 ? (
          <div className="text-xs text-muted-foreground py-8 text-center">Loading…</div>
        ) : visible.length === 0 ? (
          <div className="text-xs text-muted-foreground py-8 text-center">No users</div>
        ) : (
          <div className="bg-card border border-border rounded-xl overflow-hidden divide-y divide-border">
            {visible.map((u) => {
              const isExpanded = expandedUserId === u.id;
              return (
                <div key={u.id}>
                  <button
                    type="button"
                    onClick={() => setExpandedUserId(isExpanded ? null : u.id)}
                    className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-left hover:bg-muted/40 transition-colors"
                  >
                    <span className={"font-medium truncate flex-1 " + (u.hasPaying ? "text-emerald-600" : u.hasActiveTrial ? "text-orange-500" : "text-foreground")}>
                      {u.email}
                    </span>
                    <span className="inline-flex items-center gap-2 text-[10px] text-muted-foreground tabular-nums shrink-0">
                      <span title="Attached restaurants">🏠 {u.restaurantsCount}</span>
                      {u.hasPaying ? <span className="text-emerald-600" title="Has paying restaurant">$</span> : null}
                      {u.hasStripeCustomer ? <span title="Has Stripe customer">SC</span> : null}
                      <span className="opacity-60">{u.preferredLocale ?? "—"}</span>
                    </span>
                    <span className="text-[10px] text-muted-foreground tabular-nums shrink-0">
                      {new Date(u.createdAt).toLocaleDateString("en-CA")}
                    </span>
                  </button>
                  {isExpanded ? (
                    <div className="px-4 py-2 bg-muted/30 border-t border-border">
                      {u.restaurants.length === 0 ? (
                        <div className="text-[11px] text-muted-foreground">No attached restaurants</div>
                      ) : (
                        <div className="space-y-1">
                          {u.restaurants.map((r) => (
                            <div
                              key={r.id}
                              className="flex items-center gap-2 text-[11px]"
                            >
                              <span className="flex-1 truncate font-medium">{r.title}</span>
                              <span className={r.subscriptionStatus === "ACTIVE" ? "text-emerald-600" : "text-muted-foreground"}>
                                {r.plan ?? "FREE"} · {r.subscriptionStatus}
                                {r.hasStripeSub ? " · Stripe" : ""}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {modalCompanyId ? (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setModalCompanyId(null)}
        >
          <div
            className="w-full max-w-md bg-background border border-border rounded-2xl shadow-xl flex flex-col max-h-[85dvh] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <AdminCompanyPage companyId={modalCompanyId} onClose={() => setModalCompanyId(null)} />
          </div>
        </div>
      ) : null}
    </div>
  );
}
