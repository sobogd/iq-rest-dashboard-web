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
import { CAPI_EVENTS } from "./capi-shared";

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
  // fbclid → event_names already successfully sent (Meta CAPI dedup).
  const [sentByClick, setSentByClick] = useState<Record<string, string[]>>({});
  const [fbModal, setFbModal] = useState<{ fbclid: string; clickTs: number } | null>(null);

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

  // Click-id events surface in the info card; rest list newest-first.
  const listEvents = events
    .filter((e) => !e.event.startsWith("l_gclid_") && !e.event.startsWith("l_fbclid_"))
    .sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0));

  // Distinct fbclid values (+ click time for the CAPI fbc).
  const fbItems: Array<{ fbclid: string; clickTs: number }> = [];
  const seenFb = new Set<string>();
  for (const e of events) {
    const m = /^l_fbclid_(.+)$/.exec(e.event);
    if (m && !seenFb.has(m[1])) {
      seenFb.add(m[1]);
      fbItems.push({ fbclid: m[1], clickTs: new Date(e.at).getTime() });
    }
  }

  // Distinct gclid values (gclid column or l_gclid_ event names).
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

  // On load, check which CAPI events were already sent for each fbclid.
  const fbKey = fbItems.map((f) => f.fbclid).join(",");
  useEffect(() => {
    const ids = fbKey ? fbKey.split(",") : [];
    if (ids.length === 0) return;
    let cancelled = false;
    Promise.all(
      ids.map((fbclid) =>
        fetch(apiUrl(`/api/admin/capi/sent?fbclid=${encodeURIComponent(fbclid)}`), { credentials: "include" })
          .then((r) => (r.ok ? r.json() : { sent: [] }))
          .then((j: { sent: string[] }) => [fbclid, j.sent ?? []] as const)
          .catch(() => [fbclid, [] as string[]] as const),
      ),
    ).then((pairs) => {
      if (!cancelled) setSentByClick(Object.fromEntries(pairs));
    });
    return () => {
      cancelled = true;
    };
  }, [fbKey]);

  const markSent = (fbclid: string, eventName: string) => {
    setSentByClick((prev) => {
      const cur = prev[fbclid] ?? [];
      if (cur.includes(eventName)) return prev;
      return { ...prev, [fbclid]: [...cur, eventName] };
    });
  };

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
            <div className="bg-card border border-border rounded-xl p-3 md:p-4 space-y-2">
              <div className="flex items-center gap-2 text-xs">
                <span className="text-base shrink-0">{countryToFlag(session.country)}</span>
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
                <div className="space-y-1.5">
                  {fbItems.map(({ fbclid, clickTs }) => {
                    const sent = sentByClick[fbclid] ?? [];
                    return (
                      <div key={fbclid}>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-muted-foreground shrink-0 w-12">fbclid</span>
                          <span className="text-[11px] font-mono text-foreground break-all flex-1 min-w-0">{fbclid}</span>
                          <button
                            type="button"
                            onClick={() => setFbModal({ fbclid, clickTs })}
                            className="text-[10px] font-medium rounded px-1.5 py-0.5 shrink-0 bg-[#1877F2]/10 text-[#1877F2] hover:bg-[#1877F2]/20"
                            title="Send a Meta CAPI event"
                          >
                            CAPI
                          </button>
                          <CopyButton text={fbclid} />
                        </div>
                        {sent.length > 0 ? (
                          <div className="mt-0.5 ml-14 flex flex-wrap gap-1">
                            {sent.map((n) => (
                              <span key={n} className="text-[10px] text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 rounded px-1.5 py-0.5">
                                ✓ {n}
                              </span>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              ) : null}
            </div>

            <div className="bg-card border border-border rounded-xl overflow-hidden divide-y divide-border">
              {loading ? (
                <div className="text-xs text-muted-foreground py-8 text-center">Loading…</div>
              ) : listEvents.length === 0 ? (
                <div className="text-xs text-muted-foreground py-8 text-center">No events</div>
              ) : (
                listEvents.map((e) => (
                  <div key={e.id} className="flex items-center gap-2 px-3 md:px-4 py-2 text-xs">
                    <span className="font-mono text-foreground truncate flex-1">{e.event}</span>
                    <span className={`${chip} tabular-nums`}>{hm(e.at)}</span>
                  </div>
                ))
              )}
            </div>
          </>
        )}
      </div>

      {fbModal ? (
        <CapiSendModal
          fbclid={fbModal.fbclid}
          clickTs={fbModal.clickTs}
          sent={sentByClick[fbModal.fbclid] ?? []}
          onSent={(name) => markSent(fbModal.fbclid, name)}
          onClose={() => setFbModal(null)}
        />
      ) : null}
    </div>
  );
}

function CapiSendModal({
  fbclid,
  clickTs,
  sent,
  onSent,
  onClose,
}: {
  fbclid: string;
  clickTs: number;
  sent: string[];
  onSent: (name: string) => void;
  onClose: () => void;
}) {
  useScrollLock(true);
  const [sending, setSending] = useState<string | null>(null);
  const [local, setLocal] = useState<Set<string>>(() => new Set(sent));
  const [result, setResult] = useState<{ name: string; ok: boolean; body: unknown } | null>(null);

  async function send(name: string) {
    setSending(name);
    try {
      const res = await fetch(apiUrl("/api/admin/capi/send"), {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fbclid, eventName: name, clickTs }),
      });
      const json: unknown = await res.json().catch(() => ({}));
      const ok = res.ok;
      setResult({ name, ok, body: json });
      if (ok) {
        setLocal((p) => new Set(p).add(name));
        onSent(name);
      }
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
          {CAPI_EVENTS.map((fe) => {
            const already = local.has(fe.name);
            const busy = sending === fe.name;
            return (
              <button
                key={fe.name}
                type="button"
                onClick={() => !already && void send(fe.name)}
                disabled={Boolean(sending) || already}
                className={"w-full text-left px-4 py-2.5 transition-colors disabled:opacity-60 " + (already ? "bg-emerald-500/5" : "hover:bg-muted/40")}
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
