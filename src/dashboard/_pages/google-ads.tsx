"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ChevronRight,
  Eye,
  MousePointerClick,
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
  Pencil,
  Plus,
  Trash2,
  Calendar,
  UserPlus,
  ShoppingCart,
} from "lucide-react";
import { apiUrl } from "@/lib/api";
import { Select, SubpageStickyBar } from "../_v2/ui";
import { useDashboardRouter } from "../_spa/router";
import { useScrollLock } from "../_v2/use-scroll-lock";

type Status = "ENABLED" | "PAUSED";
type DateRange = "today" | "yesterday" | "last7days" | "last30days";

interface CampaignRow {
  id: string;
  name: string;
  status: Status;
  budget?: number;
  budgetShared?: boolean;
  impressions: number;
  clicks: number;
  conversions: number;
  convT2: number;
  convT3: number;
  cost: number;
}

interface AdGroupRow {
  id: string;
  name: string;
  status: Status;
  campaignId: string;
  suffix?: string;
  defaultBid?: number;
  impressions: number;
  clicks: number;
  conversions: number;
  convT2: number;
  convT3: number;
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
  convT2: number;
  convT3: number;
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
  convT2: number;
  convT3: number;
  cost: number;
}

interface CampaignTargeting {
  geos: Array<{ name: string; code: string | null }>;
  languages: Array<{ name: string; code: string | null }>;
}

interface SitelinkAsset {
  assetId: string;
  text: string;
  desc1?: string;
  desc2?: string;
  url: string;
}

interface CalloutAsset {
  assetId: string;
  text: string;
}

interface SnippetAsset {
  assetId: string;
  header: string;
  values: string[];
}

interface ImageAsset {
  assetId: string;
  fieldType: string;
  url?: string;
  width?: number;
  height?: number;
}

interface StrategyMeta {
  key: string;
  name: string;
  type: string;
  status: string | null;
  isPortfolio: boolean;
  targetCpaMicros?: number | null;
  cpcBidCeilingMicros?: number | null;
}

interface StrategyBidEditRequest {
  strategyId: string;
  name: string;
  targetCpaMicros: number | null;
  cpcBidCeilingMicros: number | null;
}

interface AllData {
  campaigns: CampaignRow[];
  adGroups: AdGroupRow[];
  ads: AdRow[];
  keywords: KeywordRow[];
  negatives: NegativeRow[];
  timeline: TimelineBucket[];
  campaignStrategies?: Record<string, StrategyMeta>;
  campaignAssets: Record<string, CampAssets>;
  campaignTargeting: Record<string, CampaignTargeting>;
  searchTermsByAdGroup: Record<string, SearchTerm[]>;
  adGroupSitelinks?: Record<string, SitelinkAsset[]>;
  adGroupCallouts?: Record<string, CalloutAsset[]>;
  adGroupSnippets?: Record<string, SnippetAsset[]>;
  adGroupImages?: Record<string, ImageAsset[]>;
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
  convT2?: number;
  convT3?: number;
  cost: number;
}

type DetailRequest =
  | { kind: "campaign"; id: string }
  | { kind: "ad_group"; id: string }
  | { kind: "ad"; adGroupId: string; adId: string }
  | { kind: "negative"; scope: "campaign" | "ad_group"; id: string; campaignId?: string; adGroupId?: string };

type HeadlinePin = "HEADLINE_1" | "HEADLINE_2" | "HEADLINE_3";
type DescriptionPin = "DESCRIPTION_1" | "DESCRIPTION_2";

interface AdFormState {
  finalUrl: string;
  path1?: string;
  path2?: string;
  headlines: Array<{ text: string; pin?: HeadlinePin }>;
  descriptions: Array<{ text: string; pin?: DescriptionPin }>;
}

type AdGroupFormReq =
  | { mode: "create"; campaignId: string }
  | {
      mode: "edit";
      adGroupId: string;
      campaignId: string;
      current: { name: string; status: Status; defaultBid?: number; suffix?: string };
      currentAd?: AdFormState;
    };

const DATE_OPTIONS: Array<{ value: DateRange; label: string }> = [
  { value: "today", label: "Today" },
  { value: "yesterday", label: "Yesterday" },
  { value: "last7days", label: "Last 7 days" },
  { value: "last30days", label: "Last 30 days" },
];
const DATE_LABEL: Record<DateRange, string> = {
  today: "Today",
  yesterday: "Yesterday",
  last7days: "Last 7 days",
  last30days: "Last 30 days",
};
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


// Merge a scoped /all response into the previously-loaded payload so
// the dashboard can drill into a campaign or ad group without losing
// data already on screen. Lists are replaced per-scope (e.g. ad groups
// of the same campaignId get swapped); maps merge by key.
function mergeScoped(prev: AllData | null, incoming: AllData, view: View): AllData {
  if (!prev) return incoming;
  if (view.kind === "campaigns") {
    // Replace top-level lists and merge maps. Keep deeper drill-down
    // data in case the user navigates back into it without a fresh
    // fetch.
    return {
      ...prev,
      campaigns: incoming.campaigns ?? prev.campaigns,
      timeline: incoming.timeline ?? prev.timeline,
      campaignStrategies: { ...prev.campaignStrategies, ...incoming.campaignStrategies },
      campaignTargeting: { ...prev.campaignTargeting, ...incoming.campaignTargeting },
    };
  }
  if (view.kind === "campaign") {
    const cid = view.campaignId;
    return {
      ...prev,
      campaigns: incoming.campaigns ?? prev.campaigns,
      timeline: incoming.timeline ?? prev.timeline,
      campaignStrategies: { ...prev.campaignStrategies, ...incoming.campaignStrategies },
      campaignTargeting: { ...prev.campaignTargeting, ...incoming.campaignTargeting },
      campaignAssets: { ...prev.campaignAssets, ...incoming.campaignAssets },
      adGroups: [
        ...prev.adGroups.filter((a) => a.campaignId !== cid),
        ...incoming.adGroups,
      ],
      ads: [
        ...prev.ads.filter((a) => a.campaignId !== cid),
        ...incoming.ads,
      ],
      negatives: [
        ...prev.negatives.filter((n) => n.campaignId !== cid),
        ...incoming.negatives,
      ],
    };
  }
  if (view.kind === "ad_group_detail" || view.kind === "keyword_search_terms") {
    const agId = view.adGroupId;
    return {
      ...prev,
      campaigns: incoming.campaigns ?? prev.campaigns,
      timeline: incoming.timeline ?? prev.timeline,
      campaignStrategies: { ...prev.campaignStrategies, ...incoming.campaignStrategies },
      campaignTargeting: { ...prev.campaignTargeting, ...incoming.campaignTargeting },
      campaignAssets: { ...prev.campaignAssets, ...incoming.campaignAssets },
      adGroups: [
        ...prev.adGroups.filter((a) => a.id !== agId),
        ...incoming.adGroups,
      ],
      keywords: [
        ...prev.keywords.filter((k) => k.adGroupId !== agId),
        ...incoming.keywords,
      ],
      ads: [
        ...prev.ads.filter((a) => a.adGroupId !== agId),
        ...incoming.ads,
      ],
      // Replace ad-group-scoped negatives for this adgroup. Campaign
      // negatives may also land here when the scoped query returns both
      // — those merge by id-segment ("ag-" vs "c-").
      negatives: [
        ...prev.negatives.filter((n) => !(n.scope === "ad_group" && n.adGroupId === agId)),
        ...incoming.negatives.filter((n) => n.scope === "ad_group"),
      ],
      searchTermsByAdGroup: { ...prev.searchTermsByAdGroup, ...incoming.searchTermsByAdGroup },
      adGroupSitelinks: { ...(prev.adGroupSitelinks ?? {}), ...(incoming.adGroupSitelinks ?? {}) },
      adGroupCallouts: { ...(prev.adGroupCallouts ?? {}), ...(incoming.adGroupCallouts ?? {}) },
      adGroupSnippets: { ...(prev.adGroupSnippets ?? {}), ...(incoming.adGroupSnippets ?? {}) },
      adGroupImages: { ...(prev.adGroupImages ?? {}), ...(incoming.adGroupImages ?? {}) },
    };
  }
  return incoming;
}

type Section = "campaigns" | "groups" | "keywords" | "search_terms";

interface FlatGroupRow {
  id: string;
  name: string;
  status: Status;
  campaignId: string;
  campaignName: string;
  suffix?: string;
  defaultBid?: number;
  impressions: number;
  clicks: number;
  conversions: number;
  cost: number;
}

interface FlatKeywordRow {
  id: string;
  critId: string;
  adGroupId: string;
  adGroupName: string;
  campaignId: string;
  campaignName: string;
  text: string;
  matchType: string;
  status: Status;
  impressions: number;
  clicks: number;
  conversions: number;
  cost: number;
  qualityScore?: number;
  bid?: number;
}

interface SearchTermFlatRow {
  searchTerm: string;
  status: string;
  matchedKeyword: string;
  matchedMatchType: string;
  adGroupId: string;
  adGroupName: string;
  campaignId: string;
  campaignName: string;
  impressions: number;
  clicks: number;
  conversions: number;
  cost: number;
}

interface FlatSectionData {
  campaigns?: CampaignRow[];
  timeline?: TimelineBucket[];
  groups?: FlatGroupRow[];
  keywords?: FlatKeywordRow[];
  searchTerms?: SearchTermFlatRow[];
}

interface AdGroupDrillData {
  adGroup: { id: string; name: string; suffix?: string; campaignId: string; campaignName: string };
  keywords: KeywordRow[];
  ads: AdRow[];
  assets?: CampAssets;
}

type DrillState =
  | null
  | { kind: "loading"; adGroupId: string }
  | { kind: "ad_group"; data: AdGroupDrillData };

interface KeywordStRequest {
  adGroupId: string;
  critId: string;
  title: string;
  loading: boolean;
  items: SearchTerm[];
}

const SECTION_OPTIONS: Array<{ value: Section; label: string }> = [
  { value: "campaigns", label: "Camp" },
  { value: "groups", label: "Grp" },
  { value: "keywords", label: "Kw" },
  { value: "search_terms", label: "ST" },
];

