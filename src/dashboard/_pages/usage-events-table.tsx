"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import { Trash2, Building2, Check, ListChecks, X as XIcon, UserX, Calendar, ArrowDownNarrowWide, ArrowUpNarrowWide } from "lucide-react";
import { apiUrl } from "@/lib/api";
import { RefreshIcon } from "../_v2/icons";
import { useScrollLock } from "../_v2/use-scroll-lock";

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
  ip: string | null;
  isBot: boolean;
}

/** Stable hash → HSL hue. Group by country|device|platform|(ip or region).
 *  IP preferred when present (server-anonymized), region as legacy fallback. */
function sessionHueFor(row: UsageRow): number {
  const tail = row.ip || row.region || "";
  const key = `${row.country}|${row.device || ""}|${row.platform || ""}|${tail}`;
  let h = 5381;
  for (let i = 0; i < key.length; i++) h = ((h << 5) + h + key.charCodeAt(i)) >>> 0;
  return h % 360;
}

function truncate8(s: string): string {
  return s.length <= 8 ? s : s.slice(0, 8) + "..";
}

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
  /** When set, the table is scoped to a single company. */
  companyId?: string;
  /** Reports the current row count to the parent so it can render it in its own header. */
  onCountChange?: (count: number) => void;
  /** When provided, the toolbar buttons are portalled into this host element. */
  toolbarHost?: HTMLElement | null;
}

