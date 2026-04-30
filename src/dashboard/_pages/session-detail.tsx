"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { apiUrl } from "@/lib/api";
import { ConfirmDialog, SubpageStickyBar } from "../_v2/ui";
import { RefreshIcon } from "../_v2/icons";
import { useDashboardRouter } from "../_spa/router";
import { EVENT_LABELS } from "@/lib/dashboard-events";
import {
  formatDateFull,
  formatEventName,
  formatTime,
  formatTimeDiff,
} from "./_admin-helpers";

interface SessionData {
  id: string;
  userId: string | null;
  email: string | null;
  companyId: string | null;
  restaurantName: string | null;
  ip: string | null;
  userAgent: string | null;
  createdAt: string;
}

interface AnalyticsEvent {
  id: string;
  event: string;
  occurredAt: string;
  createdAt: string;
}

const TWO_HOURS_MS = 2 * 60 * 60 * 1000;
const EVENTS_PAGE_SIZE = 15;

function groupEventsByGap(events: AnalyticsEvent[]): AnalyticsEvent[][] {
  const sorted = [...events];
  const groups: AnalyticsEvent[][] = [];
  let current: AnalyticsEvent[] = [];

  for (let i = 0; i < sorted.length; i++) {
    if (i === 0) {
      current.push(sorted[i]);
      continue;
    }
    const gap =
      new Date(sorted[i - 1].occurredAt).getTime() - new Date(sorted[i].occurredAt).getTime();
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

type Tab = "info" | "events";

export function SessionDetailPage({ sessionId }: SessionDetailPageProps) {
  const router = useDashboardRouter();
  const goBack = () => router.push({ name: "settings.admin.sessions" });

  const [tab, setTab] = useState<Tab>("info");
  const [session, setSession] = useState<SessionData | null>(null);
  const [lastEventAt, setLastEventAt] = useState<string | null>(null);
  const [events, setEvents] = useState<AnalyticsEvent[]>([]);
  const [eventsLoading, setEventsLoading] = useState(false);
  const [eventsHasMore, setEventsHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [alert, setAlert] = useState<{ title: string; message: string } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const eventsOffsetRef = useRef(0);
  const eventsLoadingRef = useRef(false);

  const fetchSessionInfo = useCallback(
    async (mode: "initial" | "refresh" = "initial") => {
      if (mode === "initial") setLoading(true);
      else setRefreshing(true);
      try {
        // Pull last event with eventLimit=1 + reverse order to display "last seen"
        const params = new URLSearchParams({ sessionId, eventLimit: "1" });
        const res = await fetch(apiUrl(`/api/admin/analytics/sessions?${params}`), {
          credentials: "include",
        });
        if (res.ok) {
          const data = await res.json();
          setSession(data.session || null);
          const evs = (data.events ?? []) as AnalyticsEvent[];
          setLastEventAt(evs.length ? evs[evs.length - 1].occurredAt : null);
        }
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [sessionId],
  );

  const loadEventsPage = useCallback(
    async (offset: number, mode: "initial" | "append" | "refresh" = "initial") => {
      if (eventsLoadingRef.current) return;
      eventsLoadingRef.current = true;
      if (mode === "refresh") setRefreshing(true);
      else setEventsLoading(true);
      try {
        const params = new URLSearchParams({
          sessionId,
          eventOffset: String(offset),
          eventLimit: String(EVENTS_PAGE_SIZE),
        });
        const res = await fetch(apiUrl(`/api/admin/analytics/sessions?${params}`), {
          credentials: "include",
        });
        if (!res.ok) return;
        const data = (await res.json()) as { events: AnalyticsEvent[]; hasMore: boolean };
        if (mode === "append") {
          setEvents((prev) => [...prev, ...data.events]);
        } else {
          setEvents(data.events);
        }
        setEventsHasMore(!!data.hasMore);
        eventsOffsetRef.current = offset + (data.events?.length ?? 0);
      } finally {
        setEventsLoading(false);
        setRefreshing(false);
        eventsLoadingRef.current = false;
      }
    },
    [sessionId],
  );

  useEffect(() => {
    void fetchSessionInfo();
  }, [fetchSessionInfo]);

  useEffect(() => {
    if (tab !== "events") return;
    if (events.length > 0) return;
    eventsOffsetRef.current = 0;
    setEventsHasMore(false);
    void loadEventsPage(0, "initial");
  }, [tab, events.length, loadEventsPage]);

  useEffect(() => {
    if (tab !== "events") return;
    const node = sentinelRef.current;
    if (!node) return;
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting) && eventsHasMore && !eventsLoadingRef.current) {
          void loadEventsPage(eventsOffsetRef.current, "append");
        }
      },
      { rootMargin: "200px" },
    );
    obs.observe(node);
    return () => obs.disconnect();
  }, [tab, eventsHasMore, loadEventsPage]);

  function refresh() {
    if (refreshing) return;
    if (tab === "info") {
      void fetchSessionInfo("refresh");
    } else {
      eventsOffsetRef.current = 0;
      void loadEventsPage(0, "refresh");
    }
  }

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

  function copy(value: string) {
    if (navigator.clipboard?.writeText) {
      navigator.clipboard
        .writeText(value)
        .then(() => setAlert({ title: "Copied", message: value }))
        .catch(() => undefined);
    }
  }

  function openCompany() {
    if (!session?.companyId) return;
    router.push({ name: "settings.admin.company", id: session.companyId });
  }

  const TABS: { value: Tab; label: string }[] = [
    { value: "info", label: "Session" },
    { value: "events", label: "Events" },
  ];

  const header = (
    <SubpageStickyBar onBack={() => goBack()} hideSave>
      <div className="inline-flex items-center gap-0.5 p-0.5 bg-secondary rounded-lg">
        {TABS.map((tdef) => {
          const isActive = tab === tdef.value;
          return (
            <button
              key={tdef.value}
              type="button"
              onClick={() => setTab(tdef.value)}
              className={
                "h-7 px-2.5 text-[11px] font-medium rounded-md transition-colors " +
                (isActive ? "bg-card text-foreground shadow-sm" : "text-muted-foreground")
              }
            >
              {tdef.label}
            </button>
          );
        })}
      </div>
    </SubpageStickyBar>
  );

  if (loading && !session) {
    return (
      <div>
        {header}
        <div className="max-w-2xl mx-auto pt-5 md:pt-4">
          <div className="mb-5">
            <div className="text-xs text-muted-foreground">Settings / Sessions</div>
            <h2 className="text-xl font-medium text-foreground mt-1">Session</h2>
          </div>
          <div className="bg-card border border-border rounded-2xl py-10 flex items-center justify-center gap-2 text-xs text-muted-foreground">
            <span className="w-4 h-4 border-2 border-input border-t-foreground rounded-full animate-spin" />
            Loading…
          </div>
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <div>
        {header}
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

  const isOnline = lastEventAt && Date.now() - new Date(lastEventAt).getTime() < 30_000;

  const infoRows: { label: string; value: string; sub?: string; copyable?: boolean; onClick?: () => void; valueCls?: string }[] = [];
  if (isOnline) infoRows.push({ label: "Status", value: "Online", valueCls: "text-emerald-600 font-medium" });
  if (session.email) infoRows.push({ label: "User", value: session.email, copyable: true });
  if (session.ip) infoRows.push({ label: "IP", value: session.ip, copyable: true });
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
  });
  if (lastEventAt && !isOnline) {
    infoRows.push({
      label: "Last event",
      value: formatDateFull(lastEventAt),
    });
  }

  return (
    <div>
      {header}
      <div className="max-w-2xl mx-auto pt-5 md:pt-4">
        <div className="mb-5 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-xs text-muted-foreground">Settings / Sessions</div>
            <h2 className="text-xl font-medium text-foreground mt-1">Session</h2>
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
            Refresh
          </button>
        </div>

        {tab === "info" ? (
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

            {session.userAgent ? (
              <div className="border-t border-border px-4 py-2.5">
                <p className="text-[10px] text-muted-foreground break-all font-mono">
                  {session.userAgent}
                </p>
              </div>
            ) : null}
          </div>
        ) : (
          <div className="space-y-3">
            {events.length === 0 && !eventsLoading ? (
              <div className="bg-card border border-border rounded-2xl p-6 text-center text-sm text-muted-foreground">
                No events
              </div>
            ) : (
              groupEventsByGap(events).map((group, gi) => (
                <div
                  key={gi}
                  className="bg-card border border-border rounded-xl overflow-hidden divide-y divide-border"
                >
                  {group.map((event, index) => {
                    const next = index < group.length - 1 ? group[index + 1] : null;
                    const diff = next ? formatTimeDiff(next.occurredAt, event.occurredAt) : null;
                    return (
                      <div key={event.id} className="px-4 py-2.5">
                        <p className="text-sm text-foreground truncate">
                          {formatEventName(event.event, EVENT_LABELS)}
                        </p>
                        <div className="flex items-center justify-between mt-0.5">
                          <span className="text-[10px] text-muted-foreground tabular-nums">
                            {formatTime(event.occurredAt)}
                          </span>
                          <span className="text-[10px] font-mono text-muted-foreground tabular-nums">
                            {diff ? `+${diff}` : ""}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ))
            )}
            {eventsLoading && (
              <div className="bg-card border border-border rounded-2xl py-6 flex items-center justify-center gap-2 text-xs text-muted-foreground">
                <span className="w-4 h-4 border-2 border-input border-t-foreground rounded-full animate-spin" />
                Loading…
              </div>
            )}
            <div ref={sentinelRef} className="h-1" />
          </div>
        )}

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
