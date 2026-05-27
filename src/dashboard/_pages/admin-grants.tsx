"use client";

// Admin-only: manage cross-company restaurant grants. English only, no i18n
// (admin surface convention). Lets an admin grant a user (by email) access to
// a restaurant owned by another company — the grantee manages it via the
// switcher with billing/delete hidden (viaGrant).

import { useCallback, useEffect, useRef, useState } from "react";
import { apiUrl } from "@/lib/api";
import { SubpageStickyBar } from "../_v2/ui";
import { useDashboardRouter } from "../_spa/router";

interface Grant {
  id: string;
  role: string;
  createdAt: string;
  userId: string;
  userEmail: string;
  restaurantId: string;
  restaurantTitle: string;
  restaurantSlug: string | null;
  ownerCompanyId: string;
  ownerCompanyName: string;
}

interface RestaurantOption {
  id: string;
  title: string;
  slug: string | null;
  companyId: string;
  companyName: string;
}

export function AdminGrantsPage() {
  const router = useDashboardRouter();
  const [grants, setGrants] = useState<Grant[]>([]);
  const [loading, setLoading] = useState(true);

  // Add-form state
  const [email, setEmail] = useState("");
  const [query, setQuery] = useState("");
  const [options, setOptions] = useState<RestaurantOption[]>([]);
  const [selected, setSelected] = useState<RestaurantOption | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchGrants = useCallback(async () => {
    try {
      const res = await fetch(apiUrl("/api/admin/restaurant-grants"), { credentials: "include" });
      if (!res.ok) return;
      setGrants((await res.json()) as Grant[]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchGrants();
  }, [fetchGrants]);

  // Debounced restaurant search for the picker.
  useEffect(() => {
    if (selected) return; // not searching while a pick is locked in
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(async () => {
      const res = await fetch(
        apiUrl(`/api/admin/restaurant-grants/restaurants?q=${encodeURIComponent(query.trim())}`),
        { credentials: "include" },
      );
      if (res.ok) setOptions((await res.json()) as RestaurantOption[]);
    }, 250);
    return () => {
      if (searchTimer.current) clearTimeout(searchTimer.current);
    };
  }, [query, selected]);

  async function submit() {
    setError(null);
    if (!email.trim()) {
      setError("Email is required");
      return;
    }
    if (!selected) {
      setError("Pick a restaurant");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(apiUrl("/api/admin/restaurant-grants"), {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), restaurantId: selected.id }),
      });
      if (!res.ok) {
        const msg = await res.json().catch(() => null);
        setError((msg as { message?: string } | null)?.message || `Failed (${res.status})`);
        return;
      }
      setEmail("");
      setSelected(null);
      setQuery("");
      setOptions([]);
      await fetchGrants();
    } finally {
      setSubmitting(false);
    }
  }

  async function remove(id: string) {
    if (!window.confirm("Revoke this grant? The user loses access to that restaurant.")) return;
    const res = await fetch(apiUrl(`/api/admin/restaurant-grants/${id}`), {
      method: "DELETE",
      credentials: "include",
    });
    if (res.ok) await fetchGrants();
  }

  return (
    <div>
      <SubpageStickyBar onBack={() => router.push({ name: "settings" })} hideSave>
        <div className="text-sm font-medium text-foreground">Restaurant grants</div>
      </SubpageStickyBar>

      <div className="max-w-5xl mx-auto md:px-6 pt-5 md:pt-4 space-y-4">
        {/* Add form */}
        <div className="bg-card border border-border rounded-xl p-4 space-y-3">
          <div className="text-sm font-medium text-foreground">Grant access</div>
          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <label className="text-xs text-muted-foreground">User email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="client@example.com"
                className="mt-1 w-full h-9 px-3 text-sm rounded-lg bg-background border border-input"
              />
            </div>
            <div className="relative">
              <label className="text-xs text-muted-foreground">Restaurant</label>
              {selected ? (
                <div className="mt-1 h-9 px-3 flex items-center justify-between gap-2 rounded-lg bg-background border border-input">
                  <span className="text-sm truncate">
                    {selected.title}
                    <span className="text-muted-foreground"> · {selected.companyName}</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => setSelected(null)}
                    className="text-xs text-muted-foreground hover:text-foreground"
                  >
                    change
                  </button>
                </div>
              ) : (
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search by title or slug…"
                  className="mt-1 w-full h-9 px-3 text-sm rounded-lg bg-background border border-input"
                />
              )}
              {!selected && options.length > 0 && (
                <div className="absolute z-10 mt-1 w-full max-h-60 overflow-auto bg-card border border-border rounded-lg shadow-lg">
                  {options.map((o) => (
                    <button
                      key={o.id}
                      type="button"
                      onClick={() => {
                        setSelected(o);
                        setOptions([]);
                      }}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-muted"
                    >
                      {o.title}
                      <span className="text-muted-foreground">
                        {" "}
                        · {o.companyName}
                        {o.slug ? ` · ${o.slug}` : ""}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
          {error && <div className="text-xs text-red-600">{error}</div>}
          <button
            type="button"
            onClick={submit}
            disabled={submitting}
            className="h-9 px-4 text-sm font-medium rounded-lg bg-primary-gradient text-primary-foreground disabled:opacity-50"
          >
            {submitting ? "Granting…" : "Grant access"}
          </button>
        </div>

        {/* List */}
        {loading ? (
          <div className="text-xs text-muted-foreground py-8 text-center">Loading…</div>
        ) : grants.length === 0 ? (
          <div className="text-xs text-muted-foreground py-8 text-center">No grants yet</div>
        ) : (
          <div className="bg-card border border-border rounded-xl overflow-hidden divide-y divide-border">
            {grants.map((g) => (
              <div key={g.id} className="flex items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <div className="text-sm font-medium text-foreground truncate">{g.userEmail}</div>
                  <div className="text-xs text-muted-foreground truncate">
                    {g.restaurantTitle}
                    {g.restaurantSlug ? ` (${g.restaurantSlug})` : ""} · owner: {g.ownerCompanyName} · {g.role}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => remove(g.id)}
                  className="text-xs text-red-600 hover:text-red-700 px-2 py-1 shrink-0"
                >
                  Revoke
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