export function GoogleAdsPage() {
  const router = useDashboardRouter();
  const [section, setSection] = useState<Section>("keywords");
  const [filterStatus, setFilterStatus] = useState<Status>("ENABLED");
  const [filterDateRange, setFilterDateRange] = useState<DateRange>("today");

  const [flatData, setFlatData] = useState<FlatSectionData>({});
  const [initialLoading, setInitialLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [drill, setDrill] = useState<DrillState>(null);

  const [detailReq, setDetailReq] = useState<DetailRequest | null>(null);
  const [bidEditReq, setBidEditReq] = useState<{ adGroupId: string; critId: string; keyword: string; currentBid: number | null; geoResource: string | null } | null>(null);
  const [strategyBidReq, setStrategyBidReq] = useState<StrategyBidEditRequest | null>(null);
  const [qsReq, setQsReq] = useState<{ adGroupId: string; critId: string; keyword: string; matchType?: string } | null>(null);
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [addKwAdGroupId, setAddKwAdGroupId] = useState<string | null>(null);
  const [addKwFromPlanner, setAddKwFromPlanner] = useState<{ adGroupId: string; text: string } | null>(null);
  const [deleteKwReq, setDeleteKwReq] = useState<{ adGroupId: string; critId: string; keyword: string } | null>(null);
  const [adGroupFormReq, setAdGroupFormReq] = useState<AdGroupFormReq | null>(null);
  const [plannerOpen, setPlannerOpen] = useState(false);
  const plannerState = usePlannerState();
  const [kwStReq, setKwStReq] = useState<KeywordStRequest | null>(null);

  const sectionPath = (s: Section): string => {
    if (s === "campaigns") return "page-campaigns";
    if (s === "groups") return "page-groups";
    if (s === "keywords") return "page-keywords";
    return "page-search-terms";
  };

  const hasAnyData = Boolean(flatData.campaigns || flatData.groups || flatData.keywords || flatData.searchTerms);

  const load = async (mode: "initial" | "refresh") => {
    if (mode === "initial") setInitialLoading(true);
    else setRefreshing(true);
    try {
      const qs = new URLSearchParams({ dateRange: filterDateRange });
      const res = await fetch(apiUrl(`/api/admin/google-ads/${sectionPath(section)}?${qs}`), { credentials: "include" });
      if (!res.ok) return;
      const j = await res.json();
      setFlatData({
        campaigns: section === "campaigns" ? j.campaigns : undefined,
        timeline: section === "campaigns" ? j.timeline : undefined,
        groups: section === "groups" ? j.adGroups : undefined,
        keywords: section === "keywords" ? j.keywords : undefined,
        searchTerms: section === "search_terms" ? j.items : undefined,
      });
    } finally {
      setInitialLoading(false);
      setRefreshing(false);
    }
  };

  // Section/date change → reload + clear any open drill.
  useEffect(() => {
    setDrill(null);
    void load(hasAnyData ? "refresh" : "initial");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [section, filterDateRange]);

  const loadDrillAdGroup = async (adGroupId: string) => {
    setDrill({ kind: "loading", adGroupId });
    const qs = new URLSearchParams({ dateRange: filterDateRange });
    const res = await fetch(apiUrl(`/api/admin/google-ads/page-ad-group/${adGroupId}?${qs}`), { credentials: "include" });
    if (!res.ok) { setDrill(null); return; }
    const j = (await res.json()) as AdGroupDrillData;
    setDrill({ kind: "ad_group", data: j });
  };

  const refreshDrill = async () => {
    if (drill?.kind === "ad_group") await loadDrillAdGroup(drill.data.adGroup.id);
  };

  const openKeywordSearchTerms = async (adGroupId: string, critId: string, title: string) => {
    setKwStReq({ adGroupId, critId, title, loading: true, items: [] });
    const qs = new URLSearchParams({ dateRange: filterDateRange });
    const res = await fetch(apiUrl(`/api/admin/google-ads/search-terms/keyword/${adGroupId}/${critId}?${qs}`), { credentials: "include" });
    if (!res.ok) return;
    const j = await res.json();
    setKwStReq((prev) => prev ? { ...prev, loading: false, items: j.items ?? [] } : null);
  };

  function handleBack() {
    if (drill) { setDrill(null); return; }
    router.push({ name: "settings" });
  }

  const filtCampaigns = (flatData.campaigns ?? []).filter((c) => c.status === filterStatus);
  const filtGroups = (flatData.groups ?? []).filter((g) => g.status === filterStatus);
  const filtKeywords = (flatData.keywords ?? []).filter((k) => k.status === filterStatus);
  const flatSearchTerms = flatData.searchTerms ?? [];

  const sortedGroups = useMemo(() => {
    const arr = [...filtGroups];
    arr.sort((a, b) => b.impressions - a.impressions);
    return arr;
  }, [filtGroups]);

  const sortedKeywords = useMemo(() => {
    const MT_ORDER: Record<string, number> = { B: 0, P: 1, E: 2 };
    const arr = [...filtKeywords];
    arr.sort((a, b) => {
      const ai = MT_ORDER[a.matchType] ?? 99;
      const bi = MT_ORDER[b.matchType] ?? 99;
      if (ai !== bi) return ai - bi;
      return b.impressions - a.impressions;
    });
    return arr;
  }, [filtKeywords]);

  const drillAg = drill?.kind === "ad_group" ? drill.data : null;
  const drillLoading = drill?.kind === "loading";

  return (
    <div>
      <SubpageStickyBar onBack={handleBack} hideSave>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setDatePickerOpen(true)}
            className="h-8 inline-flex items-center gap-1.5 px-2 rounded-md bg-secondary text-foreground hover:bg-muted transition-colors text-[11px] font-medium"
            title="Date range"
          >
            <Calendar className="w-3.5 h-3.5" />
            <span>{DATE_LABEL[filterDateRange]}</span>
          </button>
          {!drill ? (
            <TabGroup
              options={SECTION_OPTIONS.map((s) => ({ value: s.value, label: s.label }))}
              selected={section}
              onSelect={(v) => setSection(v as Section)}
            />
          ) : null}
          <TabGroup
            options={STATUS_ORDER.map((s) => ({ value: s, label: STATUS_SHORT[s] }))}
            selected={filterStatus}
            onSelect={(v) => setFilterStatus(v as Status)}
          />
          {drillAg ? (
            <>
              <button
                type="button"
                onClick={() => setAddKwAdGroupId(drillAg.adGroup.id)}
                title="Add keyword"
                className="h-8 w-8 inline-flex items-center justify-center bg-secondary rounded-md text-muted-foreground hover:text-foreground"
              >
                <Plus className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setPlannerOpen(true)}
                title="Keyword Planner"
                className="h-8 w-8 inline-flex items-center justify-center bg-secondary rounded-md text-muted-foreground hover:text-foreground"
              >
                <BarChart3 className="h-3.5 w-3.5" />
              </button>
            </>
          ) : null}
          <button
            type="button"
            onClick={() => drill ? void refreshDrill() : void load("refresh")}
            disabled={refreshing || initialLoading || drillLoading}
            title="Refresh"
            className="h-8 w-8 inline-flex items-center justify-center bg-secondary rounded-md text-muted-foreground hover:text-foreground disabled:opacity-60"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
          </button>
        </div>
      </SubpageStickyBar>

      <div className="max-w-5xl mx-auto md:px-6 pt-5 md:pt-4 space-y-3">
        {drillAg ? (
          <>
            <div className="text-[11px] text-muted-foreground flex flex-wrap items-center gap-1">
              <button
                type="button"
                onClick={() => setDrill(null)}
                className="hover:text-foreground transition-colors"
              >
                Groups
              </button>
              <span>/</span>
              <span className="text-foreground font-medium">{drillAg.adGroup.campaignName}</span>
              <span>/</span>
              <span className="text-foreground font-medium">{drillAg.adGroup.name}</span>
            </div>
            <AdGroupDetail
              keywords={drillAg.keywords.filter((k) => k.status === filterStatus)}
              ads={drillAg.ads.filter((a) => a.status === filterStatus)}
              assets={drillAg.assets}
              onView={(req) => setDetailReq(req)}
              adGroupId={drillAg.adGroup.id}
              campaignId={drillAg.adGroup.campaignId}
              campaignIsPortfolio={false}
              onKeywordOpen={(k) => void openKeywordSearchTerms(k.adGroupId, k.id, k.title)}
              onBidEdit={(k) => setBidEditReq({
                adGroupId: k.adGroupId,
                critId: k.id,
                keyword: k.text ?? k.title,
                currentBid: k.bid ?? null,
                geoResource: null,
              })}
              onQsOpen={(k) => setQsReq({ adGroupId: k.adGroupId, critId: k.id, keyword: k.text ?? k.title, matchType: k.matchType })}
              onDeleteKeyword={(k) => setDeleteKwReq({ adGroupId: k.adGroupId, critId: k.id, keyword: k.text ?? k.title })}
              searchTerms={undefined}
              negatives={[]}
              onNegativeView={() => { /* drill mode: negatives shown elsewhere */ }}
            />
          </>
        ) : drillLoading || initialLoading ? (
          <div className="text-xs text-muted-foreground py-8 text-center">Loading…</div>
        ) : section === "campaigns" ? (
          <>
            <div className="bg-card border border-border rounded-xl overflow-hidden divide-y divide-border">
              {filtCampaigns.length === 0 ? (
                <div className="text-xs text-muted-foreground py-4 text-center">No campaigns</div>
              ) : (
                filtCampaigns.map((c) => (
                  <CampaignRow
                    key={c.id}
                    c={c}
                    onOpen={() => setDetailReq({ kind: "campaign", id: c.id })}
                    onView={() => setDetailReq({ kind: "campaign", id: c.id })}
                  />
                ))
              )}
            </div>
            {filtCampaigns.length > 0 && flatData.timeline && flatData.timeline.length > 0 ? (
              <div className="bg-card border border-border rounded-xl overflow-hidden divide-y divide-border">
                <TotalAndTimeline campaigns={filtCampaigns} timeline={flatData.timeline} />
              </div>
            ) : null}
          </>
        ) : section === "groups" ? (
          <div className="bg-card border border-border rounded-xl overflow-hidden divide-y divide-border">
            {sortedGroups.length === 0 ? (
              <div className="text-xs text-muted-foreground py-4 text-center">No groups</div>
            ) : (
              sortedGroups.map((g) => (
                <FlatGroupRowEl key={g.id} g={g} onOpen={() => void loadDrillAdGroup(g.id)} />
              ))
            )}
          </div>
        ) : section === "keywords" ? (
          <div className="bg-card border border-border rounded-xl overflow-hidden divide-y divide-border">
            {sortedKeywords.length === 0 ? (
              <div className="text-xs text-muted-foreground py-4 text-center">No keywords</div>
            ) : (
              sortedKeywords.map((k) => (
                <FlatKeywordRowEl
                  key={k.id}
                  k={k}
                  onOpen={() => void openKeywordSearchTerms(k.adGroupId, k.critId, `[${k.matchType}] "${k.text}" · ${k.adGroupName}`)}
                  onBidEdit={() => setBidEditReq({
                    adGroupId: k.adGroupId,
                    critId: k.critId,
                    keyword: k.text,
                    currentBid: k.bid ?? null,
                    geoResource: null,
                  })}
                  onQsOpen={() => setQsReq({ adGroupId: k.adGroupId, critId: k.critId, keyword: k.text, matchType: k.matchType })}
                  onDelete={() => setDeleteKwReq({ adGroupId: k.adGroupId, critId: k.critId, keyword: k.text })}
                />
              ))
            )}
          </div>
        ) : section === "search_terms" ? (
          <div className="bg-card border border-border rounded-xl overflow-hidden divide-y divide-border">
            {flatSearchTerms.length === 0 ? (
              <div className="text-xs text-muted-foreground py-4 text-center">No search terms</div>
            ) : (
              flatSearchTerms.map((st, i) => (
                <FlatSearchTermRowEl key={`${st.searchTerm}|${st.adGroupId}|${i}`} st={st} />
              ))
            )}
          </div>
        ) : null}
      </div>

      {detailReq ? <DetailModal req={detailReq} onClose={() => setDetailReq(null)} /> : null}
      {datePickerOpen ? (
        <div onClick={() => setDatePickerOpen(false)} className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div onClick={(e) => e.stopPropagation()} className="w-full max-w-xs bg-card border border-border rounded-xl shadow-xl flex flex-col">
            <div className="px-4 py-3 border-b border-border flex items-center justify-between shrink-0">
              <h3 className="text-sm font-semibold text-foreground">Date range</h3>
              <button type="button" onClick={() => setDatePickerOpen(false)} className="h-7 w-7 inline-flex items-center justify-center bg-secondary rounded-md text-muted-foreground hover:text-foreground">
                <XIcon className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="py-1">
              {DATE_OPTIONS.map((o) => {
                const selected = filterDateRange === o.value;
                return (
                  <button
                    key={o.value}
                    type="button"
                    onClick={() => { setFilterDateRange(o.value); setDatePickerOpen(false); }}
                    className={"w-full text-left px-4 py-2.5 text-sm transition-colors " + (selected ? "bg-primary/10 text-primary font-medium" : "text-foreground hover:bg-muted/40")}
                  >
                    {o.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      ) : null}
      {plannerOpen ? <PlannerModal state={plannerState} campaignId={drillAg?.adGroup.campaignId ?? null} targeting={null} adGroupId={drillAg?.adGroup.id ?? null} onAddKeyword={(text, adGroupId) => setAddKwFromPlanner({ adGroupId, text })} onClose={() => setPlannerOpen(false)} /> : null}
      {addKwFromPlanner ? (
        <AddKeywordModal
          adGroupId={addKwFromPlanner.adGroupId}
          initialText={addKwFromPlanner.text}
          onClose={() => setAddKwFromPlanner(null)}
          onSaved={() => { setAddKwFromPlanner(null); setPlannerOpen(false); if (drill) void refreshDrill(); else void load("refresh"); }}
        />
      ) : null}
      {bidEditReq ? <BidEditModal req={bidEditReq} onClose={() => setBidEditReq(null)} onSaved={() => { setBidEditReq(null); if (drill) void refreshDrill(); else void load("refresh"); }} /> : null}
      {strategyBidReq ? <StrategyBidEditModal req={strategyBidReq} onClose={() => setStrategyBidReq(null)} onSaved={() => { setStrategyBidReq(null); void load("refresh"); }} /> : null}
      {qsReq ? <KeywordQsModal req={qsReq} onClose={() => setQsReq(null)} /> : null}
      {addKwAdGroupId ? <AddKeywordModal adGroupId={addKwAdGroupId} onClose={() => setAddKwAdGroupId(null)} onSaved={() => { setAddKwAdGroupId(null); if (drill) void refreshDrill(); else void load("refresh"); }} /> : null}
      {adGroupFormReq ? (
        <AdGroupFormModal
          req={adGroupFormReq}
          sitelinks={[]}
          callouts={[]}
          snippets={[]}
          images={[]}
          onClose={() => setAdGroupFormReq(null)}
          onSaved={() => { setAdGroupFormReq(null); if (drill) void refreshDrill(); else void load("refresh"); }}
          onRefresh={() => { if (drill) void refreshDrill(); else void load("refresh"); }}
        />
      ) : null}
      {deleteKwReq ? <DeleteKeywordModal req={deleteKwReq} onClose={() => setDeleteKwReq(null)} onDeleted={() => { setDeleteKwReq(null); if (drill) void refreshDrill(); else void load("refresh"); }} /> : null}
      {kwStReq ? (
        <div onClick={() => setKwStReq(null)} className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div onClick={(e) => e.stopPropagation()} className="w-full max-w-2xl max-h-[85vh] overflow-auto bg-card border border-border rounded-xl shadow-xl">
            <div className="px-4 py-3 border-b border-border flex items-center justify-between sticky top-0 bg-card z-10">
              <h3 className="text-sm font-semibold text-foreground truncate pr-2">Search terms · {kwStReq.title}</h3>
              <button type="button" onClick={() => setKwStReq(null)} className="h-7 w-7 inline-flex items-center justify-center bg-secondary rounded-md text-muted-foreground hover:text-foreground shrink-0">
                <XIcon className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="p-3">
              <SearchTermsList items={kwStReq.items} loading={kwStReq.loading} header="" />
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function FlatGroupRowEl({ g, onOpen }: { g: FlatGroupRow; onOpen: () => void }) {
  return (
    <div onClick={onOpen} role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") onOpen(); }} className="px-3 py-2 space-y-1.5 hover:bg-muted/40 transition-colors cursor-pointer">
      <div className="flex items-center gap-1.5 min-w-0">
        <TitleTag text={g.name} color={TAG_COLOR.ad_group} paused={g.status === "PAUSED"} />
        <span className="ml-auto" />
        <span className={"shrink-0 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium " + TAG_COLOR.campaign}>{g.campaignName}</span>
      </div>
      <div className="flex items-center gap-1.5 flex-wrap min-w-0">
        <MetricPill icon={<Eye className="w-3 h-3" />} value={g.impressions} label="impressions" width="wide" />
        <MetricPill icon={<MousePointerClick className="w-3 h-3" />} value={g.clicks} label="clicks" width="narrow" />
        <MetricPill icon={<Gauge className="w-3 h-3" />} value={g.conversions} label="conversions" width="narrow" highlight={g.conversions > 0} />
        <MetricPill icon={<Euro className="w-3 h-3" />} value={g.cost.toFixed(2)} label="cost €" />
        {g.defaultBid != null ? (
          <span className="shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium uppercase tracking-wider bg-sky-500/10 text-sky-500 tabular-nums">
            <Coins className="w-3 h-3" />
            {g.defaultBid.toFixed(2)}
          </span>
        ) : null}
      </div>
    </div>
  );
}

function FlatKeywordRowEl({ k, onOpen, onBidEdit, onQsOpen, onDelete }: {
  k: FlatKeywordRow;
  onOpen: () => void;
  onBidEdit: () => void;
  onQsOpen: () => void;
  onDelete: () => void;
}) {
  const mtClass = k.matchType === "E" ? "bg-red-500/15 text-red-500"
    : k.matchType === "P" ? "bg-amber-500/15 text-amber-500"
    : k.matchType === "B" ? "bg-blue-500/15 text-blue-500"
    : "bg-secondary text-foreground";
  return (
    <div onClick={onOpen} role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") onOpen(); }} className="px-3 py-2 space-y-1.5 hover:bg-muted/40 transition-colors cursor-pointer">
      <div className="flex items-center gap-1.5 min-w-0">
        <span className={"shrink-0 inline-flex items-center px-2 py-0.5 rounded text-[10px] font-mono font-semibold uppercase tracking-wider " + mtClass}>{k.matchType}</span>
        <TitleTag text={k.text} color={TAG_COLOR.keyword} paused={k.status === "PAUSED"} />
        <span className="ml-auto" />
        <CopyTag value={k.text} />
        <DeleteTag onClick={(e) => { e.stopPropagation(); onDelete(); }} />
      </div>
      <div className="flex items-center gap-1.5 flex-wrap min-w-0">
        <span className={"shrink-0 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium " + TAG_COLOR.campaign}>{k.campaignName}</span>
        <span className={"shrink-0 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium " + TAG_COLOR.ad_group}>{k.adGroupName}</span>
      </div>
      <div className="flex items-center gap-1.5 flex-wrap min-w-0">
        <MetricPill icon={<Eye className="w-3 h-3" />} value={k.impressions} label="impressions" width="wide" />
        <MetricPill icon={<MousePointerClick className="w-3 h-3" />} value={k.clicks} label="clicks" width="narrow" />
        <MetricPill icon={<Gauge className="w-3 h-3" />} value={k.conversions} label="conversions" width="narrow" highlight={k.conversions > 0} />
        <MetricPill icon={<Euro className="w-3 h-3" />} value={k.cost.toFixed(2)} label="cost €" />
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onQsOpen(); }}
          title="Open QS breakdown"
          className="shrink-0 inline-flex items-center justify-center py-0.5 px-1 w-[36px] gap-0.5 overflow-hidden rounded text-[10px] font-medium uppercase tracking-wider tabular-nums bg-muted text-muted-foreground hover:bg-muted/70 transition-colors cursor-pointer"
        >
          <Gauge className="w-3 h-3" />
          {k.qualityScore ?? "—"}
        </button>
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onBidEdit(); }}
          title="Edit bid"
          className="shrink-0 inline-flex items-center justify-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium uppercase tracking-wider bg-sky-500/10 text-sky-500 hover:bg-sky-500/20 transition-colors cursor-pointer tabular-nums min-w-[64px]"
        >
          <Coins className="w-3 h-3" />
          {k.bid != null ? k.bid.toFixed(2) : "—"}
        </button>
      </div>
    </div>
  );
}

function FlatSearchTermRowEl({ st }: { st: SearchTermFlatRow }) {
  const statusCls = searchTermStatusClass(st.status);
  return (
    <div className="px-3 py-2 space-y-1.5">
      <div className="flex items-center gap-1.5 min-w-0">
        <TitleTag text={st.searchTerm} color="bg-emerald-500/10 text-emerald-500" paused={false} />
        <span className="ml-auto" />
        <span className={"shrink-0 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium uppercase tracking-wider " + statusCls}>{st.status}</span>
      </div>
      <div className="flex items-center gap-1.5 flex-wrap min-w-0">
        <span className={"shrink-0 inline-flex items-center px-2 py-0.5 rounded text-[10px] font-mono font-semibold uppercase tracking-wider " + (st.matchedMatchType === "E" ? "bg-red-500/15 text-red-500" : st.matchedMatchType === "P" ? "bg-amber-500/15 text-amber-500" : "bg-blue-500/15 text-blue-500")}>{st.matchedMatchType}</span>
        <span className="text-[11px] text-muted-foreground truncate">"{st.matchedKeyword}"</span>
        <span className={"shrink-0 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium " + TAG_COLOR.campaign}>{st.campaignName}</span>
        <span className={"shrink-0 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium " + TAG_COLOR.ad_group}>{st.adGroupName}</span>
      </div>
      <div className="flex items-center gap-1.5 flex-wrap min-w-0">
        <MetricPill icon={<Eye className="w-3 h-3" />} value={st.impressions} label="impressions" width="wide" />
        <MetricPill icon={<MousePointerClick className="w-3 h-3" />} value={st.clicks} label="clicks" width="narrow" />
        <MetricPill icon={<Gauge className="w-3 h-3" />} value={st.conversions} label="conversions" width="narrow" highlight={st.conversions > 0} />
        <MetricPill icon={<Euro className="w-3 h-3" />} value={st.cost.toFixed(2)} label="cost €" />
      </div>
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
        <MetricPill icon={<Eye className="w-3 h-3" />} value={c.impressions} label="impressions" width="wide" />
        <MetricPill icon={<MousePointerClick className="w-3 h-3" />} value={c.clicks} label="clicks" width="narrow" />
        <MetricPill icon={<UserPlus className="w-3 h-3" />} value={c.convT2} label="T2 registrations" highlight={Number(c.convT2) > 0} width="narrow" />
        <MetricPill icon={<ShoppingCart className="w-3 h-3" />} value={c.convT3} label="T3 purchases" highlight={Number(c.convT3) > 0} width="narrow" />
        <MetricPill icon={<Euro className="w-3 h-3" />} value={c.cost.toFixed(2)} label="cost €" />
      </div>
    </div>
  );
}

function AdGroupRowEl({ a, onOpen, onEdit }: { a: AdGroupRow; onOpen: () => void; onEdit: () => void }) {
  return (
    <div onClick={onOpen} role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") onOpen(); }} className="px-3 py-2 space-y-1.5 hover:bg-muted/40 transition-colors cursor-pointer">
      <div className="flex items-center gap-1.5 min-w-0">
        <TitleTag text={a.name} color={TAG_COLOR.ad_group} paused={a.status === "PAUSED"} />
        <span className="ml-auto" />
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onEdit(); }}
          title="Edit"
          className="shrink-0 inline-flex items-center justify-center h-5 w-6 rounded text-[10px] bg-secondary text-muted-foreground hover:bg-muted hover:text-foreground transition-colors cursor-pointer"
        >
          <Pencil className="w-3 h-3" />
        </button>
      </div>
      <div className="flex items-center gap-1.5 flex-wrap min-w-0">
        <MetricPill icon={<Eye className="w-3 h-3" />} value={a.impressions} label="impressions" width="wide" />
        <MetricPill icon={<MousePointerClick className="w-3 h-3" />} value={a.clicks} label="clicks" width="narrow" />
        <MetricPill icon={<UserPlus className="w-3 h-3" />} value={a.convT2} label="T2 registrations" highlight={Number(a.convT2) > 0} width="narrow" />
        <MetricPill icon={<ShoppingCart className="w-3 h-3" />} value={a.convT3} label="T3 purchases" highlight={Number(a.convT3) > 0} width="narrow" />
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

// ──────────────────────────────────────────────────────────────────────────
// Keyword CPC chips — fetches top-of-page bid range from Google Ads
// Keyword Planner for every keyword in the currently-open ad group.
// Scoped to the campaign's geo targeting + first language. No cache: a
// fresh request fires on every ad group open. Quota cost is well under
// 1% of the Basic-access daily limit at current usage so the simpler
// always-fresh model wins.
// ──────────────────────────────────────────────────────────────────────────

interface CpcRange { lowMicros: number; highMicros: number }

// CPC chip resolution: use the campaign's first targeted country and skip
// language entirely. Google's planner returns near-identical CPC/volume
// data across language filters for Latin keywords, and filtering by the
// local country language (Greek for GR, Italian for IT, …) consistently
// suppresses results for English-led campaigns. Single-country, no
// language = densest, most consistent data.
function geoResourcesFor(t: CampaignTargeting | null): string[] {
  if (!t) return [];
  for (const g of t.geos) {
    const code = (g.code ?? "").toUpperCase();
    const match = GEO_OPTIONS.find((o) => o.code === code);
    if (match) return [match.resource];
  }
  return [];
}

function AdGroupDetail({
  keywords,
  ads,
  onView,
  adGroupId,
  onKeywordOpen,
  onBidEdit,
  campaignIsPortfolio,
  onQsOpen,
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
  /** When the parent campaign uses a portfolio bid strategy, the
   *  keyword-level CPC bid has no effect — the portfolio overrides it.
   *  We hide the inline bid edit pill so visitors don't twiddle a knob
   *  that does nothing. */
  campaignIsPortfolio: boolean;
  onKeywordOpen: (k: KeywordRow) => void;
  onBidEdit: (k: KeywordRow) => void;
  onQsOpen: (k: KeywordRow) => void;
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
                  <MetricPill icon={<Eye className="w-3 h-3" />} value={k.impressions} label="impressions" width="wide" />
                  <MetricPill icon={<MousePointerClick className="w-3 h-3" />} value={k.clicks} label="clicks" width="narrow" />
                  <MetricPill icon={<UserPlus className="w-3 h-3" />} value={k.convT2} label="T2 registrations" highlight={Number(k.convT2) > 0} width="narrow" />
                  <MetricPill icon={<ShoppingCart className="w-3 h-3" />} value={k.convT3} label="T3 purchases" highlight={Number(k.convT3) > 0} width="narrow" />
                  <MetricPill icon={<Euro className="w-3 h-3" />} value={k.cost.toFixed(2)} label="cost €" />
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); onQsOpen(k); }}
                    title="Open QS breakdown"
                    className="shrink-0 inline-flex items-center justify-center py-0.5 px-1 w-[36px] gap-0.5 overflow-hidden rounded text-[10px] font-medium uppercase tracking-wider tabular-nums bg-muted text-muted-foreground hover:bg-muted/70 transition-colors cursor-pointer"
                  >
                    <Gauge className="w-3 h-3" />
                    {k.qualityScore ?? "—"}
                  </button>
                  {campaignIsPortfolio ? null : (
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); onBidEdit(k); }}
                      title="Edit bid"
                      className="shrink-0 inline-flex items-center justify-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium uppercase tracking-wider bg-sky-500/10 text-sky-500 hover:bg-sky-500/20 transition-colors cursor-pointer tabular-nums min-w-[64px]"
                    >
                      <Coins className="w-3 h-3" />
                      {k.bid != null ? k.bid.toFixed(2) : "—"}
                    </button>
                  )}
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
              <MetricPill icon={<Eye className="w-3 h-3" />} value={st.impressions} label="impressions" width="wide" />
              <MetricPill icon={<MousePointerClick className="w-3 h-3" />} value={st.clicks} label="clicks" width="narrow" />
              <MetricPill icon={<UserPlus className="w-3 h-3" />} value={st.convT2 ?? 0} label="T2 registrations" highlight={Number(st.convT2 ?? 0) > 0} width="narrow" />
              <MetricPill icon={<ShoppingCart className="w-3 h-3" />} value={st.convT3 ?? 0} label="T3 purchases" highlight={Number(st.convT3 ?? 0) > 0} width="narrow" />
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
      convT2: acc.convT2 + (e.convT2 ?? 0),
      convT3: acc.convT3 + (e.convT3 ?? 0),
      cost: acc.cost + e.cost,
    }),
    { impressions: 0, clicks: 0, conversions: 0, convT2: 0, convT3: 0, cost: 0 },
  );
  return (
    <>
      <div className="px-3 py-2 flex items-center gap-1.5 flex-wrap min-w-0">
        <span className="shrink-0 inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium uppercase tracking-wider bg-emerald-500/10 text-emerald-500">
          Total
        </span>
        <MetricPill icon={<Eye className="w-3 h-3" />} value={total.impressions} label="impressions" width="wide" />
        <MetricPill icon={<MousePointerClick className="w-3 h-3" />} value={total.clicks} label="clicks" width="narrow" />
        <MetricPill icon={<UserPlus className="w-3 h-3" />} value={total.convT2} label="T2 registrations" highlight={Number(total.convT2) > 0} width="narrow" />
        <MetricPill icon={<ShoppingCart className="w-3 h-3" />} value={total.convT3} label="T3 purchases" highlight={Number(total.convT3) > 0} width="narrow" />
        <MetricPill icon={<Euro className="w-3 h-3" />} value={total.cost.toFixed(2)} label="cost €" />
      </div>
      {timeline.map((b) => (
        <div key={b.time} className="px-3 py-2 flex items-center gap-1.5 flex-wrap min-w-0">
          <span className="shrink-0 inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium uppercase tracking-wider bg-purple-500/10 text-purple-500 tabular-nums">
            {formatTimeTag(b.time)}
          </span>
          <MetricPill icon={<Eye className="w-3 h-3" />} value={b.impressions} label="impressions" width="wide" />
          <MetricPill icon={<MousePointerClick className="w-3 h-3" />} value={b.clicks} label="clicks" width="narrow" />
          <MetricPill icon={<UserPlus className="w-3 h-3" />} value={b.convT2} label="T2 registrations" highlight={Number(b.convT2) > 0} width="narrow" />
          <MetricPill icon={<ShoppingCart className="w-3 h-3" />} value={b.convT3} label="T3 purchases" highlight={Number(b.convT3) > 0} width="narrow" />
          <MetricPill icon={<Euro className="w-3 h-3" />} value={b.cost.toFixed(2)} label="cost €" />
        </div>
      ))}
    </>
  );
}

