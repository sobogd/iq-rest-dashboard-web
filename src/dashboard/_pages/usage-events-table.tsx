"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import { Trash2, Building2, Check, UserCheck, UserX, Filter } from "lucide-react";
import { apiUrl } from "@/lib/api";
import { RefreshIcon } from "../_v2/icons";

export interface UsageRow {
  id: string;
  at: string;
  event: string;
  country: string;
  region: string;
  device: string | null;
  platform: string | null;
  gclid: string | null;
  adParams: string | null;
  companyId: string | null;
  companyLabel: string | null;
}

/** Stable hash → HSL hue. Anonymous rows sharing
 *  country|region|device|platform get the same colour dot. */
function sessionHueFor(row: UsageRow): number {
  const key = `${row.country}|${row.region}|${row.device || ""}|${row.platform || ""}`;
  let h = 5381;
  for (let i = 0; i < key.length; i++) h = ((h << 5) + h + key.charCodeAt(i)) >>> 0;
  return h % 360;
}

function truncate8(s: string): string {
  return s.length <= 8 ? s : s.slice(0, 8) + "..";
}

export type UsageScope = "anonymous" | "identified";

function countryToFlag(code: string): string {
  if (!code || code === "XX" || code.length !== 2) return "🌐";
  const A = 0x1f1e6;
  const a = "A".charCodeAt(0);
  return String.fromCodePoint(A + code.charCodeAt(0) - a, A + code.charCodeAt(1) - a);
}

