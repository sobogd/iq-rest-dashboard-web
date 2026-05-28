"use client";

// Admin: flat list of every restaurant in the system. Per-restaurant billing
// model — replaces the Company-centred admin view for everything except
// legacy operations that still need company-scope. Clicking a row opens
// the existing AdminCompanyPage modal as a drill-down (it reads the
// restaurant's parent company).

import { useCallback, useEffect, useMemo, useState } from "react";
import { apiUrl } from "@/lib/api";
import { Trash2, Mail, X } from "lucide-react";
import { BoxIcon, EyeIcon, FolderIcon, MessageIcon } from "../_v2/icons";
import { formatDateShort } from "./_admin-helpers";
import { useScrollLock } from "../_v2/use-scroll-lock";
import { AdminCompanyPage } from "./admin-company";

interface RestaurantRow {
  id: string;
  title: string;
  slug: string | null;
  companyId: string;
  companyName: string;
  plan: string | null;
  billingCycle: string | null;
  subscriptionStatus: string;
  trialEndsAt: string | null;
  currentPeriodEnd: string | null;
  hasStripeSub: boolean;
  isManualSub: boolean;
  createdAt: string;
  users: { id: string; email: string }[];
  usersCount: number;
  categoriesCount: number;
  itemsCount: number;
  scans30d: number;
  scansToday: number;
  messagesCount: number;
  messagesLastDayCount: number;
  lastVisit: string | null;
}

interface UserSearchResult {
  id: string;
  email: string;
}

type Filter = "all" | "paying" | "trial" | "expired" | "multi-user" | "manual";

