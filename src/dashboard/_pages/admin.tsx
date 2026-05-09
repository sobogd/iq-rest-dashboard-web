"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { apiUrl } from "@/lib/api";
import { useTranslations } from "next-intl";
import { SubpageStickyBar } from "../_v2/ui";
import { BoxIcon, EyeIcon, FolderIcon, MessageIcon, RefreshIcon } from "../_v2/icons";
import { Mail, Clock } from "lucide-react";
import { formatDateShort } from "./_admin-helpers";
import { useDashboardRouter } from "../_spa/router";
import { AdminCompanyPage } from "./admin-company";

interface Company {
  id: string;
  name: string | null;
  plan: string;
  subscriptionStatus: string;
  categoriesCount: number;
  itemsCount: number;
  messagesCount: number;
  monthlyViews: number;
  todayScans: number;
  lastVisit: string | null;
  emailsSentCount: number;
}

export function AdminPage() {
  const t = useTranslations("dashboard.admin");
  const router = useDashboardRouter();

  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [modalCompanyId, setModalCompanyId] = useState<string | null>(null);
  const [sortByLastVisit, setSortByLastVisit] = useState(false);

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

  function openCompany(id: string) {
    setModalCompanyId(id);
  }

  return (
    <div>
      <SubpageStickyBar onBack={() => router.push({ name: "settings" })} hideSave>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setSortByLastVisit((v) => !v)}
            title="Sort by last visit"
            className={
              "h-8 w-8 inline-flex items-center justify-center rounded-md transition-colors " +
              (sortByLastVisit
                ? "bg-primary text-primary-foreground"
                : "bg-secondary text-muted-foreground hover:text-foreground")
            }
          >
            <Clock className="h-3.5 w-3.5" />
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
        </div>
      </SubpageStickyBar>
      <div className="max-w-2xl mx-auto pt-5 md:pt-4">
        <div className="mb-5">
          <div className="text-xs text-muted-foreground">{t("settingsBreadcrumb")}</div>
          <h2 className="text-xl font-medium text-foreground mt-1">{t("companiesTitle")}</h2>
        </div>

        {loading && companies.length === 0 ? (
          <div className="bg-card border border-border rounded-2xl py-10 flex items-center justify-center gap-2 text-xs text-muted-foreground">
            <span className="w-4 h-4 border-2 border-input border-t-foreground rounded-full animate-spin" />
            {t("loading")}
          </div>
        ) : companies.length === 0 ? (
          <div className="bg-card border border-border rounded-2xl p-8 text-center text-sm text-muted-foreground">
            {t("noCompanies")}
          </div>
        ) : (
          <div className="bg-card border border-border rounded-xl overflow-hidden divide-y divide-border">
            {visibleCompanies.map((company) => {
              const nameColor =
                company.subscriptionStatus === "ACTIVE" && company.plan === "PRO"
                  ? "text-emerald-600"
                  : company.subscriptionStatus === "ACTIVE" && company.plan === "BASIC"
                  ? "text-blue-500"
                  : "";
              return (
                <button
                  key={company.id}
                  type="button"
                  onClick={() => openCompany(company.id)}
                  className="w-full block px-3 py-2 text-left transition-colors"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div
                      className={
                        "text-sm font-medium truncate min-w-0 flex-1 " +
                        (nameColor ||
                          (company.name ? "text-foreground" : "text-muted-foreground italic"))
                      }
                    >
                      {company.name || t("noName")}
                    </div>
                    {company.lastVisit ? (
                      <span className="text-[11px] text-muted-foreground tabular-nums shrink-0">
                        {formatDateShort(company.lastVisit)}
                      </span>
                    ) : null}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1 tabular-nums">
                    <span className="inline-flex items-center gap-0.5">
                      <FolderIcon size={11} />
                      {company.categoriesCount}
                    </span>
                    <span className="inline-flex items-center gap-0.5">
                      <BoxIcon size={11} />
                      {company.itemsCount}
                    </span>
                    {company.monthlyViews > 0 ? (
                      <span
                        className="inline-flex items-center gap-0.5 text-blue-500"
                        title="Scans, last 30 days"
                      >
                        <EyeIcon size={11} />
                        {company.monthlyViews}
                      </span>
                    ) : null}
                    {company.todayScans > 0 ? (
                      <span
                        className="inline-flex items-center gap-0.5 text-emerald-600"
                        title="Scans today"
                      >
                        <EyeIcon size={11} />
                        {company.todayScans}
                      </span>
                    ) : null}
                    {company.messagesCount > 0 ? (
                      <span className="inline-flex items-center gap-0.5 text-red-500 font-medium">
                        <MessageIcon size={11} />
                        {company.messagesCount}
                      </span>
                    ) : null}
                    {company.emailsSentCount > 0 ? (
                      <span
                        className="inline-flex items-center gap-0.5 text-amber-500"
                        title="Email templates sent"
                      >
                        <Mail size={11} />
                        {company.emailsSentCount}
                      </span>
                    ) : null}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

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
