"use client";

import { useState } from "react";
import { apiUrl } from "@/lib/api";
import { SubpageStickyBar } from "../_v2/ui";
import { useDashboardRouter } from "../_spa/router";

export function AdminGoogleAdsPage() {
  const router = useDashboardRouter();
  const [gclid, setGclid] = useState("");
  const [loading, setLoading] = useState<string | null>(null);
  const [result, setResult] = useState<unknown | null>(null);

  async function upload(type: string) {
    if (!gclid.trim()) return;
    setLoading(type);
    setResult(null);
    try {
      const res = await fetch(apiUrl("/api/admin/usage/upload-conversion"), {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gclid: gclid.trim(), type }),
      });
      const json: unknown = await res.json();
      setResult(json);
    } catch (e) {
      setResult({ error: String(e) });
    } finally {
      setLoading(null);
    }
  }

  return (
    <div>
      <SubpageStickyBar onBack={() => router.push({ name: "settings" })} hideSave>
        <span className="text-sm font-medium text-foreground">Google Ads Conversion</span>
      </SubpageStickyBar>
      <div className="max-w-3xl mx-auto px-3 py-3">
        <div className="space-y-3">
          <input
            type="text"
            value={gclid}
            onChange={(e) => setGclid(e.target.value)}
            placeholder="gclid / gbraid / wbraid"
            className="w-full h-10 px-3 text-sm bg-card border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-primary font-mono"
          />
          <div className="flex gap-2">
            {(["T1", "T2", "T3"] as const).map((t) => (
              <button
                key={t}
                type="button"
                disabled={!gclid.trim() || !!loading}
                onClick={() => void upload(t)}
                className="flex-1 h-10 text-sm font-semibold bg-secondary hover:bg-muted rounded-lg disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                {loading === t ? "…" : t}
              </button>
            ))}
          </div>
        </div>
      </div>

      {result !== null && (
        <ResultModal result={result} onClose={() => setResult(null)} />
      )}
    </div>
  );
}

function ResultModal({ result, onClose }: { result: unknown; onClose: () => void }) {
  const isOk = result && typeof result === "object" && (result as Record<string, unknown>).ok === true;
  return (
    <div onClick={onClose} className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-lg bg-card border border-border rounded-xl shadow-xl flex flex-col max-h-[80vh]">
        <div className="px-4 py-3 border-b border-border flex items-center justify-between shrink-0">
          <span className={`text-sm font-semibold ${isOk ? "text-green-500" : "text-red-500"}`}>
            {isOk ? "✓ Success" : "✗ Error"}
          </span>
          <button type="button" onClick={onClose} className="h-7 w-7 inline-flex items-center justify-center bg-secondary rounded-md text-muted-foreground hover:text-foreground">✕</button>
        </div>
        <pre className="p-4 text-xs font-mono text-foreground overflow-auto whitespace-pre-wrap break-all">
          {JSON.stringify(result, null, 2)}
        </pre>
      </div>
    </div>
  );
}
