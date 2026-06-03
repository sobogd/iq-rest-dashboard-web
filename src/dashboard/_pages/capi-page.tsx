"use client";

import { useState, useEffect, useCallback } from "react";
import { Check } from "lucide-react";
import { apiUrl } from "@/lib/api";
import { RefreshIcon } from "../_v2/icons";
import { SubpageStickyBar } from "../_v2/ui";
import { useDashboardRouter } from "../_spa/router";
import { useScrollLock } from "../_v2/use-scroll-lock";
import { CAPI_EVENTS, fmtAt, type CapiLogRow } from "./capi-shared";

export function CapiPage() {
  const router = useDashboardRouter();
  const [fbclid, setFbclid] = useState("");
  const [eventName, setEventName] = useState(CAPI_EVENTS[0].name);
  const [sent, setSent] = useState<string[]>([]);
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; name: string; body: unknown } | null>(null);
  const [log, setLog] = useState<CapiLogRow[]>([]);
  const [logLoading, setLogLoading] = useState(true);

  const loadLog = useCallback(async () => {
    setLogLoading(true);
    try {
      const r = await fetch(apiUrl("/api/admin/capi/log?limit=200"), { credentials: "include" });
      const j = r.ok ? ((await r.json()) as { log: CapiLogRow[] }) : { log: [] };
      setLog(j.log ?? []);
    } finally {
      setLogLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadLog();
  }, [loadLog]);

  // Look up what's already been sent for the entered fbclid (debounced).
  useEffect(() => {
    const id = fbclid.trim();
    if (!id) {
      setSent([]);
      return;
    }
    let cancelled = false;
    const t = setTimeout(() => {
      fetch(apiUrl(`/api/admin/capi/sent?fbclid=${encodeURIComponent(id)}`), { credentials: "include" })
        .then((r) => (r.ok ? r.json() : { sent: [] }))
        .then((j: { sent: string[] }) => {
          if (!cancelled) setSent(j.sent ?? []);
        })
        .catch(() => undefined);
    }, 400);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [fbclid]);

  const already = sent.includes(eventName);
  const canSend = Boolean(fbclid.trim()) && !already && !sending;

  async function send() {
    if (!canSend) return;
    setSending(true);
    try {
      const res = await fetch(apiUrl("/api/admin/capi/send"), {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fbclid: fbclid.trim(), eventName }),
      });
      const json: unknown = await res.json().catch(() => ({}));
      const ok = res.ok;
      setResult({ ok, name: eventName, body: json });
      if (ok) setSent((p) => Array.from(new Set([...p, eventName])));
      void loadLog();
    } catch (e) {
      setResult({ ok: false, name: eventName, body: { error: String(e) } });
    } finally {
      setSending(false);
    }
  }

  return (
    <div>
      <SubpageStickyBar onBack={() => router.push({ name: "settings" })} hideSave />
      <div className="max-w-5xl mx-auto md:px-6 pt-5 md:pt-4 space-y-3">
        <div className="bg-card border border-border rounded-xl p-4 md:p-5 space-y-4">
          <div>
            <div className="text-sm font-semibold text-foreground mb-1">Meta CAPI — send a conversion</div>
            <p className="text-xs text-muted-foreground">
              Sends a live Conversions API event for a Facebook click id (fbclid). A successful
              send for the same fbclid + event type can&apos;t be repeated.
            </p>
          </div>

          <label className="block">
            <span className="block text-[11px] text-muted-foreground uppercase tracking-wider mb-1">fbclid</span>
            <input
              type="text"
              value={fbclid}
              onChange={(e) => setFbclid(e.target.value)}
              placeholder="Paste the Facebook click id"
              className="w-full h-10 px-3 bg-secondary rounded-md text-sm text-foreground font-mono focus:outline-none"
            />
          </label>

          <label className="block">
            <span className="block text-[11px] text-muted-foreground uppercase tracking-wider mb-1">Event type</span>
            <select
              value={eventName}
              onChange={(e) => setEventName(e.target.value)}
              className="w-full h-10 px-3 bg-secondary rounded-md text-sm text-foreground focus:outline-none"
            >
              {CAPI_EVENTS.map((e) => (
                <option key={e.name} value={e.name} disabled={sent.includes(e.name)}>
                  {e.name}{sent.includes(e.name) ? " — already sent" : ""}
                </option>
              ))}
            </select>
          </label>

          {sent.length > 0 ? (
            <div className="flex flex-wrap gap-1">
              {sent.map((n) => (
                <span key={n} className="text-[10px] text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 rounded px-1.5 py-0.5 inline-flex items-center gap-0.5">
                  <Check className="w-3 h-3" /> {n}
                </span>
              ))}
            </div>
          ) : null}

          <button
            type="button"
            onClick={() => void send()}
            disabled={!canSend}
            className="h-10 px-5 text-sm font-medium text-primary-foreground bg-primary-gradient rounded-md hover:opacity-90 disabled:opacity-50"
          >
            {sending ? "Sending…" : already ? "Already sent" : "Send"}
          </button>
        </div>

        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="px-4 py-2.5 border-b border-border flex items-center justify-between">
            <span className="text-sm font-semibold text-foreground">Sent log</span>
            <button
              type="button"
              onClick={() => void loadLog()}
              disabled={logLoading}
              className="h-7 w-7 inline-flex items-center justify-center bg-secondary rounded-md text-muted-foreground hover:text-foreground disabled:opacity-60"
              title="Refresh"
            >
              <RefreshIcon size={13} className={logLoading ? "animate-spin" : ""} />
            </button>
          </div>
          <div className="divide-y divide-border max-h-[60vh] overflow-y-auto">
            {logLoading && log.length === 0 ? (
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

      {result ? <ResultModal result={result} onClose={() => setResult(null)} /> : null}
    </div>
  );
}

function ResultModal({
  result,
  onClose,
}: {
  result: { ok: boolean; name: string; body: unknown };
  onClose: () => void;
}) {
  useScrollLock(true);
  return (
    <div onClick={onClose} className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-md bg-card border border-border rounded-xl shadow-xl">
        <div className="px-4 py-3 border-b border-border flex items-center justify-between">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <span className="font-mono">{result.name}</span>
            {result.ok ? (
              <span className="text-[10px] text-emerald-500 inline-flex items-center gap-0.5">
                <Check className="w-3 h-3" /> sent
              </span>
            ) : (
              <span className="text-[10px] text-red-500">failed</span>
            )}
          </h3>
          <button type="button" onClick={onClose} className="h-7 w-7 inline-flex items-center justify-center bg-secondary rounded-md text-muted-foreground hover:text-foreground shrink-0" title="Close">
            ✕
          </button>
        </div>
        <div className="px-4 py-3">
          <pre className="p-2 text-[10px] font-mono bg-secondary rounded-md text-foreground overflow-auto max-h-72 whitespace-pre-wrap break-all">
            {JSON.stringify(result.body, null, 2)}
          </pre>
        </div>
        <div className="px-4 py-3 border-t border-border">
          <button type="button" onClick={onClose} className="w-full h-9 text-sm font-medium bg-secondary hover:bg-muted rounded-md transition-colors">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
