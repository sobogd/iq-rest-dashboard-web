"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Check, Copy, Building2, Sparkles, ChevronDown } from "lucide-react";
import { apiUrl } from "@/lib/api";
import { RefreshIcon } from "../_v2/icons";
import { SubpageStickyBar } from "../_v2/ui";
import { useScrollLock } from "../_v2/use-scroll-lock";
import { useDashboardRouter } from "../_spa/router";
import { invalidateUsageCache } from "./usage-events-table";
import {
  countryToFlag,
  deviceLabel,
  pad,
  decodeSessionId,
  encodeSessionId,
  type SessionEvent,
  type SessionData,
} from "./usage-shared";

const chip = "text-[10px] text-muted-foreground bg-secondary rounded px-1.5 py-0.5 shrink-0";

// Landing pages: `l_page_<token>` marks which page the following `l_*` events
// fired on. Each landing event gets a coloured chip naming its page.
const PAGE_CHIPS: Record<string, { label: string; cls: string; bar: string }> = {
  home: { label: "Home", cls: "bg-blue-500/10 text-blue-700 dark:text-blue-400", bar: "bg-blue-500" },
  digital: { label: "Digital", cls: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400", bar: "bg-emerald-500" },
  pricing: { label: "Pricing", cls: "bg-violet-500/10 text-violet-700 dark:text-violet-400", bar: "bg-violet-500" },
  kds: { label: "KDS", cls: "bg-amber-500/10 text-amber-700 dark:text-amber-400", bar: "bg-amber-500" },
  orders: { label: "Orders", cls: "bg-orange-500/10 text-orange-700 dark:text-orange-400", bar: "bg-orange-500" },
  bookings: { label: "Bookings", cls: "bg-pink-500/10 text-pink-700 dark:text-pink-400", bar: "bg-pink-500" },
  qr: { label: "QR", cls: "bg-teal-500/10 text-teal-700 dark:text-teal-400", bar: "bg-teal-500" },
  help: { label: "Help", cls: "bg-slate-500/10 text-slate-700 dark:text-slate-400", bar: "bg-slate-500" },
};

const pageChipBase = "text-[10px] rounded px-1.5 py-0.5 shrink-0";

// Time-only "12:13:14" for rows inside a group (date is in the group header).
const hms = (iso: string) => { const d = new Date(iso); return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`; };

// "10m 12s" / "45s" / "1h 3m" — compact, no zero-padding.
function fmtDur(ms: number): string {
  if (ms < 1000) return "0s";
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ${s % 60}s`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m`;
}

interface PageGroup {
  key: string;
  token: string | null;        // null = events before the first l_page_ marker
  startAt: string;
  durationMs: number;          // until the next group's start (last group: span of its own events)
  events: SessionEvent[];      // chronological
  sectionCounts: Array<[string, number]>;
}

// Walk events oldest→newest, slicing a new group at each l_page_ marker so all
// activity that happened on a page lands in one group.
function buildPageGroups(events: SessionEvent[]): PageGroup[] {
  const chrono = [...events].sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());
  const groups: PageGroup[] = [];
  let cur: PageGroup | null = null;
  for (const e of chrono) {
    const m = /^l_page_(\w+)$/.exec(e.event);
    if (m || !cur) {
      cur = { key: e.id, token: m ? m[1] : null, startAt: e.at, durationMs: 0, events: [], sectionCounts: [] };
      groups.push(cur);
    }
    cur.events.push(e);
  }
  for (let i = 0; i < groups.length; i++) {
    const g = groups[i];
    const next = groups[i + 1];
    const last = g.events[g.events.length - 1];
    const endMs = next ? new Date(next.startAt).getTime() : new Date(last.at).getTime();
    g.durationMs = Math.max(0, endMs - new Date(g.startAt).getTime());
    const sc = new Map<string, number>();
    for (const e of g.events) {
      const sm = /^l_section_view_(\w+)$/.exec(e.event);
      if (sm) sc.set(sm[1], (sc.get(sm[1]) ?? 0) + 1);
    }
    g.sectionCounts = [...sc.entries()].sort((a, b) => b[1] - a[1]);
  }
  return groups;
}

// Rows shown inside an expanded group: drop the page marker (it's the header)
// and section views (they're the heatmap), strip the l_ prefix for display.
function rowEvents(g: PageGroup): SessionEvent[] {
  return g.events.filter(
    (e) => !/^l_page_/.test(e.event) && !/^l_section_view_/.test(e.event) && !/^l_currency_/.test(e.event),
  );
}
function displayName(name: string): string {
  return name.startsWith("l_") ? name.slice(2) : name;
}

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
const analysisCache = new Map<string, string>();

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

  // Click-id events surface in the card; everything else feeds the timeline.
  const listEvents = events.filter((e) => !e.event.startsWith("l_gclid_") && !e.event.startsWith("l_fbclid_"));

  // Oldest→newest journey, grouped by the page each run of events fired on.
  const groups = buildPageGroups(listEvents);
  const sessionMs = groups.length
    ? new Date(groups[groups.length - 1].events[groups[groups.length - 1].events.length - 1].at).getTime() -
      new Date(groups[0].startAt).getTime()
    : 0;
  const pageCount = groups.filter((g) => g.token).length;
  const barTotalMs = Math.max(1, groups.reduce((sum, g) => sum + g.durationMs, 0));

  // Collapsible groups + tap-to-scroll from the journey bar.
  const [open, setOpen] = useState<Set<string>>(() => new Set());
  const groupRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const toggleGroup = (k: string) => setOpen((prev) => { const n = new Set(prev); n.has(k) ? n.delete(k) : n.add(k); return n; });
  const jumpToGroup = (k: string) => {
    setOpen((prev) => { const n = new Set(prev); n.add(k); return n; });
    groupRefs.current[k]?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

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
  let currency: string | null = null;
  for (const e of events) {
    const n = e.event;
    if (!hasOnboarding && (n.includes("onb") || n.includes("onboarding"))) hasOnboarding = true;
    if (!hasPricing && n === "l_page_pricing") hasPricing = true;
    if (!hasDemo && n.includes("demo")) hasDemo = true;
    const cm = /^l_currency_([a-z]{3})$/.exec(n);
    if (cm) currency = cm[1].toUpperCase();
  }

  const [pickerOpen, setPickerOpen] = useState(false);
  const [analyzeOpen, setAnalyzeOpen] = useState(false);

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
          onClick={() => setAnalyzeOpen(true)}
          disabled={loading || events.length === 0}
          className="h-8 w-8 inline-flex items-center justify-center bg-secondary rounded-md text-muted-foreground hover:text-foreground disabled:opacity-60"
          title="AI session analysis"
        >
          <Sparkles className="h-4 w-4" />
        </button>
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
                  {currency ? <span className="text-[10px] font-semibold rounded px-1.5 py-0.5 shrink-0 bg-secondary text-muted-foreground">{currency}</span> : null}
                  {hasGoogle ? <span className="text-[10px] font-semibold rounded px-1.5 py-0.5 shrink-0 bg-[#4285f4]/10 text-[#4285f4]">G</span> : null}
                  {latestFbclid || hasFb ? (
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

            {loading ? (
              <div className="bg-card border border-border rounded-xl text-xs text-muted-foreground py-8 text-center">Loading…</div>
            ) : listEvents.length === 0 ? (
              <div className="bg-card border border-border rounded-xl text-xs text-muted-foreground py-8 text-center">No events</div>
            ) : (
              <>
                {/* Metrics */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  <div className="bg-card border border-border rounded-xl p-3">
                    <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Duration</div>
                    <div className="text-base font-semibold text-foreground tabular-nums">{fmtDur(sessionMs)}</div>
                  </div>
                  <div className="bg-card border border-border rounded-xl p-3">
                    <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Pages</div>
                    <div className="text-base font-semibold text-foreground tabular-nums">{pageCount}</div>
                  </div>
                  <div className="bg-card border border-border rounded-xl p-3">
                    <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Events</div>
                    <div className="text-base font-semibold text-foreground tabular-nums">{eventCount}</div>
                  </div>
                  <div className="bg-card border border-border rounded-xl p-3">
                    <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Source</div>
                    <div className="text-base font-semibold text-foreground">{hasGoogle ? "Google" : hasFb ? "Meta" : "Organic"}</div>
                  </div>
                </div>

                {/* Journey bar — proportional segments per page, tap to jump */}
                {groups.some((g) => g.token) ? (
                  <div className="bg-card border border-border rounded-xl p-3 space-y-2">
                    <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Journey</div>
                    <div className="flex w-full h-2.5 rounded-full overflow-hidden bg-secondary">
                      {groups.map((g) => {
                        const pc = g.token ? PAGE_CHIPS[g.token] : undefined;
                        return (
                          <button
                            key={g.key}
                            type="button"
                            onClick={() => jumpToGroup(g.key)}
                            title={`${pc?.label ?? g.token ?? "—"} · ${fmtDur(g.durationMs)}`}
                            className={`${pc ? pc.bar : "bg-muted-foreground/40"} h-full hover:opacity-80`}
                            style={{ flexGrow: Math.max(g.durationMs, barTotalMs * 0.02) }}
                          />
                        );
                      })}
                    </div>
                  </div>
                ) : null}

                {/* Timeline — collapsible group per page */}
                <div className="space-y-2">
                  {groups.map((g) => {
                    const pc = g.token ? PAGE_CHIPS[g.token] : undefined;
                    const isOpen = open.has(g.key);
                    const rows = rowEvents(g);
                    return (
                      <div
                        key={g.key}
                        ref={(el) => { groupRefs.current[g.key] = el; }}
                        className="bg-card border border-border rounded-xl overflow-hidden scroll-mt-16"
                      >
                        <button
                          type="button"
                          onClick={() => toggleGroup(g.key)}
                          className="w-full flex items-center gap-2 px-3 md:px-4 py-2.5 text-xs text-left hover:bg-muted/40"
                        >
                          <span className={`${pageChipBase} ${pc ? pc.cls : "bg-secondary text-muted-foreground"}`}>
                            {pc ? pc.label : g.token ?? "Pre-visit"}
                          </span>
                          <span className="text-muted-foreground tabular-nums">{hms(g.startAt)}</span>
                          <span className="text-muted-foreground tabular-nums">· {fmtDur(g.durationMs)}</span>
                          <span className="ml-auto text-muted-foreground tabular-nums">{g.events.length}</span>
                          <ChevronDown className={`w-3.5 h-3.5 text-muted-foreground transition-transform ${isOpen ? "rotate-180" : ""}`} />
                        </button>

                        {/* Section heatmap — always visible when present */}
                        {g.sectionCounts.length > 0 ? (
                          <div className="flex flex-wrap gap-1.5 px-3 md:px-4 pb-2.5">
                            {g.sectionCounts.map(([name, n]) => (
                              <span key={name} className="text-[10px] rounded px-1.5 py-0.5 bg-secondary text-muted-foreground tabular-nums">
                                {name}{n > 1 ? ` ×${n}` : ""}
                              </span>
                            ))}
                          </div>
                        ) : null}

                        {isOpen ? (
                          <div className="border-t border-border divide-y divide-border">
                            {rows.length === 0 ? (
                              <div className="px-3 md:px-4 py-2 text-[11px] text-muted-foreground">No other events</div>
                            ) : (
                              rows.map((e) => (
                                <div key={e.id} className="px-3 md:px-4 py-2 text-xs flex flex-col gap-1 md:flex-row md:items-center md:justify-between md:gap-3">
                                  <span className="font-mono text-foreground break-all md:flex-1 md:min-w-0">{displayName(e.event)}</span>
                                  <div className="flex flex-wrap items-center gap-1.5 md:shrink-0 md:justify-end">
                                    {e.ip ? <span className={`${chip} font-mono`}>{e.ip}</span> : null}
                                    <span className={chip}>{deviceLabel(e.device, e.platform)}</span>
                                    <span className={`${chip} tabular-nums`}>{hms(e.at)}</span>
                                  </div>
                                </div>
                              ))
                            )}
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              </>
            )}
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

      {analyzeOpen && session ? (
        <AnalyzeModal id={id} session={session} onClose={() => setAnalyzeOpen(false)} />
      ) : null}
    </div>
  );
}

// AI behavioural analysis of the current session. Posts the session descriptor
// over a fresh 30-day window to the API, which feeds the event transcript +
// product/event-vocabulary context to Gemini and returns a Russian narrative.
function AnalyzeModal({
  id,
  session,
  onClose,
}: {
  id: string;
  session: SessionData;
  onClose: () => void;
}) {
  useScrollLock(true);
  const [text, setText] = useState<string | null>(() => analysisCache.get(id) ?? null);
  const [loading, setLoading] = useState(() => !analysisCache.has(id));
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(apiUrl("/api/admin/usage/sessions/analyze"), {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: session.kind,
          rid: session.rid,
          ipkey: session.ipkey,
          hasIp: session.hasIp,
          from: new Date(Date.now() - 30 * 864e5).toISOString(),
          to: new Date().toISOString(),
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const j = (await res.json()) as { analysis?: string };
      const analysis = j.analysis?.trim() || "Анализ недоступен.";
      cacheSet(analysisCache, id, analysis);
      setText(analysis);
    } catch {
      setError("Не удалось получить анализ. Попробуйте ещё раз.");
    } finally {
      setLoading(false);
    }
  }, [id, session]);

  useEffect(() => {
    if (!analysisCache.has(id)) void run();
  }, [id, run]);

  return (
    <div onClick={onClose} className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-lg bg-card border border-border rounded-xl shadow-xl flex flex-col max-h-[85vh]">
        <div className="px-4 py-3 border-b border-border flex items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" /> AI session analysis
          </h3>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => void run()}
              disabled={loading}
              className="h-7 w-7 inline-flex items-center justify-center bg-secondary rounded-md text-muted-foreground hover:text-foreground shrink-0 disabled:opacity-60"
              title="Regenerate"
            >
              <RefreshIcon size={13} className={loading ? "animate-spin" : ""} />
            </button>
            <button type="button" onClick={onClose} className="h-7 w-7 inline-flex items-center justify-center bg-secondary rounded-md text-muted-foreground hover:text-foreground shrink-0" title="Close">✕</button>
          </div>
        </div>
        <div className="overflow-y-auto p-4 text-[13px] leading-relaxed text-foreground">
          {loading ? (
            <div className="text-xs text-muted-foreground py-8 text-center">Анализирую сессию…</div>
          ) : error ? (
            <div className="text-xs text-red-500 py-8 text-center">{error}</div>
          ) : (
            <AnalysisText text={text ?? ""} />
          )}
        </div>
      </div>
    </div>
  );
}

// Lightweight renderer for Gemini's plain-text output: numbered "1." lines
// become bold headings, dash lines become list items, blanks become spacing.
function AnalysisText({ text }: { text: string }) {
  const lines = text.split("\n");
  return (
    <div className="space-y-1.5">
      {lines.map((raw, i) => {
        const line = raw.trim();
        if (!line) return <div key={i} className="h-1.5" />;
        if (/^\d+\.\s/.test(line)) {
          return <div key={i} className="font-semibold text-foreground pt-1.5">{line}</div>;
        }
        if (/^[-•]\s/.test(line)) {
          return (
            <div key={i} className="flex gap-2 pl-1">
              <span className="text-muted-foreground shrink-0">•</span>
              <span>{line.replace(/^[-•]\s/, "")}</span>
            </div>
          );
        }
        return <div key={i}>{line}</div>;
      })}
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
