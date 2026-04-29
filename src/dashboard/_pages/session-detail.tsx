"use client";

import { useEffect, useState, useCallback } from "react";
import { apiUrl } from "@/lib/api";
import { ConfirmDialog, SubpageStickyBar } from "../_v2/ui";
import { useDashboardRouter } from "../_spa/router";
import { EVENT_LABELS } from "@/lib/dashboard-events";
import {
  COUNTRY_TZ,
  countryToFlag,
  formatDateFull,
  formatEventName,
  formatTime,
  formatTimeDiff,
} from "./_admin-helpers";

interface SessionData {
  id: string;
  companyId: string | null;
  country: string | null;
  city: string | null;
  landingPage: string | null;
  gclid: string | null;
  keyword: string | null;
  userAgent: string | null;
  browser: string | null;
  device: string | null;
  ip: string | null;
  restaurantName: string | null;
  wasRegistered: boolean;
  namedRestaurant: boolean;
  selectedType: boolean;
  modifiedMenu: boolean;
  modifiedContacts: boolean;
  modifiedDesign: boolean;
  reached50Views: boolean;
  paidSubscription: boolean;
  conversionSent: boolean;
  conversionViewsSent: boolean;
  conversionSubscriptionSent: boolean;
  lastSeenAt: string | null;
  createdAt: string;
  updatedAt: string;
}

interface AnalyticsEvent {
  id: string;
  event: string;
  sessionId: string;
  meta?: Record<string, string> | null;
  createdAt: string;
}

const FLAG_LABELS: Record<string, string> = {
  wasRegistered: "Registered",
  namedRestaurant: "Named restaurant",
  selectedType: "Selected type",
  modifiedMenu: "Modified menu",
  modifiedContacts: "Modified contacts",
  modifiedDesign: "Modified design",
  reached50Views: "Reached 20 views",
  paidSubscription: "Paid subscription",
  conversionSent: "Conv: type selected",
  conversionViewsSent: "Conv: 20 views",
  conversionSubscriptionSent: "Conv: subscription",
};

const TWO_HOURS_MS = 2 * 60 * 60 * 1000;

function groupEventsByGap(events: AnalyticsEvent[]): AnalyticsEvent[][] {
  const sorted = [...events].reverse();
  const groups: AnalyticsEvent[][] = [];
  let current: AnalyticsEvent[] = [];

  for (let i = 0; i < sorted.length; i++) {
    if (i === 0) {
      current.push(sorted[i]);
      continue;
    }
    const gap =
      new Date(sorted[i - 1].createdAt).getTime() - new Date(sorted[i].createdAt).getTime();
    if (gap > TWO_HOURS_MS) {
      groups.push(current);
      current = [];
    }
    current.push(sorted[i]);
  }
  if (current.length > 0) groups.push(current);
  return groups;
}

interface SessionDetailPageProps {
  sessionId: string;
}

