"use client";

import { useState } from "react";
import { apiUrl } from "@/lib/api";
import { SubpageStickyBar } from "../_v2/ui";
import { useDashboardRouter } from "../_spa/router";
import { AdminRestaurantsPage } from "./admin-restaurants";
import { AdminUsersPage } from "./admin-users";

type AdminTab = "restaurants" | "users";

export function AdminPage() {
  const router = useDashboardRouter();
  const [tab, setTab] = useState<AdminTab>("restaurants");

  // Push a force-reload SSE event to every paired kitchen tablet system-wide.
  // Used after deploying an urgent kitchen-bundle fix so staff doesn't have to
  // walk the floors manually refreshing.
  const [reloading, setReloading] = useState(false);
  async function reloadAllTablets() {
    if (reloading) return;
    if (!window.confirm("Reload every paired tablet system-wide?")) return;
    setReloading(true);
    try {
      const res = await fetch(apiUrl(`/api/admin/devices/reload-all`), {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) {
        alert("Failed to send reload");
        return;
      }
      const data = (await res.json()) as { devices: number; restaurants: number };
      alert(`Reload sent to ${data.devices} tablet(s) across ${data.restaurants} restaurant(s)`);
    } catch {
      alert("Network error");
    } finally {
      setReloading(false);
    }
  }

  const tabs: { id: AdminTab; label: string }[] = [
    { id: "restaurants", label: "Restaurants" },
    { id: "users", label: "Users" },
  ];

  return (
    <div>
      <SubpageStickyBar onBack={() => router.push({ name: "settings" })} hideSave>
        <div className="flex items-center gap-1.5 flex-wrap">
          <div className="flex items-center gap-0.5 bg-secondary rounded-md p-0.5">
            {tabs.map((tb) => (
              <button
                key={tb.id}
                type="button"
                onClick={() => setTab(tb.id)}
                className={
                  "h-7 px-2.5 text-xs font-medium rounded transition-colors " +
                  (tab === tb.id
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground")
                }
              >
                {tb.label}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={reloadAllTablets}
            disabled={reloading}
            title="Reload every paired tablet system-wide"
            className="h-8 px-3 text-xs font-medium inline-flex items-center bg-secondary rounded-md text-muted-foreground hover:text-foreground disabled:opacity-60"
          >
            {reloading ? "Sending…" : "Reload tablets"}
          </button>
        </div>
      </SubpageStickyBar>

      {tab === "restaurants" ? <AdminRestaurantsPage /> : null}
      {tab === "users" ? <AdminUsersPage /> : null}
    </div>
  );
}
