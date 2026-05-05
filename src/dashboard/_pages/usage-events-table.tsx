"use client";

import { useEffect, useState, useCallback, useRef } from "react";
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

function truncate(s: string, max: number): string {
  return s.length <= max ? s : s.slice(0, max) + "…";
}

/** Stable hash → HSL hue. Rows sharing country|region|device|platform get the
 *  same colour dot so likely-same-visitor anonymous sessions cluster visually. */
function sessionHueFor(row: UsageRow): number {
  const key = `${row.country}|${row.region}|${row.device || ""}|${row.platform || ""}`;
  let h = 5381;
  for (let i = 0; i < key.length; i++) h = ((h << 5) + h + key.charCodeAt(i)) >>> 0;
  return h % 360;
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
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}:${String(d.getSeconds()).padStart(2, "0")}`;
}

function todayUtcStr(): string {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

function shiftDate(d: string, days: number): string {
  const [y, m, day] = d.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, day + days));
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, "0")}-${String(dt.getUTCDate()).padStart(2, "0")}`;
}

function fmtDateLabel(d: string): string {
  const [, m, day] = d.split("-");
  return `${day}.${m}`;
}

interface Props {
  /** When set, the table is scoped to a single company and the scope toggle is hidden. */
  companyId?: string;
  /** Default scope; ignored when companyId is set. */
  initialScope?: UsageScope;
  /** Reports the current row count to the parent so it can render it in its own header. */
  onCountChange?: (count: number) => void;
}

const SCOPE_LABEL: Record<UsageScope, string> = {
  anonymous: "Anon",
  identified: "ID",
};

