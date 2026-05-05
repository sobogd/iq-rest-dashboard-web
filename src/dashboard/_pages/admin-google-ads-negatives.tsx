"use client";

import { useState } from "react";
import { apiUrl } from "@/lib/api";
import { SubpageStickyBar } from "../_v2/ui";
import { useDashboardRouter } from "../_spa/router";

type MatchType = "BROAD" | "PHRASE" | "EXACT";
type Campaign = "EN" | "IT" | "ES";

interface TermRow {
  term: string;
  impressions: number;
  clicks: number;
  addNeg: boolean;
  keyword: string;
  matchType: MatchType;
  hide: boolean;
}

const MATCH_TYPES: MatchType[] = ["BROAD", "PHRASE", "EXACT"];

const MATCH_COLORS: Record<MatchType, string> = {
  BROAD: "bg-orange-500/15 text-orange-400",
  PHRASE: "bg-blue-500/15 text-blue-400",
  EXACT: "bg-purple-500/15 text-purple-400",
};

type Stage = "idle" | "loading" | "review" | "applying" | "done";

function stripFormatting(s: string) {
  return s.replace(/["[\]]/g, "");
}

export function AdminGoogleAdsNegativesPage() {
  const router = useDashboardRouter();
  const [campaign, setCampaign] = useState<Campaign>("EN");
  const [stage, setStage] = useState<Stage>("idle");
  const [rows, setRows] = useState<TermRow[]>([]);
  const [debugLog, setDebugLog] = useState<unknown>(null);
  const [modal, setModal] = useState<unknown>(null);

  async function load() {
    setStage("loading");
    setRows([]);
    setDebugLog(null);
    try {
      const res = await fetch(apiUrl("/api/admin/google-ads/analyze-negatives"), {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ campaign }),
      });
      const data = await res.json() as {
        ok: boolean;
        searchTerms?: Array<{ term: string; impressions: number; clicks: number }>;
        debugLog?: unknown;
      };
      setDebugLog(data.debugLog ?? null);
      setRows((data.searchTerms ?? []).map((t) => ({
        term: t.term,
        impressions: t.impressions,
        clicks: t.clicks,
        addNeg: false,
        keyword: t.term,
        matchType: "EXACT",
        hide: false,
      })));
      setStage("review");
    } catch (e) {
      setDebugLog({ error: String(e) });
      setStage("review");
    }
  }

  async function apply() {
    const keywords = rows
      .filter((r) => r.addNeg)
      .map((r) => ({ keyword: stripFormatting(r.keyword).trim(), matchType: r.matchType }));
    const exclusions = rows
      .filter((r) => r.hide)
      .map((r) => ({ keyword: r.term, matchType: "EXACT" as MatchType }));
    if (!keywords.length && !exclusions.length) return;

    setStage("applying");
    try {
      const res = await fetch(apiUrl("/api/admin/google-ads/add-negatives"), {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ campaign, keywords, exclusions }),
      });
      const data: unknown = await res.json();
      setModal(data);
      setStage("done");
    } catch (e) {
      setModal({ error: String(e) });
      setStage("done");
    }
  }

  function update(i: number, patch: Partial<TermRow>) {
    setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  }

  const negCount = rows.filter((r) => r.addNeg).length;
  const hideCount = rows.filter((r) => r.hide).length;
  const anyAction = negCount > 0 || hideCount > 0;

  return (
    <div>
      <SubpageStickyBar onBack={() => router.push({ name: "settings" })} hideSave>
        <span className="text-sm font-medium text-foreground">Google Ads — Поисковые запросы</span>
      </SubpageStickyBar>
      <div className="max-w-2xl mx-auto px-3 py-3 space-y-4">

        {/* Campaign selector + Load */}
        <div className="flex gap-2 items-center">
          <span className="text-xs text-muted-foreground shrink-0">Кампания:</span>
          <div className="inline-flex gap-0.5 p-0.5 bg-secondary rounded-lg">
            {(["EN", "IT", "ES"] as Campaign[]).map((c) => (
              <button
                key={c}
                type="button"
                disabled={stage === "loading" || stage === "applying"}
                onClick={() => { setCampaign(c); setStage("idle"); setRows([]); setDebugLog(null); }}
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
            onClick={() => void load()}
            disabled={stage === "loading" || stage === "applying"}
            className="ml-auto h-9 px-5 text-sm font-semibold bg-primary text-primary-foreground rounded-lg disabled:opacity-50"
          >
            {stage === "loading" ? "Загрузка…" : "Загрузить"}
          </button>
        </div>

        {stage === "loading" && (
          <div className="text-sm text-muted-foreground py-8 text-center">Загружаю поисковые запросы…</div>
        )}

        {(stage === "review" || stage === "applying" || stage === "done") && (
          <>
            {rows.length === 0 ? (
              <div className="text-sm text-muted-foreground text-center py-6">
                Поисковые запросы не найдены.{" "}
                {debugLog !== null && (
                  <button type="button" className="underline" onClick={() => setModal(debugLog)}>
                    Ответ API
                  </button>
                )}
              </div>
            ) : (
              <div className="bg-card border border-border rounded-xl overflow-hidden">
                {/* Header */}
                <div className="px-4 py-2.5 border-b border-border flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">
                    {rows.length} запросов · {negCount} в негативы · {hideCount} в исключения
                  </span>
                  {debugLog !== null && (
                    <button
                      type="button"
                      onClick={() => setModal(debugLog)}
                      className="text-[11px] text-muted-foreground underline"
                    >
                      Лог
                    </button>
                  )}
                </div>

                {/* Rows */}
                <div className="divide-y divide-border max-h-[60vh] overflow-y-auto">
                  {rows.map((row, i) => (
                    <div key={i} className="px-4 py-3 space-y-2">
                      {/* Term + stats */}
                      <div className="flex items-baseline gap-2">
                        <span className="text-sm font-mono text-foreground">{row.term}</span>
                        <span className="text-[10px] text-muted-foreground">
                          {row.impressions} imp · {row.clicks} clk
                        </span>
                      </div>

                      {/* Checkbox 1: Add as negative */}
                      <div className="flex items-center gap-2 flex-wrap">
                        <label className="flex items-center gap-1.5 cursor-pointer shrink-0">
                          <input
                            type="checkbox"
                            checked={row.addNeg}
                            onChange={(e) => update(i, { addNeg: e.target.checked })}
                            className="w-4 h-4 accent-primary"
                          />
                          <span className="text-xs text-muted-foreground">Добавить негатив</span>
                        </label>
                        {row.addNeg && (
                          <>
                            <div className="inline-flex gap-0.5 p-0.5 bg-secondary rounded-md shrink-0">
                              {MATCH_TYPES.map((mt) => (
                                <button
                                  key={mt}
                                  type="button"
                                  onClick={() => update(i, { matchType: mt })}
                                  className={
                                    "h-5 px-1.5 text-[10px] font-semibold rounded transition-colors " +
                                    (row.matchType === mt
                                      ? MATCH_COLORS[mt] + " shadow-sm"
                                      : "text-muted-foreground hover:text-foreground")
                                  }
                                >
                                  {mt}
                                </button>
                              ))}
                            </div>
                            <input
                              type="text"
                              value={row.keyword}
                              onChange={(e) => update(i, { keyword: stripFormatting(e.target.value) })}
                              className="flex-1 h-6 px-2 text-xs font-mono bg-secondary border border-border rounded focus:outline-none focus:ring-1 focus:ring-primary min-w-0"
                              style={{ minWidth: "8rem" }}
                            />
                          </>
                        )}
                      </div>

                      {/* Checkbox 2: Exclude (hide) */}
                      <label className="flex items-center gap-1.5 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={row.hide}
                          onChange={(e) => update(i, { hide: e.target.checked })}
                          className="w-4 h-4 accent-primary"
                        />
                        <span className="text-xs text-muted-foreground">Исключить (не показывать)</span>
                      </label>
                    </div>
                  ))}
                </div>

                {/* Footer */}
                <div className="px-4 py-3 border-t border-border">
                  <button
                    type="button"
                    disabled={!anyAction || stage === "applying" || stage === "done"}
                    onClick={() => void apply()}
                    className="w-full h-9 text-sm font-semibold bg-primary text-primary-foreground rounded-lg disabled:opacity-50"
                  >
                    {stage === "applying"
                      ? "Сохраняю…"
                      : stage === "done"
                      ? "Готово ✓"
                      : `Применить — ${negCount} негатив${negCount === 1 ? "" : negCount < 5 ? "а" : "ов"}, ${hideCount} исключён${hideCount === 1 ? "" : hideCount < 5 ? "о" : "о"}`}
                  </button>
                </div>
              </div>
            )}
          </>
        )}

        {modal !== null && <LogModal data={modal} onClose={() => setModal(null)} />}
      </div>
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
