"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import { ChevronLeft, ChevronRight, Trash2, X as XIcon, Check } from "lucide-react";
import { apiUrl } from "@/lib/api";
import { RefreshIcon } from "../_v2/icons";
import { useDashboardRouter } from "../_spa/router";
import { useScrollLock } from "../_v2/use-scroll-lock";
import {
  countryToFlag,
  hm,
  osName,
  dayLabel,
  todayLocal,
  shiftDayLocal,
  localDayWindow,
  encodeSessionId,
  sessionKey,
  sessionDescriptor,
  type SessionRow,
} from "./usage-shared";

const RETURN_KEY = "usage_return";
const LONG_PRESS_MS = 500;

interface ReturnState {
  day: string;
  scrollY: number;
}

function readReturn(): ReturnState | null {
  try {
    const raw = sessionStorage.getItem(RETURN_KEY);
    return raw ? (JSON.parse(raw) as ReturnState) : null;
  } catch {
    return null;
  }
}

interface Props {
  /** When provided, the toolbar (day navigator / selection actions) is portalled here. */
  toolbarHost?: HTMLElement | null;
}

export function UsageEventsTable({ toolbarHost }: Props) {
  const router = useDashboardRouter();
  const ret = useRef<ReturnState | null>(readReturn());
  const [day, setDay] = useState<string>(() => ret.current?.day ?? todayLocal());
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const atToday = day >= todayLocal();

  const load = useCallback(async (d: string, mode: "full" | "soft" = "full") => {
    if (mode === "full") setLoading(true);
    else setRefreshing(true);
    try {
      const { from, to } = localDayWindow(d);
      const qs = new URLSearchParams({ from, to });
      const res = await fetch(apiUrl(`/api/admin/usage/sessions?${qs.toString()}`), {
        credentials: "include",
      });
      const j = res.ok ? ((await res.json()) as { sessions: SessionRow[] }) : { sessions: [] };
      setSessions(j.sessions ?? []);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load(day);
  }, [day, load]);

  // Restore scroll once, after the returning day's sessions have rendered.
  useEffect(() => {
    if (loading) return;
    const r = ret.current;
    if (r && typeof r.scrollY === "number") {
      window.scrollTo({ top: r.scrollY, behavior: "auto" });
    }
    ret.current = null;
    try { sessionStorage.removeItem(RETURN_KEY); } catch { /* ignore */ }
    // run only when loading flips to false the first time
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading]);

  function changeDay(delta: number) {
    exitSelect();
    setDay((d) => shiftDayLocal(d, delta));
  }

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
      sessionStorage.setItem(RETURN_KEY, JSON.stringify({ day, scrollY: window.scrollY }));
    } catch { /* ignore */ }
    router.push({ name: "settings.admin.usageSession", id: encodeSessionId({ ...s, day }) });
  }

  async function applyDelete() {
    const descriptors = sessions
      .filter((s) => selected.has(sessionKey(s)))
      .map(sessionDescriptor);
    if (descriptors.length === 0) return;
    setDeleting(true);
    try {
      const res = await fetch(apiUrl("/api/admin/usage/sessions/delete"), {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessions: descriptors }),
      });
      if (!res.ok) return;
      setConfirmOpen(false);
      exitSelect();
      await load(day);
    } finally {
      setDeleting(false);
    }
  }

  const navigatorBar = (
    <div className="flex items-center gap-1">
      <button type="button" onClick={() => changeDay(-1)} className="h-8 w-8 inline-flex items-center justify-center bg-secondary rounded-md text-muted-foreground hover:text-foreground" title="Previous day">
        <ChevronLeft className="h-4 w-4" />
      </button>
      <button
        type="button"
        onClick={() => void load(day, "soft")}
        disabled={loading || refreshing}
        className="h-8 px-2.5 inline-flex items-center justify-center gap-1.5 min-w-[96px] text-xs font-medium text-foreground bg-secondary rounded-md hover:bg-muted disabled:opacity-70"
        title="Refresh"
      >
        <RefreshIcon size={12} className={loading || refreshing ? "animate-spin" : ""} />
        <span className="tabular-nums">{dayLabel(day)}</span>
      </button>
      <button type="button" onClick={() => !atToday && changeDay(1)} disabled={atToday} className="h-8 w-8 inline-flex items-center justify-center bg-secondary rounded-md text-muted-foreground hover:text-foreground disabled:opacity-40" title="Next day">
        <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  );

  const selectionBar = (
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
  );

  const toolbar = selectMode ? selectionBar : navigatorBar;

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
            />
          ))}
        </div>
      )}

      {confirmOpen ? (
        <ConfirmDialog
          count={selected.size}
          busy={deleting}
          onCancel={() => setConfirmOpen(false)}
          onConfirm={() => void applyDelete()}
        />
      ) : null}
    </div>
  );
}

