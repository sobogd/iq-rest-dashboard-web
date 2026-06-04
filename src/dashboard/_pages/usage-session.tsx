"use client";

import { useState, useEffect, useCallback } from "react";
import { Check, Copy, Building2 } from "lucide-react";
import { apiUrl } from "@/lib/api";
import { RefreshIcon } from "../_v2/icons";
import { SubpageStickyBar } from "../_v2/ui";
import { useScrollLock } from "../_v2/use-scroll-lock";
import { useDashboardRouter } from "../_spa/router";
import { invalidateUsageCache } from "./usage-events-table";
import {
  countryToFlag,
  deviceLabel,
  hmsDate,
  decodeSessionId,
  encodeSessionId,
  type SessionEvent,
  type SessionData,
} from "./usage-shared";

const chip = "text-[10px] text-muted-foreground bg-secondary rounded px-1.5 py-0.5 shrink-0";

interface SessionSummary {
  country: string;
  region: string | null;
  userLabel: string | null;
  restaurantLabel: string | null;
  eventCount?: number;
  truncated?: boolean;
}

// Per-session events cache (by encoded id) so returning to a session is instant;
// refreshed only by the Update button. Capped so a long-lived tab can't grow it
// without bound.
const CACHE_MAX = 50;
const eventCache = new Map<string, SessionEvent[]>();
const summaryCache = new Map<string, SessionSummary>();

function cacheSet<V>(map: Map<string, V>, key: string, value: V) {
  if (map.size >= CACHE_MAX && !map.has(key)) {
    const oldest = map.keys().next().value;
    if (oldest !== undefined) map.delete(oldest);
  }
  map.set(key, value);
}

function CopyButton({ text }: { text: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        navigator.clipboard?.writeText(text).then(() => {
          setDone(true);
          setTimeout(() => setDone(false), 1200);
        }).catch(() => undefined);
      }}
      className="h-6 w-6 inline-flex items-center justify-center bg-secondary rounded text-muted-foreground hover:text-foreground shrink-0"
      title="Copy"
    >
      {done ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
    </button>
  );
}

