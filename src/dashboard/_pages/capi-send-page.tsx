"use client";

import { useState, useEffect, useCallback } from "react";
import { apiUrl } from "@/lib/api";
import { RefreshIcon } from "../_v2/icons";
import { SubpageStickyBar } from "../_v2/ui";
import { useDashboardRouter } from "../_spa/router";
import { CapiEventChips, availableEvents } from "./capi-event-select";
import { fmtAt, type CapiHistoryRow } from "./capi-shared";

export function CapiSendPage({ fbclid, clickTs }: { fbclid: string; clickTs?: number }) {
  const router = useDashboardRouter();
  const [eventName, setEventName] = useState("");
  const [history, setHistory] = useState<CapiHistoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const loadHistory = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(apiUrl(`/api/admin/capi/history?fbclid=${encodeURIComponent(fbclid)}`), {
        credentials: "include",
      });
      const j = r.ok ? ((await r.json()) as { history: CapiHistoryRow[] }) : { history: [] };
      setHistory(j.history ?? []);
    } finally {
      setLoading(false);
    }
  }, [fbclid]);

  useEffect(() => {
    void loadHistory();
  }, [loadHistory]);

  const sentNames = history.filter((h) => h.status === "success").map((h) => h.eventName);
  const available = availableEvents(sentNames);

  // Keep the selection on an available event.
  useEffect(() => {
    if (available.length > 0 && !available.includes(eventName)) setEventName(available[0]);
  }, [available, eventName]);

  async function send() {
    if (!eventName || sending) return;
    setSending(true);
    setMsg(null);
    try {
      const res = await fetch(apiUrl("/api/admin/capi/send"), {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fbclid, eventName, ...(clickTs ? { clickTs } : {}) }),
      });
      const json = (await res.json().catch(() => ({}))) as { message?: string };
      setMsg(res.ok ? { ok: true, text: `${eventName} sent` } : { ok: false, text: json?.message || `Failed (${res.status})` });
      await loadHistory();
    } catch (e) {
      setMsg({ ok: false, text: String(e) });
    } finally {
      setSending(false);
    }
  }

  return (
    <div>
      <SubpageStickyBar onBack={() => router.back()} hideSave>
        <button
          type="button"
          onClick={() => void loadHistory()}
          disabled={loading}
          className="h-8 w-8 inline-flex items-center justify-center bg-secondary rounded-md text-muted-foreground hover:text-foreground disabled:opacity-60"
          title="Refresh"
        >
          <RefreshIcon size={14} className={loading ? "animate-spin" : ""} />
        </button>
      </SubpageStickyBar>
      <div className="max-w-5xl mx-auto md:px-6 pt-5 md:pt-4 space-y-3">
        {available.length > 0 ? (
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
          {loading && history.length === 0 ? (
            <div className="text-xs text-muted-foreground py-6 text-center">Loading…</div>
          ) : history.length === 0 ? (
            <div className="text-xs text-muted-foreground py-6 text-center">No sends yet</div>
          ) : (
            history.map((h) => (
              <div key={h.id} className="flex items-center gap-2 px-3 md:px-4 py-2 text-xs">
                <span
                  className={
                    "shrink-0 text-[10px] font-semibold rounded px-1.5 py-0.5 " +
                    (h.status === "success"
                      ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                      : "bg-red-500/10 text-red-600 dark:text-red-400")
                  }
                >
                  {h.status === "success" ? "OK" : "ERR"}
                </span>
                <span className="font-medium text-foreground">{h.eventName}</span>
                <span className="flex-1" />
                <span className="text-[10px] text-muted-foreground tabular-nums">{fmtAt(h.createdAt)}</span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