function fmtAt(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}:${String(d.getSeconds()).padStart(2, "0")}`;
}

interface Props {
  /** When set, the table is scoped to a single company and the scope toggle is hidden. */
  companyId?: string;
  /** Default scope; ignored when companyId is set. */
  initialScope?: UsageScope;
  /** Reports the current row count to the parent so it can render it in its own header. */
  onCountChange?: (count: number) => void;
  /** When provided, the toolbar (scope toggle + bulk-mode buttons + refresh) is
   *  portalled into this host element instead of rendered above the rows. */
  toolbarHost?: HTMLElement | null;
}

const SCOPE_ICON: Record<UsageScope, typeof UserX> = {
  anonymous: UserX,
  identified: UserCheck,
};

const SCOPE_TITLE: Record<UsageScope, string> = {
  anonymous: "Anonymous",
  identified: "Identified",
};

type BulkMode = "none" | "delete" | "company";

export function UsageEventsTable({ companyId, initialScope = "anonymous", onCountChange, toolbarHost }: Props) {
  const [scope, setScope] = useState<UsageScope>(initialScope);
  const [rows, setRows] = useState<UsageRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [selected, setSelected] = useState<UsageRow | null>(null);
  const [mode, setMode] = useState<BulkMode>("none");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [companyPickerOpen, setCompanyPickerOpen] = useState(false);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [filterFrom, setFilterFrom] = useState<string>("");
  const [filterTo, setFilterTo] = useState<string>("");
  const [filterCompanyId, setFilterCompanyId] = useState<string>("");
  const [filterOpen, setFilterOpen] = useState(false);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const selectedCount = selectedIds.size;
  const filterActive = Boolean(filterFrom || filterTo || filterCompanyId);

  const fetchPage = useCallback(
    async (cursorParam: string | null) => {
      const qs = new URLSearchParams();
      if (companyId) qs.set("companyId", companyId);
      else if (filterCompanyId) qs.set("companyId", filterCompanyId);
      else qs.set("scope", scope);
      if (cursorParam) qs.set("cursor", cursorParam);
      if (filterFrom) qs.set("from", new Date(filterFrom).toISOString());
      if (filterTo) qs.set("to", new Date(filterTo).toISOString());
      const res = await fetch(apiUrl(`/api/admin/usage/timeline?${qs.toString()}`), {
        credentials: "include",
      });
      if (!res.ok) return null;
      return (await res.json()) as {
        events: UsageRow[];
        hasMore: boolean;
        nextCursor: string | null;
        total?: number;
      };
    },
    [scope, companyId, filterCompanyId, filterFrom, filterTo],
  );

  const load = useCallback(
    async (mode: "initial" | "refresh") => {
      if (mode === "initial") setLoading(true);
      else setRefreshing(true);
      try {
        const j = await fetchPage(null);
        if (j) {
          setRows(j.events);
          setHasMore(j.hasMore);
          setCursor(j.nextCursor);
          onCountChange?.(j.total ?? j.events.length);
        } else {
          setRows([]);
          setHasMore(false);
          setCursor(null);
          onCountChange?.(0);
        }
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [fetchPage, onCountChange],
  );

  const loadMore = useCallback(async () => {
    if (!cursor || !hasMore || loadingMore) return;
    setLoadingMore(true);
    try {
      const j = await fetchPage(cursor);
      if (j) {
        setRows((prev) => [...prev, ...j.events]);
        setHasMore(j.hasMore);
        setCursor(j.nextCursor);
      }
    } finally {
      setLoadingMore(false);
    }
  }, [cursor, hasMore, loadingMore, fetchPage]);

  useEffect(() => {
    // Refresh / page reload / scope change resets bulk mode and selection.
    setMode("none");
    setSelectedIds(new Set());
    void load("initial");
  }, [load]);

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function applyDelete() {
    if (selectedIds.size === 0) return;
    setBulkBusy(true);
    try {
      const res = await fetch(apiUrl("/api/admin/usage/events/delete"), {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: [...selectedIds] }),
      });
      if (!res.ok) return;
      setSelectedIds(new Set());
      setMode("none");
      void load("refresh");
    } finally {
      setBulkBusy(false);
      setConfirmDelete(false);
    }
  }

  async function applyLinkCompany(targetCompanyId: string) {
    if (selectedIds.size === 0) return;
    setBulkBusy(true);
    try {
      const res = await fetch(apiUrl("/api/admin/usage/events/link-company"), {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: [...selectedIds], companyId: targetCompanyId }),
      });
      if (!res.ok) return;
      setSelectedIds(new Set());
      setMode("none");
      setCompanyPickerOpen(false);
      void load("refresh");
    } finally {
      setBulkBusy(false);
    }
  }

  // IntersectionObserver — fires loadMore when sentinel scrolls into view.
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !hasMore) return;
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) void loadMore();
      },
      { rootMargin: "200px" },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [hasMore, loadMore]);

  // Auto-chain: after rows update or any state change, if sentinel is still
  // in view (e.g. short list, or observer never re-fires after a non-scroll
  // re-render like toggling bulk-select checkboxes), trigger another load.
  useEffect(() => {
    if (!hasMore || loadingMore || !cursor) return;
    const el = sentinelRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const inView = rect.top < window.innerHeight + 200 && rect.bottom > -200;
    if (inView) void loadMore();
  }, [rows, hasMore, loadingMore, cursor, loadMore]);

  const scopeButtons = !companyId
    ? (["anonymous", "identified"] as UsageScope[]).map((s) => {
        const Icon = SCOPE_ICON[s];
        const active = scope === s;
        return (
          <button
            key={s}
            type="button"
            onClick={() => setScope(s)}
            title={SCOPE_TITLE[s]}
            className={
              "h-8 w-8 inline-flex items-center justify-center rounded-md transition-colors " +
              (active
                ? "bg-primary text-primary-foreground"
                : "bg-secondary text-muted-foreground hover:text-foreground")
            }
          >
            <Icon className="h-3.5 w-3.5" />
          </button>
        );
      })
    : null;

  function handleModeButtonClick(target: "delete" | "company") {
    if (mode !== target) {
      setMode(target);
      setSelectedIds(new Set());
      return;
    }
    if (selectedCount === 0) {
      setMode("none");
      return;
    }
    if (target === "delete") setConfirmDelete(true);
    else setCompanyPickerOpen(true);
  }

  const bulkButtons = (
    <>
      <button
        type="button"
        onClick={() => handleModeButtonClick("delete")}
        disabled={bulkBusy}
        className={
          "h-8 w-8 inline-flex items-center justify-center rounded-md disabled:opacity-50 " +
          (mode === "delete"
            ? "bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/40"
            : "bg-secondary text-muted-foreground hover:text-foreground")
        }
        title={mode === "delete" ? `Delete ${selectedCount}` : "Bulk delete"}
      >
        {mode === "delete" ? <Check className="h-3.5 w-3.5" /> : <Trash2 className="h-3.5 w-3.5" />}
      </button>
      <button
        type="button"
        onClick={() => handleModeButtonClick("company")}
        disabled={bulkBusy}
        className={
          "h-8 w-8 inline-flex items-center justify-center rounded-md disabled:opacity-50 " +
          (mode === "company"
            ? "bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/40"
            : "bg-secondary text-muted-foreground hover:text-foreground")
        }
        title={mode === "company" ? `Link ${selectedCount} to company` : "Bulk link to company"}
      >
        {mode === "company" ? <Check className="h-3.5 w-3.5" /> : <Building2 className="h-3.5 w-3.5" />}
      </button>
      <button
        type="button"
        onClick={() => setFilterOpen(true)}
        className={
          "h-8 w-8 inline-flex items-center justify-center rounded-md " +
          (filterActive
            ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-900/40"
            : "bg-secondary text-muted-foreground hover:text-foreground")
        }
        title={filterActive ? `Filter: ${filterFrom || "…"} → ${filterTo || "…"}` : "Filter by date"}
      >
        <Filter className="h-3.5 w-3.5" />
      </button>
    </>
  );

  const refreshButton = (
    <button
      type="button"
      onClick={() => void load("refresh")}
      disabled={refreshing || loading}
      className="h-8 w-8 inline-flex items-center justify-center bg-secondary rounded-md text-muted-foreground hover:text-foreground disabled:opacity-60"
      title="Refresh"
    >
      <RefreshIcon size={14} className={refreshing ? "animate-spin" : ""} />
    </button>
  );

  const toolbarPortalContent = (
    <>
      {bulkButtons}
      {scopeButtons}
      {refreshButton}
    </>
  );

  return (
    <div className="space-y-3">
      {toolbarHost
        ? createPortal(toolbarPortalContent, toolbarHost)
        : (
          <div
            className="sticky z-10 bg-background py-2 flex items-center gap-1 flex-wrap"
            style={{ top: "var(--events-sticky-top, 0px)" }}
          >
            {bulkButtons}
            {scopeButtons}
            {refreshButton}
          </div>
        )}

      {loading ? (
        <div className="text-xs text-muted-foreground py-8 text-center">Loading…</div>
      ) : rows.length === 0 ? (
        <div className="text-xs text-muted-foreground py-8 text-center">No events</div>
      ) : (
        <div className="bg-card border border-border rounded-xl overflow-hidden divide-y divide-border">
          {rows.map((row) => (
            <button
              key={row.id}
              type="button"
              onClick={() => {
                if (mode !== "none") {
                  toggleSelect(row.id);
                  return;
                }
                setSelected(row);
              }}
              className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-left hover:bg-muted/40 transition-colors"
            >
              {mode !== "none" ? (
                <span
                  className={
                    "shrink-0 inline-flex items-center justify-center w-3.5 h-3.5 rounded border " +
                    (selectedIds.has(row.id)
                      ? "bg-primary border-primary text-primary-foreground"
                      : "border-border bg-card")
                  }
                  aria-hidden
                >
                  {selectedIds.has(row.id) ? <Check className="w-2.5 h-2.5" /> : null}
                </span>
              ) : null}
              {row.companyId ? (
                <span
                  className="text-[10px] text-muted-foreground bg-secondary rounded px-1.5 py-0.5 shrink-0"
                  title={row.companyLabel || row.companyId}
                >
                  {truncate8(row.companyLabel || row.companyId)}
                </span>
              ) : (
                <>
                  <span
                    className="inline-block w-2 h-2 rounded-full shrink-0"
                    style={{ backgroundColor: `hsl(${sessionHueFor(row)} 70% 55%)` }}
                    title={`Session group: ${row.country} ${row.region || "—"} / ${row.device || "—"} / ${row.platform || "—"}`}
                  />
                  <span className="text-base shrink-0" title={row.country}>
                    {countryToFlag(row.country)}
                  </span>
                </>
              )}
              <span className="font-mono text-foreground truncate flex-1">{row.event}</span>
              {row.device && !row.companyId && (
                <span className="text-[10px] text-muted-foreground shrink-0" title={`${row.device} / ${row.platform || "—"}`}>
                  {row.device === "mobile" ? "📱" : row.device === "tablet" ? "📋" : "🖥"}
                </span>
              )}
              {row.gclid && (
                <span
                  className="inline-flex items-center justify-center w-3.5 h-3.5 rounded-full bg-[#4285f4] text-[8px] font-bold text-white shrink-0"
                  title={row.gclid}
                  aria-hidden
                >
                  G
                </span>
              )}
              <span className="text-[10px] text-muted-foreground tabular-nums shrink-0">
                {fmtAt(row.at)}
              </span>
            </button>
          ))}
        </div>
      )}

      {hasMore && (
        <div ref={sentinelRef} className="text-xs text-muted-foreground py-4 text-center">
          {loadingMore ? "Loading more…" : ""}
        </div>
      )}

      <UsageEventDetail event={selected} onClose={() => setSelected(null)} />

      {confirmDelete ? (
        <ConfirmDialogInline
          title="Delete events"
          message={`Delete ${selectedCount} selected event${selectedCount === 1 ? "" : "s"}? This cannot be undone.`}
          onCancel={() => setConfirmDelete(false)}
          onConfirm={() => void applyDelete()}
          busy={bulkBusy}
        />
      ) : null}

      {companyPickerOpen ? (
        <CompanyPickerModal
          onClose={() => setCompanyPickerOpen(false)}
          onPick={(id) => void applyLinkCompany(id)}
          busy={bulkBusy}
          count={selectedCount}
        />
      ) : null}

      {filterOpen ? (
        <FilterModal
          from={filterFrom}
          to={filterTo}
          companyId={filterCompanyId}
          showCompany={!companyId}
          onClose={() => setFilterOpen(false)}
          onApply={(f, t, c) => {
            setFilterFrom(f);
            setFilterTo(t);
            setFilterCompanyId(c);
            setFilterOpen(false);
          }}
          onClear={() => {
            setFilterFrom("");
            setFilterTo("");
            setFilterCompanyId("");
            setFilterOpen(false);
          }}
        />
      ) : null}
    </div>
  );
}

function todayRangeDefaults(): { from: string; to: string } {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return { from: `${y}-${m}-${day}T00:00`, to: `${y}-${m}-${day}T23:59` };
}

function FilterModal({
  from,
  to,
  companyId,
  showCompany,
  onClose,
  onApply,
  onClear,
}: {
  from: string;
  to: string;
  companyId: string;
  showCompany: boolean;
  onClose: () => void;
  onApply: (from: string, to: string, companyId: string) => void;
  onClear: () => void;
}) {
  const defaults = todayRangeDefaults();
  const [draftFrom, setDraftFrom] = useState(from || defaults.from);
  const [draftTo, setDraftTo] = useState(to || defaults.to);
  const [draftCompanyId, setDraftCompanyId] = useState(companyId);
  const { items: companies, loading: companiesLoading } = useCompanyList();
  return (
    <div onClick={onClose} className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-sm bg-card border border-border rounded-xl shadow-xl">
        <div className="px-4 py-3 border-b border-border flex items-center justify-between">
          <h3 className="text-sm font-semibold text-foreground">Filter</h3>
          <button type="button" onClick={onClose} className="h-7 w-7 inline-flex items-center justify-center bg-secondary rounded-md text-muted-foreground hover:text-foreground">
            ✕
          </button>
        </div>
        <div className="p-4 space-y-3">
          <label className="block">
            <span className="block text-[11px] text-muted-foreground uppercase tracking-wider mb-1">From</span>
            <input
              type="datetime-local"
              value={draftFrom}
              onChange={(e) => setDraftFrom(e.target.value)}
              className="w-full h-9 px-3 bg-secondary rounded-md text-sm text-foreground focus:outline-none"
            />
          </label>
          <label className="block">
            <span className="block text-[11px] text-muted-foreground uppercase tracking-wider mb-1">To</span>
            <input
              type="datetime-local"
              value={draftTo}
              onChange={(e) => setDraftTo(e.target.value)}
              className="w-full h-9 px-3 bg-secondary rounded-md text-sm text-foreground focus:outline-none"
            />
          </label>
          {showCompany ? (
            <label className="block">
              <span className="block text-[11px] text-muted-foreground uppercase tracking-wider mb-1">Company</span>
              <select
                value={draftCompanyId}
                onChange={(e) => setDraftCompanyId(e.target.value)}
                disabled={companiesLoading}
                className="w-full h-9 px-3 bg-secondary rounded-md text-sm text-foreground focus:outline-none"
              >
                <option value="">Any company</option>
                {companies.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name || "(unnamed)"}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
        </div>
        <div className="px-4 py-3 border-t border-border flex items-center gap-2">
          <button type="button" onClick={onClear} className="flex-1 h-9 text-sm font-medium text-foreground bg-secondary rounded-md hover:bg-muted">
            Clear
          </button>
          <button
            type="button"
            onClick={() => onApply(draftFrom, draftTo, draftCompanyId)}
            className="flex-1 h-9 text-sm font-medium text-primary-foreground bg-primary rounded-md hover:opacity-90"
          >
            Apply
          </button>
        </div>
      </div>
    </div>
  );
}

function ConfirmDialogInline({
  title,
  message,
  onCancel,
  onConfirm,
  busy,
}: {
  title: string;
  message: string;
  onCancel: () => void;
  onConfirm: () => void;
  busy?: boolean;
}) {
  return (
    <div onClick={onCancel} className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-sm bg-card border border-border rounded-xl shadow-xl">
        <div className="px-4 py-3 border-b border-border">
          <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        </div>
        <p className="px-4 py-3 text-sm text-muted-foreground">{message}</p>
        <div className="px-4 py-3 border-t border-border flex items-center gap-2">
          <button type="button" onClick={onCancel} className="flex-1 h-9 text-sm font-medium text-foreground bg-secondary rounded-md hover:bg-muted">
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className="flex-1 h-9 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700 disabled:opacity-60"
          >
            {busy ? "…" : "Delete"}
          </button>
        </div>
      </div>
    </div>
  );
}

interface CompanyOption {
  id: string;
  name: string | null;
}

function useCompanyList() {
  const [items, setItems] = useState<CompanyOption[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(apiUrl("/api/admin/companies"), { credentials: "include" });
        if (!res.ok) {
          if (!cancelled) setItems([]);
          return;
        }
        const j = (await res.json()) as { companies?: Array<{ id: string; name: string | null }> };
        if (!cancelled) setItems(j.companies ?? []);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);
  return { items, loading };
}

function CompanyPickerModal({
  onClose,
  onPick,
  busy,
  count,
}: {
  onClose: () => void;
  onPick: (id: string) => void;
  busy?: boolean;
  count: number;
}) {
  const { items, loading } = useCompanyList();
  return (
    <div onClick={onClose} className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-md bg-card border border-border rounded-xl shadow-xl">
        <div className="px-4 py-3 border-b border-border flex items-center justify-between">
          <h3 className="text-sm font-semibold text-foreground">Link {count} event{count === 1 ? "" : "s"} to company</h3>
          <button type="button" onClick={onClose} className="h-7 w-7 inline-flex items-center justify-center bg-secondary rounded-md text-muted-foreground hover:text-foreground">
            ✕
          </button>
        </div>
        <div className="max-h-80 overflow-y-auto divide-y divide-border">
          {loading ? (
            <div className="text-xs text-muted-foreground py-6 text-center">Loading…</div>
          ) : items.length === 0 ? (
            <div className="text-xs text-muted-foreground py-6 text-center">No companies</div>
          ) : (
            items.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => onPick(c.id)}
                disabled={busy}
                className="w-full text-left px-4 py-2.5 hover:bg-muted/40 disabled:opacity-50"
              >
                <div className="text-sm font-medium text-foreground truncate">{c.name || "(unnamed)"}</div>
                <div className="text-[11px] text-muted-foreground/60 font-mono truncate">{c.id}</div>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function parseAdParams(raw: string | null): Array<[string, string]> {
  if (!raw) return [];
  try {
    const obj = JSON.parse(raw) as Record<string, string>;
    const LABELS: Record<string, string> = { kw: "Keyword", term: "Search term", campaign: "Campaign" };
    return Object.entries(obj).map(([k, v]) => [LABELS[k] || k, v]);
  } catch {
    return [["Ad params", raw]];
  }
}

function UsageEventDetail({ event, onClose }: { event: UsageRow | null; onClose: () => void }) {
  const [uploading, setUploading] = useState<string | null>(null);
  const [uploadResult, setUploadResult] = useState<unknown | null>(null);

  if (!event) return null;
  const at = new Date(event.at);
  const dt = `${at.getFullYear()}-${String(at.getMonth() + 1).padStart(2, "0")}-${String(at.getDate()).padStart(2, "0")} ${String(at.getHours()).padStart(2, "0")}:${String(at.getMinutes()).padStart(2, "0")}:${String(at.getSeconds()).padStart(2, "0")}`;
  const adParamFields = parseAdParams(event.adParams);
  const fields: Array<[string, string | null]> = [
    ["Event", event.event],
    ["When", dt],
    ["Country", event.country || "—"],
    ["Region", event.region || "—"],
    ["Device", event.device || "—"],
    ["Platform", event.platform || "—"],
    ["Company", event.companyLabel || event.companyId || "—"],
    ["Company ID", event.companyId || "—"],
    ["gclid", event.gclid || "—"],
    ...adParamFields,
    ["Event ID", event.id],
  ];

  async function uploadConv(type: "T1" | "T2" | "T3") {
    if (!event?.gclid || uploading) return;
    setUploading(type);
    setUploadResult(null);
    try {
      const res = await fetch(apiUrl("/api/admin/usage/upload-conversion"), {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gclid: event.gclid, type }),
      });
      const json: unknown = await res.json().catch(() => ({}));
      setUploadResult(json);
    } catch (err) {
      setUploadResult({ error: String(err) });
    } finally {
      setUploading(null);
    }
  }

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md bg-card border border-border rounded-xl shadow-xl"
      >
        <div className="px-4 py-3 border-b border-border flex items-center justify-between">
          <h3 className="text-sm font-semibold text-foreground font-mono truncate pr-3">{event.event}</h3>
          <button
            type="button"
            onClick={onClose}
            className="h-7 w-7 inline-flex items-center justify-center bg-secondary rounded-md text-muted-foreground hover:text-foreground shrink-0"
            title="Close"
          >
            ✕
          </button>
        </div>
        <div className="divide-y divide-border">
          {fields.map(([label, value]) => (
            <div key={label} className="flex items-start gap-3 px-4 py-2">
              <span className="text-[11px] text-muted-foreground shrink-0 w-20">{label}</span>
              <span className="text-xs text-foreground font-mono break-all flex-1">
                {value || "—"}
              </span>
            </div>
          ))}
        </div>

        {event.gclid ? (
          <div className="px-4 py-3 border-t border-border space-y-2">
            <div className="text-[11px] text-muted-foreground uppercase tracking-wider">Upload conversion</div>
            <div className="flex gap-2">
              {(["T1", "T2", "T3"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  disabled={!!uploading}
                  onClick={() => void uploadConv(t)}
                  className="flex-1 h-9 text-sm font-semibold bg-secondary hover:bg-muted rounded-md disabled:opacity-40 transition-colors"
                >
                  {uploading === t ? "…" : t}
                </button>
              ))}
            </div>
          </div>
        ) : null}
      </div>

      {uploadResult !== null ? (
        <UploadResultModal result={uploadResult} onClose={() => setUploadResult(null)} />
      ) : null}
    </div>
  );
}

function UploadResultModal({ result, onClose }: { result: unknown; onClose: () => void }) {
  const isOk = result && typeof result === "object" && (result as Record<string, unknown>).ok === true;
  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg bg-card border border-border rounded-xl shadow-xl flex flex-col max-h-[80vh]"
      >
        <div className="px-4 py-3 border-b border-border flex items-center justify-between shrink-0">
          <span className={`text-sm font-semibold ${isOk ? "text-emerald-500" : "text-red-500"}`}>
            {isOk ? "✓ Success" : "✗ Error"}
          </span>
          <button
            type="button"
            onClick={onClose}
            className="h-7 w-7 inline-flex items-center justify-center bg-secondary rounded-md text-muted-foreground hover:text-foreground"
          >
            ✕
          </button>
        </div>
        <pre className="p-4 text-xs font-mono text-foreground overflow-auto whitespace-pre-wrap break-all">
          {JSON.stringify(result, null, 2)}
        </pre>
      </div>
    </div>
  );
}

export function ConversionUploadButtons({
  gclid,
  className,
}: {
  gclid: string;
  className?: string;
}) {
  const [uploading, setUploading] = useState<string | null>(null);
  const [uploadResult, setUploadResult] = useState<unknown | null>(null);

  async function uploadConv(type: "T1" | "T2" | "T3") {
    if (!gclid || uploading) return;
    setUploading(type);
    setUploadResult(null);
    try {
      const res = await fetch(apiUrl("/api/admin/usage/upload-conversion"), {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gclid, type }),
      });
      const json: unknown = await res.json().catch(() => ({}));
      setUploadResult(json);
    } catch (err) {
      setUploadResult({ error: String(err) });
    } finally {
      setUploading(null);
    }
  }

  return (
    <>
      <div className={"flex items-center gap-1 " + (className || "")}>
        {(["T1", "T2", "T3"] as const).map((t) => (
          <button
            key={t}
            type="button"
            disabled={!!uploading}
            onClick={() => void uploadConv(t)}
            title={`Upload ${t} conversion`}
            className="h-8 px-2 text-xs font-semibold bg-secondary hover:bg-muted rounded-md disabled:opacity-40 transition-colors"
          >
            {uploading === t ? "…" : t}
          </button>
        ))}
      </div>
      {uploadResult !== null ? (
        <UploadResultModal result={uploadResult} onClose={() => setUploadResult(null)} />
      ) : null}
    </>
  );
}
