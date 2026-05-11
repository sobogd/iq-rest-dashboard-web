"use client";

import { useEffect, useState } from "react";
import {
  ChevronRight,
  Eye,
  MousePointerClick,
  Target,
  Euro,
  Gauge,
  Coins,
  RefreshCw,
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
  impressions: number;
  clicks: number;
  conversions: number;
  cost: number;
}

interface AdGroupRow {
  id: string;
  name: string;
  status: Status;
  suffix?: string;
  impressions: number;
  clicks: number;
  conversions: number;
  cost: number;
}

interface KeywordRow {
  id: string;
  title: string;
  status: Status;
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
  finalUrls: string[];
  headlines: Array<{ text: string; pinned?: string }>;
  descriptions: Array<{ text: string; pinned?: string }>;
  path1?: string;
  path2?: string;
  adStrength?: string;
}

interface NegativeRow {
  id: string;
  title: string;
  status: Status;
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

type View =
  | { kind: "campaigns" }
  | { kind: "campaign"; campaignId: string }
  | { kind: "ad_group_detail"; campaignId: string; adGroupId: string }
  | { kind: "campaign_negatives"; campaignId: string };

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
  const [refreshTick, setRefreshTick] = useState(0);
  const [view, setView] = useState<View>({ kind: "campaigns" });
  const [loading, setLoading] = useState(true);

  // Page-specific data
  const [page1, setPage1] = useState<{ campaigns: CampaignRow[]; timeline: TimelineBucket[] } | null>(null);
  const [page2, setPage2] = useState<{ campaign: { id: string; name: string }; adGroups: AdGroupRow[]; negativesCount: number } | null>(null);
  const [page3, setPage3] = useState<{ adGroup: { id: string; name: string; suffix?: string; campaignId: string; campaignName: string }; keywords: KeywordRow[]; ads: AdRow[]; assets: CampAssets } | null>(null);
  const [page4, setPage4] = useState<{ negatives: NegativeRow[] } | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const qs = new URLSearchParams();
        qs.set("status", filterStatus);
        qs.set("dateRange", filterDateRange);
        let url: string;
        if (view.kind === "campaigns") url = `/api/admin/google-ads/page-campaigns?${qs}`;
        else if (view.kind === "campaign") url = `/api/admin/google-ads/page-campaign/${view.campaignId}?${qs}`;
        else if (view.kind === "ad_group_detail") url = `/api/admin/google-ads/page-ad-group/${view.adGroupId}?${qs}`;
        else url = `/api/admin/google-ads/page-negatives/${view.campaignId}?${qs}`;