// Aggregate metrics per bid strategy from the *filtered* campaign list
// — so when the top-level status filter flips ENABLED ↔ PAUSED the
// strategy totals follow. Campaign → strategy mapping comes from the
// API (campaignStrategies); the metrics themselves come from the
// already-filtered CampaignRow array, which keeps everything in sync.
function StrategiesSummary({
  campaigns,
  campaignStrategies,
  onEditBids,
}: {
  campaigns: CampaignRow[];
  campaignStrategies: Record<string, StrategyMeta>;
  onEditBids: (req: StrategyBidEditRequest) => void;
}) {
  type Row = StrategyMeta & {
    impressions: number;
    clicks: number;
    conversions: number;
    cost: number;
    campaignCount: number;
  };
  const byKey = new Map<string, Row>();
  for (const c of campaigns) {
    const meta = campaignStrategies[c.id];
    if (!meta) continue;
    const cur = byKey.get(meta.key) ?? {
      ...meta,
      impressions: 0,
      clicks: 0,
      conversions: 0,
      cost: 0,
      campaignCount: 0,
    };
    cur.impressions += c.impressions;
    cur.clicks += c.clicks;
    cur.conversions += c.conversions;
    cur.cost += c.cost;
    cur.campaignCount += 1;
    byKey.set(meta.key, cur);
  }
  const rows = Array.from(byKey.values()).sort((a, b) => b.cost - a.cost);
  if (rows.length === 0) return null;
  return (
    <>
      {rows.map((s) => {
        const cpa = s.conversions > 0 ? (s.cost / s.conversions).toFixed(2) : "—";
        const tagClass = s.isPortfolio
          ? "bg-amber-500/10 text-amber-500"
          : "bg-muted text-muted-foreground";
        const statusBadge = s.status && s.status !== "ENABLED" ? ` · ${s.status}` : "";
        const subtype = s.isPortfolio ? "portfolio" : "inline";
        // Only portfolio TARGET_CPA strategies expose editable tCPA +
        // Max-CPC pills; inline / other strategy types don't have these
        // fields server-side.
        const editable = s.isPortfolio && s.type === "TARGET_CPA";
        const strategyId = s.isPortfolio ? s.key.split("/").pop() ?? "" : "";
        const tcpaEur = s.targetCpaMicros != null ? (s.targetCpaMicros / 1_000_000).toFixed(2) : "—";
        const capEur = s.cpcBidCeilingMicros != null ? (s.cpcBidCeilingMicros / 1_000_000).toFixed(2) : "—";
        const openEditor = () => {
          if (!editable || !strategyId) return;
          onEditBids({
            strategyId,
            name: s.name,
            targetCpaMicros: s.targetCpaMicros ?? null,
            cpcBidCeilingMicros: s.cpcBidCeilingMicros ?? null,
          });
        };
        return (
          <div key={s.key} className="px-3 py-2 flex items-center gap-1.5 flex-wrap min-w-0">
            <span
              className={`shrink-0 inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium uppercase tracking-wider ${tagClass}`}
              title={`${s.type}${statusBadge} · ${subtype} · ${s.campaignCount} campaign(s)`}
            >
              {s.name}
            </span>
            <MetricPill icon={<Eye className="w-3 h-3" />} value={s.impressions} label="impressions" width="wide" />
            <MetricPill icon={<MousePointerClick className="w-3 h-3" />} value={s.clicks} label="clicks" width="narrow" />
            <MetricPill icon={<UserPlus className="w-3 h-3" />} value={s.conversions} label="conversions" highlight={s.conversions > 0} width="narrow" />
            <MetricPill icon={<Euro className="w-3 h-3" />} value={s.cost.toFixed(2)} label="cost €" />
            <MetricPill icon={<Coins className="w-3 h-3" />} value={cpa} label="CPA €" />
            {editable ? (
              <>
                <button
                  type="button"
                  onClick={openEditor}
                  title="Edit target CPA"
                  className="shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium uppercase tracking-wider bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20 transition-colors cursor-pointer tabular-nums min-w-[72px]"
                >
                  <Coins className="w-3 h-3" />
                  tCPA {tcpaEur}
                </button>
                <button
                  type="button"
                  onClick={openEditor}
                  title="Edit Max CPC bid ceiling"
                  className="shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium uppercase tracking-wider bg-sky-500/10 text-sky-500 hover:bg-sky-500/20 transition-colors cursor-pointer tabular-nums min-w-[72px]"
                >
                  <Coins className="w-3 h-3" />
                  Max {capEur}
                </button>
              </>
            ) : null}
          </div>
        );
      })}
    </>
  );
}

