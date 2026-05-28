"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { apiUrl } from "@/lib/api";
import { useTranslations } from "next-intl";
import { SubpageStickyBar } from "../_v2/ui";
import { BoxIcon, EyeIcon, FolderIcon, MessageIcon, RefreshIcon } from "../_v2/icons";
import { Mail, ArrowUpDown } from "lucide-react";
import { formatDateShort } from "./_admin-helpers";
import { useDashboardRouter } from "../_spa/router";
import { AdminCompanyPage } from "./admin-company";
import { AdminRestaurantsPage } from "./admin-restaurants";
import { AdminUsersPage } from "./admin-users";
import { useScrollLock } from "../_v2/use-scroll-lock";

type AdminTab = "restaurants" | "users" | "companies";

interface Company {
  id: string;
  name: string | null;
  plan: string;
  subscriptionStatus: string;
  trialEndsAt: string | null;
  categoriesCount: number;
  itemsCount: number;
  messagesCount: number;
  messagesLastDayCount: number;
  monthlyViews: number;
  todayScans: number;
  scans45d: number;
  scans60d: number;
  scans85d: number;
  lastVisit: string | null;
  emailsSentCount: number;
}

export function AdminPage() {
  const t = useTranslations("dashboard.admin");
  const router = useDashboardRouter();
  const [tab, setTab] = useState<AdminTab>("restaurants");

  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [modalCompanyId, setModalCompanyId] = useState<string | null>(null);
  useScrollLock(Boolean(modalCompanyId));
  const [sortByLastVisit, setSortByLastVisit] = useState(false);
  const [scanDetails, setScanDetails] = useState(false);

  const visibleCompanies = useMemo(() => {
    if (!sortByLastVisit) return companies;
    return [...companies].sort((a, b) => {
      const aT = a.lastVisit ? new Date(a.lastVisit).getTime() : 0;
      const bT = b.lastVisit ? new Date(b.lastVisit).getTime() : 0;
      return bT - aT;
    });
  }, [companies, sortByLastVisit]);

  const fetchCompanies = useCallback(
    async (mode: "initial" | "refresh") => {
      if (mode === "initial") setLoading(true);
      else setRefreshing(true);
      try {
        const res = await fetch(apiUrl(`/api/admin/companies`), {
          credentials: "include",
        });
        if (!res.ok) return;
        const data = await res.json();
        setCompanies(data.companies);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [],
  );

  useEffect(() => {
    void fetchCompanies("initial");
  }, [fetchCompanies]);

  function refresh() {
    if (refreshing) return;
    void fetchCompanies("refresh");
  }

  // Push a force-reload SSE event to every paired kitchen tablet across
  // every company. Used after deploying an urgent kitchen-bundle fix so
  // staff doesn't have to walk the floors manually refreshing.
  const [reloading, setReloading] = useState(false);
  async function reloadAllTablets() {
    if (reloading) return;
    if (!window.confirm("Reload every paired tablet across all companies?")) return;
    setReloading(true);
    try {
      const res = await fetch(apiUrl(`/api/admin/devices/reload-all`), {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) {
        alert("Failed to send reload");
        return;
      }
      const data = (await res.json()) as { devices: number; restaurants: number };
      alert(`Reload sent to ${data.devices} tablet(s) across ${data.restaurants} restaurant(s)`);
    } catch {
      alert("Network error");
    } finally {
      setReloading(false);
    }
  }

  const tabs: { id: AdminTab; label: string }[] = [
    { id: "restaurants", label: "Restaurants" },
    { id: "users", label: "Users" },
    { id: "companies", label: "Companies (legacy)" },
  ];

  return (
    <div>
      <SubpageStickyBar onBack={() => router.push({ name: "settings" })} hideSave>
        <div className="flex items-center gap-1.5 flex-wrap">
          <div className="flex items-center gap-0.5 bg-secondary rounded-md p-0.5">
            {tabs.map((tb) => (
              <button
                key={tb.id}
                type="button"
                onClick={() => setTab(tb.id)}
                className={
                  "h-7 px-2.5 text-xs font-medium rounded transition-colors " +
                  (tab === tb.id
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground")
                }
              >
                {tb.label}
              </button>
            ))}
          </div>
          {tab === "companies" ? (
            <>
              <button
                type="button"
                onClick={() => setSortByLastVisit((v) => !v)}
                title="Sort by last visit"
                className={
                  "h-8 w-8 inline-flex items-center justify-center rounded-md transition-colors " +
                  (sortByLastVisit
                    ? "bg-primary-gradient text-primary-foreground"
                    : "bg-secondary text-muted-foreground hover:text-foreground")
                }
              >
                <ArrowUpDown className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setScanDetails((v) => !v)}
                title="Scan details (1d/30d/45d/60d/85d)"
                className={
                  "h-8 w-8 inline-flex items-center justify-center rounded-md transition-colors " +
                  (scanDetails
                    ? "bg-primary-gradient text-primary-foreground"
                    : "bg-secondary text-muted-foreground hover:text-foreground")
                }
              >
                <EyeIcon size={13} />
              </button>
              <button
                type="button"
                onClick={refresh}
                disabled={refreshing}
                title={t("refresh")}
                className="h-8 w-8 inline-flex items-center justify-center bg-secondary rounded-md text-muted-foreground hover:text-foreground disabled:opacity-60"
              >
                {refreshing ? (
                  <span className="w-3.5 h-3.5 border-2 border-input border-t-foreground rounded-full animate-spin" />
                ) : (
                  <RefreshIcon size={13} />
                )}
              </button>
            </>
          ) : null}
          <button
            type="button"
            onClick={reloadAllTablets}
            disabled={reloading}
            title="Reload every paired tablet across all companies"
            className="h-8 px-3 text-xs font-medium inline-flex items-center bg-secondary rounded-md text-muted-foreground hover:text-foreground disabled:opacity-60"
          >
            {reloading ? "Sending…" : "Reload tablets"}
          </button>
        </div>
      </SubpageStickyBar>

      {tab === "restaurants" ? <AdminRestaurantsPage /> : null}
      {tab === "users" ? <AdminUsersPage /> : null}

      {tab === "companies" ? <CompaniesLegacyView
        companies={companies}
        loading={loading}
        visibleCompanies={visibleCompanies}
        scanDetails={scanDetails}
        onOpen={setModalCompanyId}
        t={t}
      /> : null}

      {modalCompanyId ? (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setModalCompanyId(null)}
        >
          <div
            className="w-full max-w-md bg-background border border-border rounded-2xl shadow-xl flex flex-col max-h-[85dvh] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <AdminCompanyPage companyId={modalCompanyId} onClose={() => setModalCompanyId(null)} />
          </div>
        </div>
      ) : null}
    </div>
  );
}

// Legacy company-centric table — kept reachable from the "Companies" tab so
// admin can still cross-check the old view during the per-restaurant billing
// transition. Will be removed once the new Restaurants/Users tabs are
// confirmed stable.
function CompaniesLegacyView({
  companies,
  loading,
  visibleCompanies,
  scanDetails,
  onOpen,
  t,
}: {
  companies: Company[];
  loading: boolean;
  visibleCompanies: Company[];
  scanDetails: boolean;
  onOpen: (id: string) => void;
  t: ReturnType<typeof useTranslations>;
}) {
  return (
    <>
      <div className="max-w-5xl mx-auto md:px-6 pt-5 md:pt-4">
        {loading && companies.length === 0 ? (
          <div className="text-xs text-muted-foreground py-8 text-center">{t("loading")}</div>
        ) : companies.length === 0 ? (
          <div className="text-xs text-muted-foreground py-8 text-center">{t("noCompanies") || "No companies"}</div>
        ) : (
          <div className="bg-card border border-border rounded-xl overflow-hidden divide-y divide-border">
            {visibleCompanies.map((company) => {
              const trialEndMs = company.trialEndsAt ? new Date(company.trialEndsAt).getTime() : null;
              const trialActive =
                company.subscriptionStatus !== "ACTIVE" &&
                trialEndMs !== null &&
                trialEndMs >= Date.now();
              const trialExpired =
                company.subscriptionStatus !== "ACTIVE" &&
                trialEndMs !== null &&
                trialEndMs < Date.now();
              const trialDaysLeft =
                trialActive && trialEndMs !== null
                  ? Math.max(1, Math.ceil((trialEndMs - Date.now()) / 86_400_000))
                  : null;
              const nameColor =
                company.subscriptionStatus === "ACTIVE"
                  ? "text-emerald-600"
                  : trialActive
                  ? "text-orange-500"
                  : trialExpired
                  ? "text-muted-foreground"
                  : "";
              return (
                <button
                  key={company.id}
                  type="button"
                  onClick={() => onOpen(company.id)}
                  className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-left hover:bg-muted/40 transition-colors"
                >
                  <span
                    className={
                      "font-medium truncate flex-1 " +
                      (nameColor ||
                        (company.name ? "text-foreground" : "text-muted-foreground italic"))
                    }
                  >
                    {company.name || t("noName")}
                    {trialDaysLeft !== null ? ` (${trialDaysLeft})` : ""}
                  </span>
                  <span className="inline-flex items-center gap-2 text-[10px] text-muted-foreground tabular-nums shrink-0">
                    <span className="inline-flex items-center gap-0.5">
                      <FolderIcon size={10} />
                      {company.categoriesCount}
                    </span>
                    <span className="inline-flex items-center gap-0.5">
                      <BoxIcon size={10} />
                      {company.itemsCount}
                    </span>
                    {scanDetails ? (
                      // Eye toggle ON — surface every scan bucket and hide
                      // messages/emails/lastVisit so the row reads as a
                      // pure traffic snapshot.
                      <>
                        <span className="inline-flex items-center gap-0.5 text-emerald-600" title="Scans today (1d)">
                          <EyeIcon size={10} />
                          {company.todayScans}
                        </span>
                        <span className="inline-flex items-center gap-0.5 text-blue-500" title="Scans last 30 days">
                          <EyeIcon size={10} />
                          {company.monthlyViews}
                        </span>
                        <span className="inline-flex items-center gap-0.5 text-purple-500" title="Scans last 45 days">
                          <EyeIcon size={10} />
                          {company.scans45d}
                        </span>
                        <span className="inline-flex items-center gap-0.5 text-amber-500" title="Scans last 60 days">
                          <EyeIcon size={10} />
                          {company.scans60d}
                        </span>
                        <span className="inline-flex items-center gap-0.5 text-rose-500" title="Scans last 85 days">
                          <EyeIcon size={10} />
                          {company.scans85d}
                        </span>
                      </>
                    ) : (
                      // Eye toggle OFF — primary moderation signals:
                      // total messages (red), last-24h messages (green),
                      // email templates sent.
                      <>
                        {company.messagesCount > 0 ? (
                          <span className="inline-flex items-center gap-0.5 text-red-500 font-medium" title="Support messages — total">
                            <MessageIcon size={10} />
                            {company.messagesCount}
                          </span>
                        ) : null}
                        {company.messagesLastDayCount > 0 ? (
                          <span className="inline-flex items-center gap-0.5 text-emerald-600 font-medium" title="Support messages — last 24h">
                            <MessageIcon size={10} />
                            {company.messagesLastDayCount}
                          </span>
                        ) : null}
                        {company.emailsSentCount > 0 ? (
                          <span className="inline-flex items-center gap-0.5 text-amber-500" title="Email templates sent">
                            <Mail size={10} />
                            {company.emailsSentCount}
                          </span>
                        ) : null}
                      </>
                    )}
                  </span>
                  {!scanDetails && company.lastVisit ? (
                    <span className="text-[10px] text-muted-foreground tabular-nums shrink-0">
                      {formatDateShort(company.lastVisit)}
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}
