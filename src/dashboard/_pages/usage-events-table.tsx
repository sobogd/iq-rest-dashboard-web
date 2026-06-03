"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import { Trash2, X as XIcon, Check } from "lucide-react";
import { apiUrl } from "@/lib/api";
import { RefreshIcon } from "../_v2/icons";
import { useDashboardRouter } from "../_spa/router";
import { useScrollLock } from "../_v2/use-scroll-lock";
import {
  countryToFlag,
  hmsDate,
  encodeSessionId,
  sessionKey,
  sessionDescriptor,
  type SessionRow,
} from "./usage-shared";

const RETURN_KEY = "usage_return";
const LONG_PRESS_MS = 500;

// FB chip colour by the deepest CAPI milestone already sent for the session.
function fbStageClass(stage: SessionRow["fbStage"]): string {
  switch (stage) {
    case "reg":
      return "bg-pink-500/10 text-pink-700 dark:text-pink-400 hover:bg-pink-500/20";
    case "checkout":
      return "bg-amber-500/15 text-amber-700 dark:text-amber-400 hover:bg-amber-500/25";
    case "view":
      return "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/20";
    default:
      return "text-muted-foreground bg-secondary hover:bg-muted";
  }
}
function fbStageTitle(stage: SessionRow["fbStage"]): string {
  switch (stage) {
    case "reg":
      return "CompleteRegistration sent — send again";
    case "checkout":
      return "InitiateCheckout sent — send again";
    case "view":
      return "ViewContent sent — send again";
    default:
      return "Send a Meta CAPI event";
  }
}

// Module-level cache so navigating into a session and back doesn't re-fetch or
// re-render the (potentially large) list. Refreshed only by the Update button.
let sessionCache: SessionRow[] | null = null;

/** Drop the cached session list (e.g. after a manual assign regroups data). */
export function invalidateUsageCache() {
  sessionCache = null;
}

interface Props {
  toolbarHost?: HTMLElement | null;
}

