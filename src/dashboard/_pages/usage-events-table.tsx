"use client";

import { useState, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronLeft, ChevronRight, Store, User as UserIcon } from "lucide-react";
import { apiUrl } from "@/lib/api";
import { useScrollLock } from "../_v2/use-scroll-lock";

// ── Types ──

interface SessionRow {
  ipkey: string | null;
  hasIp: boolean;
  country: string;
  device: string | null;
  platform: string | null;
  firstAt: string;
  lastAt: string;
  eventCount: number;
  hasGoogle: boolean;
  hasFacebook: boolean;
  userId: string | null;
  restaurantId: string | null;
  userLabel: string | null;
  restaurantLabel: string | null;
}

interface SessionEvent {
  id: string;
  at: string;
  event: string;
  gclid: string | null;
  isFacebookAds: boolean;
  fbSentEvents: string[];
}

/** Meta CAPI events that can be sent manually from a fbclid landing event. */
const FB_EVENTS: Array<{ name: string; desc: string }> = [
  { name: "CompleteRegistration", desc: "Conversion — campaign optimization goal" },
  { name: "Lead", desc: "Lead / sign-up intent" },
  { name: "ViewContent", desc: "Viewed demo / content (learning)" },
  { name: "InitiateCheckout", desc: "Started onboarding / checkout" },
  { name: "Subscribe", desc: "Started a subscription" },
  { name: "Purchase", desc: "Paid subscription (value)" },
  { name: "PageView", desc: "Landing page view (top funnel)" },
];

// ── Helpers ──

function countryToFlag(code: string): string {
  if (!code || code === "XX" || code.length !== 2) return "🌐";
  const A = 0x1f1e6;
  const a = "A".charCodeAt(0);
  return String.fromCodePoint(A + code.charCodeAt(0) - a, A + code.charCodeAt(1) - a);
}

const pad = (n: number) => String(n).padStart(2, "0");