        const res = await fetch(apiUrl(url), { credentials: "include" });
        if (!res.ok) {
          if (!cancelled) {
            setPage1(null); setPage2(null); setPage3(null); setPage4(null);
          }
          return;
        }
        const j = await res.json();
        if (cancelled) return;
        if (view.kind === "campaigns") setPage1(j);
        else if (view.kind === "campaign") setPage2(j);
        else if (view.kind === "ad_group_detail") setPage3(j);
        else setPage4(j);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => { cancelled = true; };
  }, [view, filterStatus, filterDateRange, refreshTick]);

  function handleBack() {
    if (view.kind === "campaigns") {
      router.push({ name: "settings" });
    } else if (view.kind === "campaign") {
      setView({ kind: "campaigns" });
    } else if (view.kind === "ad_group_detail" || view.kind === "campaign_negatives") {
      setView({ kind: "campaign", campaignId: view.campaignId });
    }
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
            onClick={() => setRefreshTick((n) => n + 1)}
            title="Refresh"
            className="h-8 w-8 inline-flex items-center justify-center bg-secondary rounded-md text-muted-foreground hover:text-foreground"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </SubpageStickyBar>

      <div className="max-w-2xl mx-auto pt-5 md:pt-4 space-y-3">
        {view.kind !== "campaigns" ? (
          <Breadcrumb view={view} page2={page2} page3={page3} onNav={setView} />
        ) : null}

        {loading ? (
          <div className="text-xs text-muted-foreground py-8 text-center">Loading…</div>
        ) : view.kind === "campaigns" && page1 ? (
          <>
            <div className="bg-card border border-border rounded-xl overflow-hidden divide-y divide-border">
              {page1.campaigns.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setView({ kind: "campaign", campaignId: c.id })}
                  className="w-full text-left px-3 py-2 flex items-center gap-1.5 flex-wrap min-w-0 hover:bg-muted/40 transition-colors"
                >
                  <TitleTag text={c.name} color={TAG_COLOR.campaign} paused={c.status === "PAUSED"} />
                  <MetricPill icon={<Eye className="w-3 h-3" />} value={c.impressions} label="impressions" />
                  <MetricPill icon={<MousePointerClick className="w-3 h-3" />} value={c.clicks} label="clicks" />
                  <MetricPill icon={<Target className="w-3 h-3" />} value={c.conversions} label="conversions" />
                  <MetricPill icon={<Euro className="w-3 h-3" />} value={c.cost.toFixed(2)} label="cost €" />
                  <ChevronRight className="ml-auto w-3.5 h-3.5 text-muted-foreground shrink-0" />
                </button>
              ))}
            </div>
            {page1.campaigns.length > 0 ? <TotalRow items={page1.campaigns} /> : null}
            {page1.timeline.length > 0 ? <Timeline buckets={page1.timeline} /> : null}
          </>
        ) : view.kind === "campaign" && page2 ? (
          <div className="space-y-3">
            <div className="bg-card border border-border rounded-xl overflow-hidden divide-y divide-border">
              {page2.adGroups.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => setView({ kind: "ad_group_detail", campaignId: view.campaignId, adGroupId: a.id })}
                  className="w-full text-left px-3 py-2 space-y-1.5 hover:bg-muted/40 transition-colors"
                >
                  <div className="flex items-center gap-1.5 min-w-0">
                    <TitleTag text={a.name} color={TAG_COLOR.ad_group} paused={a.status === "PAUSED"} />
                    <ChevronRight className="ml-auto w-3.5 h-3.5 text-muted-foreground shrink-0" />
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
                </button>
              ))}
            </div>
            <div className="flex gap-2 px-3 md:px-0">
              <button
                type="button"
                onClick={() => setView({ kind: "campaign_negatives", campaignId: view.campaignId })}
                className="flex-1 h-10 rounded-xl text-sm font-medium bg-card border border-border text-foreground hover:bg-muted/40 transition-colors"
              >
                Negatives ({page2.negativesCount})
              </button>
            </div>
          </div>
        ) : view.kind === "ad_group_detail" && page3 ? (
          <AdGroupDetail data={page3} />
        ) : view.kind === "campaign_negatives" && page4 ? (
          <div className="bg-card border border-border rounded-xl overflow-hidden divide-y divide-border">
            {page4.negatives.length === 0 ? (
              <div className="text-xs text-muted-foreground py-8 text-center">No negatives</div>
            ) : (
              page4.negatives.map((n) => (
                <div key={n.id} className="px-3 py-2 flex items-center gap-1.5 flex-wrap min-w-0">
                  <TitleTag text={n.title} color={TAG_COLOR.negative} paused={n.status === "PAUSED"} />
                </div>
              ))
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function Breadcrumb({ view, page2, page3, onNav }: { view: View; page2: any; page3: any; onNav: (v: View) => void }) {
  return (
    <div className="px-3 md:px-0 text-[11px] text-muted-foreground flex items-center gap-1 flex-wrap">
      <button type="button" onClick={() => onNav({ kind: "campaigns" })} className="hover:text-foreground transition-colors">Campaigns</button>
      {view.kind !== "campaigns" ? (
        <>
          <ChevronRight className="w-3 h-3" />
          {view.kind === "campaign" ? (
            <span className="text-foreground truncate max-w-[200px]">{page2?.campaign?.name ?? ""}</span>
          ) : (
            <button
              type="button"
              onClick={() => onNav({ kind: "campaign", campaignId: (view as any).campaignId })}
              className="hover:text-foreground transition-colors truncate max-w-[200px]"
            >
              {page3?.adGroup?.campaignName ?? page2?.campaign?.name ?? ""}
            </button>
          )}
        </>
      ) : null}
      {view.kind === "ad_group_detail" ? (
        <>
          <ChevronRight className="w-3 h-3" />
          <span className="text-foreground truncate max-w-[200px]">{page3?.adGroup?.name ?? ""}</span>
        </>
      ) : view.kind === "campaign_negatives" ? (
        <>
          <ChevronRight className="w-3 h-3" />
          <span className="text-foreground">Negatives</span>
        </>
      ) : null}
    </div>
  );
}

function AdGroupDetail({ data }: { data: { adGroup: any; keywords: KeywordRow[]; ads: AdRow[]; assets: CampAssets } }) {
  return (
    <div className="space-y-4">
      <div>
        <div className="px-3 md:px-0 text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5">
          Keywords ({data.keywords.length})
        </div>
        <div className="bg-card border border-border rounded-xl overflow-hidden divide-y divide-border">
          {data.keywords.length === 0 ? (
            <div className="text-xs text-muted-foreground py-4 text-center">No keywords</div>
          ) : (
            data.keywords.map((k) => (
              <div key={k.id} className="px-3 py-2 flex items-center gap-1.5 flex-wrap min-w-0">
                <TitleTag text={k.title} color={TAG_COLOR.keyword} paused={k.status === "PAUSED"} />
                <MetricPill icon={<Eye className="w-3 h-3" />} value={k.impressions} label="impressions" />
                <MetricPill icon={<MousePointerClick className="w-3 h-3" />} value={k.clicks} label="clicks" />
                <MetricPill icon={<Target className="w-3 h-3" />} value={k.conversions} label="conversions" />
                <MetricPill icon={<Euro className="w-3 h-3" />} value={k.cost.toFixed(2)} label="cost €" />
                <MetricPill icon={<Gauge className="w-3 h-3" />} value={k.qualityScore ?? "—"} label="QS" />
                <MetricPill icon={<Coins className="w-3 h-3" />} value={k.bid != null ? k.bid.toFixed(2) : "—"} label="bid €" />
              </div>
            ))
          )}
        </div>
      </div>
      <div>
        <div className="px-3 md:px-0 text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5">
          Ads ({data.ads.length})
        </div>
        {data.ads.length === 0 ? (
          <div className="text-xs text-muted-foreground py-4 text-center">No ads</div>
        ) : (
          <div className="space-y-3">
            {data.ads.map((a) => (
              <AdCard key={a.id} ad={a} assets={data.assets} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function AdCard({ ad, assets }: { ad: AdRow; assets: CampAssets }) {
  return (
    <div className="bg-card border border-border rounded-xl px-3 py-3 space-y-2">
      <div className="flex items-center gap-1.5 flex-wrap min-w-0">
        <span className={`shrink-0 inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium uppercase tracking-wider ${TAG_COLOR.ad}${ad.status === "PAUSED" ? " opacity-60" : ""}`}>
          Ad {ad.id}
        </span>
        {ad.adStrength ? (
          <span className="shrink-0 inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium uppercase tracking-wider bg-emerald-500/10 text-emerald-500">
            {ad.adStrength}
          </span>
        ) : null}
        {assets.imageCount ? (
          <span className="shrink-0 inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium uppercase tracking-wider bg-muted text-muted-foreground">
            {assets.imageCount} img
          </span>
        ) : null}
        {assets.logoCount ? (
          <span className="shrink-0 inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium uppercase tracking-wider bg-muted text-muted-foreground">
            {assets.logoCount} logo
          </span>
        ) : null}
      </div>
      {ad.finalUrls.length > 0 ? (
        <div className="text-[11px] truncate">
          <span className="text-muted-foreground">URL: </span>
          <span className="text-foreground font-mono">{ad.finalUrls[0]}</span>
          {ad.path1 || ad.path2 ? <span className="text-muted-foreground font-mono">/{ad.path1 ?? ""}{ad.path2 ? `/${ad.path2}` : ""}</span> : null}
        </div>
      ) : null}
      {assets.businessNames.length > 0 ? (
        <div className="text-[11px]">
          <span className="text-muted-foreground">Business: </span>
          <span className="text-foreground">{assets.businessNames.join(", ")}</span>
        </div>
      ) : null}
      <div>
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Headlines ({ad.headlines.length})</div>
        <div className="flex items-center gap-1 flex-wrap">
          {ad.headlines.map((h, i) => (
            <span
              key={i}
              className={"inline-flex items-center px-2 py-0.5 rounded text-[11px] " + (h.pinned ? "bg-amber-500/10 text-amber-500" : "bg-secondary text-foreground")}
              title={h.pinned ? `Pinned: ${h.pinned}` : ""}
            >
              {h.pinned ? <span className="mr-1">📌</span> : null}
              {h.text}
            </span>
          ))}
        </div>
      </div>
      <div>
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Descriptions ({ad.descriptions.length})</div>
        <div className="space-y-1">
          {ad.descriptions.map((d, i) => (
            <div
              key={i}
              className={"px-2 py-1 rounded text-[11px] " + (d.pinned ? "bg-amber-500/10 text-amber-500" : "bg-secondary text-foreground")}
              title={d.pinned ? `Pinned: ${d.pinned}` : ""}
            >
              {d.pinned ? <span className="mr-1">📌</span> : null}
              {d.text}
            </div>
          ))}
        </div>
      </div>
      {assets.sitelinks.length > 0 ? (
        <div>
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Sitelinks ({assets.sitelinks.length})</div>
          <div className="flex items-center gap-1 flex-wrap">
            {assets.sitelinks.map((s, i) => (
              <span key={i} className="inline-flex items-center px-2 py-0.5 rounded text-[11px] bg-blue-500/10 text-blue-500" title={[s.desc1, s.desc2].filter(Boolean).join(" · ")}>
                {s.title}
              </span>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function TotalRow({ items }: { items: CampaignRow[] }) {
  const total = items.reduce(
    (acc, e) => ({
      impressions: acc.impressions + e.impressions,
      clicks: acc.clicks + e.clicks,
      conversions: acc.conversions + e.conversions,
      cost: acc.cost + e.cost,
    }),
    { impressions: 0, clicks: 0, conversions: 0, cost: 0 },
  );
  return (
    <div className="bg-card border border-border rounded-xl px-3 py-2 flex items-center gap-1.5 flex-wrap min-w-0">
      <span className="shrink-0 inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium uppercase tracking-wider bg-emerald-500/10 text-emerald-500">
        Total
      </span>
      <MetricPill icon={<Eye className="w-3 h-3" />} value={total.impressions} label="impressions" />
      <MetricPill icon={<MousePointerClick className="w-3 h-3" />} value={total.clicks} label="clicks" />
      <MetricPill icon={<Target className="w-3 h-3" />} value={total.conversions} label="conversions" />
      <MetricPill icon={<Euro className="w-3 h-3" />} value={total.cost.toFixed(2)} label="cost €" />
    </div>
  );
}

function Timeline({ buckets }: { buckets: TimelineBucket[] }) {
  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden divide-y divide-border">
      {buckets.map((b) => (
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

function TitleTag({ text, color, paused }: { text: string; color: string; paused: boolean }) {
  return (
    <span
      className={"shrink-0 inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium uppercase tracking-wider " + color + (paused ? " opacity-60" : "")}
      title={text}
    >
      <span className="truncate max-w-[260px]">{text}</span>
    </span>
  );
}

function MetricPill({ icon, value, label }: { icon: React.ReactNode; value: number | string; label: string }) {
  return (
    <span
      className="shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium uppercase tracking-wider bg-muted text-muted-foreground tabular-nums"
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
