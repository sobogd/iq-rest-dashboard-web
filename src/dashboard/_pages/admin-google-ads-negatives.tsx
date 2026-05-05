"use client";

import { useState } from "react";
import { apiUrl } from "@/lib/api";
import { PageHeader } from "../_v2/ui";

type MatchType = "BROAD" | "PHRASE" | "EXACT";
type Campaign = "EN" | "IT" | "ES";

interface Suggestion {
  keyword: string;
  matchType: MatchType;
  reason: string;
}

interface AnalyzeResult {
  ok: boolean;
  campaign: Campaign;
  suggestions: Suggestion[];
  log: unknown;
}

const MATCH_COLORS: Record<MatchType, string> = {
  BROAD: "bg-orange-500/15 text-orange-400",
  PHRASE: "bg-blue-500/15 text-blue-400",
  EXACT: "bg-purple-500/15 text-purple-400",
};

type Stage = "idle" | "loading" | "review" | "applying" | "done";

export function AdminGoogleAdsNegativesPage() {
  const [campaign, setCampaign] = useState<Campaign>("EN");
  const [stage, setStage] = useState<Stage>("idle");
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [checked, setChecked] = useState<Set<number>>(new Set());
  const [log, setLog] = useState<unknown>(null);
  const [modal, setModal] = useState<unknown>(null);

  async function analyze() {
    setStage("loading");
    setSuggestions([]);
    setLog(null);
    try {
      const res = await fetch(apiUrl("/api/admin/google-ads/analyze-negatives"), {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ campaign }),
      });
      const data = await res.json() as AnalyzeResult;
      setLog(data.log);
      setSuggestions(data.suggestions ?? []);
      setChecked(new Set((data.suggestions ?? []).map((_, i) => i)));
      setStage("review");
    } catch (e) {
      setLog({ error: String(e) });
      setStage("review");
    }
  }

  async function addSelected() {
    const selected = suggestions.filter((_, i) => checked.has(i));
    if (!selected.length) return;
    setStage("applying");
    try {
      const res = await fetch(apiUrl("/api/admin/google-ads/add-negatives"), {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ campaign, keywords: selected.map(s => ({ keyword: s.keyword, matchType: s.matchType })) }),
      });
      const data: unknown = await res.json();
      setModal(data);
      setStage("done");
    } catch (e) {
      setModal({ error: String(e) });
      setStage("done");
    }
  }

  function toggleAll(val: boolean) {
    setChecked(val ? new Set(suggestions.map((_, i) => i)) : new Set());
  }

  const selectedCount = checked.size;

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      <PageHeader title="Google Ads — Negative Keywords" />

      {/* Campaign selector */}
      <div className="flex gap-2 items-center">
        <span className="text-xs text-muted-foreground shrink-0">Campaign:</span>
        <div className="inline-flex gap-0.5 p-0.5 bg-secondary rounded-lg">
          {(["EN", "IT", "ES"] as Campaign[]).map((c) => (
            <button
              key={c}
              type="button"
              disabled={stage === "loading" || stage === "applying"}
              onClick={() => { setCampaign(c); setStage("idle"); setSuggestions([]); }}
              className={
                "h-7 px-3 text-xs font-medium rounded-md transition-colors " +
                (campaign === c ? "bg-card text-foreground shadow-sm" : "text-muted-foreground")
              }
            >
              {c}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => void analyze()}
          disabled={stage === "loading" || stage === "applying"}
          className="ml-auto h-9 px-5 text-sm font-semibold bg-primary text-primary-foreground rounded-lg disabled:opacity-50"
        >
          {stage === "loading" ? "Analyzing…" : "Analyze"}
        </button>
      </div>

      {stage === "loading" && (
        <div className="text-sm text-muted-foreground py-8 text-center">
          Fetching search terms + calling Gemini 2.5 Pro…
        </div>
      )}

      {(stage === "review" || stage === "applying" || stage === "done") && (
        <>
          {suggestions.length === 0 ? (
            <div className="text-sm text-muted-foreground text-center py-6">
              No suggestions returned.{" "}
              <button type="button" className="underline" onClick={() => setModal(log)}>View log</button>
            </div>
          ) : (
            <div className="bg-card border border-border rounded-xl overflow-hidden">
              {/* Header row */}
              <div className="flex items-center gap-3 px-4 py-2.5 border-b border-border">
                <input
                  type="checkbox"
                  checked={selectedCount === suggestions.length}
                  onChange={(e) => toggleAll(e.target.checked)}
                  className="w-4 h-4 accent-primary"
                />
                <span className="text-xs text-muted-foreground flex-1">
                  {selectedCount} / {suggestions.length} selected
                </span>
                <button
                  type="button"
                  onClick={() => setModal(log)}
                  className="text-[11px] text-muted-foreground underline"
                >
                  View log
                </button>
              </div>

              {/* Suggestions list */}
              <div className="divide-y divide-border max-h-[50vh] overflow-y-auto">
                {suggestions.map((s, i) => (
                  <label
                    key={i}
                    className="flex items-start gap-3 px-4 py-2.5 cursor-pointer hover:bg-muted/30 transition-colors"
                  >
                    <input
                      type="checkbox"
                      checked={checked.has(i)}
                      onChange={(e) => {
                        const next = new Set(checked);
                        e.target.checked ? next.add(i) : next.delete(i);
                        setChecked(next);
                      }}
                      className="w-4 h-4 mt-0.5 shrink-0 accent-primary"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-mono text-foreground">{s.keyword}</span>
                        <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${MATCH_COLORS[s.matchType] ?? ""}`}>
                          {s.matchType}
                        </span>
                      </div>
                      <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug">{s.reason}</p>
                    </div>
                  </label>
                ))}
              </div>

              {/* Footer action */}
              <div className="px-4 py-3 border-t border-border">
                <button
                  type="button"
                  disabled={selectedCount === 0 || stage === "applying" || stage === "done"}
                  onClick={() => void addSelected()}
                  className="w-full h-9 text-sm font-semibold bg-primary text-primary-foreground rounded-lg disabled:opacity-50"
                >
                  {stage === "applying"
                    ? "Adding…"
                    : stage === "done"
                    ? "Done ✓"
                    : `Add ${selectedCount} negative${selectedCount !== 1 ? "s" : ""} to ${campaign}`}
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {modal !== null && <LogModal data={modal} onClose={() => setModal(null)} />}
    </div>
  );
}

function LogModal({ data, onClose }: { data: unknown; onClose: () => void }) {
  const isOk = data && typeof data === "object" && (data as Record<string, unknown>).ok === true;
  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-2xl bg-card border border-border rounded-xl shadow-xl flex flex-col max-h-[85vh]"
      >
        <div className="px-4 py-3 border-b border-border flex items-center justify-between shrink-0">
          <span className={`text-sm font-semibold ${isOk ? "text-green-500" : "text-muted-foreground"}`}>
            {isOk ? "✓ Success" : "Log"}
          </span>
          <button
            type="button"
            onClick={onClose}
            className="h-7 w-7 inline-flex items-center justify-center bg-secondary rounded-md text-muted-foreground hover:text-foreground"
          >
            ✕
          </button>
        </div>
        <pre className="p-4 text-xs font-mono text-foreground overflow-auto whitespace-pre-wrap break-all flex-1">
          {JSON.stringify(data, null, 2)}
        </pre>
      </div>
    </div>
  );
}
