"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { apiUrl } from "@/lib/api";
import { useTranslations } from "next-intl";
import { SubpageStickyBar } from "../_v2/ui";
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

type Period = "today" | "yesterday" | "7days";

const PERIODS: Period[] = ["today", "yesterday", "7days"];

export function SessionsPage() {
  const t = useTranslations("dashboard.admin");
  const router = useDashboardRouter();

  const [period, setPeriod] = useState<Period>("today");
  const scrollRef = useRef<HTMLDivElement>(null);

  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

  const TABS: { value: Period; labelKey: "today" | "yesterday" | "sevenDays" }[] = [
    { value: "today", labelKey: "today" },
    { value: "yesterday", labelKey: "yesterday" },
    { value: "7days", labelKey: "sevenDays" },
  ];

  const fetchSessions = useCallback(async (p: Period) => {
    setLoading(true);
    try {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const res = await fetch(apiUrl(`/api/admin/analytics/sessions-list?period=${p}&tz=${encodeURIComponent(tz)}`));
      if (!res.ok) return;
      const json = await res.json();
      setSessions(json.sessions || []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSessions(period);
  }, [period, refreshKey, fetchSessions]);

  function refresh() {
    setRefreshKey((k) => k + 1);
  }

  function pickPeriod(p: Period) {
    setPeriod(p);
  }

  function openSession(sessionId: string) {
    router.push({ name: "settings.admin.session", sessionId });
  }

  return (
    <div>
      <SubpageStickyBar onBack={() => router.push({ name: "settings" })} hideSave>
        <button
          type="button"
          onClick={refresh}
          className="h-8 px-3 text-xs font-medium text-muted-foreground rounded-lg transition-colors"
        >
          {t("refresh")}
        </button>
      </SubpageStickyBar>
      <div ref={scrollRef} className="max-w-2xl mx-auto pt-5 md:pt-4">
        <div className="mb-5">
          <div className="text-xs text-muted-foreground">{t("settingsBreadcrumb")}</div>
          <h2 className="text-xl font-medium text-foreground mt-1">{t("sessionsTitle")}</h2>
        </div>

      <div className="flex gap-1.5 mb-5">
        {TABS.map((tab) => (
          <button
            key={tab.value}
            type="button"
            onClick={() => pickPeriod(tab.value)}
            className={
              "flex-1 h-8 px-3 text-xs font-medium rounded-full transition-colors " +
              (period === tab.value ? "bg-foreground text-background" : "bg-secondary text-foreground")
            }
          >
            {t(tab.labelKey)}
          </button>
        ))}
      </div>

      {loading && sessions.length === 0 ? (
        <div className="bg-card border border-border rounded-2xl p-8 text-center text-sm text-muted-foreground">
          {t("loading")}
        </div>
      ) : sessions.length === 0 ? (
        <div className="bg-card border border-border rounded-2xl p-8 text-center text-sm text-muted-foreground">
          {t("noSessions")}
        </div>
      ) : (
        <div className="bg-card border border-border rounded-xl overflow-hidden divide-y divide-border">
          {sessions.map((session) => {
            const isOnline =
              session.lastSeenAt && Date.now() - new Date(session.lastSeenAt).getTime() < 30_000;
            return (
              <button
                key={session.sessionId}
                type="button"
                onClick={() => openSession(session.sessionId)}
                className="flex items-center gap-2.5 w-full px-3 py-2 text-left transition-colors"
              >
                <span className="text-base shrink-0">
                  {session.country ? countryToFlag(session.country) : "🌐"}
                </span>
                <span className="text-xs font-medium shrink-0 text-foreground">
                  {formatDateShort(session.lastEvent)}
                </span>
                <span
                  className={
                    "text-xs shrink-0 " +
                    (session.source === "Ads" ? "text-blue-500" : "text-muted-foreground")
                  }
                >
                  {session.source}
                </span>
                <span className="flex-1" />
                <span className="text-xs text-muted-foreground tabular-nums shrink-0">
                  {formatDuration(session.duration)} · {t("events", { count: session.eventCount })}
                </span>
                {isOnline ? (
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 shrink-0" />
                ) : session.hasUser ? (
                  <span className="h-1.5 w-1.5 rounded-full bg-red-500 shrink-0" />
                ) : null}
              </button>
            );
          })}
        </div>
      )}
      </div>
    </div>
  );
}
