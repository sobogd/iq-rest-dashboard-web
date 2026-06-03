"use client";

import { useState, useEffect } from "react";
import { Check } from "lucide-react";
import { apiUrl } from "@/lib/api";
import { SubpageStickyBar } from "../_v2/ui";
import { useDashboardRouter } from "../_spa/router";
import { useScrollLock } from "../_v2/use-scroll-lock";
import {
  countryToFlag,
  deviceLabel,
  hms,
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

export function UsageSessionPage({ id }: { id: string }) {
  const router = useDashboardRouter();
  const session = decodeSessionId(id);
  const [events, setEvents] = useState<SessionEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [fbFor, setFbFor] = useState<SessionEvent | null>(null);

  useEffect(() => {
    if (!session) {
      setLoading(false);
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
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  const back = () => router.back();

  return (
    <div>
      <SubpageStickyBar onBack={back} hideSave />
      <div className="max-w-3xl mx-auto px-4 md:px-6 pt-5 md:pt-4 space-y-3">
        {!session ? (
          <div className="text-xs text-muted-foreground py-8 text-center">Invalid session link</div>
        ) : (
          <>
            <div className="bg-card border border-border rounded-xl p-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <span className="text-base">{countryToFlag(session.country)}</span>
                <span className="tabular-nums">{hms(session.firstAt)}–{hms(session.lastAt)}</span>
                <span className="text-[11px] text-muted-foreground font-normal">{session.eventCount} events</span>
                {session.hasGoogle ? (
                  <span className="inline-flex items-center justify-center w-3.5 h-3.5 rounded-full bg-[#4285f4] text-[8px] font-bold text-white" aria-hidden>G</span>
                ) : null}
                {session.hasFacebook ? (
                  <span className="inline-flex items-center justify-center w-3.5 h-3.5 rounded-full bg-[#1877F2] text-[8px] font-bold text-white" aria-hidden>F</span>
                ) : null}
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                {session.restaurantLabel ? <span>🏪 {session.restaurantLabel}</span> : null}
                {session.userLabel ? <span>👤 {session.userLabel}</span> : null}
                <span>{deviceLabel(session.device, session.platform)}</span>
                {session.hasIp && session.ipkey ? <span className="font-mono">{session.ipkey}</span> : null}
              </div>
            </div>

            <div className="bg-card border border-border rounded-xl overflow-hidden divide-y divide-border">
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
