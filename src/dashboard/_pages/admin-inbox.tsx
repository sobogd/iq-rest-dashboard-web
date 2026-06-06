"use client";

import { useState, useEffect, useCallback } from "react";
import { MessageCircle } from "lucide-react";
import { apiUrl } from "@/lib/api";
import { RefreshIcon } from "../_v2/icons";
import { SubpageStickyBar } from "../_v2/ui";
import { useDashboardRouter } from "../_spa/router";
import { AVAILABLE_LANGUAGES } from "../_v2/i18n";
import { phoneToFlag } from "./phone-country";

const LANG_FLAG = new Map(AVAILABLE_LANGUAGES.map((l) => [l.code, l.flag]));
const chip = "text-[10px] text-muted-foreground bg-secondary rounded px-1.5 py-0.5";

type Filter = "all" | "watched" | "new" | "muted";

interface Thread {
  id: string;
  channel: "whatsapp" | "internal";
  contactId?: string;
  restaurantId?: string;
  name: string;
  externalId?: string;
  lang: string | null;
  watched: boolean;
  muted: boolean;
  unread: boolean;
  lastAt: string;
  lastPreview: string;
  lastFromMe: boolean;
}

function fmtAt(iso: string): string {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  const M = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${d.getDate()} ${M[d.getMonth()]} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

export function AdminInboxPage({ onBack }: { onBack: () => void }) {
  const router = useDashboardRouter();
  const [threads, setThreads] = useState<Thread[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>("all");
  const [waConfigured, setWaConfigured] = useState<boolean | null>(null);

  const load = useCallback(async (f: Filter) => {
    setLoading(true);
    try {
      const res = await fetch(apiUrl(`/api/admin/inbox/threads?filter=${f}`), { credentials: "include" });
      const j = res.ok ? ((await res.json()) as { threads: Thread[] }) : { threads: [] };
      setThreads(j.threads ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(filter);
  }, [load, filter]);

  useEffect(() => {
    fetch(apiUrl("/api/admin/inbox/config"), { credentials: "include" })
      .then((r) => (r.ok ? r.json() : { whatsapp: false }))
      .then((j: { whatsapp: boolean }) => setWaConfigured(!!j.whatsapp))
      .catch(() => setWaConfigured(false));
  }, []);

  function openThread(t: Thread) {
    // Both channels open in the unified inbox thread view (id carries the
    // channel prefix: "wa:<contactId>" or "int:<restaurantId>").
    router.push({ name: "settings.admin.inboxThread", id: t.id });
  }

  const filterChip = (f: Filter, label: string) => (
    <button
      type="button"
      onClick={() => setFilter(f)}
      className={
        "h-7 px-3 rounded-full text-xs font-medium transition-colors " +
        (filter === f ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground hover:text-foreground")
      }
    >
      {label}
    </button>
  );

  return (
    <div>
      <SubpageStickyBar onBack={onBack} hideSave>
        <button
          type="button"
          onClick={() => void load(filter)}
          disabled={loading}
          className="h-8 w-8 inline-flex items-center justify-center bg-secondary rounded-md text-muted-foreground hover:text-foreground disabled:opacity-60"
          title="Refresh"
        >
          <RefreshIcon size={14} className={loading ? "animate-spin" : ""} />
        </button>
      </SubpageStickyBar>
      <div className="max-w-5xl mx-auto md:px-6 pt-5 md:pt-4 space-y-3">
        {waConfigured === false ? (
          <div className="text-[11px] text-amber-700 dark:text-amber-400 bg-amber-500/10 rounded-lg px-3 py-2">
            WhatsApp is not connected yet — only internal threads show. See the setup steps to link your number.
          </div>
        ) : null}

        <div className="flex items-center gap-1.5">
          {filterChip("all", "All")}
          {filterChip("watched", "Watched")}
          {filterChip("new", "New")}
          {filterChip("muted", "Muted")}
        </div>

        {loading && threads.length === 0 ? (
          <div className="text-xs text-muted-foreground py-8 text-center">Loading…</div>
        ) : threads.length === 0 ? (
          <div className="text-xs text-muted-foreground py-8 text-center">No conversations</div>
        ) : (
          <div className="bg-card border border-border rounded-xl overflow-hidden divide-y divide-border">
            {threads.map((t) => {
              const countryFlag = t.channel === "whatsapp" ? phoneToFlag(t.externalId) : "";
              const langFlag = LANG_FLAG.get(t.lang || "") || "";
              // Hide the language flag when it would duplicate the country flag.
              const showLang = !!langFlag && langFlag !== countryFlag;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => openThread(t)}
                  className="w-full flex items-center gap-2 px-3 py-2 text-xs text-left hover:bg-muted/40 transition-colors"
                >
                  <span className="text-base shrink-0">
                    {countryFlag || (t.channel === "internal" ? <MessageCircle className="w-3.5 h-3.5 text-muted-foreground" /> : "🌐")}
                  </span>
                  {showLang ? <span className="text-base shrink-0" title={t.lang || ""}>{langFlag}</span> : null}
                  {t.unread ? <span className="w-2 h-2 rounded-full bg-primary shrink-0" title="Unread" /> : null}
                  <span className={(t.unread ? "font-semibold text-foreground " : "") + chip + " truncate min-w-0 max-w-[60%]"} title={t.name}>{t.name}</span>
                  <span className="flex-1" />
                  <span className={chip + " tabular-nums shrink-0"}>{fmtAt(t.lastAt)}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