function StrategyBidEditModal({
  req,
  onClose,
  onSaved,
}: {
  req: StrategyBidEditRequest;
  onClose: () => void;
  onSaved: () => void;
}) {
  useScrollLock(true);
  const [tcpaInput, setTcpaInput] = useState(req.targetCpaMicros != null ? (req.targetCpaMicros / 1_000_000).toFixed(2) : "");
  const [capInput, setCapInput] = useState(req.cpcBidCeilingMicros != null ? (req.cpcBidCeilingMicros / 1_000_000).toFixed(2) : "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const tcpa = parseBid(tcpaInput);
  const cap = parseBid(capInput);
  // Allow either field on its own — leave blank to keep current value.
  // The button enables only when at least one value is positive AND
  // both touched fields are positive (no zero/negative numbers).
  const tcpaTouched = tcpaInput.trim() !== "";
  const capTouched = capInput.trim() !== "";
  const tcpaValid = !tcpaTouched || (tcpa != null && tcpa > 0);
  const capValid = !capTouched || (cap != null && cap > 0);
  const canSave = (tcpaTouched || capTouched) && tcpaValid && capValid && !saving;

  async function save() {
    if (!canSave) return;
    setSaving(true);
    setError(null);
    try {
      const body: { targetCpaMicros?: number; cpcBidCeilingMicros?: number } = {};
      if (tcpaTouched && tcpa != null) body.targetCpaMicros = Math.round(tcpa * 1_000_000);
      if (capTouched && cap != null) body.cpcBidCeilingMicros = Math.round(cap * 1_000_000);
      const res = await fetch(
        apiUrl(`/api/admin/google-ads/strategy/${req.strategyId}/bid`),
        {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
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
          <h3 className="text-sm font-semibold text-foreground truncate" title={req.name}>
            Edit strategy — {req.name}
          </h3>
          <button type="button" onClick={onClose} className="h-7 w-7 inline-flex items-center justify-center bg-secondary rounded-md text-muted-foreground hover:text-foreground shrink-0">
            <XIcon className="w-3.5 h-3.5" />
          </button>
        </div>
        <form
          onSubmit={(e) => { e.preventDefault(); void save(); }}
          className="p-4 space-y-3"
        >
          <FormLabel label="Target CPA (€)">
            <input
              type="text"
              inputMode="decimal"
              value={tcpaInput}
              onChange={(e) => setTcpaInput(e.target.value.replace(/[^0-9.,]/g, ""))}
              placeholder="25.00"
              autoFocus
              className="w-full h-9 px-3 rounded-md bg-secondary border border-border text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary tabular-nums"
            />
          </FormLabel>
          <FormLabel label="Max CPC bid ceiling (€)">
            <input
              type="text"
              inputMode="decimal"
              value={capInput}
              onChange={(e) => setCapInput(e.target.value.replace(/[^0-9.,]/g, ""))}
              placeholder="2.20"
              className="w-full h-9 px-3 rounded-md bg-secondary border border-border text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary tabular-nums"
            />
          </FormLabel>
          {error ? <div className="text-xs text-red-500">{error}</div> : null}
          <button
            type="submit"
            disabled={!canSave}
            className="w-full h-9 px-4 rounded-md bg-primary-gradient text-primary-foreground text-xs font-medium uppercase tracking-wider disabled:opacity-50 hover:opacity-90 transition-opacity"
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </form>
      </div>
    </div>
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

function MetricPill({ icon, value, label, highlight, width = "default" }: { icon: React.ReactNode; value: number | string; label: string; highlight?: boolean; width?: "narrow" | "wide" | "default" }) {
  const cls = highlight
    ? "bg-emerald-500/10 text-emerald-500"
    : "bg-muted text-muted-foreground";
  const size = width === "narrow"
    ? "px-1 w-[36px] gap-0.5 overflow-hidden"
    : width === "wide"
    ? "px-1 w-[54px] gap-0.5 overflow-hidden"
    : "px-2 min-w-[64px] gap-1";
  return (
    <span
      className={"shrink-0 inline-flex items-center justify-center py-0.5 rounded text-[10px] font-medium uppercase tracking-wider tabular-nums " + size + " " + cls}
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
          className={"h-7 min-w-7 px-2 rounded text-[11px] font-medium uppercase tracking-wider tabular-nums transition-colors inline-flex items-center justify-center " + (selected === o.value ? "bg-primary-gradient text-primary-foreground" : "text-muted-foreground hover:text-foreground")}
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
  // Non-EU first
  { label: "USA", code: "US", resource: "geoTargetConstants/2840" },
  { label: "United Kingdom", code: "GB", resource: "geoTargetConstants/2826" },
  // EU-27 + EFTA (matches the EU EN campaign targeting set)
  { label: "Austria", code: "AT", resource: "geoTargetConstants/2040" },
  { label: "Belgium", code: "BE", resource: "geoTargetConstants/2056" },
  { label: "Bulgaria", code: "BG", resource: "geoTargetConstants/2100" },
  { label: "Croatia", code: "HR", resource: "geoTargetConstants/2191" },
  { label: "Cyprus", code: "CY", resource: "geoTargetConstants/2196" },
  { label: "Czechia", code: "CZ", resource: "geoTargetConstants/2203" },
  { label: "Denmark", code: "DK", resource: "geoTargetConstants/2208" },
  { label: "Estonia", code: "EE", resource: "geoTargetConstants/2233" },
  { label: "Finland", code: "FI", resource: "geoTargetConstants/2246" },
  { label: "France", code: "FR", resource: "geoTargetConstants/2250" },
  { label: "Germany", code: "DE", resource: "geoTargetConstants/2276" },
  { label: "Greece", code: "GR", resource: "geoTargetConstants/2300" },
  { label: "Hungary", code: "HU", resource: "geoTargetConstants/2348" },
  { label: "Iceland", code: "IS", resource: "geoTargetConstants/2352" },
  { label: "Ireland", code: "IE", resource: "geoTargetConstants/2372" },
  { label: "Italy", code: "IT", resource: "geoTargetConstants/2380" },
  { label: "Latvia", code: "LV", resource: "geoTargetConstants/2428" },
  { label: "Liechtenstein", code: "LI", resource: "geoTargetConstants/2438" },
  { label: "Lithuania", code: "LT", resource: "geoTargetConstants/2440" },
  { label: "Luxembourg", code: "LU", resource: "geoTargetConstants/2442" },
  { label: "Malta", code: "MT", resource: "geoTargetConstants/2470" },
  { label: "Netherlands", code: "NL", resource: "geoTargetConstants/2528" },
  { label: "Norway", code: "NO", resource: "geoTargetConstants/2578" },
  { label: "Poland", code: "PL", resource: "geoTargetConstants/2616" },
  { label: "Portugal", code: "PT", resource: "geoTargetConstants/2620" },
  { label: "Romania", code: "RO", resource: "geoTargetConstants/2642" },
  { label: "Slovakia", code: "SK", resource: "geoTargetConstants/2703" },
  { label: "Slovenia", code: "SI", resource: "geoTargetConstants/2705" },
  { label: "Spain", code: "ES", resource: "geoTargetConstants/2724" },
  { label: "Sweden", code: "SE", resource: "geoTargetConstants/2752" },
  { label: "Switzerland", code: "CH", resource: "geoTargetConstants/2756" },
];
// Preset groups for the keyword planner. Each group must stay ≤10 countries
// to fit GenerateKeywordIdeasRequest.geoTargetConstants's API limit so the
// "select group" button always produces a single-shot, no-batching request.
// IT/ES/PT are intentionally excluded — those run on dedicated paid
// campaigns + keyword-research scripts and don't belong in exploratory
// planner work.
const GEO_GROUPS: { id: string; label: string; codes: string[] }[] = [
  { id: "western", label: "Western (rich)", codes: ["DE", "FR", "AT", "CH", "BE", "NL", "LU", "LI"] },
  { id: "nordics", label: "Nordics", codes: ["SE", "NO", "DK", "FI", "IS"] },
  { id: "mediterranean", label: "Mediterranean (small)", codes: ["GR", "MT", "CY"] },
  { id: "eastern_visegrad", label: "Eastern (Visegrad+)", codes: ["PL", "CZ", "SK", "HU", "SI"] },
  { id: "eastern_poor", label: "Eastern (lower-income)", codes: ["RO", "BG", "HR", "LT", "LV", "EE"] },
  { id: "british_isles", label: "British Isles", codes: ["GB", "IE"] },
];

interface PlannerState {
  phrase: string;
  setPhrase: (v: string) => void;
  geos: string[];
  setGeos: (v: string[]) => void;
  result: KeywordPlanData | null;
  setResult: (v: KeywordPlanData | null) => void;
  resultError: string | null;
  setResultError: (v: string | null) => void;
  appliedCampaignId: string | null;
  setAppliedCampaignId: (v: string | null) => void;
}

function usePlannerState(): PlannerState {
  const [phrase, setPhrase] = useState("");
  // Default: empty selection — opening the modal from a campaign auto-fills
  // the campaign's targeting; opening standalone, the user picks a group.
  const [geos, setGeos] = useState<string[]>([]);
  const [result, setResult] = useState<KeywordPlanData | null>(null);
  const [resultError, setResultError] = useState<string | null>(null);
  const [appliedCampaignId, setAppliedCampaignId] = useState<string | null>(null);
  return { phrase, setPhrase, geos, setGeos, result, setResult, resultError, setResultError, appliedCampaignId, setAppliedCampaignId };
}

function PlannerModal({ state, campaignId, targeting, adGroupId, onAddKeyword, onClose }: { state: PlannerState; campaignId: string | null; targeting: CampaignTargeting | null; adGroupId: string | null; onAddKeyword: (text: string, adGroupId: string) => void; onClose: () => void }) {
  useScrollLock(true);

  const { phrase, setPhrase, geos, setGeos, result, setResult, resultError, setResultError, appliedCampaignId, setAppliedCampaignId } = state;
  const [submitting, setSubmitting] = useState(false);

  // Auto-pick country from current campaign targeting (once per campaign).
  // Language is not part of the planner query anymore — Google's planner
  // returns near-identical CPC/volume data across languages for Latin
  // keywords, and dropping it removes a class of false "no data" rows
  // where the wrong language filter starved the response.
  useEffect(() => {
    if (!campaignId || campaignId === appliedCampaignId) return;
    if (!targeting) return;
    const firstGeoCode = targeting.geos[0]?.code?.toUpperCase();
    if (firstGeoCode) {
      const geoMatch = GEO_OPTIONS.find((g) => g.code === firstGeoCode);
      if (geoMatch) setGeos([geoMatch.resource]);
    }
    setAppliedCampaignId(campaignId);
  }, [campaignId, targeting, appliedCampaignId, setGeos, setAppliedCampaignId]);

  const canSubmit = phrase.trim().length > 0 && geos.length > 0 && geos.length <= 10 && !submitting;

  async function submit() {
    if (!canSubmit) return;
    setSubmitting(true);
    setResultError(null);
    setResult(null);
    try {
      const qs = new URLSearchParams({
        phrase: phrase.trim(),
        geo: geos.join(","),
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
            <FormLabel label={`Countries (${geos.length}/10)`}>
              <div className="space-y-2">
                {/* Group preset chips: click toggles the whole group on/off. */}
                <div className="flex flex-wrap gap-1.5">
                  {GEO_GROUPS.map((grp) => {
                    const resources = grp.codes
                      .map((c) => GEO_OPTIONS.find((g) => g.code === c)?.resource)
                      .filter((r): r is string => !!r);
                    const allOn = resources.every((r) => geos.includes(r));
                    return (
                      <button
                        key={grp.id}
                        type="button"
                        onClick={() => {
                          if (allOn) setGeos(geos.filter((r) => !resources.includes(r)));
                          else setGeos(Array.from(new Set([...geos, ...resources])));
                        }}
                        className={`text-[11px] px-2.5 h-7 rounded-full border transition-colors ${
                          allOn
                            ? "bg-primary-gradient text-primary-foreground border-primary"
                            : "bg-secondary text-foreground border-border hover:bg-secondary/70"
                        }`}
                      >
                        {grp.label} ({grp.codes.length})
                      </button>
                    );
                  })}
                  <button
                    type="button"
                    onClick={() => setGeos([])}
                    disabled={geos.length === 0}
                    className="text-[11px] px-2.5 h-7 rounded-full border border-border bg-transparent hover:bg-secondary/70 disabled:opacity-40"
                  >
                    Clear
                  </button>
                </div>
                {/* Individual country chips for fine-grained edits. */}
                <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto p-1 rounded-md border border-border bg-secondary/40">
                  {GEO_OPTIONS.map((g) => {
                    const on = geos.includes(g.resource);
                    return (
                      <button
                        key={g.resource}
                        type="button"
                        onClick={() => {
                          if (on) setGeos(geos.filter((r) => r !== g.resource));
                          else setGeos([...geos, g.resource]);
                        }}
                        className={`text-[10px] px-2 h-6 rounded border transition-colors ${
                          on
                            ? "bg-primary-gradient text-primary-foreground border-primary"
                            : "bg-background text-muted-foreground border-border hover:text-foreground"
                        }`}
                      >
                        {g.code}
                      </button>
                    );
                  })}
                </div>
                {geos.length > 10 ? (
                  <div className="text-[11px] text-red-500">
                    API limit is 10 countries — deselect {geos.length - 10}.
                  </div>
                ) : null}
              </div>
            </FormLabel>
            <div className="flex items-end gap-2">
              <button
                type="submit"
                disabled={!canSubmit}
                className="h-9 px-4 rounded-md bg-primary-gradient text-primary-foreground text-xs font-medium uppercase tracking-wider disabled:opacity-50 hover:opacity-90 transition-opacity"
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
  const avgCpc = lowCpc != null && highCpc != null ? (lowCpc + highCpc) / 2 : null;

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
        <Row label="CPC avg" value={avgCpc != null ? `€${avgCpc.toFixed(2)}` : "—"} />
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

function CpcRangeBlock({ state, onPick }: { state: CpcRange | "loading" | "missing"; onPick: (eur: number) => void }) {
  if (state === "loading") {
    return (
      <div className="text-[11px] text-muted-foreground inline-flex items-center gap-2">
        <span className="inline-block w-3 h-3 border border-muted-foreground/40 border-t-foreground rounded-full animate-spin" />
        Loading planner CPC range…
      </div>
    );
  }
  if (state === "missing") {
    return (
      <div className="text-[11px] text-muted-foreground">No planner CPC data for this keyword.</div>
    );
  }
  const low = state.lowMicros / 1e6;
  const high = state.highMicros / 1e6;
  const avg = (low + high) / 2;
  const fmt = (n: number) => (n >= 10 ? n.toFixed(1) : n.toFixed(2));
  const pill = "text-[11px] px-2.5 h-7 rounded-md bg-secondary text-foreground hover:bg-muted transition-colors tabular-nums inline-flex items-center gap-1";
  return (
    <div className="space-y-1.5">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
        Planner top-of-page CPC
      </div>
      <div className="flex items-center gap-1.5">
        <button type="button" onClick={() => onPick(low)} className={pill} title="Min">
          <span className="text-muted-foreground">min</span> €{fmt(low)}
        </button>
        <button type="button" onClick={() => onPick(avg)} className={pill} title="Average">
          <span className="text-muted-foreground">avg</span> €{fmt(avg)}
        </button>
        <button type="button" onClick={() => onPick(high)} className={pill} title="Max">
          <span className="text-muted-foreground">max</span> €{fmt(high)}
        </button>
      </div>
    </div>
  );
}

function BidEditModal({
  req,
  onClose,
  onSaved,
}: {
  req: { adGroupId: string; critId: string; keyword: string; currentBid: number | null; geoResource: string | null };
  onClose: () => void;
  onSaved: () => void;
}) {
  useScrollLock(true);
  const [input, setInput] = useState(req.currentBid != null ? req.currentBid.toFixed(2) : "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // CPC range from Keyword Planner for this keyword + the campaign's first
  // targeted country. Single, focused request — no rate-limit issues
  // since the user can only have one bid edit modal open at a time.
  const [cpcState, setCpcState] = useState<CpcRange | "loading" | "missing">("loading");
  useEffect(() => {
    if (!req.geoResource) {
      setCpcState("missing");
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const qs = new URLSearchParams({ phrase: req.keyword, geo: req.geoResource! });
        const res = await fetch(apiUrl(`/api/admin/google-ads/planner?${qs}`), { credentials: "include" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const j = (await res.json()) as {
          lowTopOfPageBidMicros: number | null;
          highTopOfPageBidMicros: number | null;
        };
        if (cancelled) return;
        if (j.lowTopOfPageBidMicros != null && j.highTopOfPageBidMicros != null) {
          setCpcState({ lowMicros: j.lowTopOfPageBidMicros, highMicros: j.highTopOfPageBidMicros });
        } else {
          setCpcState("missing");
        }
      } catch {
        if (!cancelled) setCpcState("missing");
      }
    })();
    return () => { cancelled = true; };
  }, [req.keyword, req.geoResource]);

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
                className="h-9 px-4 rounded-md bg-primary-gradient text-primary-foreground text-xs font-medium uppercase tracking-wider disabled:opacity-50 hover:opacity-90 transition-opacity shrink-0"
              >
                {saving ? "Saving…" : "Save"}
              </button>
            </div>
          </FormLabel>
          <CpcRangeBlock state={cpcState} onPick={(eur) => setInput(eur.toFixed(2))} />
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

// Google Ads enum for `*_quality_score` fields. The REST surface
// (googleAds:search via fetch — which is what the admin endpoint uses)
// returns the value as a string enum name; the google-ads-api npm lib
// returns it as a numeric code. Accept both so the modal works regardless
// of which path produced the payload.
//   0 / "UNSPECIFIED"     → Unspecified
//   1 / "UNKNOWN"         → Unknown
//   2 / "BELOW_AVERAGE"   → Below average
//   3 / "AVERAGE"         → Average
//   4 / "ABOVE_AVERAGE"   → Above average
const QS_LEVEL_LABEL: Record<string, string> = {
  UNSPECIFIED: "Unspecified",
  UNKNOWN: "Unknown",
  BELOW_AVERAGE: "Below average",
  AVERAGE: "Average",
  ABOVE_AVERAGE: "Above average",
};
const QS_LEVEL_CLS: Record<string, string> = {
  BELOW_AVERAGE: "bg-red-500/10 text-red-500",
  AVERAGE: "bg-amber-500/10 text-amber-500",
  ABOVE_AVERAGE: "bg-emerald-500/10 text-emerald-500",
};
const QS_LEVEL_NUM_TO_KEY: Record<number, string> = {
  0: "UNSPECIFIED",
  1: "UNKNOWN",
  2: "BELOW_AVERAGE",
  3: "AVERAGE",
  4: "ABOVE_AVERAGE",
};

function qsLevel(value: unknown): { label: string; cls: string } {
  let key: string | null = null;
  if (typeof value === "number" && value in QS_LEVEL_NUM_TO_KEY) {
    key = QS_LEVEL_NUM_TO_KEY[value];
  } else if (typeof value === "string" && value in QS_LEVEL_LABEL) {
    key = value;
  }
  if (!key) return { label: "—", cls: "bg-muted text-muted-foreground" };
  return { label: QS_LEVEL_LABEL[key] || "—", cls: QS_LEVEL_CLS[key] || "bg-muted text-muted-foreground" };
}

interface QualityInfoLike {
  qualityScore?: number | string;
  quality_score?: number | string;
  creativeQualityScore?: number | string;
  creative_quality_score?: number | string;
  postClickQualityScore?: number | string;
  post_click_quality_score?: number | string;
  searchPredictedCtr?: number | string;
  search_predicted_ctr?: number | string;
}

function readQualityInfo(record: unknown): QualityInfoLike | null {
  if (!record || typeof record !== "object") return null;
  const r = record as Record<string, unknown>;
  const agc = (r.adGroupCriterion || r.ad_group_criterion) as Record<string, unknown> | undefined;
  const qi = (agc?.qualityInfo || agc?.quality_info) as QualityInfoLike | undefined;
  return qi ?? null;
}

function KeywordQsModal({
  req,
  onClose,
}: {
  req: { adGroupId: string; critId: string; keyword: string; matchType?: string };
  onClose: () => void;
}) {
  useScrollLock(true);
  const [qi, setQi] = useState<QualityInfoLike | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(
          apiUrl(`/api/admin/google-ads/detail/keyword/${req.adGroupId}/${req.critId}`),
          { credentials: "include" },
        );
        if (!res.ok) {
          if (!cancelled) setError(`Error ${res.status}`);
          return;
        }
        const j = await res.json();
        if (!cancelled) setQi(readQualityInfo(j.record));
      } catch (e) {
        if (!cancelled) setError(String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [req.adGroupId, req.critId]);

  const rawScore = qi?.qualityScore ?? qi?.quality_score;
  const score = typeof rawScore === "string" ? Number(rawScore) : rawScore;
  const creative = qsLevel(qi?.creativeQualityScore ?? qi?.creative_quality_score);
  const postClick = qsLevel(qi?.postClickQualityScore ?? qi?.post_click_quality_score);
  const predCtr = qsLevel(qi?.searchPredictedCtr ?? qi?.search_predicted_ctr);

  return (
    <div onClick={onClose} className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-md bg-card border border-border rounded-xl shadow-xl flex flex-col">
        <div className="px-4 py-3 border-b border-border flex items-start justify-between gap-3 shrink-0">
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-foreground">Quality Score breakdown</h3>
            <p className="text-xs text-muted-foreground mt-1 truncate font-mono">
              {req.matchType ? `[${req.matchType}] ` : ""}{req.keyword}
            </p>
          </div>
          <button type="button" onClick={onClose} className="h-7 w-7 shrink-0 inline-flex items-center justify-center bg-secondary rounded-md text-muted-foreground hover:text-foreground">
            <XIcon className="w-3.5 h-3.5" />
          </button>
        </div>
        <div className="p-4">
          {loading ? (
            <div className="flex items-center justify-center py-8 gap-2 text-xs text-muted-foreground">
              <Gauge className="w-3.5 h-3.5 animate-pulse" />
              Loading…
            </div>
          ) : error ? (
            <div className="text-center text-xs text-red-500 py-6">{error}</div>
          ) : !qi ? (
            <div className="text-center text-xs text-muted-foreground py-6">No QS data yet.</div>
          ) : (
            <div className="space-y-2.5">
              <div className="flex items-center justify-between p-3 bg-muted/40 rounded-lg">
                <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Quality Score</span>
                <span className="text-2xl font-bold tabular-nums text-foreground">
                  {typeof score === "number" ? `${score}/10` : "—"}
                </span>
              </div>
              <QsBreakdownRow label="Ad relevance (creative)" badge={creative} />
              <QsBreakdownRow label="Landing page experience" badge={postClick} />
              <QsBreakdownRow label="Expected CTR" badge={predCtr} />
              <p className="text-[10px] text-muted-foreground pt-2 leading-relaxed">
                "—" or "Unknown" means Google hasn&apos;t collected enough impressions/clicks yet to score this dimension. Estimates stabilize after a week or two of meaningful traffic.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function QsBreakdownRow({ label, badge }: { label: string; badge: { label: string; cls: string } }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className={"shrink-0 inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium uppercase tracking-wider " + badge.cls}>
        {badge.label}
      </span>
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
                  className={"h-8 px-3 rounded text-[11px] font-semibold uppercase tracking-wider transition-colors inline-flex items-center justify-center " + (matchType === mt ? "bg-primary-gradient text-primary-foreground" : "text-muted-foreground hover:text-foreground")}
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
                  : "bg-primary-gradient text-primary-foreground";
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
              className="h-9 px-4 rounded-md bg-primary-gradient text-primary-foreground text-xs font-medium uppercase tracking-wider disabled:opacity-50 hover:opacity-90 transition-opacity"
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

const EMPTY_HEADLINE: { text: string; pin?: HeadlinePin } = { text: "" };
const EMPTY_DESCRIPTION: { text: string; pin?: DescriptionPin } = { text: "" };

function AdGroupFormModal({
  req,
  sitelinks,
  callouts,
  snippets,
  images,
  onClose,
  onSaved,
  onRefresh,
}: {
  req: AdGroupFormReq;
  sitelinks: SitelinkAsset[];
  callouts: CalloutAsset[];
  snippets: SnippetAsset[];
  images: ImageAsset[];
  onClose: () => void;
  onSaved: () => void;
  onRefresh: () => void;
}) {
  useScrollLock(true);
  const isEdit = req.mode === "edit";
  const initial = isEdit
    ? req.current
    : { name: "", status: "ENABLED" as Status, defaultBid: undefined, suffix: undefined };
  const initialAd: AdFormState = isEdit && req.currentAd
    ? req.currentAd
    : {
        finalUrl: "",
        path1: "",
        path2: "",
        headlines: [EMPTY_HEADLINE, EMPTY_HEADLINE, EMPTY_HEADLINE],
        descriptions: [EMPTY_DESCRIPTION, EMPTY_DESCRIPTION],
      };

  type TabKey = "basic" | "headlines" | "descriptions" | "sitelinks" | "callouts" | "snippet" | "images";
  const [tab, setTab] = useState<TabKey>("basic");
  const [name, setName] = useState(initial.name);
  const [status, setStatus] = useState<Status>(initial.status);
  const [bidStr, setBidStr] = useState(initial.defaultBid != null ? initial.defaultBid.toFixed(2) : "");
  const [suffix, setSuffix] = useState(initial.suffix ?? "");
  const [finalUrl, setFinalUrl] = useState(initialAd.finalUrl);
  const [path1, setPath1] = useState(initialAd.path1 ?? "");
  const [path2, setPath2] = useState(initialAd.path2 ?? "");
  const [headlines, setHeadlines] = useState<Array<{ text: string; pin?: HeadlinePin }>>(
    initialAd.headlines.length >= 3 ? initialAd.headlines : [...initialAd.headlines, ...Array(3 - initialAd.headlines.length).fill(EMPTY_HEADLINE)],
  );
  const [descriptions, setDescriptions] = useState<Array<{ text: string; pin?: DescriptionPin }>>(
    initialAd.descriptions.length >= 2 ? initialAd.descriptions : [...initialAd.descriptions, ...Array(2 - initialAd.descriptions.length).fill(EMPTY_DESCRIPTION)],
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const parsedBid = parseBid(bidStr);
  const bidValid = !bidStr.trim() || (parsedBid != null && parsedBid > 0);

  const validHeadlines = headlines.filter((h) => h.text.trim().length > 0 && h.text.trim().length <= 30);
  const validDescriptions = descriptions.filter((d) => d.text.trim().length > 0 && d.text.trim().length <= 90);
  const anyHeadlineOverLimit = headlines.some((h) => h.text.trim().length > 30);
  const anyDescriptionOverLimit = descriptions.some((d) => d.text.trim().length > 90);
  const path1OverLimit = path1.trim().length > 15;
  const path2OverLimit = path2.trim().length > 15;
  const finalUrlValid = finalUrl.trim().length === 0 || /^https?:\/\//i.test(finalUrl.trim());
  const adComplete = finalUrl.trim().length > 0
    && validHeadlines.length >= 3 && validHeadlines.length <= 15
    && validDescriptions.length >= 2 && validDescriptions.length <= 4
    && !anyHeadlineOverLimit && !anyDescriptionOverLimit
    && !path1OverLimit && !path2OverLimit
    && finalUrlValid;

  // Client-side ad-strength heuristic — mirrors Google's published guidance:
  // more headlines + descriptions + variety + less pinning + asset coverage.
  // The real value is computed server-side by Google after save; this gives
  // a live preview as the user types and toggles pins/assets.
  const adStrength = useMemo(() => {
    let score = 0;
    const validH = headlines.filter((h) => h.text.trim().length > 0 && h.text.trim().length <= 30);
    const validD = descriptions.filter((d) => d.text.trim().length > 0 && d.text.trim().length <= 90);
    const hCount = validH.length;
    const dCount = validD.length;
    score += Math.max(0, Math.min((hCount - 3) / 12, 1)) * 25;
    score += Math.max(0, Math.min((dCount - 2) / 2, 1)) * 15;
    if (hCount > 0) {
      const firstWords = new Set(
        validH.map((h) => h.text.trim().split(/\s+/)[0]?.toLowerCase() ?? ""),
      );
      score += (firstWords.size / hCount) * 15;
    }
    const pinnedTotal = validH.filter((h) => h.pin).length + validD.filter((d) => d.pin).length;
    const pinnable = hCount + dCount;
    score += (pinnable > 0 ? 1 - pinnedTotal / pinnable : 1) * 10;
    score += (Math.min(sitelinks.length, 4) / 4) * 10;
    score += (Math.min(callouts.length, 6) / 6) * 10;
    score += Math.min(snippets.length, 1) * 5;
    const landscape = images.filter((i) => i.fieldType === "MARKETING_IMAGE").length;
    const square = images.filter((i) => i.fieldType === "SQUARE_MARKETING_IMAGE").length;
    const logo = images.filter((i) => i.fieldType === "LOGO").length;
    score += (Math.min(landscape, 4) / 4) * 5;
    score += (Math.min(square, 4) / 4) * 5;
    score += Math.min(logo, 1) * 5;
    const pct = Math.round(Math.min(score, 100));
    let label = "POOR";
    let color = "bg-red-500/15 text-red-500";
    if (pct >= 85) {
      label = "EXCELLENT";
      color = "bg-emerald-500/15 text-emerald-500";
    } else if (pct >= 60) {
      label = "GOOD";
      color = "bg-blue-500/15 text-blue-500";
    } else if (pct >= 30) {
      label = "AVERAGE";
      color = "bg-amber-500/15 text-amber-500";
    }
    return { pct, label, color };
  }, [headlines, descriptions, sitelinks, callouts, snippets, images]);

  const baseValid = name.trim().length > 0 && bidValid;
  // For create — ad block is required. For edit — ad block is optional (user may only
  // tweak ad-group fields). But if any ad field has user input, the whole ad must be complete.
  const adRequired = !isEdit;
  const canSave = !saving && baseValid && (adRequired ? adComplete : (adComplete || !hasUserAdInput()));

  function hasUserAdInput(): boolean {
    if (!isEdit) return true;
    const cur = req.currentAd;
    if (!cur) return finalUrl.trim().length > 0 || headlines.some((h) => h.text.trim().length > 0) || descriptions.some((d) => d.text.trim().length > 0);
    if ((cur.finalUrl ?? "") !== finalUrl) return true;
    if ((cur.path1 ?? "") !== path1) return true;
    if ((cur.path2 ?? "") !== path2) return true;
    if (cur.headlines.length !== headlines.length) return true;
    for (let i = 0; i < headlines.length; i++) {
      if ((cur.headlines[i]?.text ?? "") !== headlines[i].text) return true;
      if ((cur.headlines[i]?.pin ?? "") !== (headlines[i].pin ?? "")) return true;
    }
    if (cur.descriptions.length !== descriptions.length) return true;
    for (let i = 0; i < descriptions.length; i++) {
      if ((cur.descriptions[i]?.text ?? "") !== descriptions[i].text) return true;
      if ((cur.descriptions[i]?.pin ?? "") !== (descriptions[i].pin ?? "")) return true;
    }
    return false;
  }

  function updateHeadline(i: number, patch: Partial<{ text: string; pin?: HeadlinePin }>) {
    setHeadlines((arr) => arr.map((h, idx) => (idx === i ? { ...h, ...patch } : h)));
  }
  function addHeadline() {
    setHeadlines((arr) => (arr.length < 15 ? [...arr, { text: "" }] : arr));
  }
  function removeHeadline(i: number) {
    setHeadlines((arr) => (arr.length > 3 ? arr.filter((_, idx) => idx !== i) : arr));
  }
  function updateDescription(i: number, patch: Partial<{ text: string; pin?: DescriptionPin }>) {
    setDescriptions((arr) => arr.map((d, idx) => (idx === i ? { ...d, ...patch } : d)));
  }
  function addDescription() {
    setDescriptions((arr) => (arr.length < 4 ? [...arr, { text: "" }] : arr));
  }
  function removeDescription(i: number) {
    setDescriptions((arr) => (arr.length > 2 ? arr.filter((_, idx) => idx !== i) : arr));
  }

  async function save() {
    if (!canSave) return;
    setSaving(true);
    setError(null);
    try {
      const bidMicros = parsedBid != null && parsedBid > 0 ? Math.round(parsedBid * 1_000_000) : null;
      const payload: Record<string, unknown> = {};

      // Ad-group level diff (edit) or full payload (create).
      if (isEdit) {
        const cur = req.current;
        if (name.trim() !== cur.name) payload.name = name.trim();
        if (status !== cur.status) payload.status = status;
        const curBidMicros = cur.defaultBid != null ? Math.round(cur.defaultBid * 1_000_000) : null;
        if (bidMicros !== curBidMicros) payload.defaultBidMicros = bidMicros;
        const curSuffix = cur.suffix ?? "";
        if (suffix !== curSuffix) payload.finalUrlSuffix = suffix.length > 0 ? suffix : null;
      } else {
        payload.name = name.trim();
        if (bidMicros) payload.defaultBidMicros = bidMicros;
        if (suffix.trim()) payload.finalUrlSuffix = suffix.trim();
      }

      // Ad block — always for create, only if dirty for edit.
      const shouldSendAd = !isEdit || hasUserAdInput();
      if (shouldSendAd && adComplete) {
        payload.ad = {
          finalUrl: finalUrl.trim(),
          headlines: headlines
            .filter((h) => h.text.trim().length > 0)
            .map((h) => ({ text: h.text.trim(), ...(h.pin ? { pin: h.pin } : {}) })),
          descriptions: descriptions
            .filter((d) => d.text.trim().length > 0)
            .map((d) => ({ text: d.text.trim(), ...(d.pin ? { pin: d.pin } : {}) })),
          ...(path1.trim() ? { path1: path1.trim() } : {}),
          ...(path2.trim() ? { path2: path2.trim() } : {}),
        };
      }

      if (isEdit && Object.keys(payload).length === 0) {
        onClose();
        return;
      }

      const url = isEdit
        ? apiUrl(`/api/admin/google-ads/ad-group/${req.adGroupId}`)
        : apiUrl(`/api/admin/google-ads/ad-group/${req.campaignId}`);
      const res = await fetch(url, {
        method: isEdit ? "PATCH" : "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const txt = await res.text();
        setError(`Error ${res.status}: ${txt.slice(0, 300)}`);
        return;
      }
      onSaved();
    } catch (e: any) {
      setError(String(e));
    } finally {
      setSaving(false);
    }
  }

  const TabBtn = ({ k, label, badge }: { k: TabKey; label: string; badge?: string }) => (
    <button
      type="button"
      onClick={() => setTab(k)}
      className={
        "h-8 px-3 rounded text-[11px] font-semibold uppercase tracking-wider transition-colors inline-flex items-center justify-center gap-1.5 " +
        (tab === k ? "bg-primary-gradient text-primary-foreground" : "text-muted-foreground hover:text-foreground")
      }
    >
      <span>{label}</span>
      {badge ? <span className="text-[9px] opacity-70 normal-case tracking-normal">{badge}</span> : null}
    </button>
  );

  return (
    <div onClick={onClose} className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-lg bg-card border border-border rounded-xl shadow-xl flex flex-col max-h-[90vh]">
        <div className="px-4 py-3 border-b border-border flex items-center gap-2 shrink-0">
          <h3 className="text-sm font-semibold text-foreground truncate flex-1 min-w-0">
            {isEdit ? "Edit ad" : "New ad"}
          </h3>
          <div
            title={`Live strength preview · Google computes the real value after save`}
            className={`inline-flex items-center gap-1.5 px-2 py-1 rounded text-[10px] font-semibold uppercase tracking-wider shrink-0 ${adStrength.color}`}
          >
            <span>{adStrength.label}</span>
            <span className="opacity-70 tabular-nums normal-case tracking-normal">{adStrength.pct}%</span>
          </div>
          <button type="button" onClick={onClose} className="h-7 w-7 inline-flex items-center justify-center bg-secondary rounded-md text-muted-foreground hover:text-foreground shrink-0">
            <XIcon className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="px-4 pt-3 pb-2 border-b border-border shrink-0 overflow-x-auto">
          <div className="inline-flex items-center bg-secondary rounded-md p-0.5 gap-0.5">
            <TabBtn k="basic" label="Basic" />
            <TabBtn k="headlines" label="Headlines" badge={`${validHeadlines.length}/15`} />
            <TabBtn k="descriptions" label="Descriptions" badge={`${validDescriptions.length}/4`} />
            <TabBtn k="sitelinks" label="Sitelinks" badge={`${sitelinks.length}`} />
            <TabBtn k="callouts" label="Callouts" badge={`${callouts.length}`} />
            <TabBtn k="snippet" label="Snippet" badge={`${snippets.length}`} />
            <TabBtn k="images" label="Images" badge={`${images.length}`} />
          </div>
        </div>

        <form onSubmit={(e) => { e.preventDefault(); void save(); }} className="flex-1 overflow-y-auto p-4 space-y-3">
          {tab === "basic" ? (
            <>
              <FormLabel label="Name">
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Menu QR Code [IT]"
                  autoFocus={!isEdit}
                  className="w-full h-9 px-3 rounded-md bg-secondary border border-border text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </FormLabel>
              {isEdit ? (
                <FormLabel label="Status">
                  <div className="inline-flex items-center bg-secondary rounded-md p-0.5 gap-0.5">
                    {(["ENABLED", "PAUSED"] as const).map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => setStatus(s)}
                        className={"h-8 px-3 rounded text-[11px] font-semibold uppercase tracking-wider transition-colors inline-flex items-center justify-center " + (status === s ? "bg-primary-gradient text-primary-foreground" : "text-muted-foreground hover:text-foreground")}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </FormLabel>
              ) : null}
              <FormLabel label="Default CPC bid (€)">
                <input
                  type="text"
                  inputMode="decimal"
                  value={bidStr}
                  onChange={(e) => setBidStr(e.target.value.replace(/[^0-9.,]/g, ""))}
                  placeholder="0.50"
                  className="w-full h-9 px-3 rounded-md bg-secondary border border-border text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary tabular-nums"
                />
                {bidStr.trim() && !bidValid ? (
                  <div className="text-[11px] text-amber-500 mt-1">Invalid number</div>
                ) : null}
              </FormLabel>
              <FormLabel label="Final URL Suffix">
                <input
                  type="text"
                  value={suffix}
                  onChange={(e) => setSuffix(e.target.value)}
                  placeholder="gclid={gclid}&kw={keyword}"
                  className="w-full h-9 px-3 rounded-md bg-secondary border border-border text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary font-mono"
                />
              </FormLabel>
              <FormLabel label="Final URL">
                <input
                  type="text"
                  value={finalUrl}
                  onChange={(e) => setFinalUrl(e.target.value)}
                  placeholder="https://iq-rest.com/it/menu-digitale"
                  className="w-full h-9 px-3 rounded-md bg-secondary border border-border text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary font-mono"
                />
                {finalUrl.trim().length > 0 && !finalUrlValid ? (
                  <div className="text-[11px] text-amber-500 mt-1">Must start with http:// or https://</div>
                ) : null}
              </FormLabel>
              <div className="grid grid-cols-2 gap-3">
                <FormLabel label="Path 1">
                  <input
                    type="text"
                    value={path1}
                    onChange={(e) => setPath1(e.target.value)}
                    placeholder="menu-digitale"
                    maxLength={15}
                    className="w-full h-9 px-3 rounded-md bg-secondary border border-border text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                  <div className="text-[10px] text-muted-foreground mt-1 tabular-nums">{path1.length}/15</div>
                </FormLabel>
                <FormLabel label="Path 2">
                  <input
                    type="text"
                    value={path2}
                    onChange={(e) => setPath2(e.target.value)}
                    placeholder="ristoranti"
                    maxLength={15}
                    className="w-full h-9 px-3 rounded-md bg-secondary border border-border text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                  <div className="text-[10px] text-muted-foreground mt-1 tabular-nums">{path2.length}/15</div>
                </FormLabel>
              </div>
            </>
          ) : null}

          {tab === "headlines" ? (
            <div className="space-y-2">
              <div className="text-[11px] text-muted-foreground">
                3-15 headlines, each ≤30 chars. Pin to fix position; unpinned rotate.
              </div>
              {headlines.map((h, i) => (
                <div key={i} className="flex items-start gap-2">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={h.text}
                        onChange={(e) => updateHeadline(i, { text: e.target.value })}
                        placeholder={`Headline ${i + 1}`}
                        maxLength={30}
                        className="flex-1 h-9 px-3 rounded-md bg-secondary border border-border text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                      />
                      <Select<string>
                        value={h.pin ?? ""}
                        onChange={(next) => updateHeadline(i, { pin: (next || undefined) as HeadlinePin | undefined })}
                        className="!h-9 !w-28 !px-2 text-xs"
                        options={[
                          { value: "", label: "unpinned" },
                          { value: "HEADLINE_1", label: "Pos 1" },
                          { value: "HEADLINE_2", label: "Pos 2" },
                          { value: "HEADLINE_3", label: "Pos 3" },
                        ]}
                      />
                      <button
                        type="button"
                        onClick={() => removeHeadline(i)}
                        disabled={headlines.length <= 3}
                        className="h-9 w-9 inline-flex items-center justify-center bg-secondary rounded-md text-muted-foreground hover:text-foreground disabled:opacity-30"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                    <div className="text-[10px] text-muted-foreground mt-1 tabular-nums">{h.text.length}/30</div>
                  </div>
                </div>
              ))}
              <button
                type="button"
                onClick={addHeadline}
                disabled={headlines.length >= 15}
                className="h-8 px-3 rounded-md bg-secondary text-xs text-muted-foreground hover:text-foreground disabled:opacity-30 inline-flex items-center gap-1.5"
              >
                <Plus className="w-3 h-3" /> Add headline
              </button>
              {anyHeadlineOverLimit ? (
                <div className="text-[11px] text-amber-500">Some headlines exceed 30 chars</div>
              ) : null}
            </div>
          ) : null}

          {tab === "descriptions" ? (
            <div className="space-y-2">
              <div className="text-[11px] text-muted-foreground">
                2-4 descriptions, each ≤90 chars. Pin to fix position; unpinned rotate.
              </div>
              {descriptions.map((d, i) => (
                <div key={i} className="flex items-start gap-2">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <textarea
                        value={d.text}
                        onChange={(e) => updateDescription(i, { text: e.target.value })}
                        placeholder={`Description ${i + 1}`}
                        maxLength={90}
                        rows={2}
                        className="flex-1 px-3 py-2 rounded-md bg-secondary border border-border text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary resize-none"
                      />
                      <Select<string>
                        value={d.pin ?? ""}
                        onChange={(next) => updateDescription(i, { pin: (next || undefined) as DescriptionPin | undefined })}
                        className="!h-9 !w-28 !px-2 text-xs"
                        options={[
                          { value: "", label: "unpinned" },
                          { value: "DESCRIPTION_1", label: "Pos 1" },
                          { value: "DESCRIPTION_2", label: "Pos 2" },
                        ]}
                      />
                      <button
                        type="button"
                        onClick={() => removeDescription(i)}
                        disabled={descriptions.length <= 2}
                        className="h-9 w-9 inline-flex items-center justify-center bg-secondary rounded-md text-muted-foreground hover:text-foreground disabled:opacity-30"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                    <div className="text-[10px] text-muted-foreground mt-1 tabular-nums">{d.text.length}/90</div>
                  </div>
                </div>
              ))}
              <button
                type="button"
                onClick={addDescription}
                disabled={descriptions.length >= 4}
                className="h-8 px-3 rounded-md bg-secondary text-xs text-muted-foreground hover:text-foreground disabled:opacity-30 inline-flex items-center gap-1.5"
              >
                <Plus className="w-3 h-3" /> Add description
              </button>
              {anyDescriptionOverLimit ? (
                <div className="text-[11px] text-amber-500">Some descriptions exceed 90 chars</div>
              ) : null}
            </div>
          ) : null}

          {tab === "sitelinks" ? (
            isEdit ? (
              <SitelinksTab
                adGroupId={req.adGroupId}
                sitelinks={sitelinks}
                onRefresh={onRefresh}
              />
            ) : (
              <div className="text-[11px] text-muted-foreground py-4 text-center">
                Save the ad first, then re-open Edit to add sitelinks.
              </div>
            )
          ) : null}

          {tab === "callouts" ? (
            isEdit ? (
              <CalloutsTab
                adGroupId={req.adGroupId}
                callouts={callouts}
                onRefresh={onRefresh}
              />
            ) : (
              <div className="text-[11px] text-muted-foreground py-4 text-center">
                Save the ad first, then re-open Edit to add callouts.
              </div>
            )
          ) : null}

          {tab === "snippet" ? (
            isEdit ? (
              <SnippetTab
                adGroupId={req.adGroupId}
                snippets={snippets}
                onRefresh={onRefresh}
              />
            ) : (
              <div className="text-[11px] text-muted-foreground py-4 text-center">
                Save the ad first, then re-open Edit to add structured snippets.
              </div>
            )
          ) : null}

          {tab === "images" ? (
            isEdit ? (
              <ImagesTab
                adGroupId={req.adGroupId}
                images={images}
                onRefresh={onRefresh}
              />
            ) : (
              <div className="text-[11px] text-muted-foreground py-4 text-center">
                Save the ad first, then re-open Edit to add images.
              </div>
            )
          ) : null}

          {error ? (
            <div className="text-[11px] text-red-500 break-all">{error}</div>
          ) : null}
        </form>

        <div className="px-4 py-3 border-t border-border flex justify-end shrink-0">
          <button
            type="button"
            onClick={() => void save()}
            disabled={!canSave}
            className="h-9 px-4 rounded-md bg-primary-gradient text-primary-foreground text-xs font-medium uppercase tracking-wider disabled:opacity-50 hover:opacity-90 transition-opacity"
          >
            {saving ? "Saving…" : isEdit ? "Save" : "Create"}
          </button>
        </div>
      </div>
    </div>
  );
}

function SitelinksTab({
  adGroupId,
  sitelinks,
  onRefresh,
}: {
  adGroupId: string;
  sitelinks: SitelinkAsset[];
  onRefresh: () => void;
}) {
  const [text, setText] = useState("");
  const [desc1, setDesc1] = useState("");
  const [desc2, setDesc2] = useState("");
  const [url, setUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const textValid = text.trim().length > 0 && text.trim().length <= 25;
  const desc1Valid = desc1.length <= 35;
  const desc2Valid = desc2.length <= 35;
  const urlValid = url.trim().length > 0 && /^https?:\/\//i.test(url.trim());
  const canAdd = !saving && textValid && desc1Valid && desc2Valid && urlValid;

  async function add() {
    if (!canAdd) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(
        apiUrl(`/api/admin/google-ads/ad-group/${adGroupId}/sitelink`),
        {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            linkText: text.trim(),
            description1: desc1.trim() || undefined,
            description2: desc2.trim() || undefined,
            finalUrl: url.trim(),
          }),
        },
      );
      if (!res.ok) {
        const txt = await res.text();
        setError(`Error ${res.status}: ${txt.slice(0, 200)}`);
        return;
      }
      setText("");
      setDesc1("");
      setDesc2("");
      setUrl("");
      onRefresh();
    } catch (e: any) {
      setError(String(e));
    } finally {
      setSaving(false);
    }
  }

  async function remove(assetId: string) {
    setDeletingId(assetId);
    setError(null);
    try {
      const res = await fetch(
        apiUrl(`/api/admin/google-ads/ad-group/${adGroupId}/sitelink/${assetId}`),
        { method: "DELETE", credentials: "include" },
      );
      if (!res.ok) {
        const txt = await res.text();
        setError(`Error ${res.status}: ${txt.slice(0, 200)}`);
        return;
      }
      onRefresh();
    } catch (e: any) {
      setError(String(e));
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="space-y-3">
      <div className="text-[11px] text-muted-foreground">
        4-6 sitelinks recommended. Each: title ≤25, descriptions ≤35 each.
      </div>

      {sitelinks.length === 0 ? (
        <div className="text-[11px] text-muted-foreground py-2">No sitelinks yet.</div>
      ) : (
        <div className="space-y-2">
          {sitelinks.map((s) => (
            <div
              key={s.assetId}
              className="border border-border rounded-md p-3 flex items-start gap-2 bg-secondary/40"
            >
              <div className="flex-1 min-w-0">
                <div className="text-xs font-medium text-foreground truncate">{s.text}</div>
                {s.desc1 ? <div className="text-[11px] text-muted-foreground truncate">{s.desc1}</div> : null}
                {s.desc2 ? <div className="text-[11px] text-muted-foreground truncate">{s.desc2}</div> : null}
                <div className="text-[10px] text-muted-foreground/70 font-mono truncate mt-0.5">{s.url}</div>
              </div>
              <button
                type="button"
                onClick={() => void remove(s.assetId)}
                disabled={deletingId === s.assetId}
                title="Delete"
                className="shrink-0 h-7 w-7 inline-flex items-center justify-center rounded text-[10px] bg-red-500/10 text-red-500 hover:bg-red-500/20 transition-colors disabled:opacity-50"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="border border-border rounded-md p-3 space-y-2 bg-card">
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Add sitelink</div>
        <div>
          <input
            type="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Title (e.g. Funzionalità)"
            maxLength={25}
            className="w-full h-8 px-2 rounded-md bg-secondary border border-border text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          />
          <div className="text-[10px] text-muted-foreground mt-0.5 tabular-nums">{text.length}/25</div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <input
              type="text"
              value={desc1}
              onChange={(e) => setDesc1(e.target.value)}
              placeholder="Description 1 (optional)"
              maxLength={35}
              className="w-full h-8 px-2 rounded-md bg-secondary border border-border text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            />
            <div className="text-[10px] text-muted-foreground mt-0.5 tabular-nums">{desc1.length}/35</div>
          </div>
          <div>
            <input
              type="text"
              value={desc2}
              onChange={(e) => setDesc2(e.target.value)}
              placeholder="Description 2 (optional)"
              maxLength={35}
              className="w-full h-8 px-2 rounded-md bg-secondary border border-border text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            />
            <div className="text-[10px] text-muted-foreground mt-0.5 tabular-nums">{desc2.length}/35</div>
          </div>
        </div>
        <input
          type="text"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://iq-rest.com/it/menu-digitale#features"
          className="w-full h-8 px-2 rounded-md bg-secondary border border-border text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary font-mono"
        />
        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => void add()}
            disabled={!canAdd}
            className="h-8 px-3 rounded-md bg-primary-gradient text-primary-foreground text-xs font-medium uppercase tracking-wider disabled:opacity-50 hover:opacity-90 transition-opacity"
          >
            {saving ? "Adding…" : "Add"}
          </button>
        </div>
      </div>

      {error ? <div className="text-[11px] text-red-500 break-all">{error}</div> : null}
    </div>
  );
}

function CalloutsTab({
  adGroupId,
  callouts,
  onRefresh,
}: {
  adGroupId: string;
  callouts: CalloutAsset[];
  onRefresh: () => void;
}) {
  const [text, setText] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const canAdd = !saving && text.trim().length > 0 && text.trim().length <= 25;

  async function add() {
    if (!canAdd) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(
        apiUrl(`/api/admin/google-ads/ad-group/${adGroupId}/callout`),
        {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ calloutText: text.trim() }),
        },
      );
      if (!res.ok) {
        const txt = await res.text();
        setError(`Error ${res.status}: ${txt.slice(0, 200)}`);
        return;
      }
      setText("");
      onRefresh();
    } catch (e: any) {
      setError(String(e));
    } finally {
      setSaving(false);
    }
  }

  async function remove(assetId: string) {
    setDeletingId(assetId);
    setError(null);
    try {
      const res = await fetch(
        apiUrl(`/api/admin/google-ads/ad-group/${adGroupId}/callout/${assetId}`),
        { method: "DELETE", credentials: "include" },
      );
      if (!res.ok) {
        const txt = await res.text();
        setError(`Error ${res.status}: ${txt.slice(0, 200)}`);
        return;
      }
      onRefresh();
    } catch (e: any) {
      setError(String(e));
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="space-y-3">
      <div className="text-[11px] text-muted-foreground">
        6-10 callouts recommended. Each ≤25 chars.
      </div>

      {callouts.length === 0 ? (
        <div className="text-[11px] text-muted-foreground py-2">No callouts yet.</div>
      ) : (
        <div className="flex flex-wrap gap-2">
          {callouts.map((c) => (
            <div
              key={c.assetId}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-secondary border border-border"
            >
              <span className="text-xs text-foreground">{c.text}</span>
              <button
                type="button"
                onClick={() => void remove(c.assetId)}
                disabled={deletingId === c.assetId}
                title="Delete"
                className="shrink-0 h-5 w-5 inline-flex items-center justify-center rounded text-[10px] bg-red-500/10 text-red-500 hover:bg-red-500/20 transition-colors disabled:opacity-50"
              >
                <Trash2 className="w-2.5 h-2.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="border border-border rounded-md p-3 space-y-2 bg-card">
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Add callout</div>
        <div className="flex items-start gap-2">
          <div className="flex-1">
            <input
              type="text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="e.g. 14 giorni gratis"
              maxLength={25}
              className="w-full h-8 px-2 rounded-md bg-secondary border border-border text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            />
            <div className="text-[10px] text-muted-foreground mt-0.5 tabular-nums">{text.length}/25</div>
          </div>
          <button
            type="button"
            onClick={() => void add()}
            disabled={!canAdd}
            className="h-8 px-3 rounded-md bg-primary-gradient text-primary-foreground text-xs font-medium uppercase tracking-wider disabled:opacity-50 hover:opacity-90 transition-opacity shrink-0"
          >
            {saving ? "Adding…" : "Add"}
          </button>
        </div>
      </div>

      {error ? <div className="text-[11px] text-red-500 break-all">{error}</div> : null}
    </div>
  );
}

const SNIPPET_HEADERS = [
  "AMENITIES",
  "BRANDS",
  "COURSES",
  "DEGREE_PROGRAMS",
  "DESTINATIONS",
  "FEATURED_HOTELS",
  "INSURANCE_COVERAGE",
  "MODELS",
  "NEIGHBORHOODS",
  "SERVICE_CATALOG",
  "SHOW_TYPES",
  "STYLES",
  "TYPES",
] as const;

function SnippetTab({
  adGroupId,
  snippets,
  onRefresh,
}: {
  adGroupId: string;
  snippets: SnippetAsset[];
  onRefresh: () => void;
}) {
  const [header, setHeader] = useState<string>("TYPES");
  const [valuesText, setValuesText] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const parsedValues = valuesText
    .split(/\n|,/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && s.length <= 25);
  const canAdd = !saving && parsedValues.length >= 3 && parsedValues.length <= 10;

  async function add() {
    if (!canAdd) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(
        apiUrl(`/api/admin/google-ads/ad-group/${adGroupId}/snippet`),
        {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ header, values: parsedValues }),
        },
      );
      if (!res.ok) {
        const txt = await res.text();
        setError(`Error ${res.status}: ${txt.slice(0, 200)}`);
        return;
      }
      setValuesText("");
      onRefresh();
    } catch (e: any) {
      setError(String(e));
    } finally {
      setSaving(false);
    }
  }

  async function remove(assetId: string) {
    setDeletingId(assetId);
    setError(null);
    try {
      const res = await fetch(
        apiUrl(`/api/admin/google-ads/ad-group/${adGroupId}/snippet/${assetId}`),
        { method: "DELETE", credentials: "include" },
      );
      if (!res.ok) {
        const txt = await res.text();
        setError(`Error ${res.status}: ${txt.slice(0, 200)}`);
        return;
      }
      onRefresh();
    } catch (e: any) {
      setError(String(e));
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="space-y-3">
      <div className="text-[11px] text-muted-foreground">
        1+ structured snippet recommended. Header + 3-10 values (each ≤25 chars).
      </div>

      {snippets.length === 0 ? (
        <div className="text-[11px] text-muted-foreground py-2">No snippets yet.</div>
      ) : (
        <div className="space-y-2">
          {snippets.map((s) => (
            <div
              key={s.assetId}
              className="border border-border rounded-md p-3 flex items-start gap-2 bg-secondary/40"
            >
              <div className="flex-1 min-w-0">
                <div className="text-[10px] uppercase tracking-wider text-primary font-semibold">{s.header}</div>
                <div className="flex flex-wrap gap-1 mt-1">
                  {s.values.map((v, i) => (
                    <span key={i} className="text-[11px] px-2 py-0.5 rounded bg-secondary text-foreground">{v}</span>
                  ))}
                </div>
              </div>
              <button
                type="button"
                onClick={() => void remove(s.assetId)}
                disabled={deletingId === s.assetId}
                title="Delete"
                className="shrink-0 h-7 w-7 inline-flex items-center justify-center rounded text-[10px] bg-red-500/10 text-red-500 hover:bg-red-500/20 transition-colors disabled:opacity-50"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="border border-border rounded-md p-3 space-y-2 bg-card">
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Add snippet</div>
        <div>
          <div className="text-[10px] text-muted-foreground mb-1">Header</div>
          <Select<string>
            value={header}
            onChange={(next) => setHeader(next)}
            className="!h-8 !px-2 text-xs"
            options={SNIPPET_HEADERS.map((h) => ({ value: h, label: h }))}
          />
        </div>
        <div>
          <div className="text-[10px] text-muted-foreground mb-1">Values — one per line or comma-separated</div>
          <textarea
            value={valuesText}
            onChange={(e) => setValuesText(e.target.value)}
            placeholder={"Menu digitale\nQR Code\nOrdini diretti\n…"}
            rows={4}
            className="w-full px-2 py-1.5 rounded-md bg-secondary border border-border text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary resize-none"
          />
          <div className="text-[10px] text-muted-foreground mt-0.5 tabular-nums">
            {parsedValues.length}/10 valid values
            {valuesText.trim() && parsedValues.length < 3 ? <span className="text-amber-500"> · need ≥3</span> : null}
            {parsedValues.length > 10 ? <span className="text-amber-500"> · max 10</span> : null}
          </div>
        </div>
        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => void add()}
            disabled={!canAdd}
            className="h-8 px-3 rounded-md bg-primary-gradient text-primary-foreground text-xs font-medium uppercase tracking-wider disabled:opacity-50 hover:opacity-90 transition-opacity"
          >
            {saving ? "Adding…" : "Add"}
          </button>
        </div>
      </div>

      {error ? <div className="text-[11px] text-red-500 break-all">{error}</div> : null}
    </div>
  );
}

const IMAGE_FIELD_TYPES = [
  { key: "MARKETING_IMAGE", label: "Landscape (1.91:1)", recommended: 4, note: "≥600×314, jpg/png" },
  { key: "SQUARE_MARKETING_IMAGE", label: "Square (1:1)", recommended: 4, note: "≥300×300" },
  { key: "LOGO", label: "Logo (1:1)", recommended: 1, note: "≥128×128, brand mark only" },
  { key: "LANDSCAPE_LOGO", label: "Logo (4:1)", recommended: 0, note: "≥512×128" },
] as const;

function ImagesTab({
  adGroupId,
  images,
  onRefresh,
}: {
  adGroupId: string;
  images: ImageAsset[];
  onRefresh: () => void;
}) {
  const [uploadingField, setUploadingField] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function upload(file: File, fieldType: string) {
    setUploadingField(fieldType);
    setError(null);
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const dataUrl = reader.result as string;
          resolve(dataUrl.split(",")[1] ?? "");
        };
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(file);
      });
      if (!base64) {
        setError("Failed to read file");
        return;
      }
      const res = await fetch(
        apiUrl(`/api/admin/google-ads/ad-group/${adGroupId}/image`),
        {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ data: base64, fieldType, name: file.name }),
        },
      );
      if (!res.ok) {
        const txt = await res.text();
        setError(`Error ${res.status}: ${txt}`);
        return;
      }
      onRefresh();
    } catch (e: any) {
      setError(String(e));
    } finally {
      setUploadingField(null);
    }
  }

  async function remove(assetId: string, fieldType: string) {
    setDeletingId(assetId);
    setError(null);
    try {
      const res = await fetch(
        apiUrl(`/api/admin/google-ads/ad-group/${adGroupId}/image/${assetId}/${fieldType}`),
        { method: "DELETE", credentials: "include" },
      );
      if (!res.ok) {
        const txt = await res.text();
        setError(`Error ${res.status}: ${txt.slice(0, 200)}`);
        return;
      }
      onRefresh();
    } catch (e: any) {
      setError(String(e));
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="text-[11px] text-muted-foreground">
        Upload images per slot. JPG/PNG, ≤5 MB each. Recommended ≥4 landscape + 4 square + 1 logo.
      </div>

      {IMAGE_FIELD_TYPES.map((slot) => {
        const slotImages = images.filter((i) => i.fieldType === slot.key);
        const uploading = uploadingField === slot.key;
        return (
          <div key={slot.key} className="border border-border rounded-md p-3 bg-card space-y-2">
            <div className="flex items-baseline justify-between gap-2">
              <div>
                <div className="text-xs font-semibold text-foreground">{slot.label}</div>
                <div className="text-[10px] text-muted-foreground">{slot.note}</div>
              </div>
              <div className="text-[10px] text-muted-foreground tabular-nums shrink-0">
                {slotImages.length}{slot.recommended ? ` / ${slot.recommended}+` : ""}
              </div>
            </div>

            {slotImages.length > 0 ? (
              <div className="grid grid-cols-3 gap-2">
                {slotImages.map((img) => (
                  <div key={img.assetId} className="relative aspect-square rounded-md overflow-hidden bg-secondary border border-border">
                    {img.url ? (
                      <img src={img.url} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-[10px] text-muted-foreground">no preview</div>
                    )}
                    <button
                      type="button"
                      onClick={() => void remove(img.assetId, slot.key)}
                      disabled={deletingId === img.assetId}
                      title="Detach"
                      className="absolute top-1 right-1 h-6 w-6 inline-flex items-center justify-center rounded bg-red-500/80 text-white hover:bg-red-500 transition-colors disabled:opacity-50"
                    >
                      <Trash2 className="w-2.5 h-2.5" />
                    </button>
                  </div>
                ))}
              </div>
            ) : null}

            <label className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md bg-secondary text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer disabled:opacity-50">
              <Plus className="w-3 h-3" />
              <span>{uploading ? "Uploading…" : "Upload"}</span>
              <input
                type="file"
                accept="image/png,image/jpeg"
                disabled={uploading}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void upload(file, slot.key);
                  e.currentTarget.value = "";
                }}
                className="hidden"
              />
            </label>
          </div>
        );
      })}

      {error ? <div className="text-[11px] text-red-500 break-all">{error}</div> : null}
    </div>
  );
}
