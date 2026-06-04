"use client";

import { useState, useEffect, useCallback } from "react";
import { Star, EyeOff, Trash2, MessageCircle } from "lucide-react";
import { apiUrl } from "@/lib/api";
import { RefreshIcon } from "../_v2/icons";
import { SubpageStickyBar } from "../_v2/ui";
import { useDashboardRouter } from "../_spa/router";
import { AVAILABLE_LANGUAGES } from "../_v2/i18n";

const LANG_FLAG = new Map(AVAILABLE_LANGUAGES.map((l) => [l.code, l.flag]));

type Filter = "all" | "watched" | "new";

interface Thread {
  id: string;
  channel: "whatsapp" | "internal";
  contactId?: string;
  restaurantId?: string;
  name: string;
  lang: string | null;
  watched: boolean;
  muted: boolean;
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
    if (t.channel === "whatsapp") router.push({ name: "settings.admin.inboxThread", id: t.id });
    else if (t.restaurantId) router.push({ name: "settings.admin.messageThread", id: t.restaurantId });
  }

  async function setFlag(contactId: string, patch: { watched?: boolean; muted?: boolean }) {
    await fetch(apiUrl(`/api/admin/inbox/contacts/${contactId}/flags`), {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    void load(filter);
  }

  async function remove(id: string) {
    if (!window.confirm("Delete this conversation? This cannot be undone.")) return;
    await fetch(apiUrl(`/api/admin/inbox/threads/${encodeURIComponent(id)}`), {
      method: "DELETE",
      credentials: "include",
    });
    void load(filter);
  }

  const chip = (f: Filter, label: string) => (
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
          {chip("all", "All")}
          {chip("watched", "Watched")}
          {chip("new", "New")}
        </div>

        {loading && threads.length === 0 ? (
          <div className="text-xs text-muted-foreground py-8 text-center">Loading…</div>
        ) : threads.length === 0 ? (
          <div className="text-xs text-muted-foreground py-8 text-center">No conversations</div>
        ) : (
          <div className="bg-card border border-border rounded-xl overflow-hidden divide-y divide-border">
            {threads.map((t) => (
              <div key={t.id} className="flex items-center gap-2 px-3 py-2 text-xs hover:bg-muted/40 transition-colors">
                <button type="button" onClick={() => openThread(t)} className="flex items-center gap-2 min-w-0 flex-1 text-left">
                  <span
                    className={
                      "shrink-0 inline-flex items-center justify-center w-5 h-5 rounded " +
                      (t.channel === "whatsapp" ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" : "bg-secondary text-muted-foreground")
                    }
                    title={t.channel}
                  >
                    {t.channel === "whatsapp" ? <span className="text-[11px] font-bold">W</span> : <MessageCircle className="w-3 h-3" />}
                  </span>
                  <span className="text-base shrink-0" title={t.lang || ""}>{LANG_FLAG.get(t.lang || "") || "🌐"}</span>
                  <span className="min-w-0 flex-1">
                    <span className="font-medium text-foreground truncate block">{t.name}</span>
                    <span className="text-[10px] text-muted-foreground truncate block">
                      {t.lastFromMe ? "You: " : ""}{t.lastPreview}
                    </span>
                  </span>
                </button>
                {t.channel === "whatsapp" && t.contactId ? (
                  <span className="shrink-0 flex items-center gap-0.5">
                    <button
                      type="button"
                      onClick={() => setFlag(t.contactId!, { watched: !t.watched })}
                      className={"h-7 w-7 inline-flex items-center justify-center rounded " + (t.watched ? "text-amber-500" : "text-muted-foreground hover:text-foreground")}
                      title={t.watched ? "Unwatch" : "Watch"}
                    >
                      <Star className="w-3.5 h-3.5" fill={t.watched ? "currentColor" : "none"} />
                    </button>
                    <button
                      type="button"
                      onClick={() => setFlag(t.contactId!, { muted: true })}
                      className="h-7 w-7 inline-flex items-center justify-center rounded text-muted-foreground hover:text-foreground"
                      title="Mute (hide)"
                    >
                      <EyeOff className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => remove(t.id)}
                      className="h-7 w-7 inline-flex items-center justify-center rounded text-red-500 hover:bg-red-500/10"
                      title="Delete"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </span>
                ) : null}
                <span className="text-[10px] text-muted-foreground tabular-nums shrink-0">{fmtAt(t.lastAt)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