export function UsageEventsTable({ companyId, initialScope = "anonymous", onCountChange }: Props) {
  const [date, setDate] = useState<string>(() => todayUtcStr());
  const [scope, setScope] = useState<UsageScope>(initialScope);
  const [rows, setRows] = useState<UsageRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [selected, setSelected] = useState<UsageRow | null>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);

  const isToday = date === todayUtcStr();

  const fetchPage = useCallback(
    async (cursorParam: string | null) => {
      const qs = new URLSearchParams({ date });
      if (companyId) qs.set("companyId", companyId);
      else qs.set("scope", scope);
      if (cursorParam) qs.set("cursor", cursorParam);
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
    [date, scope, companyId],
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
    void load("initial");
  }, [load]);

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

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        {/* Date stepper */}
        <button
          type="button"
          onClick={() => setDate((d) => shiftDate(d, -1))}
          className="h-8 w-8 inline-flex items-center justify-center bg-secondary rounded-md text-muted-foreground hover:text-foreground"
          title="Previous day"
        >
          ‹
        </button>
        <div className="h-8 px-3 inline-flex items-center bg-secondary rounded-md text-xs font-medium tabular-nums">
          {fmtDateLabel(date)}
        </div>
        <button
          type="button"
          onClick={() => {
            const next = shiftDate(date, 1);
            if (next <= todayUtcStr()) setDate(next);
          }}
          disabled={isToday}
          className="h-8 w-8 inline-flex items-center justify-center bg-secondary rounded-md text-muted-foreground hover:text-foreground disabled:opacity-40 disabled:cursor-not-allowed"
          title="Next day"
        >
          ›
        </button>

        {!companyId && (
          <div className="inline-flex items-center gap-0.5 p-0.5 bg-secondary rounded-lg ml-2">
            {(["anonymous", "identified"] as UsageScope[]).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setScope(s)}
                className={
                  "h-7 px-2.5 inline-flex items-center rounded-md text-[11px] font-medium transition-colors " +
                  (scope === s ? "bg-card text-foreground shadow-sm" : "text-muted-foreground")
                }
              >
                {SCOPE_LABEL[s]}
              </button>
            ))}
          </div>
        )}

        <button
          type="button"
          onClick={() => void load("refresh")}
          disabled={refreshing || loading}
          className="h-8 w-8 ml-auto inline-flex items-center justify-center bg-secondary rounded-md text-muted-foreground hover:text-foreground disabled:opacity-60"
          title="Refresh"
        >
          <RefreshIcon size={14} className={refreshing ? "animate-spin" : ""} />
        </button>
      </div>

      {loading ? (
        <div className="text-xs text-muted-foreground py-8 text-center">Loading…</div>
      ) : rows.length === 0 ? (
        <div className="text-xs text-muted-foreground py-8 text-center">No events on this day</div>
      ) : (
        <div className="bg-card border border-border rounded-xl overflow-hidden divide-y divide-border">
          {rows.map((row) => (
            <button
              key={row.id}
              type="button"
              onClick={() => setSelected(row)}
              className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-left hover:bg-muted/40 transition-colors"
            >
              <span
                className="inline-block w-2 h-2 rounded-full shrink-0"
                style={{ backgroundColor: `hsl(${sessionHueFor(row)} 70% 55%)` }}
                title={`Session group: ${row.country} ${row.region || "—"} / ${row.device || "—"} / ${row.platform || "—"}`}
              />
              <span className="text-base shrink-0" title={row.country}>
                {countryToFlag(row.country)}
              </span>
              <span className="font-mono text-foreground truncate flex-1">{row.event}</span>
              {row.companyId && !companyId && (
                <span
                  className="text-[10px] text-muted-foreground bg-secondary rounded px-1.5 py-0.5 shrink-0"
                  title={row.companyLabel || row.companyId}
                >
                  {truncate(row.companyLabel || row.companyId, 10)}
                </span>
              )}
              {row.device && (
                <span className="text-[10px] text-muted-foreground shrink-0" title={`${row.device} / ${row.platform || "—"}`}>
                  {row.device === "mobile" ? "📱" : row.device === "tablet" ? "📋" : "🖥"}
                </span>
              )}
              {row.gclid && (
                <span
                  role="button"
                  tabIndex={0}
                  onClick={(e) => {
                    e.stopPropagation();
                    navigator.clipboard?.writeText(row.gclid!);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      e.stopPropagation();
                      navigator.clipboard?.writeText(row.gclid!);
                    }
                  }}
                  className="inline-flex items-center justify-center w-3.5 h-3.5 rounded-full bg-[#4285f4] text-[8px] font-bold text-white shrink-0 hover:scale-110 transition-transform cursor-pointer"
                  title={`Click to copy gclid:\n${row.gclid}`}
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

function ConversionPicker({ gclid, onClose }: { gclid: string; onClose: () => void }) {
  const [loading, setLoading] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  async function upload(type: string) {
    setLoading(type);
    try {
      const res = await fetch(apiUrl("/api/admin/usage/upload-conversion"), {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gclid, type }),
      });
      if (res.ok) setDone(type);
    } finally {
      setLoading(null);
    }
  }

  return (
    <div onClick={(e) => e.stopPropagation()} className="mt-3 pt-3 border-t border-border">
      <p className="text-[11px] text-muted-foreground mb-2">Upload conversion</p>
      {done ? (
        <p className="text-xs text-green-500">{done} uploaded ✓</p>
      ) : (
        <div className="flex gap-2">
          {["T1", "T2", "T3"].map((t) => (
            <button
              key={t}
              type="button"
              disabled={!!loading}
              onClick={() => void upload(t)}
              className="h-7 px-3 text-xs font-medium bg-secondary hover:bg-muted rounded-md disabled:opacity-50"
            >
              {loading === t ? "…" : t}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function UsageEventDetail({ event, onClose }: { event: UsageRow | null; onClose: () => void }) {
  const [showConvPicker, setShowConvPicker] = useState(false);

  useEffect(() => { setShowConvPicker(false); }, [event]);

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
              <span
                className="text-xs text-foreground font-mono break-all flex-1 cursor-pointer"
                onClick={() => value && value !== "—" && navigator.clipboard?.writeText(value)}
                title={value && value !== "—" ? "Click to copy" : ""}
              >
                {value || "—"}
              </span>
            </div>
          ))}
        </div>
        {event.gclid && (
          <div className="px-4 pb-4">
            {showConvPicker ? (
              <ConversionPicker gclid={event.gclid} onClose={() => setShowConvPicker(false)} />
            ) : (
              <button
                type="button"
                onClick={() => setShowConvPicker(true)}
                className="mt-3 h-8 px-4 text-xs font-medium bg-[#4285f4] hover:bg-[#3367d6] text-white rounded-md w-full"
              >
                Upload to Google Ads
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
