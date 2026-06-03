"use client";

import { useState, useEffect, useCallback } from "react";
import { apiUrl } from "@/lib/api";
import { RefreshIcon } from "../_v2/icons";
import { SubpageStickyBar } from "../_v2/ui";
import { useDashboardRouter } from "../_spa/router";
import { CapiEventSelect } from "./capi-event-select";
import { CAPI_EVENTS, fmtAt, type CapiLogRow, type CapiHistoryRow } from "./capi-shared";

export function CapiPage() {
  const router = useDashboardRouter();
  const [latest, setLatest] = useState<{ fbclid: string | null; clickTs: number | null }>({ fbclid: null, clickTs: null });
  const [eventName, setEventName] = useState(CAPI_EVENTS[0].name);
  const [sentNames, setSentNames] = useState<string[]>([]);
  const [log, setLog] = useState<CapiLogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const loadSent = useCallback(async (fbclid: string) => {
    const r = await fetch(apiUrl(`/api/admin/capi/history?fbclid=${encodeURIComponent(fbclid)}`), { credentials: "include" });
    const j = r.ok ? ((await r.json()) as { history: CapiHistoryRow[] }) : { history: [] };
    setSentNames((j.history ?? []).filter((h) => h.status === "success").map((h) => h.eventName));
  }, []);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [latestRes, logRes] = await Promise.all([
        fetch(apiUrl("/api/admin/capi/latest"), { credentials: "include" }),
        fetch(apiUrl("/api/admin/capi/log?limit=200"), { credentials: "include" }),
      ]);
      const lj = latestRes.ok ? ((await latestRes.json()) as { fbclid: string | null; clickTs: number | null }) : { fbclid: null, clickTs: null };
      const gj = logRes.ok ? ((await logRes.json()) as { log: CapiLogRow[] }) : { log: [] };
      setLatest(lj);
      setLog(gj.log ?? []);
      if (lj.fbclid) await loadSent(lj.fbclid);
      else setSentNames([]);
    } finally {
      setLoading(false);
    }
  }, [loadSent]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  const already = sentNames.includes(eventName);
  const canSend = Boolean(latest.fbclid) && !already && !sending;

  async function send() {
    if (!canSend || !latest.fbclid) return;
    setSending(true);
    setMsg(null);
    try {
      const res = await fetch(apiUrl("/api/admin/capi/send"), {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fbclid: latest.fbclid, eventName, ...(latest.clickTs ? { clickTs: latest.clickTs } : {}) }),
      });
      const json = (await res.json().catch(() => ({}))) as { message?: string };
      setMsg(res.ok ? { ok: true, text: `${eventName} sent` } : { ok: false, text: json?.message || `Failed (${res.status})` });
      await loadAll();
    } catch (e) {
      setMsg({ ok: false, text: String(e) });
    } finally {
      setSending(false);
    }
  }

  return (
    <div>
      <SubpageStickyBar onBack={() => router.push({ name: "settings" })} hideSave>
        <button
          type="button"
          onClick={() => void loadAll()}
          disabled={loading}
          className="h-8 w-8 inline-flex items-center justify-center bg-secondary rounded-md text-muted-foreground hover:text-foreground disabled:opacity-60"
          title="Refresh"
        >
          <RefreshIcon size={14} className={loading ? "animate-spin" : ""} />
        </button>
      </SubpageStickyBar>
      <div className="max-w-5xl mx-auto md:px-6 pt-5 md:pt-4 space-y-3">
        {/* Send to the latest click */}
        <div className="bg-card border border-border rounded-xl p-4 md:p-5 space-y-4">
          <div>
            <div className="text-sm font-semibold text-foreground mb-1">Meta CAPI — send to latest click</div>
            <p className="text-xs text-muted-foreground">
              Fires a live Conversions API event for the most recent fbclid click. A successful
              send can&apos;t be repeated for the same event type.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[10px] text-muted-foreground shrink-0 w-12">fbclid</span>
            {latest.fbclid ? (
              <span className="text-[11px] font-mono text-foreground break-all">{latest.fbclid}</span>
            ) : (
              <span className="text-[11px] text-muted-foreground">no fbclid clicks yet</span>
            )}
          </div>

          <label className="block">
            <span className="block text-[11px] text-muted-foreground uppercase tracking-wider mb-1">Event type</span>
            <CapiEventSelect value={eventName} onChange={setEventName} sentNames={sentNames} />
          </label>

          {msg ? <div className={"text-xs " + (msg.ok ? "text-emerald-500" : "text-red-500")}>{msg.text}</div> : null}

          <button
            type="button"
            onClick={() => void send()}
            disabled={!canSend}
            className="h-10 px-5 text-sm font-medium text-primary-foreground bg-primary-gradient rounded-md hover:opacity-90 disabled:opacity-50"
          >
            {sending ? "Sending…" : already ? "Already sent" : "Send"}
          </button>
        </div>

        {/* Full send history (all clicks) */}
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="px-4 py-2.5 border-b border-border text-sm font-semibold text-foreground">Sent log</div>
          <div className="divide-y divide-border max-h-[60vh] overflow-y-auto">
            {loading && log.length === 0 ? (
              <div className="text-xs text-muted-foreground py-6 text-center">Loading…</div>
            ) : log.length === 0 ? (
              <div className="text-xs text-muted-foreground py-6 text-center">No sends yet</div>
            ) : (
              log.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => router.push({ name: "settings.admin.capiLog", id: r.id })}
                  className="w-full flex items-center gap-2 px-3 md:px-4 py-2 text-xs text-left hover:bg-muted/40 transition-colors"
                >
                  <span
                    className={
                      "shrink-0 text-[10px] font-semibold rounded px-1.5 py-0.5 " +
                      (r.status === "success"
                        ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                        : "bg-red-500/10 text-red-600 dark:text-red-400")
                    }
                  >
                    {r.status === "success" ? "OK" : "ERR"}
                  </span>
                  <span className="shrink-0 font-medium text-foreground">{r.eventName}</span>
                  <span className="flex-1 min-w-0 font-mono text-muted-foreground truncate" title={r.fbclid}>{r.fbclid}</span>
                  <span className="shrink-0 text-[10px] text-muted-foreground tabular-nums">{fmtAt(r.createdAt)}</span>
                </button>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