/** Local HH:MM:SS for an ISO timestamp. */
function hms(iso: string): string {
  const d = new Date(iso);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function todayUTC(): string {
  return new Date().toISOString().slice(0, 10);
}

function shiftDay(day: string, delta: number): string {
  const d = new Date(`${day}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}

function dayLabel(day: string): string {
  const t = todayUTC();
  if (day === t) return "Today";
  if (day === shiftDay(t, -1)) return "Yesterday";
  const [y, m, d] = day.split("-");
  return `${d}.${m}.${y}`;
}

interface Props {
  /** When provided, the day navigator is portalled into this host element. */
  toolbarHost?: HTMLElement | null;
}

export function UsageEventsTable({ toolbarHost }: Props) {
  const [day, setDay] = useState<string>(() => todayUTC());
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<SessionRow | null>(null);

  const atToday = day >= todayUTC();

  const load = useCallback(async (d: string) => {
    setLoading(true);
    try {
      const res = await fetch(apiUrl(`/api/admin/usage/sessions?day=${d}`), {
        credentials: "include",
      });
      if (!res.ok) {
        setSessions([]);
        return;
      }
      const j = (await res.json()) as { sessions: SessionRow[] };
      setSessions(j.sessions ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(day);
  }, [day, load]);

  const navigator = (
    <div className="flex items-center gap-1">
      <button
        type="button"
        onClick={() => setDay((d) => shiftDay(d, -1))}
        className="h-8 w-8 inline-flex items-center justify-center bg-secondary rounded-md text-muted-foreground hover:text-foreground"
        title="Previous day"
      >
        <ChevronLeft className="h-4 w-4" />
      </button>
      <span className="min-w-[92px] text-center text-xs font-medium text-foreground tabular-nums">
        {dayLabel(day)}
      </span>
      <button
        type="button"
        onClick={() => !atToday && setDay((d) => shiftDay(d, 1))}
        disabled={atToday}
        className="h-8 w-8 inline-flex items-center justify-center bg-secondary rounded-md text-muted-foreground hover:text-foreground disabled:opacity-40"
        title="Next day"
      >
        <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  );

  return (
    <div className="space-y-3">
      {toolbarHost ? createPortal(navigator, toolbarHost) : <div className="flex">{navigator}</div>}

      {loading ? (
        <div className="text-xs text-muted-foreground py-8 text-center">Loading…</div>
      ) : sessions.length === 0 ? (
        <div className="text-xs text-muted-foreground py-8 text-center">No sessions</div>
      ) : (
        <div className="bg-card border border-border rounded-xl overflow-hidden divide-y divide-border">
          {sessions.map((s, i) => (
            <button
              key={`${s.ipkey}-${s.country}-${s.device}-${s.platform}-${i}`}
              type="button"
              onClick={() => setSelected(s)}
              className="w-full flex items-center gap-2 px-3 py-2 text-xs text-left hover:bg-muted/40 transition-colors"
            >
              <span className="text-base shrink-0" title={s.country}>
                {countryToFlag(s.country)}
              </span>
              <span className="text-foreground tabular-nums shrink-0">
                {hms(s.firstAt)}–{hms(s.lastAt)}
              </span>
              <span className="text-[10px] text-muted-foreground shrink-0">{s.eventCount}</span>

              {s.userLabel ? (
                <span
                  className="inline-flex items-center gap-1 text-[10px] text-muted-foreground bg-secondary rounded px-1.5 py-0.5 shrink-0 max-w-[160px] truncate"
                  title={s.userLabel}
                >
                  <UserIcon className="h-3 w-3 shrink-0" />
                  <span className="truncate">{s.userLabel}</span>
                </span>
              ) : null}
              {s.restaurantLabel ? (
                <span
                  className="inline-flex items-center gap-1 text-[10px] text-muted-foreground bg-secondary rounded px-1.5 py-0.5 shrink-0 max-w-[160px] truncate"
                  title={s.restaurantLabel}
                >
                  <Store className="h-3 w-3 shrink-0" />
                  <span className="truncate">{s.restaurantLabel}</span>
                </span>
              ) : null}

              <span className="flex-1" />

              {s.hasGoogle ? (
                <span
                  className="inline-flex items-center justify-center w-3.5 h-3.5 rounded-full bg-[#4285f4] text-[8px] font-bold text-white shrink-0"
                  title="Google Ads (gclid) in this session"
                  aria-hidden
                >
                  G
                </span>
              ) : null}
              {s.hasFacebook ? (
                <span
                  className="inline-flex items-center justify-center w-3.5 h-3.5 rounded-full bg-[#1877F2] text-[8px] font-bold text-white shrink-0"
                  title="Facebook/Instagram Ads (fbclid) in this session"
                  aria-hidden
                >
                  F
                </span>
              ) : null}
              {s.device ? (
                <span className="text-[10px] text-muted-foreground shrink-0" title={`${s.device} / ${s.platform || "—"}`}>
                  {s.device === "mobile" ? "📱" : s.device === "tablet" ? "📋" : "🖥"}
                </span>
              ) : null}
            </button>
          ))}
        </div>
      )}

      <SessionDetail session={selected} onClose={() => setSelected(null)} />
    </div>
  );
}

// ── Session detail modal ──

function SessionDetail({ session, onClose }: { session: SessionRow | null; onClose: () => void }) {
  useScrollLock(Boolean(session));
  const [events, setEvents] = useState<SessionEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [fbFor, setFbFor] = useState<SessionEvent | null>(null);

  useEffect(() => {
    if (!session) {
      setEvents([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    const qs = new URLSearchParams({
      ipkey: session.ipkey ?? "",
      hasIp: session.hasIp ? "1" : "0",
      country: session.country,
      device: session.device ?? "",
      platform: session.platform ?? "",
      from: session.firstAt,
      to: session.lastAt,
    });
    fetch(apiUrl(`/api/admin/usage/sessions/events?${qs.toString()}`), { credentials: "include" })
      .then((r) => (r.ok ? r.json() : { events: [] }))
      .then((j: { events: SessionEvent[] }) => {
        if (!cancelled) setEvents(j.events ?? []);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [session]);

  if (!session) return null;

  return (
    <>
      <div onClick={onClose} className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
        <div onClick={(e) => e.stopPropagation()} className="w-full max-w-md bg-card border border-border rounded-xl shadow-xl max-h-[85vh] flex flex-col">
          <div className="px-4 py-3 border-b border-border flex items-center justify-between gap-3">
            <div className="min-w-0">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <span>{countryToFlag(session.country)}</span>
                <span className="tabular-nums">{hms(session.firstAt)}–{hms(session.lastAt)}</span>
                <span className="text-[11px] text-muted-foreground">{session.eventCount} events</span>
              </h3>
              <div className="text-[11px] text-muted-foreground truncate mt-0.5">
                {[session.restaurantLabel, session.userLabel].filter(Boolean).join(" · ") || "anonymous"}
              </div>
            </div>
            <button type="button" onClick={onClose} className="h-7 w-7 inline-flex items-center justify-center bg-secondary rounded-md text-muted-foreground hover:text-foreground shrink-0" title="Close">
              ✕
            </button>
          </div>
          <div className="overflow-y-auto divide-y divide-border">
            {loading ? (
              <div className="text-xs text-muted-foreground py-8 text-center">Loading…</div>
            ) : events.length === 0 ? (
              <div className="text-xs text-muted-foreground py-8 text-center">No events</div>
            ) : (
              events.map((e) => {
                const isFb = e.isFacebookAds || e.event.startsWith("l_fbclid_");
                return (
                  <div key={e.id} className="flex items-center gap-2 px-4 py-2 text-xs">
                    <span className="font-mono text-foreground truncate flex-1">{e.event}</span>
                    {isFb ? (
                      <button
                        type="button"
                        onClick={() => setFbFor(e)}
                        className="text-[10px] font-medium rounded px-1.5 py-0.5 shrink-0 bg-[#1877F2]/10 text-[#1877F2] hover:bg-[#1877F2]/20"
                        title="Send a Meta CAPI event"
                      >
                        FB
                      </button>
                    ) : null}
                    <span className="text-[10px] text-muted-foreground tabular-nums shrink-0">{hms(e.at)}</span>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {fbFor ? <FbSendModal event={fbFor} onClose={() => setFbFor(null)} /> : null}
    </>
  );
}

// ── Meta CAPI send (single event) ──

function FbSendModal({ event, onClose }: { event: SessionEvent; onClose: () => void }) {
  useScrollLock(true);
  const [sending, setSending] = useState<string | null>(null);
  const [sent, setSent] = useState<Set<string>>(() => new Set(event.fbSentEvents ?? []));
  const [result, setResult] = useState<{ name: string; ok: boolean; body: unknown } | null>(null);

  async function send(name: string) {
    setSending(name);
    try {
      const res = await fetch(apiUrl(`/api/admin/usage-events/${event.id}/fb-send`), {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ event_name: name }),
      });
      const json: unknown = await res.json().catch(() => ({}));
      setResult({ name, ok: res.ok, body: json });
      if (res.ok) setSent((prev) => new Set(prev).add(name));
    } catch (e) {
      setResult({ name, ok: false, body: { error: String(e) } });
    } finally {
      setSending(null);
    }
  }

  return (
    <div onClick={onClose} className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-md bg-card border border-border rounded-xl shadow-xl">
        <div className="px-4 py-3 border-b border-border flex items-center justify-between">
          <h3 className="text-sm font-semibold text-foreground">Meta CAPI — send (live)</h3>
          <button type="button" onClick={onClose} className="h-7 w-7 inline-flex items-center justify-center bg-secondary rounded-md text-muted-foreground hover:text-foreground shrink-0" title="Close">
            ✕
          </button>
        </div>
        <div className="divide-y divide-border max-h-[50vh] overflow-y-auto">
          {FB_EVENTS.map((fe) => {
            const already = sent.has(fe.name);
            const busy = sending === fe.name;
            return (
              <button
                key={fe.name}
                type="button"
                onClick={() => void send(fe.name)}
                disabled={Boolean(sending)}
                className={"w-full text-left px-4 py-2.5 transition-colors disabled:opacity-50 " + (already ? "bg-emerald-500/5" : "hover:bg-muted/40")}
              >
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-foreground">{fe.name}</span>
                  {already ? (
                    <span className="text-[10px] text-emerald-500 inline-flex items-center gap-0.5">
                      <Check className="w-3 h-3" /> sent
                    </span>
                  ) : null}
                  {busy ? <span className="text-[10px] text-muted-foreground">sending…</span> : null}
                </div>
                <div className="text-[11px] text-muted-foreground mt-0.5">{fe.desc}</div>
              </button>
            );
          })}
        </div>
        {result ? (
          <div className="px-4 py-3 border-t border-border">
            <div className={"text-[11px] mb-1 " + (result.ok ? "text-emerald-500" : "text-red-500")}>
              {result.name}: {result.ok ? "sent" : "failed"}
            </div>
            <pre className="p-2 text-[10px] font-mono bg-secondary rounded-md text-foreground overflow-auto max-h-40 whitespace-pre-wrap break-all">
              {JSON.stringify(result.body, null, 2)}
            </pre>
          </div>
        ) : null}
      </div>
    </div>
  );
}
