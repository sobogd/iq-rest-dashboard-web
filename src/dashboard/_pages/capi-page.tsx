"use client";

import { useState, useEffect, useCallback } from "react";
import { apiUrl } from "@/lib/api";
import { RefreshIcon } from "../_v2/icons";
import { SubpageStickyBar } from "../_v2/ui";
import { useDashboardRouter } from "../_spa/router";
import { CapiEventChips, availableEvents } from "./capi-event-select";
import { fmtAt, type CapiLogRow, type CapiHistoryRow } from "./capi-shared";

export function CapiPage() {
  const router = useDashboardRouter();
  const [latest, setLatest] = useState<{ fbclid: string | null; clickTs: number | null }>({ fbclid: null, clickTs: null });
  const [eventName, setEventName] = useState("");
  const [sentNames, setSentNames] = useState<string[]>([]);
  const [log, setLog] = useState<CapiLogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

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
      if (lj.fbclid) {
        const hr = await fetch(apiUrl(`/api/admin/capi/history?fbclid=${encodeURIComponent(lj.fbclid)}`), { credentials: "include" });
        const hj = hr.ok ? ((await hr.json()) as { history: CapiHistoryRow[] }) : { history: [] };
        setSentNames((hj.history ?? []).filter((h) => h.status === "success").map((h) => h.eventName));
      } else {
        setSentNames([]);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  const available = availableEvents(sentNames);
  useEffect(() => {
    if (available.length > 0 && !available.includes(eventName)) setEventName(available[0]);
  }, [available, eventName]);

  async function send() {
    if (!eventName || !latest.fbclid || sending) return;
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

  const showForm = Boolean(latest.fbclid) && available.length > 0;

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
        {showForm ? (
          <div className="bg-card border border-border rounded-xl p-4 md:p-5 space-y-4">
            <CapiEventChips events={available} value={eventName} onChange={setEventName} />
            {msg ? <div className={"text-xs " + (msg.ok ? "text-emerald-500" : "text-red-500")}>{msg.text}</div> : null}
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => void send()}
                disabled={!eventName || sending}
                className="inline-flex items-center gap-1.5 h-8 px-3 text-xs font-medium text-primary-foreground bg-primary-gradient rounded-lg disabled:opacity-60"
              >
                {sending ? "Sending…" : "Send"}
              </button>
            </div>
          </div>
        ) : null}

        <div className="bg-card border border-border rounded-xl overflow-hidden divide-y divide-border">
          {loading && log.length === 0 ? (
            <div className="text-xs text-muted-foreground py-6 text-center">Loading…</div>
          ) : log.length === 0 ? (
            <div className="text-xs text-muted-foreground py-6 text-center">No sends yet</div>
          ) : (
            log.map((r) => (
              <div key={r.id} className="flex items-center gap-2 px-3 md:px-4 py-2 text-xs">
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
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
