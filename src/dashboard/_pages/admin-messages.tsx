"use client";

import { useState, useEffect, useCallback } from "react";
import { apiUrl } from "@/lib/api";
import { RefreshIcon } from "../_v2/icons";
import { SubpageStickyBar } from "../_v2/ui";
import { useDashboardRouter } from "../_spa/router";
import { AVAILABLE_LANGUAGES } from "../_v2/i18n";

const LANG_FLAG = new Map(AVAILABLE_LANGUAGES.map((l) => [l.code, l.flag]));

interface Thread {
  restaurantId: string;
  title: string;
  defaultLanguage: string | null;
  count: number;
  lastMessage: string;
  lastAt: string;
  lastFromAdmin: boolean;
}

function fmtAt(iso: string): string {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

export function AdminMessagesPage({ onBack }: { onBack: () => void }) {
  const router = useDashboardRouter();
  const [threads, setThreads] = useState<Thread[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(apiUrl("/api/admin/messages/threads"), { credentials: "include" });
      const j = res.ok ? ((await res.json()) as { threads: Thread[] }) : { threads: [] };
      setThreads(j.threads ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div>
      <SubpageStickyBar onBack={onBack} hideSave>
        <button
          type="button"
          onClick={() => void load()}
          disabled={loading}
          className="h-8 w-8 inline-flex items-center justify-center bg-secondary rounded-md text-muted-foreground hover:text-foreground disabled:opacity-60"
          title="Refresh"
        >
          <RefreshIcon size={14} className={loading ? "animate-spin" : ""} />
        </button>
      </SubpageStickyBar>
      <div className="max-w-5xl mx-auto md:px-6 pt-5 md:pt-4">
        {loading && threads.length === 0 ? (
          <div className="text-xs text-muted-foreground py-8 text-center">Loading…</div>
        ) : threads.length === 0 ? (
          <div className="text-xs text-muted-foreground py-8 text-center">No conversations</div>
        ) : (
          <div className="bg-card border border-border rounded-xl overflow-hidden divide-y divide-border">
            {threads.map((t) => (
              <button
                key={t.restaurantId}
                type="button"
                onClick={() => router.push({ name: "settings.admin.messageThread", id: t.restaurantId })}
                className="w-full flex items-center gap-2 px-3 py-2 text-xs text-left hover:bg-muted/40 transition-colors"
              >
                <span className="text-base shrink-0" title={t.defaultLanguage || ""}>
                  {LANG_FLAG.get(t.defaultLanguage || "") || "🌐"}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="font-medium text-foreground truncate block">{t.title}</span>
                  <span className="text-[10px] text-muted-foreground truncate block">
                    {t.lastFromAdmin ? "You: " : ""}{t.lastMessage}
                  </span>
                </span>
                <span className="text-[10px] text-muted-foreground bg-secondary rounded px-1.5 py-0.5 shrink-0">{t.count}</span>
                <span className="text-[10px] text-muted-foreground tabular-nums shrink-0">{fmtAt(t.lastAt)}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
