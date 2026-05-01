"use client";

import { useEffect, useState, useCallback } from "react";
import { apiUrl } from "@/lib/api";
import { useTranslations } from "next-intl";
import { ConfirmDialog, SubpageStickyBar } from "../_v2/ui";
import { RefreshIcon, TrashIcon } from "../_v2/icons";
import { countryToFlag, formatDateShort, formatDuration } from "./_admin-helpers";
import { useDashboardRouter } from "../_spa/router";

type Device = "mobile" | "tablet" | "desktop" | "unknown";

interface Session {
  sessionId: string;
  lastEvent: string;
  duration: number;
  eventCount: number;
  userId: string | null;
  email: string | null;
  country: string | null;
  device: Device;
  source: string;
}

function deviceIcon(d: Device): string {
  if (d === "mobile") return "📱";
  if (d === "tablet") return "📋";
  if (d === "desktop") return "💻";
  return "❓";
}

type Period = "today" | "yesterday";

export function SessionsPage() {
  const t = useTranslations("dashboard.admin");
  const router = useDashboardRouter();
  // Period lives on the View itself so opening a session detail and clicking back
  // restores the same tab the user was on (and reloads/share-links keep the tab).
  const period: Period = router.view.name === "settings.admin.sessions" && router.view.period
    ? router.view.period
    : "today";

  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const TABS: { value: Period; labelKey: "today" | "yesterday" }[] = [
    { value: "today", labelKey: "today" },
    { value: "yesterday", labelKey: "yesterday" },
  ];

  const setPeriod = (next: Period) => {
    // Replace (no new history entry) so back button still goes to settings, not previous tab.
    router.replace({ name: "settings.admin.sessions", period: next });
  };

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

  async function deleteSession(sessionId: string) {
    setDeleting(true);
    try {
      const res = await fetch(apiUrl("/api/admin/analytics/sessions"), {
        method: "DELETE",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId }),
      });
      if (res.ok) {
        // Optimistic local removal — avoids a full reload roundtrip.
        setSessions((prev) => prev.filter((s) => s.sessionId !== sessionId));
      }
    } finally {
      setDeleting(false);
      setPendingDelete(null);
    }
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
              const isOnline = Date.now() - new Date(s.lastEvent).getTime() < 30_000;
              return (
                <div key={s.sessionId} className="flex items-center gap-2 pr-2">
                  <button
                    type="button"
                    onClick={() => openSession(s.sessionId)}
                    className="flex-1 min-w-0 flex items-center gap-3 px-3 py-2 text-left transition-colors"
                  >
                    <span className="text-base shrink-0 flex items-center gap-1">
                      <span>{s.country ? countryToFlag(s.country) : "🌐"}</span>
                      <span className="text-sm" title={s.device}>{deviceIcon(s.device)}</span>
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium text-foreground truncate">
                        {formatDateShort(s.lastEvent)}
                        {isOnline ? (
                          <span className="ml-2 inline-block h-1.5 w-1.5 rounded-full bg-emerald-500 align-middle" />
                        ) : s.userId ? (
                          <span className="ml-2 inline-block h-1.5 w-1.5 rounded-full bg-red-500 align-middle" />
                        ) : null}
                      </div>
                      <div className="text-xs text-muted-foreground truncate">
                        <span className={s.source === "Ads" ? "text-blue-500" : ""}>{s.source}</span>
                        {s.email ? (
                          <>
                            <span className="mx-1.5">·</span>
                            {s.email}
                          </>
                        ) : null}
                        <span className="mx-1.5">·</span>
                        {formatDuration(s.duration)}
                        <span className="mx-1.5">·</span>
                        {t("events", { count: s.eventCount })}
                      </div>
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setPendingDelete(s.sessionId)}
                    aria-label="Delete session"
                    className="shrink-0 w-8 h-8 inline-flex items-center justify-center text-muted-foreground hover:text-red-600 transition-colors"
                  >
                    <TrashIcon size={14} />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
      <ConfirmDialog
        open={pendingDelete !== null}
        title="Delete session?"
        message="The session and all its events will be removed."
        confirmStyle="danger"
        onConfirm={() => {
          if (pendingDelete) void deleteSession(pendingDelete);
        }}
        onCancel={() => (deleting ? null : setPendingDelete(null))}
      />
    </div>
  );
}