export function UsageEventsTable({ companyId, onCountChange, toolbarHost }: Props) {
  const [rows, setRows] = useState<UsageRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [selected, setSelected] = useState<UsageRow | null>(null);
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [companyPickerOpen, setCompanyPickerOpen] = useState(false);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [filterFrom, setFilterFrom] = useState<string>("");
  const [filterTo, setFilterTo] = useState<string>("");
  const [filterCompanyId, setFilterCompanyId] = useState<string>("");
  const [filterOnlyAnonymous, setFilterOnlyAnonymous] = useState<boolean>(false);
  const [filterModal, setFilterModal] = useState<"dates" | "company" | null>(null);
  const [sortAsc, setSortAsc] = useState(false);
  const { items: companies, loading: companiesLoading } = useCompanyList();
  const sentinelRef = useRef<HTMLDivElement>(null);
  const selectedCount = selectedIds.size;
  const dateFilterActive = Boolean(filterFrom || filterTo);
  const companyFilterActive = Boolean(filterCompanyId);

  const fetchPage = useCallback(
    async (cursorParam: string | null) => {
      const qs = new URLSearchParams();
      if (companyId) qs.set("companyId", companyId);
      else if (filterCompanyId) qs.set("companyId", filterCompanyId);
      else qs.set("scope", filterOnlyAnonymous ? "anonymous" : "all");
      if (cursorParam) qs.set("cursor", cursorParam);
      if (filterFrom) qs.set("from", new Date(filterFrom).toISOString());
      if (filterTo) qs.set("to", new Date(filterTo).toISOString());
      if (sortAsc) qs.set("sort", "asc");
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
    [companyId, filterCompanyId, filterOnlyAnonymous, filterFrom, filterTo, sortAsc],
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
      // Chain: page may be short — if sentinel still in view, keep loading.
      setTimeout(() => {
        const el = sentinelRef.current;
        if (!el) return;
        const r = el.getBoundingClientRect();
        if (r.top < window.innerHeight + 200 && r.bottom > -200) void loadMore();
      }, 0);
    },
    [fetchPage, onCountChange],
  );

  // Stable loadMore via refs — observer attaches once and reads latest state
  // without identity churn that would re-render the rows during click events.
  const stateRef = useRef({ cursor, hasMore, loadingMore, fetchPage });
  stateRef.current = { cursor, hasMore, loadingMore, fetchPage };

  const loadMore = useCallback(async () => {
    const s = stateRef.current;
    if (!s.cursor || !s.hasMore || s.loadingMore) return;
    setLoadingMore(true);
    try {
      const j = await s.fetchPage(s.cursor);
      if (j) {
        setRows((prev) => [...prev, ...j.events]);
        setHasMore(j.hasMore);
        setCursor(j.nextCursor);
      }
    } finally {
      setLoadingMore(false);
    }
    // Chain: if sentinel still in view after this load, trigger another.
    setTimeout(() => {
      const el = sentinelRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      if (r.top < window.innerHeight + 200 && r.bottom > -200) void loadMore();
    }, 0);
  }, []);

  useEffect(() => {
    // Refresh / page reload / scope change resets bulk mode and selection.
    setSelectMode(false);
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

  function resetListAndScrollTop() {
    setRows([]);
    setCursor(null);
    setHasMore(false);
    if (typeof window !== "undefined") window.scrollTo({ top: 0 });
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
      setSelectMode(false);
      resetListAndScrollTop();
      void load("initial");
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
      setSelectMode(false);
      setCompanyPickerOpen(false);
      resetListAndScrollTop();
      void load("initial");
    } finally {
      setBulkBusy(false);
    }
  }

  // IntersectionObserver — fires loadMore when sentinel scrolls into view.
  // Attaches once per hasMore transition; loadMore is stable via stateRef.
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

  const selectToggle = (
    <button
      type="button"
      onClick={() => {
        setSelectMode(true);
        setSelectedIds(new Set());
      }}
      className="h-8 w-8 inline-flex items-center justify-center bg-secondary rounded-md text-muted-foreground hover:text-foreground"
      title="Select events"
    >
      <ListChecks className="h-3.5 w-3.5" />
    </button>
  );

  const anonButton = (
    <button
      type="button"
      onClick={() => {
        const next = !filterOnlyAnonymous;
        setFilterOnlyAnonymous(next);
        if (next) setFilterCompanyId("");
      }}
      className={
        "h-8 w-8 inline-flex items-center justify-center rounded-md " +
        (filterOnlyAnonymous
          ? "bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-900/40"
          : "bg-secondary text-muted-foreground hover:text-foreground")
      }
      title={filterOnlyAnonymous ? "Anonymous only — on" : "Show anonymous only"}
    >
      <UserX className="h-3.5 w-3.5" />
    </button>
  );

  const sortButton = (
    <button
      type="button"
      onClick={() => setSortAsc((v) => !v)}
      className={
        "h-8 w-8 inline-flex items-center justify-center rounded-md " +
        (sortAsc
          ? "bg-primary/15 text-primary hover:bg-primary/25"
          : "bg-secondary text-muted-foreground hover:text-foreground")
      }
      title={sortAsc ? "Oldest first (asc)" : "Newest first (desc)"}
    >
      {sortAsc ? <ArrowUpNarrowWide className="h-3.5 w-3.5" /> : <ArrowDownNarrowWide className="h-3.5 w-3.5" />}
    </button>
  );

  const dateButton = (
    <button
      type="button"
      onClick={() => setFilterModal("dates")}
      className={
        "h-8 w-8 inline-flex items-center justify-center rounded-md " +
        (dateFilterActive
          ? "bg-primary/15 text-primary hover:bg-primary/25"
          : "bg-secondary text-muted-foreground hover:text-foreground")
      }
      title={dateFilterActive ? "Date filter active" : "Date filter"}
    >
      <Calendar className="h-3.5 w-3.5" />
    </button>
  );
  const companyFilterButton = !companyId ? (
    <button
      type="button"
      onClick={() => setFilterModal("company")}
      className={
        "h-8 w-8 inline-flex items-center justify-center rounded-md " +
        (companyFilterActive
          ? "bg-primary/15 text-primary hover:bg-primary/25"
          : "bg-secondary text-muted-foreground hover:text-foreground")
      }
      title={companyFilterActive ? "Company filter active" : "Company filter"}
    >
      <Building2 className="h-3.5 w-3.5" />
    </button>
  ) : null;

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

  const selectionActions = (
    <>
      <button
        type="button"
        onClick={() => selectedCount > 0 && setConfirmDelete(true)}
        disabled={selectedCount === 0 || bulkBusy}
        className="h-8 w-8 inline-flex items-center justify-center rounded-md bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/40 disabled:opacity-40"
        title={`Delete ${selectedCount}`}
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        onClick={() => selectedCount > 0 && setCompanyPickerOpen(true)}
        disabled={selectedCount === 0 || bulkBusy}
        className="h-8 w-8 inline-flex items-center justify-center rounded-md bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/40 disabled:opacity-40"
        title={`Link ${selectedCount} to company`}
      >
        <Building2 className="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        onClick={() => {
          setSelectMode(false);
          setSelectedIds(new Set());
        }}
        className="h-8 w-8 inline-flex items-center justify-center rounded-md bg-secondary text-muted-foreground hover:text-foreground"
        title="Clear"
      >
        <XIcon className="h-3.5 w-3.5" />
      </button>
    </>
  );

  const toolbarPortalContent = selectMode ? (
    selectionActions
  ) : (
    <>
      {selectToggle}
      {anonButton}
      {companyFilterButton}
      {dateButton}
      {sortButton}
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
            {selectMode ? selectionActions : (
              <>
                {selectToggle}
                {anonButton}
                {companyFilterButton}
                {dateButton}
                {refreshButton}
              </>
            )}
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
                if (selectMode) {
                  toggleSelect(row.id);
                  return;
                }
                setSelected(row);
              }}
              className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-left hover:bg-muted/40 transition-colors"
            >
              {selectMode ? (
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
                    title={`Session group: ${row.country} / ${row.device || "—"} / ${row.platform || "—"} / ${row.ip || "—"}`}
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
              {row.isBot ? (
                <span
                  className="inline-flex items-center justify-center w-3.5 h-3.5 rounded-full bg-yellow-400 text-[8px] font-bold text-black shrink-0"
                  title="Bot (detected via User-Agent)"
                  aria-hidden
                >
                  B
                </span>
              ) : row.gclid ? (
                <span
                  className="inline-flex items-center justify-center w-3.5 h-3.5 rounded-full bg-[#4285f4] text-[8px] font-bold text-white shrink-0"
                  title={row.gclid}
                  aria-hidden
                >
                  G
                </span>
              ) : null}
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
          title={`Link ${selectedCount} event${selectedCount === 1 ? "" : "s"} to company`}
          companies={companies}
          loading={companiesLoading}
          onClose={() => setCompanyPickerOpen(false)}
          onPick={(id) => void applyLinkCompany(id)}
          busy={bulkBusy}
          showSearch
        />
      ) : null}

      {filterModal === "dates" ? (
        <FilterModal
          from={filterFrom}
          to={filterTo}
          onClose={() => setFilterModal(null)}
          onApply={(f, t) => {
            setFilterFrom(f);
            setFilterTo(t);
            setFilterModal(null);
          }}
          onClear={() => {
            setFilterFrom("");
            setFilterTo("");
            setFilterModal(null);
          }}
        />
      ) : null}

      {filterModal === "company" ? (
        <CompanyPickerModal
          title="Filter by company"
          companies={companies}
          loading={companiesLoading}
          initialSelected={filterCompanyId}
          onClose={() => setFilterModal(null)}
          onPick={(id) => {
            setFilterCompanyId(id);
            if (id) setFilterOnlyAnonymous(false);
            setFilterModal(null);
          }}
          onClear={() => {
            setFilterCompanyId("");
            setFilterModal(null);
          }}
          showSearch
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
  onClose,
  onApply,
  onClear,
}: {
  from: string;
  to: string;
  onClose: () => void;
  onApply: (from: string, to: string) => void;
  onClear: () => void;
}) {
  useScrollLock(true);
  const defaults = todayRangeDefaults();
  const [draftFrom, setDraftFrom] = useState(from || defaults.from);
  const [draftTo, setDraftTo] = useState(to || defaults.to);
  const [datesTouched, setDatesTouched] = useState(Boolean(from || to));
  return (
    <div onClick={onClose} className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-sm bg-card border border-border rounded-xl shadow-xl">
        <div className="px-4 py-3 border-b border-border flex items-center justify-between">
          <h3 className="text-sm font-semibold text-foreground">Date filter</h3>
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
              onChange={(e) => { setDraftFrom(e.target.value); setDatesTouched(true); }}
              className="w-full h-9 px-3 bg-secondary rounded-md text-sm text-foreground focus:outline-none"
            />
          </label>
          <label className="block">
            <span className="block text-[11px] text-muted-foreground uppercase tracking-wider mb-1">To</span>
            <input
              type="datetime-local"
              value={draftTo}
              onChange={(e) => { setDraftTo(e.target.value); setDatesTouched(true); }}
              className="w-full h-9 px-3 bg-secondary rounded-md text-sm text-foreground focus:outline-none"
            />
          </label>
        </div>
        <div className="px-4 py-3 border-t border-border flex items-center gap-2">
          <button type="button" onClick={onClear} className="flex-1 h-9 text-sm font-medium text-foreground bg-secondary rounded-md hover:bg-muted">
            Clear
          </button>
          <button
            type="button"
            onClick={() => onApply(
              datesTouched ? draftFrom : "",
              datesTouched ? draftTo : "",
            )}
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
  useScrollLock(true);
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
  title,
  companies,
  loading,
  initialSelected,
  onClose,
  onPick,
  onClear,
  busy,
  showSearch,
}: {
  title: string;
  companies: CompanyOption[];
  loading: boolean;
  initialSelected?: string;
  onClose: () => void;
  onPick: (id: string) => void;
  onClear?: () => void;
  busy?: boolean;
  showSearch?: boolean;
}) {
  useScrollLock(true);
  const [query, setQuery] = useState("");
  const [draft, setDraft] = useState(initialSelected ?? "");
  const q = query.trim().toLowerCase();
  const filtered = q
    ? companies.filter((c) => (c.name || "").toLowerCase().includes(q))
    : companies;
  const applyMode = Boolean(onClear);
  return (
    <div onClick={onClose} className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-md bg-card border border-border rounded-xl shadow-xl flex flex-col max-h-[80vh]">
        <div className="px-4 py-3 border-b border-border flex items-center justify-between shrink-0">
          <h3 className="text-sm font-semibold text-foreground">{title}</h3>
          <button type="button" onClick={onClose} className="h-7 w-7 inline-flex items-center justify-center bg-secondary rounded-md text-muted-foreground hover:text-foreground">
            ✕
          </button>
        </div>
        {showSearch ? (
          <div className="px-4 py-2.5 border-b border-border shrink-0">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search…"
              className="w-full h-9 px-3 rounded-md bg-secondary text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
        ) : null}
        <div className="overflow-y-auto divide-y divide-border">
          {loading ? (
            <div className="text-xs text-muted-foreground py-6 text-center">Loading…</div>
          ) : filtered.length === 0 ? (
            <div className="text-xs text-muted-foreground py-6 text-center">No companies</div>
          ) : (
            filtered.map((c) => {
              const selected = applyMode && draft === c.id;
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => applyMode ? setDraft(c.id) : onPick(c.id)}
                  disabled={busy}
                  className={"w-full text-left px-4 py-2.5 disabled:opacity-50 transition-colors " + (selected ? "bg-primary/10 text-primary" : "hover:bg-muted/40")}
                >
                  <div className={"text-sm font-medium truncate " + (selected ? "" : "text-foreground")}>{c.name || "(unnamed)"}</div>
                </button>
              );
            })
          )}
        </div>
        {applyMode ? (
          <div className="px-4 py-3 border-t border-border flex items-center gap-2 shrink-0">
            <button type="button" onClick={onClear} className="flex-1 h-9 text-sm font-medium text-foreground bg-secondary rounded-md hover:bg-muted">
              Clear
            </button>
            <button
              type="button"
              onClick={() => onPick(draft)}
              disabled={!draft}
              className="flex-1 h-9 text-sm font-medium text-primary-foreground bg-primary rounded-md hover:opacity-90 disabled:opacity-50"
            >
              Apply
            </button>
          </div>
        ) : null}
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
  useScrollLock(Boolean(event));
  const [similarOpen, setSimilarOpen] = useState(false);

  if (!event) return null;
  const at = new Date(event.at);
  const dt = `${at.getFullYear()}-${String(at.getMonth() + 1).padStart(2, "0")}-${String(at.getDate()).padStart(2, "0")} ${String(at.getHours()).padStart(2, "0")}:${String(at.getMinutes()).padStart(2, "0")}:${String(at.getSeconds()).padStart(2, "0")}`;
  const adParamFields = parseAdParams(event.adParams);
  const fields: Array<[string, string | null]> = [
    ["Event", event.event],
    ["When", dt],
    ["Country", event.country || "—"],
    ["Region", event.region || "—"],
    ["IP", event.ip || "—"],
    ["Device", event.device || "—"],
    ["Platform", event.platform || "—"],
    ["Company", event.companyLabel || event.companyId || "—"],
    ["Company ID", event.companyId || "—"],
    ["gclid", event.gclid || "—"],
    ["Bot", event.isBot ? "yes" : "no"],
    ...adParamFields,
    ["Event ID", event.id],
  ];

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

        <div className="px-4 py-3 border-t border-border">
          <button
            type="button"
            onClick={() => setSimilarOpen(true)}
            className="w-full h-9 text-sm font-medium bg-secondary hover:bg-muted rounded-md transition-colors"
          >
            Show similar events
          </button>
        </div>
      </div>

      {similarOpen ? (
        <SimilarEventsModal eventId={event.id} onClose={() => setSimilarOpen(false)} />
      ) : null}
    </div>
  );
}

