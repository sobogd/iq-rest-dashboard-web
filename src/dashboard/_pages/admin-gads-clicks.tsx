"use client";

import { useEffect, useState, useCallback } from "react";
import { ChevronLeft, ChevronRight, X, Check } from "lucide-react";
import { apiUrl } from "@/lib/api";

interface ClickRow {
  gclid: string;
  campaign: string;
  keyword: string;
  t1: boolean;
  t2: boolean;
  t3: boolean;
}

interface ApiResp {
  date: string;
  clicks: ClickRow[];
}

const FLAGS: Record<string, string> = { IT: "🇮🇹", ES: "🇪🇸", PT: "🇵🇹" };

function todayUtc(): string {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

function shiftDay(iso: string, delta: number): string {
  const d = new Date(`${iso}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + delta);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

export function AdminGoogleAdsClicksPage({ onClose }: { onClose: () => void }) {
  const [date, setDate] = useState(todayUtc());
  const [rows, setRows] = useState<ClickRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async (d: string) => {
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch(apiUrl(`/api/admin/google-ads/clicks?date=${d}`), { credentials: "include" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as ApiResp;
      setRows(data.clicks);
    } catch (e) {
      setErr((e as Error).message);
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(date);
  }, [date, load]);

  const totals = rows.reduce(
    (acc, r) => ({
      total: acc.total + 1,
      t1: acc.t1 + (r.t1 ? 1 : 0),
      t2: acc.t2 + (r.t2 ? 1 : 0),
      t3: acc.t3 + (r.t3 ? 1 : 0),
    }),
    { total: 0, t1: 0, t2: 0, t3: 0 },
  );

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Header */}
      <div className="flex items-center gap-3 px-5 py-3 border-b border-border">
        <button
          type="button"
          onClick={() => setDate((d) => shiftDay(d, -1))}
          className="h-9 w-9 inline-flex items-center justify-center rounded-md bg-secondary text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="h-9 px-2 rounded-md bg-secondary border border-border text-sm text-foreground"
        />
        <button
          type="button"
          onClick={() => setDate((d) => shiftDay(d, 1))}
          disabled={date >= todayUtc()}
          className="h-9 w-9 inline-flex items-center justify-center rounded-md bg-secondary text-muted-foreground hover:text-foreground disabled:opacity-40"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
        <div className="flex-1" />
        <button
          type="button"
          onClick={onClose}
          className="h-9 w-9 inline-flex items-center justify-center rounded-md bg-secondary text-muted-foreground hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Summary row */}
      <div className="px-5 py-2 border-b border-border text-xs text-muted-foreground tabular-nums flex gap-4">
        <span>Clicks: <b className="text-foreground">{totals.total}</b></span>
        <span>T1: <b className="text-foreground">{totals.t1}</b></span>
        <span>T2: <b className="text-foreground">{totals.t2}</b></span>
        <span>T3: <b className="text-foreground">{totals.t3}</b></span>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-auto">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-6 h-6 border-2 border-input border-t-foreground rounded-full animate-spin" />
          </div>
        ) : err ? (
          <div className="p-5 text-sm text-red-500">Error: {err}</div>
        ) : rows.length === 0 ? (
          <div className="p-5 text-sm text-muted-foreground text-center">No clicks for {date}</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-background border-b border-border text-xs text-muted-foreground">
              <tr>
                <th className="px-4 py-2 text-left font-medium">Date</th>
                <th className="px-2 py-2 text-left font-medium">Camp</th>
                <th className="px-2 py-2 text-left font-medium">Keyword</th>
                <th className="px-4 py-2 text-left font-medium">gclid</th>
                <th className="px-2 py-2 text-center font-medium">T1</th>
                <th className="px-2 py-2 text-center font-medium">T2</th>
                <th className="px-2 py-2 text-center font-medium">T3</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.gclid} className="border-b border-border/50 hover:bg-muted/40">
                  <td className="px-4 py-2 tabular-nums text-muted-foreground whitespace-nowrap">{date}</td>
                  <td className="px-2 py-2 whitespace-nowrap">
                    <span className="mr-1">{FLAGS[r.campaign] || "🏳"}</span>
                    <span className="text-xs text-muted-foreground">{r.campaign}</span>
                  </td>
                  <td className="px-2 py-2 max-w-[180px] truncate" title={r.keyword}>{r.keyword || "—"}</td>
                  <td className="px-4 py-2 font-mono text-xs max-w-[260px] truncate" title={r.gclid}>{r.gclid}</td>
                  <td className="px-2 py-2 text-center">
                    {r.t1 ? <Check className="h-4 w-4 text-emerald-500 inline" /> : <span className="text-muted-foreground">—</span>}
                  </td>
                  <td className="px-2 py-2 text-center">
                    {r.t2 ? <Check className="h-4 w-4 text-emerald-500 inline" /> : <span className="text-muted-foreground">—</span>}
                  </td>
                  <td className="px-2 py-2 text-center">
                    {r.t3 ? <Check className="h-4 w-4 text-emerald-500 inline" /> : <span className="text-muted-foreground">—</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
