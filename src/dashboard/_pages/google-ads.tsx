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
  BarChart3,
  Play,
  Pause,
  Copy,
  Check,
  Plus,
  Trash2,
} from "lucide-react";
import { apiUrl } from "@/lib/api";
import { SubpageStickyBar } from "../_v2/ui";
import { useDashboardRouter } from "../_spa/router";
import { useScrollLock } from "../_v2/use-scroll-lock";

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

interface CampaignTargeting {
  geos: Array<{ name: string; code: string | null }>;
  languages: Array<{ name: string; code: string | null }>;
}

interface AllData {
  campaigns: CampaignRow[];
  adGroups: AdGroupRow[];
  ads: AdRow[];
  keywords: KeywordRow[];
  negatives: NegativeRow[];
  timeline: TimelineBucket[];
  campaignAssets: Record<string, CampAssets>;
  campaignTargeting: Record<string, CampaignTargeting>;
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
  | { kind: "negative"; scope: "campaign" | "ad_group"; id: string; campaignId?: string; adGroupId?: string };

const DATE_ORDER: DateRange[] = ["today", "yesterday", "last7days"];
const DATE_SHORT: Record<DateRange, React.ReactNode> = { today: "T", yesterday: "Y", last7days: "7" };
const STATUS_ORDER: Status[] = ["ENABLED", "PAUSED"];
const STATUS_SHORT: Record<Status, React.ReactNode> = {
  ENABLED: <Play className="w-3 h-3" />,
  PAUSED: <Pause className="w-3 h-3" />,
};

const MT_BADGE_COLOR: Record<string, string> = {
  EXACT: "bg-red-500/15 text-red-500",
  PHRASE: "bg-amber-500/15 text-amber-500",
  BROAD: "bg-blue-500/15 text-blue-500",
};

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
  const [plannerOpen, setPlannerOpen] = useState(false);
  const plannerState = usePlannerState();
  const [bidEditReq, setBidEditReq] = useState<{ adGroupId: string; critId: string; keyword: string; currentBid: number | null } | null>(null);
  const [addKwAdGroupId, setAddKwAdGroupId] = useState<string | null>(null);
  const [addKwFromPlanner, setAddKwFromPlanner] = useState<{ adGroupId: string; text: string } | null>(null);
  const [deleteKwReq, setDeleteKwReq] = useState<{ adGroupId: string; critId: string; keyword: string } | null>(null);

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
          {view.kind === "ad_group_detail" ? (
            <button
              type="button"
              onClick={() => setAddKwAdGroupId(view.adGroupId)}
              title="Add keyword"
              className="h-8 w-8 inline-flex items-center justify-center bg-secondary rounded-md text-muted-foreground hover:text-foreground"
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
          ) : null}
          {view.kind === "ad_group_detail" || view.kind === "keyword_search_terms" ? (
            <button
              type="button"
              onClick={() => setPlannerOpen(true)}
              title="Keyword Planner"
              className="h-8 w-8 inline-flex items-center justify-center bg-secondary rounded-md text-muted-foreground hover:text-foreground"
            >
              <BarChart3 className="h-3.5 w-3.5" />
            </button>
          ) : null}
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
            onBidEdit={(k) => setBidEditReq({ adGroupId: k.adGroupId, critId: k.id, keyword: k.text ?? k.title, currentBid: k.bid ?? null })}
            onDeleteKeyword={(k) => setDeleteKwReq({ adGroupId: k.adGroupId, critId: k.id, keyword: k.text ?? k.title })}
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
      {plannerOpen ? <PlannerModal state={plannerState} campaignId={currentCampaign?.id ?? null} targeting={currentCampaign?.id ? data?.campaignTargeting?.[currentCampaign.id] ?? null : null} adGroupId={(view.kind === "ad_group_detail" || view.kind === "keyword_search_terms") ? view.adGroupId : null} onAddKeyword={(text, adGroupId) => setAddKwFromPlanner({ adGroupId, text })} onClose={() => setPlannerOpen(false)} /> : null}
      {addKwFromPlanner ? (
        <AddKeywordModal
          adGroupId={addKwFromPlanner.adGroupId}
          initialText={addKwFromPlanner.text}
          onClose={() => setAddKwFromPlanner(null)}
          onSaved={() => { setAddKwFromPlanner(null); setPlannerOpen(false); void load("refresh"); }}
        />
      ) : null}
      {bidEditReq ? <BidEditModal req={bidEditReq} onClose={() => setBidEditReq(null)} onSaved={() => { setBidEditReq(null); void load("refresh"); }} /> : null}
      {addKwAdGroupId ? <AddKeywordModal adGroupId={addKwAdGroupId} onClose={() => setAddKwAdGroupId(null)} onSaved={() => { setAddKwAdGroupId(null); void load("refresh"); }} /> : null}
      {deleteKwReq ? <DeleteKeywordModal req={deleteKwReq} onClose={() => setDeleteKwReq(null)} onDeleted={() => { setDeleteKwReq(null); void load("refresh"); }} /> : null}
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
        <MetricPill icon={<Target className="w-3 h-3" />} value={c.conversions} label="conversions" highlight={Number(c.conversions) > 0} />
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
        <MetricPill icon={<Target className="w-3 h-3" />} value={a.conversions} label="conversions" highlight={Number(a.conversions) > 0} />
        <MetricPill icon={<Euro className="w-3 h-3" />} value={a.cost.toFixed(2)} label="cost €" />
      </div>
      {a.suffix ? (
        <div>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); void navigator.clipboard.writeText(a.suffix!); }}
            title="Copy"
            className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium uppercase tracking-wider bg-muted text-muted-foreground font-mono hover:bg-secondary transition-colors cursor-pointer"
          >
            <span className="truncate max-w-[260px]">{a.suffix}</span>
          </button>
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
  onBidEdit,
  onDeleteKeyword,
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
  onBidEdit: (k: KeywordRow) => void;
  onDeleteKeyword: (k: KeywordRow) => void;
  searchTerms?: SearchTerm[];
  negatives: NegativeRow[];
  onNegativeView: (n: NegativeRow) => void;
}) {
  const sortedKeywords = useMemo(() => {
    const MT_ORDER: Record<string, number> = { BROAD: 0, PHRASE: 1, EXACT: 2 };
    const arr = [...keywords];
    arr.sort((a, b) => {
      const ai = MT_ORDER[a.matchType ?? ""] ?? 99;
      const bi = MT_ORDER[b.matchType ?? ""] ?? 99;
      if (ai !== bi) return ai - bi;
      return b.impressions - a.impressions;
    });
    return arr;
  }, [keywords]);
  return (
    <div className="space-y-4">
      <div>
        <div className="px-3 md:px-0 text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5">
          Keywords ({sortedKeywords.length})
        </div>
        <div className="bg-card border border-border rounded-xl divide-y divide-border">
          {sortedKeywords.length === 0 ? (
            <div className="text-xs text-muted-foreground py-4 text-center">No keywords</div>
          ) : (
            sortedKeywords.map((k) => {
              const mtLetter = k.matchType === "EXACT" ? "E" : k.matchType === "PHRASE" ? "P" : k.matchType === "BROAD" ? "B" : "?";
              const mtClass = MT_BADGE_COLOR[k.matchType ?? ""] ?? "bg-secondary text-foreground";
              const titleColor = TAG_COLOR.keyword;
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
                  <span className={"shrink-0 inline-flex items-center px-2 py-0.5 rounded text-[10px] font-mono font-semibold uppercase tracking-wider " + mtClass}>{mtLetter}</span>
                  <TitleTag text={k.text ?? k.title} color={titleColor} paused={k.status === "PAUSED"} />
                  <span className="ml-auto" />
                  <CopyTag value={k.text ?? k.title} />
                  <DeleteTag onClick={(e) => { e.stopPropagation(); onDeleteKeyword(k); }} />
                </div>
                <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                  <MetricPill icon={<Eye className="w-3 h-3" />} value={k.impressions} label="impressions" />
                  <MetricPill icon={<MousePointerClick className="w-3 h-3" />} value={k.clicks} label="clicks" />
                  <MetricPill icon={<Target className="w-3 h-3" />} value={k.conversions} label="conversions" highlight={Number(k.conversions) > 0} />
                  <MetricPill icon={<Euro className="w-3 h-3" />} value={k.cost.toFixed(2)} label="cost €" />
                  <MetricPill icon={<Gauge className="w-3 h-3" />} value={k.qualityScore ?? "—"} label="QS" />
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); onBidEdit(k); }}
                    title="Edit bid"
                    className="shrink-0 inline-flex items-center justify-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium uppercase tracking-wider bg-sky-500/10 text-sky-500 hover:bg-sky-500/20 transition-colors cursor-pointer tabular-nums min-w-[64px]"
                  >
                    <Coins className="w-3 h-3" />
                    {k.bid != null ? k.bid.toFixed(2) : "—"}
                  </button>
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

function searchTermStatusClass(status: string): string {
  switch (status) {
    case "added": return "bg-emerald-500/15 text-emerald-500";
    case "excluded": return "bg-red-500/15 text-red-500";
    case "added_excluded": return "bg-amber-500/15 text-amber-500";
    default: return "bg-muted text-muted-foreground";
  }
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
              <span className={"shrink-0 inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium uppercase tracking-wider " + searchTermStatusClass(st.status)}>
                {st.status}
              </span>
              <span className="shrink-0 inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium uppercase tracking-wider bg-secondary text-foreground" title={st.matchedKeyword}>
                <span className="truncate max-w-[200px]">{st.matchedKeyword}</span>
              </span>
              <span className="ml-auto" />
              <CopyTag value={st.searchTerm} />
            </div>
            <div className="flex items-center gap-1.5 flex-wrap min-w-0">
              <MetricPill icon={<Eye className="w-3 h-3" />} value={st.impressions} label="impressions" />
              <MetricPill icon={<MousePointerClick className="w-3 h-3" />} value={st.clicks} label="clicks" />
              <MetricPill icon={<Target className="w-3 h-3" />} value={st.conversions} label="conversions" highlight={Number(st.conversions) > 0} />
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
        <MetricPill icon={<Target className="w-3 h-3" />} value={total.conversions} label="conversions" highlight={Number(total.conversions) > 0} />
        <MetricPill icon={<Euro className="w-3 h-3" />} value={total.cost.toFixed(2)} label="cost €" />
      </div>
      {timeline.map((b) => (
        <div key={b.time} className="px-3 py-2 flex items-center gap-1.5 flex-wrap min-w-0">
          <span className="shrink-0 inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium uppercase tracking-wider bg-purple-500/10 text-purple-500 tabular-nums">
            {formatTimeTag(b.time)}
          </span>
          <MetricPill icon={<Eye className="w-3 h-3" />} value={b.impressions} label="impressions" />
          <MetricPill icon={<MousePointerClick className="w-3 h-3" />} value={b.clicks} label="clicks" />
          <MetricPill icon={<Target className="w-3 h-3" />} value={b.conversions} label="conversions" highlight={Number(b.conversions) > 0} />
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

function CopyTag({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        void navigator.clipboard.writeText(value);
        setCopied(true);
        setTimeout(() => setCopied(false), 1200);
      }}
      title={copied ? "Copied" : "Copy"}
      className={"shrink-0 inline-flex items-center justify-center h-5 w-6 rounded text-[10px] transition-colors cursor-pointer " + (copied ? "bg-emerald-500/10 text-emerald-500" : "bg-secondary text-muted-foreground hover:text-foreground hover:bg-muted")}
    >
      {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
    </button>
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

function MetricPill({ icon, value, label, highlight }: { icon: React.ReactNode; value: number | string; label: string; highlight?: boolean }) {
  const cls = highlight
    ? "bg-emerald-500/10 text-emerald-500"
    : "bg-muted text-muted-foreground";
  return (
    <span
      className={"shrink-0 inline-flex items-center justify-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium uppercase tracking-wider tabular-nums min-w-[64px] " + cls}
      title={`${value} ${label}`}
    >
      {icon}
      {value}
    </span>
  );
}

function TabGroup({ options, selected, onSelect }: { options: Array<{ value: string; label: React.ReactNode }>; selected: string; onSelect: (v: string) => void }) {
  return (
    <div className="inline-flex items-center bg-secondary rounded-md p-0.5 gap-0.5">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onSelect(o.value)}
          className={"h-7 min-w-7 px-2 rounded text-[11px] font-medium uppercase tracking-wider tabular-nums transition-colors inline-flex items-center justify-center " + (selected === o.value ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function DetailModal({ req, onClose }: { req: DetailRequest; onClose: () => void }) {
  useScrollLock(true);
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

interface KeywordPlanData {
  keyword: string;
  bidMicros: number | null;
  geoTargets: string[];
  language: string | null;
  avgMonthlySearches: number | null;
  competition: string | null;
  competitionIndex: number | null;
  lowTopOfPageBidMicros: number | null;
  highTopOfPageBidMicros: number | null;
  monthlySearchVolumes: Array<{ year: number; monthName: string; monthNum: number; searches: number }>;
  minMonth: { year: number; monthName: string; monthNum: number; searches: number } | null;
  maxMonth: { year: number; monthName: string; monthNum: number; searches: number } | null;
  yoyPct: number | null;
  foundExactMatch: boolean;
}

const GEO_OPTIONS = [
  { label: "USA", code: "US", resource: "geoTargetConstants/2840" },
  { label: "Spain", code: "ES", resource: "geoTargetConstants/2724" },
  { label: "Portugal", code: "PT", resource: "geoTargetConstants/2620" },
  { label: "Germany", code: "DE", resource: "geoTargetConstants/2276" },
  { label: "Italy", code: "IT", resource: "geoTargetConstants/2380" },
];
const LANG_OPTIONS = [
  { label: "English", code: "EN", resource: "languageConstants/1000" },
  { label: "Spanish", code: "ES", resource: "languageConstants/1003" },
  { label: "Portuguese", code: "PT", resource: "languageConstants/1014" },
  { label: "German", code: "DE", resource: "languageConstants/1001" },
  { label: "Italian", code: "IT", resource: "languageConstants/1004" },
];

interface PlannerState {
  phrase: string;
  setPhrase: (v: string) => void;
  geo: string;
  setGeo: (v: string) => void;
  language: string;
  setLanguage: (v: string) => void;
  result: KeywordPlanData | null;
  setResult: (v: KeywordPlanData | null) => void;
  resultError: string | null;
  setResultError: (v: string | null) => void;
  appliedCampaignId: string | null;
  setAppliedCampaignId: (v: string | null) => void;
}

function usePlannerState(): PlannerState {
  const [phrase, setPhrase] = useState("");
  const [geo, setGeo] = useState<string>(GEO_OPTIONS[4].resource);
  const [language, setLanguage] = useState<string>(LANG_OPTIONS[4].resource);
  const [result, setResult] = useState<KeywordPlanData | null>(null);
  const [resultError, setResultError] = useState<string | null>(null);
  const [appliedCampaignId, setAppliedCampaignId] = useState<string | null>(null);
  return { phrase, setPhrase, geo, setGeo, language, setLanguage, result, setResult, resultError, setResultError, appliedCampaignId, setAppliedCampaignId };
}

const COUNTRY_TO_LANG: Record<string, string> = { US: "EN", ES: "ES", PT: "PT", DE: "DE", IT: "IT" };

function PlannerModal({ state, campaignId, targeting, adGroupId, onAddKeyword, onClose }: { state: PlannerState; campaignId: string | null; targeting: CampaignTargeting | null; adGroupId: string | null; onAddKeyword: (text: string, adGroupId: string) => void; onClose: () => void }) {
  useScrollLock(true);

  const { phrase, setPhrase, geo, setGeo, language, setLanguage, result, setResult, resultError, setResultError, appliedCampaignId, setAppliedCampaignId } = state;
  const [submitting, setSubmitting] = useState(false);

  // Auto-pick country + language from current campaign targeting (once per campaign).
  useEffect(() => {
    if (!campaignId || campaignId === appliedCampaignId) return;
    if (!targeting) return;
    const firstGeoCode = targeting.geos[0]?.code?.toUpperCase();
    if (firstGeoCode) {
      const geoMatch = GEO_OPTIONS.find((g) => g.code === firstGeoCode);
      if (geoMatch) setGeo(geoMatch.resource);
      const langCode = COUNTRY_TO_LANG[firstGeoCode];
      if (langCode) {
        const langMatch = LANG_OPTIONS.find((l) => l.code === langCode);
        if (langMatch) setLanguage(langMatch.resource);
      }
    }
    setAppliedCampaignId(campaignId);
  }, [campaignId, targeting, appliedCampaignId, setGeo, setLanguage, setAppliedCampaignId]);

  const canSubmit = phrase.trim().length > 0 && !submitting;

  async function submit() {
    if (!canSubmit) return;
    setSubmitting(true);
    setResultError(null);
    setResult(null);
    try {
      const qs = new URLSearchParams({
        phrase: phrase.trim(),
        geo,
        language,
      });
      const res = await fetch(apiUrl(`/api/admin/google-ads/planner?${qs}`), { credentials: "include" });
      if (!res.ok) {
        const txt = await res.text();
        setResultError(`Error ${res.status}: ${txt.slice(0, 200)}`);
        return;
      }
      const j = (await res.json()) as KeywordPlanData;
      setResult(j);
    } catch (e: any) {
      setResultError(String(e));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div onClick={onClose} className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-2xl bg-card border border-border rounded-xl shadow-xl flex flex-col max-h-[85vh]">
        <div className="px-4 py-3 border-b border-border flex items-center justify-between shrink-0">
          <h3 className="text-sm font-semibold text-foreground inline-flex items-center gap-2">
            <BarChart3 className="w-4 h-4" />
            Keyword Planner
          </h3>
          <button type="button" onClick={onClose} className="h-7 w-7 inline-flex items-center justify-center bg-secondary rounded-md text-muted-foreground hover:text-foreground shrink-0">
            <XIcon className="w-3.5 h-3.5" />
          </button>
        </div>
        <div className="overflow-y-auto p-4 space-y-3">
          <form
            onSubmit={(e) => { e.preventDefault(); void submit(); }}
            className="space-y-3"
          >
            <FormLabel label="Keyword">
              <input
                type="text"
                value={phrase}
                onChange={(e) => setPhrase(e.target.value)}
                placeholder="e.g. qr menu ristorante"
                autoFocus
                className="w-full h-9 px-3 rounded-md bg-secondary border border-border text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </FormLabel>
            <div className="flex items-end gap-2">
              <FormLabel label="Country" className="flex-1">
                <select
                  value={geo}
                  onChange={(e) => setGeo(e.target.value)}
                  className="w-full h-9 px-2 rounded-md bg-secondary border border-border text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  {GEO_OPTIONS.map((g) => (
                    <option key={g.resource} value={g.resource}>{g.label} ({g.code})</option>
                  ))}
                </select>
              </FormLabel>
              <FormLabel label="Language" className="flex-1">
                <select
                  value={language}
                  onChange={(e) => setLanguage(e.target.value)}
                  className="w-full h-9 px-2 rounded-md bg-secondary border border-border text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  {LANG_OPTIONS.map((l) => (
                    <option key={l.resource} value={l.resource}>{l.label} ({l.code})</option>
                  ))}
                </select>
              </FormLabel>
              <button
                type="submit"
                disabled={!canSubmit}
                className="h-9 px-4 rounded-md bg-primary text-primary-foreground text-xs font-medium uppercase tracking-wider disabled:opacity-50 hover:opacity-90 transition-opacity shrink-0"
              >
                {submitting ? "Analyzing…" : "Analyze"}
              </button>
            </div>
            {resultError ? (
              <div className="text-[11px] text-red-500 break-all">{resultError}</div>
            ) : null}
          </form>
          <KeywordPlanContent data={result} />
          {adGroupId && phrase.trim() ? (
            <div className="pt-1">
              <button
                type="button"
                onClick={() => onAddKeyword(phrase.trim(), adGroupId)}
                className="w-full h-9 rounded-md bg-secondary border border-border text-xs font-medium uppercase tracking-wider text-foreground hover:bg-muted transition-colors inline-flex items-center justify-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" />
                Add this keyword to ad group
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function FormLabel({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={"space-y-1 " + (className ?? "")}>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      {children}
    </div>
  );
}

function KeywordPlanContent({ data }: { data: KeywordPlanData | null }) {
  const lowCpc = data?.lowTopOfPageBidMicros != null ? data.lowTopOfPageBidMicros / 1e6 : null;
  const highCpc = data?.highTopOfPageBidMicros != null ? data.highTopOfPageBidMicros / 1e6 : null;

  const compColor = (c: string | null | undefined) => {
    if (c === "LOW") return "text-emerald-500 bg-emerald-500/10";
    if (c === "MEDIUM") return "text-amber-500 bg-amber-500/10";
    if (c === "HIGH") return "text-red-500 bg-red-500/10";
    return "text-muted-foreground bg-muted";
  };

  const yoy = data?.yoyPct ?? null;
  const yoyStr = yoy == null ? null : (yoy > 0 ? "+" : "") + yoy.toFixed(1) + "% YoY";
  const yoyClass = yoy == null ? "" : yoy > 5 ? "text-emerald-500" : yoy < -5 ? "text-red-500" : "text-muted-foreground";

  return (
    <div className="space-y-2 text-xs">
      {data && !data.foundExactMatch ? (
        <div className="px-2 py-1.5 rounded bg-amber-500/10 text-amber-500 text-[10px]">
          Exact match not found — showing closest idea
        </div>
      ) : null}
      <div className="bg-secondary/40 border border-border rounded-lg divide-y divide-border">
        <Row
          label="Avg searches / month"
          value={
            <span>
              <span className="font-semibold">{fmtNum(data?.avgMonthlySearches ?? null)}</span>
              {yoyStr ? <span className={`ml-2 ${yoyClass}`}>({yoyStr})</span> : null}
            </span>
          }
        />
        <Row
          label="Competition"
          value={
            <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium uppercase tracking-wider ${compColor(data?.competition)}`}>
              {data?.competition ?? "—"}
            </span>
          }
        />
        <Row label="Index (0-100)" value={data?.competitionIndex != null ? String(data.competitionIndex) : "—"} />
        <Row label="CPC low" value={lowCpc != null ? `€${lowCpc.toFixed(2)}` : "—"} />
        <Row label="CPC high" value={highCpc != null ? `€${highCpc.toFixed(2)}` : "—"} />
      </div>
    </div>
  );
}

function Row({
  label,
  value,
  bold,
  mono,
  valueClass,
}: {
  label: string;
  value: React.ReactNode;
  bold?: boolean;
  mono?: boolean;
  valueClass?: string;
}) {
  return (
    <div className="flex items-center gap-3 px-3 py-1.5">
      <span className="text-[11px] text-muted-foreground shrink-0 w-44">{label}</span>
      <span className={`text-xs flex-1 break-all ${bold ? "font-semibold text-foreground" : "text-foreground"} ${mono ? "font-mono" : ""} ${valueClass ?? ""}`}>
        {value}
      </span>
    </div>
  );
}

function fmtNum(n: number | null): string {
  if (n == null) return "—";
  return n.toLocaleString();
}

function BidEditModal({
  req,
  onClose,
  onSaved,
}: {
  req: { adGroupId: string; critId: string; keyword: string; currentBid: number | null };
  onClose: () => void;
  onSaved: () => void;
}) {
  useScrollLock(true);
  const [input, setInput] = useState(req.currentBid != null ? req.currentBid.toFixed(2) : "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const parsed = parseBid(input);
  const canSave = parsed != null && parsed > 0 && !saving;

  async function save() {
    if (!canSave) return;
    setSaving(true);
    setError(null);
    try {
      const bidMicros = Math.round(parsed! * 1_000_000);
      const res = await fetch(
        apiUrl(`/api/admin/google-ads/keyword/${req.adGroupId}/${req.critId}/bid`),
        {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ bidMicros }),
        },
      );
      if (!res.ok) {
        const txt = await res.text();
        setError(`Error ${res.status}: ${txt.slice(0, 200)}`);
        return;
      }
      onSaved();
    } catch (e: any) {
      setError(String(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div onClick={onClose} className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-sm bg-card border border-border rounded-xl shadow-xl flex flex-col">
        <div className="px-4 py-3 border-b border-border flex items-center justify-between shrink-0">
          <h3 className="text-sm font-semibold text-foreground truncate" title={req.keyword}>
            Edit bid — {req.keyword}
          </h3>
          <button type="button" onClick={onClose} className="h-7 w-7 inline-flex items-center justify-center bg-secondary rounded-md text-muted-foreground hover:text-foreground shrink-0">
            <XIcon className="w-3.5 h-3.5" />
          </button>
        </div>
        <form
          onSubmit={(e) => { e.preventDefault(); void save(); }}
          className="p-4 space-y-3"
        >
          <FormLabel label="CPC bid (€)">
            <div className="flex items-center gap-2">
              <input
                type="text"
                inputMode="decimal"
                value={input}
                onChange={(e) => {
                  const cleaned = e.target.value.replace(/[^0-9.,]/g, "");
                  setInput(cleaned);
                }}
                placeholder="0.25"
                autoFocus
                className="flex-1 h-9 px-3 rounded-md bg-secondary border border-border text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary tabular-nums"
              />
              <button
                type="submit"
                disabled={!canSave}
                className="h-9 px-4 rounded-md bg-primary text-primary-foreground text-xs font-medium uppercase tracking-wider disabled:opacity-50 hover:opacity-90 transition-opacity shrink-0"
              >
                {saving ? "Saving…" : "Save"}
              </button>
            </div>
          </FormLabel>
          {parsed != null ? (
            <div className="text-[11px] text-muted-foreground">
              Will be saved as <span className="font-mono text-foreground">€{parsed.toFixed(2)}</span>
            </div>
          ) : input ? (
            <div className="text-[11px] text-amber-500">Invalid number</div>
          ) : null}
          {error ? (
            <div className="text-[11px] text-red-500 break-all">{error}</div>
          ) : null}
        </form>
      </div>
    </div>
  );
}

function DeleteTag({ onClick }: { onClick: (e: React.MouseEvent) => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title="Delete"
      className="shrink-0 inline-flex items-center justify-center h-5 w-6 rounded text-[10px] bg-red-500/10 text-red-500 hover:bg-red-500/20 transition-colors cursor-pointer"
    >
      <Trash2 className="w-3 h-3" />
    </button>
  );
}

function DeleteKeywordModal({
  req,
  onClose,
  onDeleted,
}: {
  req: { adGroupId: string; critId: string; keyword: string };
  onClose: () => void;
  onDeleted: () => void;
}) {
  useScrollLock(true);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function confirm() {
    setDeleting(true);
    setError(null);
    try {
      const res = await fetch(
        apiUrl(`/api/admin/google-ads/keyword/${req.adGroupId}/${req.critId}`),
        { method: "DELETE", credentials: "include" },
      );
      if (!res.ok) {
        const txt = await res.text();
        setError(`Error ${res.status}: ${txt.slice(0, 200)}`);
        return;
      }
      onDeleted();
    } catch (e: any) {
      setError(String(e));
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div onClick={onClose} className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-sm bg-card border border-border rounded-xl shadow-xl flex flex-col">
        <div className="px-4 py-3 border-b border-border flex items-center justify-between shrink-0">
          <h3 className="text-sm font-semibold text-foreground">Delete keyword</h3>
          <button type="button" onClick={onClose} className="h-7 w-7 inline-flex items-center justify-center bg-secondary rounded-md text-muted-foreground hover:text-foreground shrink-0">
            <XIcon className="w-3.5 h-3.5" />
          </button>
        </div>
        <div className="p-4 space-y-3 text-xs">
          <div className="text-foreground">
            Permanently remove keyword:
          </div>
          <div className="px-2 py-1.5 rounded bg-secondary text-foreground font-mono break-all">
            {req.keyword}
          </div>
          {error ? <div className="text-[11px] text-red-500 break-all">{error}</div> : null}
          <div className="flex items-center justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="h-9 px-3 rounded-md bg-secondary text-foreground text-xs font-medium uppercase tracking-wider hover:bg-muted transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void confirm()}
              disabled={deleting}
              className="h-9 px-4 rounded-md bg-red-500 text-white text-xs font-medium uppercase tracking-wider disabled:opacity-50 hover:bg-red-600 transition-colors"
            >
              {deleting ? "Deleting…" : "Delete"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function AddKeywordModal({
  adGroupId,
  initialText,
  onClose,
  onSaved,
}: {
  adGroupId: string;
  initialText?: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  useScrollLock(true);
  const [text, setText] = useState(initialText ?? "");
  const [matchType, setMatchType] = useState<"EXACT" | "PHRASE" | "BROAD">("EXACT");
  const [negative, setNegative] = useState(false);
  const [bidStr, setBidStr] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const parsedBid = parseBid(bidStr);
  const bidValid = !bidStr || (parsedBid != null && parsedBid > 0);
  const canSave = text.trim().length > 0 && !saving && bidValid;

  async function save() {
    if (!canSave) return;
    setSaving(true);
    setError(null);
    try {
      const payload: Record<string, unknown> = { text: text.trim(), matchType, negative };
      if (parsedBid != null && parsedBid > 0) payload.bidMicros = Math.round(parsedBid * 1_000_000);
      const res = await fetch(
        apiUrl(`/api/admin/google-ads/keyword/${adGroupId}`),
        {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );
      if (!res.ok) {
        const txt = await res.text();
        setError(`Error ${res.status}: ${txt.slice(0, 200)}`);
        return;
      }
      onSaved();
    } catch (e: any) {
      setError(String(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div onClick={onClose} className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-sm bg-card border border-border rounded-xl shadow-xl flex flex-col">
        <div className="px-4 py-3 border-b border-border flex items-center justify-between shrink-0">
          <h3 className="text-sm font-semibold text-foreground">Add keyword</h3>
          <button type="button" onClick={onClose} className="h-7 w-7 inline-flex items-center justify-center bg-secondary rounded-md text-muted-foreground hover:text-foreground shrink-0">
            <XIcon className="w-3.5 h-3.5" />
          </button>
        </div>
        <form
          onSubmit={(e) => { e.preventDefault(); void save(); }}
          className="p-4 space-y-3"
        >
          <FormLabel label="Keyword">
            <input
              type="text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="e.g. qr menu ristorante"
              autoFocus
              className="w-full h-9 px-3 rounded-md bg-secondary border border-border text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </FormLabel>
          <FormLabel label="Match type">
            <div className="inline-flex items-center bg-secondary rounded-md p-0.5 gap-0.5">
              {(["EXACT", "PHRASE", "BROAD"] as const).map((mt) => (
                <button
                  key={mt}
                  type="button"
                  onClick={() => setMatchType(mt)}
                  className={"h-8 px-3 rounded text-[11px] font-semibold uppercase tracking-wider transition-colors inline-flex items-center justify-center " + (matchType === mt ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}
                >
                  {mt}
                </button>
              ))}
            </div>
          </FormLabel>
          {!negative ? (
            <FormLabel label="CPC bid (€) — optional">
              <input
                type="text"
                inputMode="decimal"
                value={bidStr}
                onChange={(e) => setBidStr(e.target.value.replace(/[^0-9.,]/g, ""))}
                placeholder="0.25"
                className="w-full h-9 px-3 rounded-md bg-secondary border border-border text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary tabular-nums"
              />
              {bidStr && !bidValid ? (
                <div className="text-[10px] text-amber-500 mt-1">Invalid number</div>
              ) : null}
            </FormLabel>
          ) : null}
          <FormLabel label="Polarity">
            <div className="inline-flex items-center bg-secondary rounded-md p-0.5 gap-0.5">
              {([
                { value: false, label: "POSITIVE" },
                { value: true, label: "NEGATIVE" },
              ] as const).map((p) => {
                const active = negative === p.value;
                const activeColor = p.value
                  ? "bg-red-500 text-white"
                  : "bg-primary text-primary-foreground";
                return (
                  <button
                    key={p.label}
                    type="button"
                    onClick={() => setNegative(p.value)}
                    className={"h-8 px-3 rounded text-[11px] font-semibold uppercase tracking-wider transition-colors inline-flex items-center justify-center " + (active ? activeColor : "text-muted-foreground hover:text-foreground")}
                  >
                    {p.label}
                  </button>
                );
              })}
            </div>
          </FormLabel>
          {error ? <div className="text-[11px] text-red-500 break-all">{error}</div> : null}
          <div className="flex items-center justify-end pt-1">
            <button
              type="submit"
              disabled={!canSave}
              className="h-9 px-4 rounded-md bg-primary text-primary-foreground text-xs font-medium uppercase tracking-wider disabled:opacity-50 hover:opacity-90 transition-opacity"
            >
              {saving ? "Saving…" : "Save"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function parseBid(s: string): number | null {
  const trimmed = s.trim();
  if (!trimmed) return null;
  // Allow only digits, dots, commas
  if (!/^[0-9.,]+$/.test(trimmed)) return null;
  // Normalize: replace commas with dots
  const normalized = trimmed.replace(/,/g, ".");
  // Must have at most one dot
  const dotCount = (normalized.match(/\./g) ?? []).length;
  if (dotCount > 1) return null;
  const n = Number(normalized);
  if (!Number.isFinite(n)) return null;
  return n;
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