function SimilarEventsModal({ eventId, onClose }: { eventId: string; onClose: () => void }) {
  useScrollLock(true);
  const [rows, setRows] = useState<UsageRow[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(apiUrl(`/api/admin/usage/similar/${eventId}`), { credentials: "include" });
        if (!res.ok) { if (!cancelled) setError(`Error ${res.status}`); return; }
        const j = await res.json();
        if (!cancelled) setRows(j.events ?? []);
      } catch (e: any) {
        if (!cancelled) setError(String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [eventId]);

  return (
    <div onClick={onClose} className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-2xl bg-card border border-border rounded-xl shadow-xl flex flex-col max-h-[85vh]">
        <div className="px-4 py-3 border-b border-border flex items-center justify-between shrink-0">
          <h3 className="text-sm font-semibold text-foreground">
            Similar events {rows ? `(${rows.length})` : ""}
          </h3>
          <button type="button" onClick={onClose} className="h-7 w-7 inline-flex items-center justify-center bg-secondary rounded-md text-muted-foreground hover:text-foreground">
            ✕
          </button>
        </div>
        <div className="overflow-y-auto">
          {loading ? (
            <div className="text-xs text-muted-foreground py-8 text-center">Loading…</div>
          ) : error ? (
            <div className="text-xs text-red-500 py-8 text-center">{error}</div>
          ) : !rows || rows.length === 0 ? (
            <div className="text-xs text-muted-foreground py-8 text-center">No matches</div>
          ) : (
            <div className="divide-y divide-border">
              {rows.map((r) => (
                <div
                  key={r.id}
                  className="w-full flex items-center gap-2 px-3 py-1.5 text-xs"
                >
                  {r.companyId ? (
                    <span className="text-[10px] text-muted-foreground bg-secondary rounded px-1.5 py-0.5 shrink-0" title={r.companyLabel || r.companyId}>
                      {truncate8(r.companyLabel || r.companyId)}
                    </span>
                  ) : (
                    <>
                      <span className="inline-block w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: `hsl(${sessionHueFor(r)} 70% 55%)` }} />
                      <span className="text-base shrink-0">{countryToFlag(r.country)}</span>
                    </>
                  )}
                  <span className="font-mono text-foreground truncate flex-1">{r.event}</span>
                  {r.isBot ? (
                    <span className="inline-flex items-center justify-center w-3.5 h-3.5 rounded-full bg-yellow-400 text-[8px] font-bold text-black shrink-0" title="Bot">B</span>
                  ) : r.gclid ? (
                    <span className="inline-flex items-center justify-center w-3.5 h-3.5 rounded-full bg-[#4285f4] text-[8px] font-bold text-white shrink-0" title={r.gclid}>G</span>
                  ) : null}
                  <span className="text-[10px] text-muted-foreground tabular-nums shrink-0">
                    {fmtAt(r.at)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