export function UsageEventsTable({ toolbarHost }: Props) {
  const router = useDashboardRouter();
  // Fixed 30-day window, computed once.
  const win = useRef({ from: new Date(Date.now() - 30 * 864e5).toISOString(), to: new Date().toISOString() });
  const returnScroll = useRef<number | null>(readReturnScroll());
  const [sessions, setSessions] = useState<SessionRow[]>(() => sessionCache ?? []);
  const [loading, setLoading] = useState(() => sessionCache === null);
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    // Recompute the 30-day window on every fetch so a refresh picks up sessions
    // newer than the initial mount (the API filters at < to).
    win.current = { from: new Date(Date.now() - 30 * 864e5).toISOString(), to: new Date().toISOString() };
    try {
      const qs = new URLSearchParams({ from: win.current.from, to: win.current.to });
      const res = await fetch(apiUrl(`/api/admin/usage/sessions?${qs.toString()}`), { credentials: "include" });
      const j = res.ok ? ((await res.json()) as { sessions: SessionRow[] }) : { sessions: [] };
      sessionCache = j.sessions ?? [];
      setSessions(sessionCache);
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch only when there's no cache; navigating back reuses it. The Update
  // button (and a delete) call load() explicitly to refresh.
  useEffect(() => {
    if (sessionCache === null) void load();
  }, [load]);

  // Restore scroll once after the list re-mounts (return from a session).
  useEffect(() => {
    if (loading) return;
    if (returnScroll.current != null) {
      window.scrollTo({ top: returnScroll.current, behavior: "auto" });
      returnScroll.current = null;
      try { sessionStorage.removeItem(RETURN_KEY); } catch { /* ignore */ }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading]);

  function exitSelect() {
    setSelectMode(false);
    setSelected(new Set());
  }

  function toggle(key: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function openSession(s: SessionRow) {
    try {
      sessionStorage.setItem(RETURN_KEY, JSON.stringify({ scrollY: window.scrollY }));
    } catch { /* ignore */ }
    router.push({ name: "settings.admin.usageSession", id: encodeSessionId({ ...s, from: win.current.from, to: win.current.to }) });
  }

  async function applyDelete() {
    const descriptors = sessions.filter((s) => selected.has(sessionKey(s))).map(sessionDescriptor);
    if (descriptors.length === 0) return;
    setDeleting(true);
    try {
      const res = await fetch(apiUrl("/api/admin/usage/sessions/delete"), {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ from: win.current.from, to: win.current.to, sessions: descriptors }),
      });
      if (!res.ok) return;
      setConfirmOpen(false);
      exitSelect();
      await load();
    } finally {
      setDeleting(false);
    }
  }

  const toolbar = selectMode ? (
    <div className="flex items-center gap-1">
      <button
        type="button"
        onClick={() => selected.size > 0 && setConfirmOpen(true)}
        disabled={selected.size === 0 || deleting}
        className="h-8 inline-flex items-center gap-1.5 px-2.5 rounded-md bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/40 disabled:opacity-40 text-xs font-medium"
        title={`Delete ${selected.size}`}
      >
        <Trash2 className="h-3.5 w-3.5" /> {selected.size}
      </button>
      <button type="button" onClick={exitSelect} className="h-8 w-8 inline-flex items-center justify-center bg-secondary rounded-md text-muted-foreground hover:text-foreground" title="Cancel">
        <XIcon className="h-3.5 w-3.5" />
      </button>
    </div>
  ) : (
    <button
      type="button"
      onClick={() => void load()}
      disabled={loading}
      className="h-8 w-8 inline-flex items-center justify-center bg-secondary rounded-md text-muted-foreground hover:text-foreground disabled:opacity-60"
      title="Refresh"
    >
      <RefreshIcon size={14} className={loading ? "animate-spin" : ""} />
    </button>
  );

  return (
    <div className="space-y-3">
      {toolbarHost ? createPortal(toolbar, toolbarHost) : <div className="flex">{toolbar}</div>}

      {loading ? (
        <div className="text-xs text-muted-foreground py-8 text-center">Loading…</div>
      ) : sessions.length === 0 ? (
        <div className="text-xs text-muted-foreground py-8 text-center">No sessions</div>
      ) : (
        <div className="bg-card border border-border rounded-xl overflow-hidden divide-y divide-border">
          {sessions.map((s) => (
            <SessionItem
              key={sessionKey(s)}
              session={s}
              selectMode={selectMode}
              selected={selected.has(sessionKey(s))}
              onOpen={() => openSession(s)}
              onToggle={() => toggle(sessionKey(s))}
              onLongPress={() => {
                setSelectMode(true);
                setSelected(new Set([sessionKey(s)]));
              }}
              onFb={() =>
                s.latestFbclid &&
                router.push({ name: "settings.admin.capiSend", fbclid: s.latestFbclid, clickTs: s.latestFbTs ?? undefined })
              }
            />
          ))}
        </div>
      )}

      {confirmOpen ? (
        <ConfirmDialog count={selected.size} busy={deleting} onCancel={() => setConfirmOpen(false)} onConfirm={() => void applyDelete()} />
      ) : null}
    </div>
  );
}

function readReturnScroll(): number | null {
  try {
    const raw = sessionStorage.getItem(RETURN_KEY);
    if (!raw) return null;
    const v = JSON.parse(raw) as { scrollY?: number };
    return typeof v.scrollY === "number" ? v.scrollY : null;
  } catch {
    return null;
  }
}

function SessionItem({
  session: s,
  selectMode,
  selected,
  onOpen,
  onToggle,
  onLongPress,
  onFb,
}: {
  session: SessionRow;
  selectMode: boolean;
  selected: boolean;
  onOpen: () => void;
  onToggle: () => void;
  onLongPress: () => void;
  onFb: () => void;
}) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longFired = useRef(false);
  const startPt = useRef<{ x: number; y: number } | null>(null);

  function clearTimer() {
    if (timer.current) { clearTimeout(timer.current); timer.current = null; }
  }
  function onPointerDown(e: React.PointerEvent) {
    longFired.current = false;
    startPt.current = { x: e.clientX, y: e.clientY };
    clearTimer();
    timer.current = setTimeout(() => { longFired.current = true; onLongPress(); }, LONG_PRESS_MS);
  }
  function onPointerMove(e: React.PointerEvent) {
    const p = startPt.current;
    if (p && (Math.abs(e.clientX - p.x) > 10 || Math.abs(e.clientY - p.y) > 10)) clearTimer();
  }
  function onClick() {
    clearTimer();
    if (longFired.current) { longFired.current = false; return; }
    if (selectMode) onToggle();
    else onOpen();
  }

  const label = s.restaurantLabel;
  const chip = "text-[10px] text-muted-foreground bg-secondary rounded px-1.5 py-0.5 shrink-0";

  return (
    <button
      type="button"
      onClick={onClick}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={clearTimer}
      onPointerLeave={clearTimer}
      onContextMenu={(e) => e.preventDefault()}
      className="w-full flex items-center gap-2 px-3 py-2 text-xs text-left hover:bg-muted/40 transition-colors"
    >
      {selectMode ? (
        <span
          className={
            "shrink-0 inline-flex items-center justify-center w-4 h-4 rounded border " +
            (selected ? "bg-primary border-primary text-primary-foreground" : "border-border bg-card")
          }
          aria-hidden
        >
          {selected ? <Check className="w-2.5 h-2.5" /> : null}
        </span>
      ) : null}

      <span className="text-base shrink-0" title={s.country}>{countryToFlag(s.country)}</span>

      <span className="flex-1 min-w-0 flex items-center gap-2">
        {label ? (
          <span className="text-[10px] bg-pink-500/10 text-pink-700 dark:text-pink-400 rounded px-1.5 py-0.5 truncate min-w-0" title={label}>{label}</span>
        ) : s.region ? (
          <span className={`${chip} truncate min-w-0`} title={s.region}>{s.region}</span>
        ) : null}
      </span>

      <span className="shrink-0 flex items-center gap-2">
        {s.hasContent || s.hasOnboarding ? (
          <span className="shrink-0 flex flex-col items-center justify-center gap-0.5">
            {s.hasContent ? <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" title="Pricing / Demo" /> : null}
            {s.hasOnboarding ? <span className="w-1.5 h-1.5 rounded-full bg-amber-500" title="Onboarding" /> : null}
          </span>
        ) : null}
        {s.hasGoogle ? <span className={chip}>G</span> : null}
        {s.latestFbclid ? (
          <span
            role="button"
            tabIndex={-1}
            onClick={(e) => { e.stopPropagation(); onFb(); }}
            className={"text-[10px] rounded px-1.5 py-0.5 shrink-0 cursor-pointer " + fbStageClass(s.fbStage)}
            title={fbStageTitle(s.fbStage)}
          >
            FB
          </span>
        ) : s.hasFacebook ? (
          <span className={chip}>FB</span>
        ) : null}
        <span className={chip}>{s.eventCount}</span>
        <span className={`${chip} tabular-nums`}>{hmsDate(s.lastAt)}</span>
      </span>
    </button>
  );
}

function ConfirmDialog({
  count, busy, onCancel, onConfirm,
}: {
  count: number; busy: boolean; onCancel: () => void; onConfirm: () => void;
}) {
  useScrollLock(true);
  return (
    <div onClick={onCancel} className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-sm bg-card border border-border rounded-xl shadow-xl">
        <div className="px-4 py-3 border-b border-border">
          <h3 className="text-sm font-semibold text-foreground">Delete sessions</h3>
        </div>
        <p className="px-4 py-3 text-sm text-muted-foreground">
          Delete {count} selected session{count === 1 ? "" : "s"} and all their events? This cannot be undone.
        </p>
        <div className="px-4 py-3 border-t border-border flex items-center gap-2">
          <button type="button" onClick={onCancel} className="flex-1 h-9 text-sm font-medium text-foreground bg-secondary rounded-md hover:bg-muted">Cancel</button>
          <button type="button" onClick={onConfirm} disabled={busy} className="flex-1 h-9 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700 disabled:opacity-60">
            {busy ? "…" : "Delete"}
          </button>
        </div>
      </div>
    </div>
  );
}