export function AdminRestaurantsPage() {
  const [rows, setRows] = useState<RestaurantRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>("all");
  const [modalCompanyId, setModalCompanyId] = useState<string | null>(null);
  const [usersModalRestaurantId, setUsersModalRestaurantId] = useState<string | null>(null);
  useScrollLock(Boolean(modalCompanyId) || Boolean(usersModalRestaurantId));

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
    if (filter === "all") return rows;
    if (filter === "paying") return rows.filter((r) => r.hasStripeSub && r.subscriptionStatus === "ACTIVE");
    if (filter === "manual") return rows.filter((r) => r.isManualSub);
    if (filter === "multi-user") return rows.filter((r) => r.usersCount > 1);
    if (filter === "trial") {
      const now = Date.now();
      return rows.filter(
        (r) =>
          r.subscriptionStatus !== "ACTIVE" &&
          r.trialEndsAt !== null &&
          new Date(r.trialEndsAt).getTime() >= now,
      );
    }
    if (filter === "expired") {
      const now = Date.now();
      return rows.filter(
        (r) =>
          r.subscriptionStatus !== "ACTIVE" &&
          r.trialEndsAt !== null &&
          new Date(r.trialEndsAt).getTime() < now,
      );
    }
    return rows;
  }, [rows, filter]);

  const filters: { id: Filter; label: string }[] = [
    { id: "all", label: "All" },
    { id: "paying", label: "Paying" },
    { id: "trial", label: "Trial" },
    { id: "expired", label: "Expired" },
    { id: "multi-user", label: "Multi-user" },
    { id: "manual", label: "Manual sub" },
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
          <div className="text-xs text-muted-foreground py-8 text-center">No restaurants</div>
        ) : (
          <div className="bg-card border border-border rounded-xl overflow-hidden divide-y divide-border">
            {visible.map((r) => {
              const trialEndMs = r.trialEndsAt ? new Date(r.trialEndsAt).getTime() : null;
              const trialActive =
                r.subscriptionStatus !== "ACTIVE" && trialEndMs !== null && trialEndMs >= Date.now();
              const trialExpired =
                r.subscriptionStatus !== "ACTIVE" && trialEndMs !== null && trialEndMs < Date.now();
              const trialDaysLeft =
                trialActive && trialEndMs !== null
                  ? Math.max(1, Math.ceil((trialEndMs - Date.now()) / 86_400_000))
                  : null;
              const nameColor =
                r.subscriptionStatus === "ACTIVE"
                  ? "text-emerald-600"
                  : trialActive
                  ? "text-orange-500"
                  : trialExpired
                  ? "text-muted-foreground"
                  : "";
              return (
                <div
                  key={r.id}
                  className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-left hover:bg-muted/40 transition-colors"
                >
                  <button
                    type="button"
                    onClick={() => setModalCompanyId(r.companyId)}
                    className={
                      "font-medium truncate flex-1 text-left " +
                      (nameColor || (r.title ? "text-foreground" : "text-muted-foreground italic"))
                    }
                    title={r.slug || ""}
                  >
                    {r.title}
                    {trialDaysLeft !== null ? ` (${trialDaysLeft}d)` : ""}
                  </button>
                  <span className="inline-flex items-center gap-2 text-[10px] text-muted-foreground tabular-nums shrink-0">
                    <span className={"font-mono " + (r.plan === "PRO" ? "text-emerald-600" : r.plan === "BASIC" ? "text-blue-500" : "")}>
                      {r.plan ?? "—"}
                    </span>
                    {r.isManualSub ? (
                      <span className="text-amber-500" title="Manual subscription (no Stripe sub)">
                        M
                      </span>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => setUsersModalRestaurantId(r.id)}
                      className="inline-flex items-center gap-0.5 hover:text-foreground"
                      title={r.users.map((u) => u.email).join(", ")}
                    >
                      <UserBadge count={r.usersCount} highlight={r.usersCount > 1} />
                    </button>
                    <span className="inline-flex items-center gap-0.5" title="Categories">
                      <FolderIcon size={10} />
                      {r.categoriesCount}
                    </span>
                    <span className="inline-flex items-center gap-0.5" title="Items">
                      <BoxIcon size={10} />
                      {r.itemsCount}
                    </span>
                    {r.scans30d > 0 ? (
                      <span className="inline-flex items-center gap-0.5 text-blue-500" title="Scans 30d">
                        <EyeIcon size={10} />
                        {r.scans30d}
                      </span>
                    ) : null}
                    {r.messagesCount > 0 ? (
                      <span className="inline-flex items-center gap-0.5 text-red-500 font-medium" title="Support messages — total">
                        <MessageIcon size={10} />
                        {r.messagesCount}
                      </span>
                    ) : null}
                    {r.messagesLastDayCount > 0 ? (
                      <span className="inline-flex items-center gap-0.5 text-emerald-600 font-medium" title="Support messages — last 24h">
                        <MessageIcon size={10} />
                        {r.messagesLastDayCount}
                      </span>
                    ) : null}
                  </span>
                  {r.lastVisit ? (
                    <span className="text-[10px] text-muted-foreground tabular-nums shrink-0">
                      {formatDateShort(r.lastVisit)}
                    </span>
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

      {usersModalRestaurantId ? (
        <RestaurantUsersModal
          restaurantId={usersModalRestaurantId}
          initial={rows.find((r) => r.id === usersModalRestaurantId)?.users ?? []}
          onClose={() => setUsersModalRestaurantId(null)}
          onChange={() => void fetchRows()}
        />
      ) : null}
    </div>
  );
}

function UserBadge({ count, highlight }: { count: number; highlight?: boolean }) {
  return (
    <span className={highlight ? "text-purple-500 font-medium" : ""}>👥{count}</span>
  );
}

function RestaurantUsersModal({
  restaurantId,
  initial,
  onClose,
  onChange,
}: {
  restaurantId: string;
  initial: { id: string; email: string }[];
  onClose: () => void;
  onChange: () => void;
}) {
  const [users, setUsers] = useState(initial);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<UserSearchResult[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }
    const t = setTimeout(async () => {
      const res = await fetch(
        apiUrl(`/api/admin/users/search?q=${encodeURIComponent(query.trim())}`),
        { credentials: "include" },
      );
      if (res.ok) {
        const data = (await res.json()) as UserSearchResult[];
        // Exclude already-attached users.
        const attachedIds = new Set(users.map((u) => u.id));
        setResults(data.filter((u) => !attachedIds.has(u.id)));
      }
    }, 250);
    return () => clearTimeout(t);
  }, [query, users]);

  async function attach(user: UserSearchResult) {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(apiUrl(`/api/admin/restaurants/${restaurantId}/users`), {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: user.email }),
      });
      if (!res.ok) {
        const msg = await res.json().catch(() => null);
        setError((msg as { message?: string } | null)?.message || `Failed (${res.status})`);
        return;
      }
      setUsers((prev) => [...prev, user]);
      setQuery("");
      setResults([]);
      onChange();
    } finally {
      setBusy(false);
    }
  }

  async function detach(userId: string) {
    if (busy) return;
    if (users.length <= 1) {
      setError("Cannot remove the last user — orphans the restaurant");
      return;
    }
    if (!window.confirm("Remove this user from the restaurant?")) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(
        apiUrl(`/api/admin/restaurants/${restaurantId}/users/${userId}`),
        { method: "DELETE", credentials: "include" },
      );
      if (!res.ok) {
        const msg = await res.json().catch(() => null);
        setError((msg as { message?: string } | null)?.message || `Failed (${res.status})`);
        return;
      }
      setUsers((prev) => prev.filter((u) => u.id !== userId));
      onChange();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md bg-background border border-border rounded-2xl shadow-xl flex flex-col max-h-[85dvh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-4 py-3 border-b border-border flex items-center justify-between">
          <h3 className="text-sm font-semibold text-foreground">Attached users ({users.length})</h3>
          <button
            type="button"
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-auto px-4 py-3 space-y-3">
          <div className="divide-y divide-border">
            {users.map((u) => (
              <div key={u.id} className="flex items-center justify-between gap-2 py-2">
                <div className="min-w-0">
                  <div className="text-sm font-medium text-foreground truncate">{u.email}</div>
                </div>
                <button
                  type="button"
                  onClick={() => detach(u.id)}
                  disabled={busy || users.length <= 1}
                  className="h-7 px-2 text-xs text-red-600 hover:text-red-700 disabled:opacity-40 inline-flex items-center gap-1"
                >
                  <Trash2 className="h-3 w-3" /> Remove
                </button>
              </div>
            ))}
          </div>

          <div className="border-t border-border pt-3">
            <label className="text-xs text-muted-foreground">Add user (must be registered)</label>
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="search by email…"
              className="mt-1 w-full h-9 px-3 text-sm rounded-lg bg-background border border-input"
            />
            {results.length > 0 ? (
              <div className="mt-1 max-h-48 overflow-auto bg-card border border-border rounded-lg">
                {results.map((u) => (
                  <button
                    key={u.id}
                    type="button"
                    onClick={() => attach(u)}
                    disabled={busy}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-muted disabled:opacity-50 inline-flex items-center justify-between gap-2"
                  >
                    <span className="truncate">{u.email}</span>
                    <Mail className="h-3 w-3 text-muted-foreground" />
                  </button>
                ))}
              </div>
            ) : query.trim() && !busy ? (
              <div className="mt-1 text-[11px] text-muted-foreground">No matches</div>
            ) : null}
            {error ? <div className="mt-2 text-xs text-red-600">{error}</div> : null}
          </div>
        </div>
      </div>
    </div>
  );
}
