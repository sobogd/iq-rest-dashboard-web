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
import { SubpageStickyBar } from "../_v2/ui";
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
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [addKwAdGroupId, setAddKwAdGroupId] = useState<string | null>(null);
  const [addKwFromPlanner, setAddKwFromPlanner] = useState<{ adGroupId: string; text: string } | null>(null);
  const [deleteKwReq, setDeleteKwReq] = useState<{ adGroupId: string; critId: string; keyword: string } | null>(null);
  const [adGroupFormReq, setAdGroupFormReq] = useState<AdGroupFormReq | null>(null);

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
          <button
            type="button"
            onClick={() => setDatePickerOpen(true)}
            className="h-8 inline-flex items-center gap-1.5 px-2 rounded-md bg-secondary text-foreground hover:bg-muted transition-colors text-[11px] font-medium"
            title="Date range"
          >
            <Calendar className="w-3.5 h-3.5" />
            <span>{DATE_LABEL[filterDateRange]}</span>
          </button>
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
          {view.kind === "campaign" ? (
            <button
              type="button"
              onClick={() => setAdGroupFormReq({ mode: "create", campaignId: view.campaignId })}
              title="New ad group"
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
                    onEdit={() => {
                      const ad = data?.ads.find((x) => x.adGroupId === a.id && x.status === "ENABLED")
                        ?? data?.ads.find((x) => x.adGroupId === a.id);
                      const currentAd: AdFormState | undefined = ad
                        ? {
                            finalUrl: ad.finalUrls[0] ?? "",
                            path1: ad.path1,
                            path2: ad.path2,
                            headlines: ad.headlines.map((h) => ({
                              text: h.text,
                              pin: (h.pinned === "HEADLINE_1" || h.pinned === "HEADLINE_2" || h.pinned === "HEADLINE_3")
                                ? (h.pinned as HeadlinePin)
                                : undefined,
                            })),
                            descriptions: ad.descriptions.map((d) => ({
                              text: d.text,
                              pin: (d.pinned === "DESCRIPTION_1" || d.pinned === "DESCRIPTION_2")
                                ? (d.pinned as DescriptionPin)
                                : undefined,
                            })),
                          }
                        : undefined;
                      setAdGroupFormReq({
                        mode: "edit",
                        adGroupId: a.id,
                        campaignId: a.campaignId,
                        current: { name: a.name, status: a.status, defaultBid: a.defaultBid, suffix: a.suffix },
                        currentAd,
                      });
                    }}
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
      {adGroupFormReq ? (
        <AdGroupFormModal
          req={adGroupFormReq}
          sitelinks={
            adGroupFormReq.mode === "edit"
              ? (data?.adGroupSitelinks?.[adGroupFormReq.adGroupId] ?? [])
              : []
          }
          callouts={
            adGroupFormReq.mode === "edit"
              ? (data?.adGroupCallouts?.[adGroupFormReq.adGroupId] ?? [])
              : []
          }
          snippets={
            adGroupFormReq.mode === "edit"
              ? (data?.adGroupSnippets?.[adGroupFormReq.adGroupId] ?? [])
              : []
          }
          images={
            adGroupFormReq.mode === "edit"
              ? (data?.adGroupImages?.[adGroupFormReq.adGroupId] ?? [])
              : []
          }
          onClose={() => setAdGroupFormReq(null)}
          onSaved={() => { setAdGroupFormReq(null); void load("refresh"); }}
          onRefresh={() => { void load("refresh"); }}
        />
      ) : null}
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
                  <MetricPill icon={<Eye className="w-3 h-3" />} value={k.impressions} label="impressions" width="wide" />
                  <MetricPill icon={<MousePointerClick className="w-3 h-3" />} value={k.clicks} label="clicks" width="narrow" />
                  <MetricPill icon={<UserPlus className="w-3 h-3" />} value={k.convT2} label="T2 registrations" highlight={Number(k.convT2) > 0} width="narrow" />
                  <MetricPill icon={<ShoppingCart className="w-3 h-3" />} value={k.convT3} label="T3 purchases" highlight={Number(k.convT3) > 0} width="narrow" />
                  <MetricPill icon={<Euro className="w-3 h-3" />} value={k.cost.toFixed(2)} label="cost €" />
                  <MetricPill icon={<Gauge className="w-3 h-3" />} value={k.qualityScore ?? "—"} label="QS" width="narrow" />
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
        (tab === k ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")
      }
    >
      <span>{label}</span>
      {badge ? <span className="text-[9px] opacity-70 normal-case tracking-normal">{badge}</span> : null}
    </button>
  );

  return (
    <div onClick={onClose} className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-lg bg-card border border-border rounded-xl shadow-xl flex flex-col max-h-[90vh]">
        <div className="px-4 py-3 border-b border-border flex items-center justify-between shrink-0">
          <h3 className="text-sm font-semibold text-foreground truncate">
            {isEdit ? "Edit ad" : "New ad"}
          </h3>
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
                        className={"h-8 px-3 rounded text-[11px] font-semibold uppercase tracking-wider transition-colors inline-flex items-center justify-center " + (status === s ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}
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
                      <select
                        value={h.pin ?? ""}
                        onChange={(e) => updateHeadline(i, { pin: (e.target.value || undefined) as HeadlinePin | undefined })}
                        className="h-9 px-2 rounded-md bg-secondary border border-border text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                      >
                        <option value="">unpinned</option>
                        <option value="HEADLINE_1">Pos 1</option>
                        <option value="HEADLINE_2">Pos 2</option>
                        <option value="HEADLINE_3">Pos 3</option>
                      </select>
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
                      <select
                        value={d.pin ?? ""}
                        onChange={(e) => updateDescription(i, { pin: (e.target.value || undefined) as DescriptionPin | undefined })}
                        className="h-9 px-2 rounded-md bg-secondary border border-border text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                      >
                        <option value="">unpinned</option>
                        <option value="DESCRIPTION_1">Pos 1</option>
                        <option value="DESCRIPTION_2">Pos 2</option>
                      </select>
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
            className="h-9 px-4 rounded-md bg-primary text-primary-foreground text-xs font-medium uppercase tracking-wider disabled:opacity-50 hover:opacity-90 transition-opacity"
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
            className="h-8 px-3 rounded-md bg-primary text-primary-foreground text-xs font-medium uppercase tracking-wider disabled:opacity-50 hover:opacity-90 transition-opacity"
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
            className="h-8 px-3 rounded-md bg-primary text-primary-foreground text-xs font-medium uppercase tracking-wider disabled:opacity-50 hover:opacity-90 transition-opacity shrink-0"
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
          <select
            value={header}
            onChange={(e) => setHeader(e.target.value)}
            className="w-full h-8 px-2 rounded-md bg-secondary border border-border text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          >
            {SNIPPET_HEADERS.map((h) => (
              <option key={h} value={h}>{h}</option>
            ))}
          </select>
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
            className="h-8 px-3 rounded-md bg-primary text-primary-foreground text-xs font-medium uppercase tracking-wider disabled:opacity-50 hover:opacity-90 transition-opacity"
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
        setError(`Error ${res.status}: ${txt.slice(0, 300)}`);
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