function SessionItem({
  session: s,
  selectMode,
  selected,
  onOpen,
  onToggle,
  onLongPress,
}: {
  session: SessionRow;
  selectMode: boolean;
  selected: boolean;
  onOpen: () => void;
  onToggle: () => void;
  onLongPress: () => void;
}) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longFired = useRef(false);
  const startPt = useRef<{ x: number; y: number } | null>(null);

  function clearTimer() {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
  }

  function onPointerDown(e: React.PointerEvent) {
    longFired.current = false;
    startPt.current = { x: e.clientX, y: e.clientY };
    clearTimer();
    timer.current = setTimeout(() => {
      longFired.current = true;
      onLongPress();
    }, LONG_PRESS_MS);
  }
  function onPointerMove(e: React.PointerEvent) {
    const p = startPt.current;
    if (p && (Math.abs(e.clientX - p.x) > 10 || Math.abs(e.clientY - p.y) > 10)) clearTimer();
  }
  function onClick() {
    clearTimer();
    if (longFired.current) {
      longFired.current = false;
      return; // long-press already handled selection; swallow the click
    }
    if (selectMode) onToggle();
    else onOpen();
  }

  // Restaurant name resolved server-side (falls back to the user's restaurant).
  // Shown in full; CSS truncates only when it can't fit the remaining width.
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
      <span className={`${chip} tabular-nums`}>{hm(s.lastAt)}</span>
      <span className={chip}>{s.eventCount}</span>

      <span className="flex-1 min-w-0 flex items-center justify-end gap-2">
        {label ? (
          <span
            className="text-[10px] bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 rounded px-1.5 py-0.5 truncate min-w-0"
            title={label}
          >
            {label}
          </span>
        ) : s.region ? (
          <span
            className="text-[10px] bg-pink-500/10 text-pink-700 dark:text-pink-400 rounded px-1.5 py-0.5 truncate min-w-0"
            title={s.region}
          >
            {s.region}
          </span>
        ) : null}
        <span className={chip}>{osName(s.platform, s.device)}</span>
        {s.hasGoogle ? <span className="text-[10px] font-semibold rounded px-1.5 py-0.5 shrink-0 bg-[#4285f4]/10 text-[#4285f4]">G</span> : null}
        {s.hasFacebook ? <span className="text-[10px] font-semibold rounded px-1.5 py-0.5 shrink-0 bg-[#1877F2]/10 text-[#1877F2]">FB</span> : null}
      </span>
    </button>
  );
}

function ConfirmDialog({
  count,
  busy,
  onCancel,
  onConfirm,
}: {
  count: number;
  busy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
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
          <button type="button" onClick={onCancel} className="flex-1 h-9 text-sm font-medium text-foreground bg-secondary rounded-md hover:bg-muted">
            Cancel
          </button>
          <button type="button" onClick={onConfirm} disabled={busy} className="flex-1 h-9 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700 disabled:opacity-60">
            {busy ? "…" : "Delete"}
          </button>
        </div>
      </div>
    </div>
  );
}
