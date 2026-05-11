"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ChevronRight,
  Eye,
  MousePointerClick,
  Target,
  Euro,
  Gauge,
  Coins,
  RefreshCw,
  X as XIcon,
} from "lucide-react";
import { apiUrl } from "@/lib/api";
import { SubpageStickyBar } from "../_v2/ui";
import { useDashboardRouter } from "../_spa/router";

type Status = "ENABLED" | "PAUSED";
type DateRange = "today" | "yesterday" | "last7days";

interface CampaignRow {
  id: string;
  name: string;
  status: Status;
  budget?: number;
  budgetShared?: boolean;
  impressions: number;
  clicks: number;
  conversions: number;
  cost: number;
}

interface AdGroupRow {
  id: string;
  name: string;
  status: Status;
  campaignId: string;
  suffix?: string;
  impressions: number;
  clicks: number;
  conversions: number;
  cost: number;
}

interface KeywordRow {
  id: string;
  title: string;
  text?: string;
  matchType?: string;
  status: Status;
  adGroupId: string;
  campaignId: string;
  impressions: number;
  clicks: number;
  conversions: number;
  cost: number;
  qualityScore?: number;
  bid?: number;
}

interface AdRow {
  id: string;
  status: Status;
  adGroupId: string;
  campaignId: string;
  finalUrls: string[];
  headlines: Array<{ text: string; pinned?: string }>;
  descriptions: Array<{ text: string; pinned?: string }>;
  path1?: string;
  path2?: string;
  adStrength?: string;
}

interface NegativeRow {
  id: string;
  text: string;
  matchType: string;
  status: Status;
  campaignId: string;
  adGroupId?: string;
  scope: "campaign" | "ad_group";
  rawId: string;
}

interface CampAssets {
  businessNames: string[];
  sitelinks: Array<{ title: string; desc1?: string; desc2?: string }>;
  imageCount: number;
  logoCount: number;
}

interface TimelineBucket {
  time: string;
  impressions: number;
  clicks: number;
  conversions: number;
  cost: number;
}

interface AllData {
  campaigns: CampaignRow[];
  adGroups: AdGroupRow[];
  ads: AdRow[];
  keywords: KeywordRow[];
  negatives: NegativeRow[];
  timeline: TimelineBucket[];
  campaignAssets: Record<string, CampAssets>;
  searchTermsByAdGroup: Record<string, SearchTerm[]>;
}

type View =
  | { kind: "campaigns" }
  | { kind: "campaign"; campaignId: string }
  | { kind: "ad_group_detail"; campaignId: string; adGroupId: string }
  | { kind: "keyword_search_terms"; campaignId: string; adGroupId: string; critId: string; keywordTitle: string };

interface SearchTerm {
  searchTerm: string;
  status: string;
  matchedKeyword: string;
  matchedKwText?: string;
  matchedKwMt?: string;
  impressions: number;
  clicks: number;
  conversions: number;
  cost: number;
}

type DetailRequest =
  | { kind: "campaign"; id: string }
  | { kind: "ad_group"; id: string }
  | { kind: "ad"; adGroupId: string; adId: string }
  | { kind: "keyword"; adGroupId: string; critId: string }
  | { kind: "negative"; scope: "campaign" | "ad_group"; id: string; campaignId?: string; adGroupId?: string };

const DATE_ORDER: DateRange[] = ["today", "yesterday", "last7days"];
const DATE_SHORT: Record<DateRange, string> = { today: "tod", yesterday: "yes", last7days: "7d" };
const STATUS_ORDER: Status[] = ["ENABLED", "PAUSED"];
const STATUS_SHORT: Record<Status, string> = { ENABLED: "on", PAUSED: "off" };

const TAG_COLOR = {
  campaign: "bg-blue-500/10 text-blue-500",
  ad_group: "bg-purple-500/10 text-purple-500",
  ad: "bg-emerald-500/10 text-emerald-500",
  keyword: "bg-amber-500/10 text-amber-500",
  negative: "bg-red-500/10 text-red-500",
};

