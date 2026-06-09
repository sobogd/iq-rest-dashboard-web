"use client";

import { useState, useEffect, useCallback } from "react";
import { Check, Copy, Building2, Sparkles } from "lucide-react";
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

// Noise hidden from the flat list: page markers (shown as a per-row page chip)
// and geo currency (header chip). Click ids (l_gclid_/l_fbclid_) stay visible
// in the timeline — they mark the actual paid-ad click moment. Section views
// stay too — they're the scroll path.
function isHiddenEvent(name: string): boolean {
  return /^l_page_/.test(name) || /^l_currency_/.test(name);
}

// Paid-ad click rows get a source chip so the click moment stands out.
function adChip(name: string): { label: string; cls: string } | null {
  if (/^l_gclid_/.test(name)) return { label: "Google", cls: "bg-blue-500/15 text-blue-600 dark:text-blue-400" };
  if (/^l_fbclid_/.test(name)) return { label: "Meta", cls: "bg-indigo-500/15 text-indigo-600 dark:text-indigo-400" };
  return null;
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
const restaurantsCache = new Map<string, Record<string, string>>();
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
  const [restaurantTitles, setRestaurantTitles] = useState<Record<string, string>>(() => restaurantsCache.get(id) ?? {});
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
      uid: session.uid ?? "",
      rid: session.rid ?? "",
      ipkey: session.ipkey ?? "",
      hasIp: session.hasIp ? "1" : "0",
      from: new Date(Date.now() - 30 * 864e5).toISOString(),
      to: new Date().toISOString(),
    });
    try {
      const res = await fetch(apiUrl(`/api/admin/usage/sessions/events?${qs.toString()}`), { credentials: "include" });
      const j = res.ok
        ? ((await res.json()) as { events: SessionEvent[]; summary?: SessionSummary; restaurants?: Record<string, string> })
        : { events: [], summary: undefined, restaurants: {} };
      cacheSet(eventCache, id, j.events ?? []);
      setEvents(j.events ?? []);
      if (j.summary) {
        cacheSet(summaryCache, id, j.summary);
        setSummary(j.summary);
      }
      const rmap = j.restaurants ?? {};
      cacheSet(restaurantsCache, id, rmap);
      setRestaurantTitles(rmap);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Fetch only when uncached; the Update button forces a refresh.
  useEffect(() => {
    if (!eventCache.has(id) || !summaryCache.has(id)) void load(eventCache.has(id) ? "soft" : "full");
  }, [id, load]);

  // Tie every event to the page it fired on (latest l_page_ at-or-before it,
  // walking oldest→newest) so each row can carry a page chip.
  const pageByEventId = new Map<string, string>();
  {
    const chrono = [...events].sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());
    let current: string | null = null;
    for (const e of chrono) {
      const m = /^l_page_(\w+)$/.exec(e.event);
      if (m) current = m[1];
      // Only landing (l_*) events belong to a page; dashboard events don't.
      if (current && e.event.startsWith("l_")) pageByEventId.set(e.id, current);
    }
  }

  // Flat list, newest-first, minus the noise.
  const rows = events
    .filter((e) => !isHiddenEvent(e.event))
    .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());

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
    if (!hasDemo && n.startsWith("l_demo")) hasDemo = true;
    const cm = /^l_currency_([a-z]{3})$/.exec(n);
    if (cm) currency = cm[1].toUpperCase();
  }

  const [pickerOpen, setPickerOpen] = useState(false);
  const [analyzeOpen, setAnalyzeOpen] = useState(false);

  function onAssigned() {
    // The session's events now carry manualRestaurantId — sessions group by
    // user, so the session itself doesn't move; just relabel its events with
    // the chosen venue. Drop caches and reload the current session.
    invalidateUsageCache();
    eventCache.delete(id);
    summaryCache.delete(id);
    restaurantsCache.delete(id);
    setPickerOpen(false);
    void load("full");
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
                  {session.kind === "r" && session.rid && restaurant ? (
                    // LEGACY restaurant-keyed session — link to the venue.
                    <button
                      type="button"
                      onClick={() => router.push({ name: "settings.admin.restaurant", id: session.rid! })}
                      className="text-[10px] bg-pink-500/10 text-pink-700 dark:text-pink-400 rounded px-1.5 py-0.5 truncate min-w-0 hover:bg-pink-500/20"
                      title={restaurant}
                    >
                      {restaurant}
                    </button>
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

              {hasDemo || hasPricing || hasOnboarding || session?.hasRegistered || session?.isDemo ? (
                <div className="flex flex-wrap items-center gap-1.5">
                  {session?.isDemo ? (
                    <span className="text-[10px] rounded px-1.5 py-0.5 bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 font-semibold">Demo account</span>
                  ) : null}
                  {hasDemo ? (
                    <span className="text-[10px] rounded px-1.5 py-0.5 bg-indigo-500/10 text-indigo-700 dark:text-indigo-400">Demo</span>
                  ) : null}
                  {hasPricing ? (
                    <span className="text-[10px] rounded px-1.5 py-0.5 bg-violet-500/10 text-violet-700 dark:text-violet-400">Pricing</span>
                  ) : null}
                  {hasOnboarding ? (
                    <span className="text-[10px] rounded px-1.5 py-0.5 bg-amber-500/10 text-amber-700 dark:text-amber-400">Onboarding</span>
                  ) : null}
                  {session?.hasRegistered ? (
                    <span className="text-[10px] rounded px-1.5 py-0.5 bg-sky-500/10 text-sky-700 dark:text-sky-400">Registered</span>
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
            ) : rows.length === 0 ? (
              <div className="bg-card border border-border rounded-xl text-xs text-muted-foreground py-8 text-center">No events</div>
            ) : (
              <div className="bg-card border border-border rounded-xl overflow-hidden divide-y divide-border">
                {rows.map((e) => {
                  const tok = pageByEventId.get(e.id);
                  const pc = tok ? PAGE_CHIPS[tok] : undefined;
                  const ad = adChip(e.event);
                  // Which restaurant a dashboard event belongs to (active venue
                  // at the time). Landing l_* events have no restaurant.
                  const rTitle = e.restaurantId ? restaurantTitles[e.restaurantId] : undefined;
                  return (
                    <div key={e.id} className="px-3 md:px-4 py-2 text-xs flex flex-col gap-1 md:flex-row md:items-center md:justify-between md:gap-3">
                      <div className="flex items-center gap-2 md:flex-1 md:min-w-0">
                        {tok ? (
                          <span className={`${pageChipBase} ${pc ? pc.cls : "bg-secondary text-muted-foreground"}`}>
                            {pc ? pc.label : tok}
                          </span>
                        ) : null}
                        {ad ? <span className={`${pageChipBase} ${ad.cls}`}>{ad.label}</span> : null}
                        {rTitle ? (
                          <span className={`${pageChipBase} bg-pink-500/10 text-pink-700 dark:text-pink-400 truncate max-w-[40%]`} title={rTitle}>
                            {rTitle}
                          </span>
                        ) : null}
                        <span className="font-mono text-foreground break-all min-w-0">{displayName(e.event)}</span>
                      </div>
                      <div className="flex flex-wrap items-center gap-1.5 md:shrink-0 md:justify-end">
                        {e.ip ? <span className={`${chip} font-mono`}>{e.ip}</span> : null}
                        <span className={chip}>{deviceLabel(e.device, e.platform)}</span>
                        <span className={`${chip} tabular-nums`}>{hmsDate(e.at)}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>

      {pickerOpen && session ? (
        <RestaurantPickerModal
          descriptor={{ kind: session.kind, uid: session.uid ?? null, rid: session.rid ?? null, ipkey: session.ipkey, hasIp: session.hasIp }}
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
          uid: session.uid,
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
  descriptor: { kind: "u" | "a" | "r"; uid: string | null; rid: string | null; ipkey: string | null; hasIp: boolean };
  onClose: () => void;
  onAssigned: () => void;
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
          uid: descriptor.uid,
          rid: descriptor.rid,
          ipkey: descriptor.ipkey,
          hasIp: descriptor.hasIp,
          from: new Date(Date.now() - 30 * 864e5).toISOString(),
          to: new Date().toISOString(),
          restaurantId: selected.id,
        }),
      });
      if (res.ok) onAssigned();
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
