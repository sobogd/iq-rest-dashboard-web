"use client";

import { useEffect, useState, useCallback } from "react";
import { apiUrl } from "@/lib/api";
import { useTranslations } from "next-intl";
import { SubpageStickyBar } from "../_v2/ui";
import { RefreshIcon } from "../_v2/icons";
import { countryToFlag, formatDateShort, formatDuration } from "./_admin-helpers";
import { useDashboardRouter } from "../_spa/router";

interface Session {
  sessionId: string;
  lastEvent: string;
  duration: number;
  eventCount: number;
  country: string | null;
  source: string;
  hasUser: boolean;
  lastSeenAt: string | null;
}

type Period = "today" | "yesterday";

export function SessionsPage() {
  const t = useTranslations("dashboard.admin");
  const router = useDashboardRouter();

  const [period, setPeriod] = useState<Period>("today");
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const TABS: { value: Period; labelKey: "today" | "yesterday" }[] = [
    { value: "today", labelKey: "today" },
    { value: "yesterday", labelKey: "yesterday" },
  ];

  const load = useCallback(
    async (p: Period, mode: "initial" | "refresh") => {
      if (mode === "initial") setLoading(true);
      else setRefreshing(true);
      try {
        const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
        const url = apiUrl(
          `/api/admin/analytics/sessions-list?period=${p}&tz=${encodeURIComponent(tz)}&limit=2000`,
        );
        const res = await fetch(url, { credentials: "include" });
        if (!res.ok) return;
        const json = (await res.json()) as { sessions: Session[] };
        setSessions(json.sessions || []);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [],
  );

  useEffect(() => {
    void load(period, "initial");
  }, [period, load]);

  function refresh() {
    if (refreshing) return;
    void load(period, "refresh");
  }

  function openSession(sessionId: string) {
    router.push({ name: "settings.admin.session", sessionId });
  }

  return (
    <div>
      <SubpageStickyBar onBack={() => router.push({ name: "settings" })} hideSave>
        <div className="inline-flex items-center gap-0.5 p-0.5 bg-secondary rounded-lg">
          {TABS.map((tab) => {
            const isActive = period === tab.value;
            return (
              <button
                key={tab.value}
                type="button"
                onClick={() => setPeriod(tab.value)}
                className={
                  "h-7 px-2.5 text-[11px] font-medium rounded-md transition-colors " +
                  (isActive ? "bg-card text-foreground shadow-sm" : "text-muted-foreground")
                }
              >
                {t(tab.labelKey)}
              </button>
            );
          })}
        </div>
      </SubpageStickyBar>
      <div className="max-w-2xl mx-auto pt-5 md:pt-4">
        <div className="mb-5 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-xs text-muted-foreground">{t("settingsBreadcrumb")}</div>
            <h2 className="text-xl font-medium text-foreground mt-1">{t("sessionsTitle")}</h2>
          </div>
          <button
            type="button"
            onClick={refresh}
            disabled={refreshing}
            className="inline-flex items-center gap-1.5 h-9 px-3 text-xs font-medium text-muted-foreground bg-secondary rounded-md transition-colors shrink-0 disabled:opacity-60"
          >
            {refreshing ? (
              <span className="w-3.5 h-3.5 border-2 border-input border-t-foreground rounded-full animate-spin" />
            ) : (
              <RefreshIcon size={13} />
            )}
            {t("refresh")}
          </button>
        </div>

        {loading && sessions.length === 0 ? (
          <div className="bg-card border border-border rounded-2xl py-10 flex items-center justify-center gap-2 text-xs text-muted-foreground">
            <span className="w-4 h-4 border-2 border-input border-t-foreground rounded-full animate-spin" />
            {t("loading")}
          </div>
        ) : sessions.length === 0 ? (
          <div className="bg-card border border-border rounded-2xl p-8 text-center text-sm text-muted-foreground">
            {t("noSessions")}
          </div>
        ) : (
          <div className="bg-card border border-border rounded-xl overflow-hidden divide-y divide-border">
            {sessions.map((s) => {
              const isOnline =
                s.lastSeenAt && Date.now() - new Date(s.lastSeenAt).getTime() < 30_000;
              return (
                <button
                  key={s.sessionId}
                  type="button"
                  onClick={() => openSession(s.sessionId)}
                  className="w-full flex items-center gap-3 px-3 py-2 text-left transition-colors"
                >
                  <span className="text-base shrink-0">
                    {s.country ? countryToFlag(s.country) : "🌐"}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium text-foreground truncate">
                      {formatDateShort(s.lastEvent)}
                      {isOnline ? (
                        <span className="ml-2 inline-block h-1.5 w-1.5 rounded-full bg-emerald-500 align-middle" />
                      ) : s.hasUser ? (
                        <span className="ml-2 inline-block h-1.5 w-1.5 rounded-full bg-red-500 align-middle" />
                      ) : null}
                    </div>
                    <div className="text-xs text-muted-foreground truncate">
                      <span className={s.source === "Ads" ? "text-blue-500" : ""}>{s.source}</span>
                      <span className="mx-1.5">·</span>
                      {formatDuration(s.duration)}
                      <span className="mx-1.5">·</span>
                      {t("events", { count: s.eventCount })}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