export function SessionDetailPage({ sessionId }: SessionDetailPageProps) {
  const router = useDashboardRouter();
  const goBack = () => router.back();

  const [session, setSession] = useState<SessionData | null>(null);
  const [events, setEvents] = useState<AnalyticsEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [pendingConv, setPendingConv] = useState<string | null>(null);
  const [alert, setAlert] = useState<{ title: string; message: string } | null>(null);
  const [convPrompt, setConvPrompt] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ sessionId });
      const res = await fetch(apiUrl(`/api/admin/analytics/sessions?${params}`), { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        setSession(data.session || null);
        setEvents(data.events || []);
      }
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  async function handleDelete() {
    setDeleting(true);
    try {
      const res = await fetch(apiUrl("/api/admin/analytics/sessions"), {
        credentials: "include",
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId }),
      });
      if (res.ok) goBack();
      else setAlert({ title: "Delete failed", message: "Could not delete session." });
    } catch {
      setAlert({ title: "Delete failed", message: "Could not delete session." });
    } finally {
      setDeleting(false);
      setConfirmDelete(false);
    }
  }

  async function sendConversion(eventType: string) {
    if (!session?.gclid) return;
    setPendingConv(eventType);
    setConvPrompt(null);
    try {
      const res = await fetch(apiUrl("/api/admin/analytics/send-conversion"), {
        credentials: "include",
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          gclid: session.gclid,
          conversionDateTime: new Date().toISOString(),
          eventType,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setAlert({ title: "Conversion sent", message: `"${eventType}" delivered.` });
        fetchData();
      } else {
        setAlert({ title: "Send failed", message: data.error || "Failed to send conversion" });
      }
    } catch {
      setAlert({ title: "Send failed", message: "Network error" });
    } finally {
      setPendingConv(null);
    }
  }

  if (loading && !session) {
    return (
      <div>
        <SubpageStickyBar onBack={() => goBack()} hideSave />
        <div className="max-w-2xl mx-auto pt-5 md:pt-4">
          <div className="mb-5">
            <div className="text-xs text-muted-foreground">Settings / Sessions</div>
            <h2 className="text-xl font-medium text-foreground mt-1">Session</h2>
          </div>
          <div className="bg-card border border-border rounded-2xl p-8 text-center text-sm text-muted-foreground">
            Loading…
          </div>
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <div>
        <SubpageStickyBar onBack={() => goBack()} hideSave />
        <div className="max-w-2xl mx-auto pt-5 md:pt-4">
          <div className="mb-5">
            <div className="text-xs text-muted-foreground">Settings / Sessions</div>
            <h2 className="text-xl font-medium text-foreground mt-1">Session</h2>
          </div>
          <div className="bg-card border border-border rounded-2xl p-8 text-center text-sm text-muted-foreground">
            Not found
          </div>
        </div>
      </div>
    );
  }

  const isOnline = session.lastSeenAt && Date.now() - new Date(session.lastSeenAt).getTime() < 30_000;
  const countryTz = session.country ? COUNTRY_TZ[session.country] : undefined;
  const activeFlags = Object.entries(FLAG_LABELS).filter(
    ([key]) => session[key as keyof SessionData] === true,
  );

  function openCompany() {
    if (!session?.companyId) return;
    router.push({ name: "settings.admin.company", id: session.companyId });
  }

  function copy(value: string) {
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(value).then(() => {
        setAlert({ title: "Copied", message: value });
      }).catch(() => {});
    }
  }

  const infoRows: { label: string; value: string; sub?: string; copyable?: boolean; onClick?: () => void; valueCls?: string }[] = [];
  if (isOnline) infoRows.push({ label: "Status", value: "Online", valueCls: "text-emerald-600 font-medium" });
  if (session.country)
    infoRows.push({
      label: "Country",
      value: `${countryToFlag(session.country)} ${session.country}${session.city ? `, ${session.city}` : ""}`,
    });
  if (session.landingPage) infoRows.push({ label: "Landing", value: session.landingPage });
  if (session.ip) infoRows.push({ label: "IP", value: session.ip, copyable: true });
  if (session.browser) infoRows.push({ label: "Browser", value: session.browser });
  if (session.device) infoRows.push({ label: "Device", value: session.device });
  infoRows.push({ label: "Source", value: session.gclid ? "Google Ads" : "Direct" });
  if (session.gclid) infoRows.push({ label: "GCLID", value: session.gclid, copyable: true });
  if (session.keyword) infoRows.push({ label: "Keyword", value: session.keyword, copyable: true });
  if (session.companyId)
    infoRows.push({
      label: "Restaurant",
      value: session.restaurantName || "No name",
      onClick: openCompany,
      valueCls: "text-blue-500",
    });
  infoRows.push({
    label: "Created",
    value: formatDateFull(session.createdAt),
    sub: countryTz ? formatTime(session.createdAt, countryTz) : undefined,
  });
  infoRows.push({
    label: "Updated",
    value: formatDateFull(session.updatedAt),
    sub: countryTz ? formatTime(session.updatedAt, countryTz) : undefined,
  });
  if (session.lastSeenAt && !isOnline) {
    infoRows.push({
      label: "Last seen",
      value: formatDateFull(session.lastSeenAt),
      sub: countryTz ? formatTime(session.lastSeenAt, countryTz) : undefined,
    });
  }

  return (
    <div>
      <SubpageStickyBar onBack={() => goBack()} hideSave>
        <button
          type="button"
          onClick={fetchData}
          className="h-8 px-3 text-xs font-medium text-muted-foreground rounded-lg transition-colors"
        >
          Refresh
        </button>
      </SubpageStickyBar>
      <div className="max-w-2xl mx-auto pt-5 md:pt-4">
        <div className="mb-5">
          <div className="text-xs text-muted-foreground">Settings / Sessions</div>
          <h2 className="text-xl font-medium text-foreground mt-1">Session</h2>
        </div>

        {/* Info card */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="divide-y divide-border">
          {infoRows.map((row) => (
            <button
              key={row.label}
              type="button"
              disabled={!row.copyable && !row.onClick}
              onClick={() => {
                if (row.copyable) copy(row.value);
                else if (row.onClick) row.onClick();
              }}
              className="flex items-center justify-between w-full px-4 py-2.5 text-left"
            >
              <span className="text-xs text-muted-foreground shrink-0">{row.label}</span>
              <span
                className={
                  "text-xs font-mono text-right break-all max-w-[60%] " +
                  (row.valueCls || (row.onClick ? "text-blue-500" : "text-foreground"))
                }
              >
                {row.value}
                {row.sub ? <span className="block text-muted-foreground">{row.sub}</span> : null}
              </span>
            </button>
          ))}
        </div>

        {activeFlags.length > 0 ? (
          <div className="border-t border-border px-4 py-2.5">
            <div className="flex flex-wrap gap-1.5">
              {activeFlags.map(([, label]) => (
                <span
                  key={label}
                  className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200"
                >
                  {label}
                </span>
              ))}
            </div>
          </div>
        ) : null}

        {session.userAgent ? (
          <div className="border-t border-border px-4 py-2.5">
            <p className="text-[10px] text-muted-foreground break-all font-mono">{session.userAgent}</p>
          </div>
        ) : null}
      </div>

      {/* Conversion buttons */}
      {session.gclid ? (
        <div className="space-y-2 mt-4">
          {!session.conversionSent ? (
            <button
              type="button"
              onClick={() => setConvPrompt("type_selected")}
              disabled={pendingConv !== null}
              className="w-full h-10 px-4 text-sm font-medium text-foreground bg-card border border-border rounded-lg transition-colors disabled:opacity-60"
            >
              {pendingConv === "type_selected" ? "Sending…" : "Send conversion: type selected"}
            </button>
          ) : null}
          {!session.conversionViewsSent ? (
            <button
              type="button"
              onClick={() => setConvPrompt("views_reached")}
              disabled={pendingConv !== null}
              className="w-full h-10 px-4 text-sm font-medium text-foreground bg-card border border-border rounded-lg transition-colors disabled:opacity-60"
            >
              {pendingConv === "views_reached" ? "Sending…" : "Send conversion: 20 views"}
            </button>
          ) : null}
          {!session.conversionSubscriptionSent ? (
            <button
              type="button"
              onClick={() => setConvPrompt("subscription")}
              disabled={pendingConv !== null}
              className="w-full h-10 px-4 text-sm font-medium text-foreground bg-card border border-border rounded-lg transition-colors disabled:opacity-60"
            >
              {pendingConv === "subscription" ? "Sending…" : "Send conversion: subscription"}
            </button>
          ) : null}
        </div>
      ) : null}

      {/* Events */}
      <div className="mt-4">
        <h3 className="text-sm font-medium text-foreground mb-2">Events</h3>
        {events.length === 0 ? (
          <div className="bg-card border border-border rounded-2xl p-6 text-center text-sm text-muted-foreground">
            No events
          </div>
        ) : (
          <div className="space-y-3">
            {groupEventsByGap(events).map((group, gi) => (
              <div key={gi} className="bg-card border border-border rounded-xl overflow-hidden divide-y divide-border">
                {group.map((event, index) => {
                  const next = index < group.length - 1 ? group[index + 1] : null;
                  const diff = next ? formatTimeDiff(next.createdAt, event.createdAt) : null;
                  return (
                    <div key={event.id} className="px-4 py-2.5">
                      <p className="text-sm text-foreground truncate">
                        {formatEventName(event.event, EVENT_LABELS)}
                        {event.meta ? (
                          <span className="text-muted-foreground ml-1">
                            ({Object.values(event.meta).join(" / ")})
                          </span>
                        ) : null}
                      </p>
                      <div className="flex items-center justify-between mt-0.5">
                        <span className="text-[10px] text-muted-foreground tabular-nums">
                          {formatTime(event.createdAt)}
                        </span>
                        <span className="text-[10px] font-mono text-muted-foreground tabular-nums">
                          {diff ? `+${diff}` : ""}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="mt-6 flex justify-center">
        <button
          type="button"
          onClick={() => setConfirmDelete(true)}
          className="inline-flex items-center gap-1.5 h-9 px-3 text-xs font-medium text-red-600 rounded-lg transition-colors"
        >
          Delete session
        </button>
      </div>

      <ConfirmDialog
        open={confirmDelete}
        title="Delete session?"
        message="This will permanently remove the session and all its events."
        confirmLabel="Delete"
        onCancel={() => (deleting ? null : setConfirmDelete(false))}
        onConfirm={handleDelete}
      />

      <ConfirmDialog
        open={convPrompt !== null}
        title="Send conversion?"
        message={`Send "${convPrompt}" for gclid ${session.gclid}.`}
        confirmLabel="Send"
        confirmStyle="primary"
        onCancel={() => setConvPrompt(null)}
        onConfirm={() => convPrompt && sendConversion(convPrompt)}
      />

      <ConfirmDialog
        open={alert !== null}
        singleButton
        title={alert?.title}
        message={alert?.message}
        onCancel={() => setAlert(null)}
      />
      </div>
    </div>
  );
}
