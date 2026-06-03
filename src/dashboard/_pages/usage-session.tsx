"use client";

import { useState, useEffect, useCallback } from "react";
import { Check, Copy } from "lucide-react";
import { apiUrl } from "@/lib/api";
import { RefreshIcon } from "../_v2/icons";
import { SubpageStickyBar } from "../_v2/ui";
import { useDashboardRouter } from "../_spa/router";
import { useScrollLock } from "../_v2/use-scroll-lock";
import {
  countryToFlag,
  osName,
  hm,
  decodeSessionId,
  type SessionEvent,
} from "./usage-shared";

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

const chip = "text-[10px] text-muted-foreground bg-secondary rounded px-1.5 py-0.5 shrink-0";

function CopyButton({ text }: { text: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        navigator.clipboard?.writeText(text).then(() => {
          setDone(true);
          setTimeout(() => setDone(false), 1200);
        }).catch(() => undefined);
      }}
      className="h-6 w-6 inline-flex items-center justify-center bg-secondary rounded text-muted-foreground hover:text-foreground shrink-0"
      title="Copy"
    >
      {done ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
    </button>
  );
}

export function UsageSessionPage({ id }: { id: string }) {
  const router = useDashboardRouter();
  const session = decodeSessionId(id);
  const [events, setEvents] = useState<SessionEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [fbFor, setFbFor] = useState<SessionEvent | null>(null);

  const load = useCallback(async (mode: "full" | "soft") => {
    if (!session) {
      setLoading(false);
      return;
    }
    if (mode === "full") setLoading(true);
    else setRefreshing(true);
    const qs = new URLSearchParams({
      ipkey: session.ipkey ?? "",
      hasIp: session.hasIp ? "1" : "0",
      country: session.country,
      device: session.device ?? "",
      platform: session.platform ?? "",
      from: session.firstAt,
      to: session.lastAt,
    });
    try {
      const res = await fetch(apiUrl(`/api/admin/usage/sessions/events?${qs.toString()}`), {
        credentials: "include",
      });
      const j = res.ok ? ((await res.json()) as { events: SessionEvent[] }) : { events: [] };
      setEvents(j.events ?? []);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    void load("full");
  }, [load]);

  // Click-id events are pulled OUT of the list and surfaced in the info card.
  // Remaining events newest-first.
  const listEvents = events
    .filter((e) => !e.event.startsWith("l_gclid_") && !e.event.startsWith("l_fbclid_"))
    .sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0));

  // Distinct fbclid values (+ their source event for the Meta CAPI send).
  const fbItems: Array<{ fbclid: string; event: SessionEvent }> = [];
  const seenFb = new Set<string>();
  for (const e of events) {
    const m = /^l_fbclid_(.+)$/.exec(e.event);
    if (m && !seenFb.has(m[1])) {
      seenFb.add(m[1]);
      fbItems.push({ fbclid: m[1], event: e });
    }
  }

  // Distinct gclid values (from the gclid column and l_gclid_ event names).
  const gclids: string[] = [];
  const seenG = new Set<string>();
  for (const e of events) {
    let g: string | null = e.gclid || null;
    const m = /^l_gclid_(.+)$/.exec(e.event);
    if (m) g = m[1];
    if (g && !seenG.has(g)) {
      seenG.add(g);
      gclids.push(g);
    }
  }

  const back = () => router.back();
  const restaurant = session?.restaurantLabel ?? null;
  const region = session?.region ?? null;

  return (
    <div>
      <SubpageStickyBar onBack={back} hideSave>
        <button
          type="button"
          onClick={() => void load("soft")}
          disabled={loading || refreshing}
          className="h-8 w-8 inline-flex items-center justify-center bg-secondary rounded-md text-muted-foreground hover:text-foreground disabled:opacity-60"
          title="Refresh"
        >
          <RefreshIcon size={14} className={loading || refreshing ? "animate-spin" : ""} />
        </button>
      </SubpageStickyBar>
      <div className="max-w-5xl mx-auto md:px-6 pt-5 md:pt-4 space-y-3">
        {!session ? (
          <div className="text-xs text-muted-foreground py-8 text-center">Invalid session link</div>
        ) : (
          <>
            {/* Info card — same chip design as the list row + IP + click-ids. */}
            <div className="bg-card border border-border rounded-xl p-3 md:p-4 space-y-2">
              <div className="flex items-center gap-2 text-xs">
                <span className="text-base shrink-0">{countryToFlag(session.country)}</span>
                <span className={`${chip} tabular-nums`}>{hm(session.firstAt)}–{hm(session.lastAt)}</span>
                <span className={chip}>{session.eventCount}</span>
                <span className="flex-1 min-w-0 flex items-center justify-end gap-2">
                  {restaurant ? (
                    <span className="text-[10px] bg-pink-500/10 text-pink-700 dark:text-pink-400 rounded px-1.5 py-0.5 truncate min-w-0" title={restaurant}>{restaurant}</span>
                  ) : region ? (
                    <span className="text-[10px] bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 rounded px-1.5 py-0.5 truncate min-w-0" title={region}>{region}</span>
                  ) : null}
                  <span className={chip}>{osName(session.platform, session.device)}</span>
                  {session.hasIp && session.ipkey ? <span className={`${chip} font-mono`}>{session.ipkey}</span> : null}
                  {session.hasGoogle ? <span className="text-[10px] font-semibold rounded px-1.5 py-0.5 shrink-0 bg-[#4285f4]/10 text-[#4285f4]">G</span> : null}
                  {session.hasFacebook ? <span className="text-[10px] font-semibold rounded px-1.5 py-0.5 shrink-0 bg-[#1877F2]/10 text-[#1877F2]">FB</span> : null}
                </span>
              </div>

              {session.userLabel ? (
                <div className="text-[11px] text-muted-foreground truncate">👤 {session.userLabel}</div>
              ) : null}

              {gclids.length > 0 ? (
                <div className="space-y-1">
                  {gclids.map((g) => (
                    <div key={g} className="flex items-center gap-2">
                      <span className="text-[10px] text-muted-foreground shrink-0 w-12">gclid</span>
                      <span className="text-[11px] font-mono text-foreground break-all flex-1 min-w-0">{g}</span>
                      <CopyButton text={g} />
                    </div>
                  ))}
                </div>
              ) : null}

              {fbItems.length > 0 ? (
                <div className="space-y-1">
                  {fbItems.map(({ fbclid, event }) => (
                    <div key={fbclid} className="flex items-center gap-2">
                      <span className="text-[10px] text-muted-foreground shrink-0 w-12">fbclid</span>
                      <span className="text-[11px] font-mono text-foreground break-all flex-1 min-w-0">{fbclid}</span>
                      <button
                        type="button"
                        onClick={() => setFbFor(event)}
                        className="text-[10px] font-medium rounded px-1.5 py-0.5 shrink-0 bg-[#1877F2]/10 text-[#1877F2] hover:bg-[#1877F2]/20"
                        title="Send a Meta CAPI event"
                      >
                        FB
                      </button>
                      <CopyButton text={fbclid} />
                    </div>
                  ))}
                </div>
              ) : null}
            </div>

            {/* Events list (click-id events excluded). */}
            <div className="bg-card border border-border rounded-xl overflow-hidden divide-y divide-border">
              {loading ? (
                <div className="text-xs text-muted-foreground py-8 text-center">Loading…</div>
              ) : listEvents.length === 0 ? (
                <div className="text-xs text-muted-foreground py-8 text-center">No events</div>
              ) : (
                listEvents.map((e) => (
                  <div key={e.id} className="flex items-center gap-2 px-3 md:px-4 py-2 text-xs">
                    <span className="font-mono text-foreground truncate flex-1">{e.event}</span>
                  </div>
                ))
              )}
            </div>
          </>
        )}
      </div>

      {fbFor ? <FbSendModal event={fbFor} onClose={() => setFbFor(null)} /> : null}
    </div>
  );
}

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