export function GoogleAdsPage() {
  const router = useDashboardRouter();
  const [filterStatus, setFilterStatus] = useState<Status>("ENABLED");
  const [filterDateRange, setFilterDateRange] = useState<DateRange>("today");
  const [view, setView] = useState<View>({ kind: "campaigns" });

  const [data, setData] = useState<AllData | null>(null);
  const [initialLoading, setInitialLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [detailReq, setDetailReq] = useState<DetailRequest | null>(null);

  const load = async (mode: "initial" | "refresh") => {
    if (mode === "initial") setInitialLoading(true);
    else setRefreshing(true);
    try {
      const qs = new URLSearchParams({ dateRange: filterDateRange });
      const res = await fetch(apiUrl(`/api/admin/google-ads/all?${qs}`), { credentials: "include" });
      if (!res.ok) return;
      const j = (await res.json()) as AllData;
      setData(j);
    } finally {
      setInitialLoading(false);
      setRefreshing(false);
    }
  };

  // Initial + date-change → loader. Refresh button → no loader.
  useEffect(() => {
    void load(data ? "refresh" : "initial");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterDateRange]);

  // Client-side filter by status
  const filtered = useMemo(() => {
    if (!data) return null;
    const byS = <T extends { status: Status }>(arr: T[]) => arr.filter((x) => x.status === filterStatus);
    return {
      campaigns: byS(data.campaigns),
      adGroups: byS(data.adGroups),
      ads: byS(data.ads),
      keywords: byS(data.keywords),
      negatives: byS(data.negatives),
    };
  }, [data, filterStatus]);

  const currentCampaign = view.kind !== "campaigns" ? filtered?.campaigns.find((c) => c.id === view.campaignId) ?? data?.campaigns.find((c) => c.id === view.campaignId) : null;
  const currentAdGroupId = (view.kind === "ad_group_detail" || view.kind === "keyword_search_terms") ? view.adGroupId : null;
  const currentAdGroup = currentAdGroupId ? (filtered?.adGroups.find((a) => a.id === currentAdGroupId) ?? data?.adGroups.find((a) => a.id === currentAdGroupId)) : null;

  function handleBack() {
    if (view.kind === "campaigns") router.push({ name: "settings" });
    else if (view.kind === "campaign") setView({ kind: "campaigns" });
    else if (view.kind === "ad_group_detail") setView({ kind: "campaign", campaignId: view.campaignId });
    else if (view.kind === "keyword_search_terms") setView({ kind: "ad_group_detail", campaignId: view.campaignId, adGroupId: view.adGroupId });
  }


  return (
    <div>
      <SubpageStickyBar onBack={handleBack} hideSave>
        <div className="flex items-center gap-1.5">
          <TabGroup
            options={DATE_ORDER.map((d) => ({ value: d, label: DATE_SHORT[d] }))}
            selected={filterDateRange}
            onSelect={(v) => setFilterDateRange(v as DateRange)}
          />
          <TabGroup
            options={STATUS_ORDER.map((s) => ({ value: s, label: STATUS_SHORT[s] }))}
            selected={filterStatus}
            onSelect={(v) => setFilterStatus(v as Status)}
          />
          <button
            type="button"
            onClick={() => void load("refresh")}
            disabled={refreshing || initialLoading}
            title="Refresh"
            className="h-8 w-8 inline-flex items-center justify-center bg-secondary rounded-md text-muted-foreground hover:text-foreground disabled:opacity-60"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
          </button>
        </div>
      </SubpageStickyBar>

      <div className="max-w-2xl mx-auto pt-5 md:pt-4 space-y-3">
        {initialLoading ? (
          <div className="text-xs text-muted-foreground py-8 text-center">Loading…</div>
        ) : !filtered ? null : view.kind === "campaigns" ? (
          <>
            <div className="bg-card border border-border rounded-xl overflow-hidden divide-y divide-border">
              {filtered.campaigns.map((c) => (
                <CampaignRow
                  key={c.id}
                  c={c}
                  onOpen={() => setView({ kind: "campaign", campaignId: c.id })}
                  onView={() => setDetailReq({ kind: "campaign", id: c.id })}
                />
              ))}
            </div>
            {filtered.campaigns.length > 0 ? (
              <div className="bg-card border border-border rounded-xl overflow-hidden divide-y divide-border">
                <TotalAndTimeline campaigns={filtered.campaigns} timeline={data?.timeline ?? []} />
              </div>
            ) : null}
          </>
        ) : view.kind === "campaign" && currentCampaign ? (
          <>
            <div>
              <div className="px-3 md:px-0 text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5">Ad groups</div>
              <div className="bg-card border border-border rounded-xl overflow-hidden divide-y divide-border">
                {filtered.adGroups.filter((a) => a.campaignId === view.campaignId).map((a) => (
                  <AdGroupRowEl
                    key={a.id}
                    a={a}
                    onOpen={() => setView({ kind: "ad_group_detail", campaignId: view.campaignId, adGroupId: a.id })}
                    onView={() => setDetailReq({ kind: "ad_group", id: a.id })}
                  />
                ))}
              </div>
            </div>
            <NegativesBlock
              negatives={filtered.negatives.filter((n) => n.campaignId === view.campaignId && n.scope === "campaign")}
              onView={(n) => setDetailReq({ kind: "negative", scope: n.scope, id: n.rawId, campaignId: n.campaignId, adGroupId: n.adGroupId })}
            />
          </>
        ) : view.kind === "ad_group_detail" && currentAdGroup ? (
          <AdGroupDetail
            keywords={filtered.keywords.filter((k) => k.adGroupId === view.adGroupId)}
            ads={filtered.ads.filter((a) => a.adGroupId === view.adGroupId)}
            assets={data?.campaignAssets[view.campaignId]}
            onView={(req) => setDetailReq(req)}
            adGroupId={view.adGroupId}
            campaignId={view.campaignId}
            onKeywordOpen={(k) => setView({ kind: "keyword_search_terms", campaignId: view.campaignId, adGroupId: view.adGroupId, critId: k.id, keywordTitle: k.title })}
            searchTerms={data?.searchTermsByAdGroup[view.adGroupId]}
            negatives={filtered.negatives.filter((n) => n.adGroupId === view.adGroupId && n.scope === "ad_group")}
            onNegativeView={(n) => setDetailReq({ kind: "negative", scope: n.scope, id: n.rawId, campaignId: n.campaignId, adGroupId: n.adGroupId })}
          />
        ) : view.kind === "keyword_search_terms" ? (
          <SearchTermsList
            items={(data?.searchTermsByAdGroup[view.adGroupId] ?? []).filter((st) => {
              const kw = data?.keywords.find((k) => k.id === view.critId);
              if (!kw) return false;
              return st.matchedKwText === kw.text && st.matchedKwMt === kw.matchType;
            })}
            loading={false}
            header={view.keywordTitle}
          />
        ) : null}
      </div>

      {detailReq ? <DetailModal req={detailReq} onClose={() => setDetailReq(null)} /> : null}
    </div>
  );
}

function CampaignRow({ c, onOpen, onView }: { c: CampaignRow; onOpen: () => void; onView: () => void }) {
  const budgetSuffix = c.budget != null ? ` (${c.budget.toFixed(2)}€${c.budgetShared ? "·shared" : ""})` : "";
  return (
    <div onClick={onOpen} role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") onOpen(); }} className="px-3 py-2 space-y-1.5 hover:bg-muted/40 transition-colors cursor-pointer">
      <div className="flex items-center gap-1.5 min-w-0">
        <TitleTag text={`${c.name}${budgetSuffix}`} color={TAG_COLOR.campaign} paused={c.status === "PAUSED"} />
        <span className="ml-auto" />
        <ViewTag onClick={(e) => { e.stopPropagation(); onView(); }} />
      </div>
      <div className="flex items-center gap-1.5 flex-wrap min-w-0">
        <MetricPill icon={<Eye className="w-3 h-3" />} value={c.impressions} label="impressions" />
        <MetricPill icon={<MousePointerClick className="w-3 h-3" />} value={c.clicks} label="clicks" />
        <MetricPill icon={<Target className="w-3 h-3" />} value={c.conversions} label="conversions" />
        <MetricPill icon={<Euro className="w-3 h-3" />} value={c.cost.toFixed(2)} label="cost €" />
      </div>
    </div>
  );
}

function AdGroupRowEl({ a, onOpen, onView }: { a: AdGroupRow; onOpen: () => void; onView: () => void }) {
  return (
    <div onClick={onOpen} role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") onOpen(); }} className="px-3 py-2 space-y-1.5 hover:bg-muted/40 transition-colors cursor-pointer">
      <div className="flex items-center gap-1.5 min-w-0">
        <TitleTag text={a.name} color={TAG_COLOR.ad_group} paused={a.status === "PAUSED"} />
        <span className="ml-auto" />
        <ViewTag onClick={(e) => { e.stopPropagation(); onView(); }} />
      </div>
      <div className="flex items-center gap-1.5 flex-wrap min-w-0">
        <MetricPill icon={<Eye className="w-3 h-3" />} value={a.impressions} label="impressions" />
        <MetricPill icon={<MousePointerClick className="w-3 h-3" />} value={a.clicks} label="clicks" />
        <MetricPill icon={<Target className="w-3 h-3" />} value={a.conversions} label="conversions" />
        <MetricPill icon={<Euro className="w-3 h-3" />} value={a.cost.toFixed(2)} label="cost €" />
      </div>
      {a.suffix ? (
        <div>
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium uppercase tracking-wider bg-muted text-muted-foreground font-mono">
            <span className="truncate max-w-[260px]">{a.suffix}</span>
          </span>
        </div>
      ) : null}
    </div>
  );
}

function NegativeRowEl({ n, onView }: { n: NegativeRow; onView: () => void }) {
  return (
    <div className="px-3 py-2 flex items-center gap-1.5 flex-wrap min-w-0">
      <span className="shrink-0 inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium uppercase tracking-wider bg-secondary text-foreground">
        {n.matchType}
      </span>
      <TitleTag text={n.text} color={TAG_COLOR.negative} paused={n.status === "PAUSED"} />
      <span className="ml-auto" />
      <ViewTag onClick={onView} />
    </div>
  );
}

function AdGroupDetail({
  keywords,
  ads,
  onView,
  adGroupId,
  onKeywordOpen,
  searchTerms,
  negatives,
  onNegativeView,
}: {
  keywords: KeywordRow[];
  ads: AdRow[];
  assets?: CampAssets;
  onView: (req: DetailRequest) => void;
  adGroupId: string;
  campaignId: string;
  onKeywordOpen: (k: KeywordRow) => void;
  searchTerms?: SearchTerm[];
  negatives: NegativeRow[];
  onNegativeView: (n: NegativeRow) => void;
}) {
  return (
    <div className="space-y-4">
      <div>
        <div className="px-3 md:px-0 text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5">
          Keywords ({keywords.length})
        </div>
        <div className="bg-card border border-border rounded-xl overflow-hidden divide-y divide-border">
          {keywords.length === 0 ? (
            <div className="text-xs text-muted-foreground py-4 text-center">No keywords</div>
          ) : (
            keywords.map((k) => {
              const mt = k.matchType ? (k.matchType === "EXACT" ? "E" : k.matchType === "PHRASE" ? "P" : k.matchType === "BROAD" ? "B" : "?") : "?";
              return (
              <div
                key={k.id}
                onClick={() => onKeywordOpen(k)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") onKeywordOpen(k); }}
                className="px-3 py-2 space-y-1.5 hover:bg-muted/40 transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="shrink-0 inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium uppercase tracking-wider bg-secondary text-foreground">{mt}</span>
                  <TitleTag text={k.text ?? k.title} color={TAG_COLOR.keyword} paused={k.status === "PAUSED"} />
                  <span className="ml-auto" />
                  <ViewTag onClick={(e) => { e.stopPropagation(); onView({ kind: "keyword", adGroupId: k.adGroupId, critId: k.id }); }} />
                </div>
                <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                  <MetricPill icon={<Eye className="w-3 h-3" />} value={k.impressions} label="impressions" />
                  <MetricPill icon={<MousePointerClick className="w-3 h-3" />} value={k.clicks} label="clicks" />
                  <MetricPill icon={<Target className="w-3 h-3" />} value={k.conversions} label="conversions" />
                  <MetricPill icon={<Euro className="w-3 h-3" />} value={k.cost.toFixed(2)} label="cost €" />
                  <MetricPill icon={<Gauge className="w-3 h-3" />} value={k.qualityScore ?? "—"} label="QS" />
                  <MetricPill icon={<Coins className="w-3 h-3" />} value={k.bid != null ? k.bid.toFixed(2) : "—"} label="bid €" />
                </div>
              </div>
              );
            })
          )}
        </div>
      </div>
      <div>
        <div className="px-3 md:px-0 text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5">
          Ads ({ads.length})
        </div>
        {ads.length === 0 ? (
          <div className="text-xs text-muted-foreground py-4 text-center">No ads</div>
        ) : (
          <div className="bg-card border border-border rounded-xl overflow-hidden divide-y divide-border">
            {ads.map((a) => (
              <AdCard
                key={a.id}
                ad={a}
                onView={() => onView({ kind: "ad", adGroupId, adId: a.id })}
              />
            ))}
          </div>
        )}
      </div>
      <SearchTermsList items={searchTerms} loading={false} header="Search terms" />
      <NegativesBlock negatives={negatives} onView={onNegativeView} />
    </div>
  );
}

function NegativesBlock({ negatives, onView }: { negatives: NegativeRow[]; onView: (n: NegativeRow) => void }) {
  return (
    <div>
      <div className="px-3 md:px-0 text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5">
        Negatives ({negatives.length})
      </div>
      {negatives.length === 0 ? (
        <div className="text-xs text-muted-foreground py-4 text-center">No negatives</div>
      ) : (
        <div className="bg-card border border-border rounded-xl overflow-hidden divide-y divide-border">
          {negatives.map((n) => (
            <NegativeRowEl key={n.id} n={n} onView={() => onView(n)} />
          ))}
        </div>
      )}
    </div>
  );
}

function AdCard({ ad, onView }: { ad: AdRow; onView: () => void }) {
  return (
    <div className="px-3 py-2 flex items-center gap-1.5 flex-wrap min-w-0">
      <span className={`shrink-0 inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium uppercase tracking-wider ${TAG_COLOR.ad}${ad.status === "PAUSED" ? " opacity-60" : ""}`}>
        Ad {ad.id}
      </span>
      {ad.adStrength ? (
        <span className="shrink-0 inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium uppercase tracking-wider bg-emerald-500/10 text-emerald-500">
          {ad.adStrength}
        </span>
      ) : null}
      <span className="ml-auto" />
      <ViewTag onClick={onView} />
    </div>
  );
}

function SearchTermsList({ items, loading, header }: { items?: SearchTerm[]; loading: boolean; header: string }) {
  if (loading && !items) return <div className="text-xs text-muted-foreground py-8 text-center">Loading…</div>;
  if (!items || items.length === 0) return (
    <>
      <div className="px-3 md:px-0 text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5">{header}</div>
      <div className="text-xs text-muted-foreground py-8 text-center">No search terms</div>
    </>
  );
  return (
    <>
      <div className="px-3 md:px-0 text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5">{header} ({items.length})</div>
      <div className="bg-card border border-border rounded-xl overflow-hidden divide-y divide-border">
        {items.map((st, i) => (
          <div key={i} className="px-3 py-2 space-y-1.5">
            <div className="flex items-center gap-1.5 flex-wrap min-w-0">
              <span className="shrink-0 inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium uppercase tracking-wider bg-amber-500/10 text-amber-500">
                <span className="truncate max-w-[300px]">{st.searchTerm}</span>
              </span>
              <span className="shrink-0 inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium uppercase tracking-wider bg-muted text-muted-foreground">
                {st.status}
              </span>
              <span className="shrink-0 inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium uppercase tracking-wider bg-secondary text-foreground" title={st.matchedKeyword}>
                <span className="truncate max-w-[200px]">{st.matchedKeyword}</span>
              </span>
            </div>
            <div className="flex items-center gap-1.5 flex-wrap min-w-0">
              <MetricPill icon={<Eye className="w-3 h-3" />} value={st.impressions} label="impressions" />
              <MetricPill icon={<MousePointerClick className="w-3 h-3" />} value={st.clicks} label="clicks" />
              <MetricPill icon={<Target className="w-3 h-3" />} value={st.conversions} label="conversions" />
              <MetricPill icon={<Euro className="w-3 h-3" />} value={st.cost.toFixed(2)} label="cost €" />
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

function TotalAndTimeline({ campaigns, timeline }: { campaigns: CampaignRow[]; timeline: TimelineBucket[] }) {
  const total = campaigns.reduce(
    (acc, e) => ({
      impressions: acc.impressions + e.impressions,
      clicks: acc.clicks + e.clicks,
      conversions: acc.conversions + e.conversions,
      cost: acc.cost + e.cost,
    }),
    { impressions: 0, clicks: 0, conversions: 0, cost: 0 },
  );
  return (
    <>
      <div className="px-3 py-2 flex items-center gap-1.5 flex-wrap min-w-0">
        <span className="shrink-0 inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium uppercase tracking-wider bg-emerald-500/10 text-emerald-500">
          Total
        </span>
        <MetricPill icon={<Eye className="w-3 h-3" />} value={total.impressions} label="impressions" />
        <MetricPill icon={<MousePointerClick className="w-3 h-3" />} value={total.clicks} label="clicks" />
        <MetricPill icon={<Target className="w-3 h-3" />} value={total.conversions} label="conversions" />
        <MetricPill icon={<Euro className="w-3 h-3" />} value={total.cost.toFixed(2)} label="cost €" />
      </div>
      {timeline.map((b) => (
        <div key={b.time} className="px-3 py-2 flex items-center gap-1.5 flex-wrap min-w-0">
          <span className="shrink-0 inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium uppercase tracking-wider bg-purple-500/10 text-purple-500 tabular-nums">
            {formatTimeTag(b.time)}
          </span>
          <MetricPill icon={<Eye className="w-3 h-3" />} value={b.impressions} label="impressions" />
          <MetricPill icon={<MousePointerClick className="w-3 h-3" />} value={b.clicks} label="clicks" />
          <MetricPill icon={<Target className="w-3 h-3" />} value={b.conversions} label="conversions" />
          <MetricPill icon={<Euro className="w-3 h-3" />} value={b.cost.toFixed(2)} label="cost €" />
        </div>
      ))}
    </>
  );
}

function formatTimeTag(time: string): string {
  const m = time.match(/(\d{2}):00$/);
  if (m) {
    const h = parseInt(m[1], 10);
    return `${String(h).padStart(2, "0")}-${String((h + 1) % 24).padStart(2, "0")}`;
  }
  return time;
}

function TitleTag({ text, color, paused, onClick }: { text: string; color: string; paused: boolean; onClick?: () => void }) {
  const cls = "shrink-0 inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium uppercase tracking-wider " + color + (paused ? " opacity-60" : "");
  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={cls + " cursor-pointer"} title={text}>
        <span className="truncate max-w-[260px]">{text}</span>
      </button>
    );
  }
  return (
    <span className={cls} title={text}>
      <span className="truncate max-w-[260px]">{text}</span>
    </span>
  );
}

function ViewTag({ onClick }: { onClick: (e: React.MouseEvent) => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="shrink-0 inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium uppercase tracking-wider bg-secondary text-foreground hover:bg-muted transition-colors cursor-pointer"
    >
      View
    </button>
  );
}

function MetricPill({ icon, value, label }: { icon: React.ReactNode; value: number | string; label: string }) {
  return (
    <span
      className="shrink-0 inline-flex items-center justify-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium uppercase tracking-wider bg-muted text-muted-foreground tabular-nums min-w-[64px]"
      title={`${value} ${label}`}
    >
      {icon}
      {value}
    </span>
  );
}

function TabGroup({ options, selected, onSelect }: { options: Array<{ value: string; label: string }>; selected: string; onSelect: (v: string) => void }) {
  return (
    <div className="inline-flex items-center bg-secondary rounded-md p-0.5 gap-0.5">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onSelect(o.value)}
          className={"h-7 px-2 rounded text-[11px] font-medium uppercase tracking-wider tabular-nums transition-colors " + (selected === o.value ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function DetailModal({ req, onClose }: { req: DetailRequest; onClose: () => void }) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        let url: string;
        if (req.kind === "campaign") url = `/api/admin/google-ads/detail/campaign/${req.id}`;
        else if (req.kind === "ad_group") url = `/api/admin/google-ads/detail/ad-group/${req.id}`;
        else if (req.kind === "ad") url = `/api/admin/google-ads/detail/ad/${req.adGroupId}/${req.adId}`;
        else if (req.kind === "keyword") url = `/api/admin/google-ads/detail/keyword/${req.adGroupId}/${req.critId}`;
        else {
          const qs = new URLSearchParams();
          if (req.campaignId) qs.set("campaignId", req.campaignId);
          if (req.adGroupId) qs.set("adGroupId", req.adGroupId);
          url = `/api/admin/google-ads/detail/negative/${req.scope}/${req.id}?${qs}`;
        }
        const res = await fetch(apiUrl(url), { credentials: "include" });
        if (!res.ok) {
          if (!cancelled) setError(`Error ${res.status}`);
          return;
        }
        const j = await res.json();
        if (!cancelled) setData(j.record);
      } catch (e: any) {
        if (!cancelled) setError(String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [req]);

  const rows = useMemo(() => (data ? flattenObject(data) : []), [data]);

  return (
    <div onClick={onClose} className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-2xl bg-card border border-border rounded-xl shadow-xl flex flex-col max-h-[85vh]">
        <div className="px-4 py-3 border-b border-border flex items-center justify-between shrink-0">
          <h3 className="text-sm font-semibold text-foreground capitalize">{req.kind.replace("_", " ")} detail</h3>
          <button type="button" onClick={onClose} className="h-7 w-7 inline-flex items-center justify-center bg-secondary rounded-md text-muted-foreground hover:text-foreground">
            <XIcon className="w-3.5 h-3.5" />
          </button>
        </div>
        <div className="overflow-y-auto">
          {loading ? (
            <div className="text-xs text-muted-foreground py-8 text-center">Loading…</div>
          ) : error ? (
            <div className="text-xs text-red-500 py-8 text-center">{error}</div>
          ) : rows.length === 0 ? (
            <div className="text-xs text-muted-foreground py-8 text-center">No data</div>
          ) : (
            <div className="divide-y divide-border">
              {rows.map(([label, value]) => (
                <div key={label} className="flex items-start gap-3 px-4 py-1.5">
                  <span className="text-[11px] text-muted-foreground shrink-0 w-44 font-mono break-words">{label}</span>
                  <span className="text-xs text-foreground flex-1 break-all font-mono whitespace-pre-wrap">{value}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function flattenObject(obj: any, prefix = ""): Array<[string, string]> {
  const out: Array<[string, string]> = [];
  if (obj == null) return out;
  if (typeof obj !== "object") {
    out.push([prefix || "(value)", String(obj)]);
    return out;
  }
  if (Array.isArray(obj)) {
    if (obj.length === 0) {
      out.push([prefix || "(empty)", "[]"]);
      return out;
    }
    obj.forEach((item, i) => {
      out.push(...flattenObject(item, `${prefix}[${i}]`));
    });
    return out;
  }
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v == null) continue;
    if (typeof v === "object") {
      out.push(...flattenObject(v, key));
    } else {
      out.push([key, String(v)]);
    }
  }
  return out;
}