export function UsageSessionPage({ id }: { id: string }) {
  const router = useDashboardRouter();
  const session = decodeSessionId(id);
  const [events, setEvents] = useState<SessionEvent[]>(() => eventCache.get(id) ?? []);
  const [summary, setSummary] = useState<SessionSummary | null>(() => summaryCache.get(id) ?? null);
  const [loading, setLoading] = useState(() => !eventCache.has(id));
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (mode: "full" | "soft") => {
    if (!session) {
      setLoading(false);
      return;
    }
    if (mode === "full") setLoading(true);
    else setRefreshing(true);
    // Fresh 30-day window (NOT the snapshot baked into the id) so refresh
    // actually picks up events that arrived after the list was generated.
    const qs = new URLSearchParams({
      kind: session.kind,
      rid: session.rid ?? "",
      ipkey: session.ipkey ?? "",
      hasIp: session.hasIp ? "1" : "0",
      from: new Date(Date.now() - 30 * 864e5).toISOString(),
      to: new Date().toISOString(),
    });
    try {
      const res = await fetch(apiUrl(`/api/admin/usage/sessions/events?${qs.toString()}`), { credentials: "include" });
      const j = res.ok ? ((await res.json()) as { events: SessionEvent[]; summary?: SessionSummary }) : { events: [], summary: undefined };
      cacheSet(eventCache, id, j.events ?? []);
      setEvents(j.events ?? []);
      if (j.summary) {
        cacheSet(summaryCache, id, j.summary);
        setSummary(j.summary);
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Fetch only when uncached; the Update button forces a refresh.
  useEffect(() => {
    if (!eventCache.has(id) || !summaryCache.has(id)) void load(eventCache.has(id) ? "soft" : "full");
  }, [id, load]);

  // Click-id events surface in the card; everything else lists newest-first.
  const listEvents = events.filter((e) => !e.event.startsWith("l_gclid_") && !e.event.startsWith("l_fbclid_"));

  const gclids: string[] = [];
  const seenG = new Set<string>();
  for (const e of events) {
    let g: string | null = e.gclid || null;
    const m = /^l_gclid_(.+)$/.exec(e.event);
    if (m) g = m[1];
    if (g && !seenG.has(g)) { seenG.add(g); gclids.push(g); }
  }

  // The id only carries a snapshot of the summary (and synthetic navigations —
  // e.g. from a restaurant detail — bake in zeros). Derive the header from the
  // freshly-loaded events, falling back to the baked descriptor.
  let latestFbclid: string | null = session?.latestFbclid ?? null;
  let latestFbTs: number | null = session?.latestFbTs ?? null;
  let hasFb = session?.hasFacebook ?? false;
  for (const e of events) {
    if (e.isFacebookAds) hasFb = true;
    const m = /^l_fbclid_(.+)$/.exec(e.event);
    if (m) {
      hasFb = true;
      const ts = new Date(e.at).getTime();
      if (latestFbTs === null || ts >= latestFbTs) { latestFbTs = ts; latestFbclid = m[1]; }
    }
  }
  // Prefer the server's true total (the events list itself is capped at 2000).
  const eventCount = summary?.eventCount ?? session?.eventCount ?? events.length;
  const hasGoogle = gclids.length > 0 || (session?.hasGoogle ?? false);

  // Funnel touchpoints derived from the session's event names (works for
  // landing activity stitched onto a restaurant). Lets me decide which FB
  // event to send for a given session.
  let hasOnboarding = false;
  let hasPricing = false;
  let hasDemo = false;
  for (const e of events) {
    const n = e.event;
    if (!hasOnboarding && (n.includes("onb") || n.includes("onboarding"))) hasOnboarding = true;
    if (!hasPricing && n === "l_page_pricing") hasPricing = true;
    if (!hasDemo && n.includes("demo")) hasDemo = true;
  }

  const [pickerOpen, setPickerOpen] = useState(false);

  function onAssigned(rid: string, title: string) {
    // The session's events now carry manualRestaurantId → regroup under the
    // restaurant. Drop caches and open the restaurant's session.
    invalidateUsageCache();
    eventCache.clear();
    summaryCache.clear();
    const win = { from: new Date(Date.now() - 30 * 864e5).toISOString(), to: new Date().toISOString() };
    const data: SessionData = {
      kind: "r", rid, ipkey: null, hasIp: false, country: session?.country ?? "", region: null,
      firstAt: win.from, lastAt: win.to, eventCount: 0, hasGoogle: false, hasFacebook: false,
      latestFbclid: null, latestFbTs: null, userLabel: null, restaurantLabel: title,
      from: win.from, to: win.to,
    };
    setPickerOpen(false);
    router.push({ name: "settings.admin.usageSession", id: encodeSessionId(data) });
  }

  const back = () => router.back();
  const restaurant = summary?.restaurantLabel ?? session?.restaurantLabel ?? null;
  const region = summary?.region ?? session?.region ?? null;
  const country = summary?.country || session?.country || "";
  const userLabel = summary?.userLabel ?? session?.userLabel ?? null;

  return (
    <div>
      <SubpageStickyBar onBack={back} hideSave>
        <button
          type="button"
          onClick={() => setPickerOpen(true)}
          className="h-8 w-8 inline-flex items-center justify-center bg-secondary rounded-md text-muted-foreground hover:text-foreground"
          title="Assign to a restaurant"
        >
          <Building2 className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => void load("soft")}
          disabled={loading || refreshing}
          className="h-8 w-8 inline-flex items-center justify-center bg-secondary rounded-md text-muted-foreground hover:text-foreground disabled:opacity-60"
          title="Refresh"
        >
          <RefreshIcon size={14} className={loading || refreshing ? "animate-spin" : ""} />
        </button>
      </SubpageStickyBar>
      <div className="max-w-5xl mx-auto md:px-6 pt-5 md:pt-4 space-y-3">
        {!session ? (
          <div className="text-xs text-muted-foreground py-8 text-center">Invalid session link</div>
        ) : (
          <>
            <div className="bg-card border border-border rounded-xl p-3 md:p-4 space-y-2">
              <div className="flex items-center gap-2 text-xs">
                {country ? <span className="text-base shrink-0">{countryToFlag(country)}</span> : null}
                <span className={chip}>{eventCount}</span>
                <span className="flex-1 min-w-0 flex items-center justify-end gap-2">
                  {restaurant ? (
                    session.kind === "r" && session.rid ? (
                      <button
                        type="button"
                        onClick={() => router.push({ name: "settings.admin.restaurant", id: session.rid! })}
                        className="text-[10px] bg-pink-500/10 text-pink-700 dark:text-pink-400 rounded px-1.5 py-0.5 truncate min-w-0 hover:bg-pink-500/20"
                        title={restaurant}
                      >
                        {restaurant}
                      </button>
                    ) : (
                      <span className="text-[10px] bg-pink-500/10 text-pink-700 dark:text-pink-400 rounded px-1.5 py-0.5 truncate min-w-0" title={restaurant}>{restaurant}</span>
                    )
                  ) : region ? (
                    <span className="text-[10px] bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 rounded px-1.5 py-0.5 truncate min-w-0" title={region}>{region}</span>
                  ) : null}
                  {hasGoogle ? <span className="text-[10px] font-semibold rounded px-1.5 py-0.5 shrink-0 bg-[#4285f4]/10 text-[#4285f4]">G</span> : null}
                  {latestFbclid ? (
                    <button
                      type="button"
                      onClick={() => router.push({ name: "settings.admin.capiSend", fbclid: latestFbclid!, clickTs: latestFbTs ?? undefined })}
                      className="text-[10px] font-semibold rounded px-1.5 py-0.5 shrink-0 bg-[#1877F2]/10 text-[#1877F2] hover:bg-[#1877F2]/20"
                      title="Send a Meta CAPI event"
                    >
                      FB
                    </button>
                  ) : hasFb ? (
                    <span className="text-[10px] font-semibold rounded px-1.5 py-0.5 shrink-0 bg-[#1877F2]/10 text-[#1877F2]">FB</span>
                  ) : null}
                </span>
              </div>

              {userLabel ? (
                <div className="text-[11px] text-muted-foreground truncate">👤 {userLabel}</div>
              ) : null}

              {hasDemo || hasPricing || hasOnboarding ? (
                <div className="flex flex-wrap items-center gap-1.5">
                  {hasDemo ? (
                    <span className="text-[10px] rounded px-1.5 py-0.5 bg-indigo-500/10 text-indigo-700 dark:text-indigo-400">Demo</span>
                  ) : null}
                  {hasPricing ? (
                    <span className="text-[10px] rounded px-1.5 py-0.5 bg-violet-500/10 text-violet-700 dark:text-violet-400">Pricing</span>
                  ) : null}
                  {hasOnboarding ? (
                    <span className="text-[10px] rounded px-1.5 py-0.5 bg-sky-500/10 text-sky-700 dark:text-sky-400">Onboarding</span>
                  ) : null}
                </div>
              ) : null}

              {gclids.length > 0 ? (
                <div className="space-y-1">
                  {gclids.map((g) => (
                    <div key={g} className="flex items-center gap-2">
                      <span className="text-[10px] text-muted-foreground shrink-0 w-12">gclid</span>
                      <span className="text-[11px] font-mono text-foreground break-all flex-1 min-w-0">{g}</span>
                      <CopyButton text={g} />
                    </div>
                  ))}
                </div>
              ) : null}
            </div>

            {summary?.truncated ? (
              <div className="text-[11px] text-muted-foreground px-1">
                Showing the latest {events.length.toLocaleString()} of {eventCount.toLocaleString()} events.
              </div>
            ) : null}

            <div className="bg-card border border-border rounded-xl overflow-hidden divide-y divide-border">
              {loading ? (
                <div className="text-xs text-muted-foreground py-8 text-center">Loading…</div>
              ) : listEvents.length === 0 ? (
                <div className="text-xs text-muted-foreground py-8 text-center">No events</div>
              ) : (
                listEvents.map((e) => (
                  <div key={e.id} className="px-3 md:px-4 py-2 text-xs flex flex-col gap-1 md:flex-row md:items-center md:justify-between md:gap-3">
                    <div className="font-mono text-foreground break-all md:flex-1 md:min-w-0">{e.event}</div>
                    <div className="flex flex-wrap items-center gap-1.5 md:shrink-0 md:justify-end">
                      {e.ip ? <span className={`${chip} font-mono`}>{e.ip}</span> : null}
                      <span className={chip}>{deviceLabel(e.device, e.platform)}</span>
                      <span className={`${chip} tabular-nums`}>{hmsDate(e.at)}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </>
        )}
      </div>

      {pickerOpen && session ? (
        <RestaurantPickerModal
          descriptor={{ kind: session.kind, rid: session.rid, ipkey: session.ipkey, hasIp: session.hasIp }}
          onClose={() => setPickerOpen(false)}
          onAssigned={onAssigned}
        />
      ) : null}
    </div>
  );
}

function RestaurantPickerModal({
  descriptor,
  onClose,
  onAssigned,
}: {
  descriptor: { kind: "r" | "a"; rid: string | null; ipkey: string | null; hasIp: boolean };
  onClose: () => void;
  onAssigned: (rid: string, title: string) => void;
}) {
  useScrollLock(true);
  const [restaurants, setRestaurants] = useState<Array<{ id: string; title: string }>>([]);
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<{ id: string; title: string } | null>(null);
  const [assigning, setAssigning] = useState(false);

  useEffect(() => {
    fetch(apiUrl("/api/admin/usage/restaurants"), { credentials: "include" })
      .then((r) => (r.ok ? r.json() : { restaurants: [] }))
      .then((j: { restaurants: Array<{ id: string; title: string }> }) => setRestaurants(j.restaurants ?? []))
      .catch(() => undefined);
  }, []);

  const filtered = q.trim()
    ? restaurants.filter((r) => r.title.toLowerCase().includes(q.trim().toLowerCase()))
    : restaurants;

  async function continueAssign() {
    if (!selected || assigning) return;
    setAssigning(true);
    try {
      const res = await fetch(apiUrl("/api/admin/usage/sessions/assign"), {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: descriptor.kind,
          rid: descriptor.rid,
          ipkey: descriptor.ipkey,
          hasIp: descriptor.hasIp,
          from: new Date(Date.now() - 30 * 864e5).toISOString(),
          to: new Date().toISOString(),
          restaurantId: selected.id,
        }),
      });
      if (res.ok) onAssigned(selected.id, selected.title);
    } finally {
      setAssigning(false);
    }
  }

  return (
    <div onClick={onClose} className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-md bg-card border border-border rounded-xl shadow-xl flex flex-col max-h-[80vh]">
        <div className="px-4 py-3 border-b border-border flex items-center justify-between">
          <h3 className="text-sm font-semibold text-foreground">Assign to a restaurant</h3>
          <button type="button" onClick={onClose} className="h-7 w-7 inline-flex items-center justify-center bg-secondary rounded-md text-muted-foreground hover:text-foreground shrink-0" title="Close">✕</button>
        </div>
        <div className="p-3 border-b border-border">
          <input
            type="text"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search…"
            className="w-full h-9 px-3 bg-secondary rounded-md text-sm text-foreground focus:outline-none"
          />
        </div>
        <div className="overflow-y-auto divide-y divide-border flex-1">
          {filtered.length === 0 ? (
            <div className="text-xs text-muted-foreground py-6 text-center">No restaurants</div>
          ) : (
            filtered.map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => setSelected(r)}
                className={"w-full flex items-center gap-2 px-4 py-2.5 text-sm text-left transition-colors " + (selected?.id === r.id ? "bg-primary/10" : "hover:bg-muted/40")}
              >
                <span className="flex-1 truncate text-foreground">{r.title}</span>
                {selected?.id === r.id ? <Check className="w-4 h-4 text-primary shrink-0" /> : null}
              </button>
            ))
          )}
        </div>
        <div className="px-4 py-3 border-t border-border flex items-center gap-2">
          <button type="button" onClick={onClose} className="flex-1 h-9 text-sm font-medium text-foreground bg-secondary rounded-md hover:bg-muted">Cancel</button>
          <button
            type="button"
            onClick={() => void continueAssign()}
            disabled={!selected || assigning}
            className="flex-1 h-9 text-sm font-medium text-primary-foreground bg-primary-gradient rounded-md hover:opacity-90 disabled:opacity-50"
          >
            {assigning ? "…" : "Continue"}
          </button>
        </div>
      </div>
    </div>
  );
}
