"use client";

import { useEffect, useState, useCallback } from "react";
import { useTranslations } from "next-intl";
import { SubpageStickyBar } from "../_v2/ui";
import { useDashboardRouter } from "../_spa/router";

interface Company {
  id: string;
  name: string | null;
  plan: string;
  subscriptionStatus: string;
  categoriesCount: number;
  itemsCount: number;
  messagesCount: number;
  monthlyViews: number;
  todayViews: number;
  scanLimit: number | null;
}

type Filter = "all" | "today_active";

export function AdminPage() {
  const t = useTranslations("dashboard.admin");
  const router = useDashboardRouter();

  const TABS: { value: Filter; labelKey: "all" | "activeToday" }[] = [
    { value: "all", labelKey: "all" },
    { value: "today_active", labelKey: "activeToday" },
  ];

  const [filter, setFilter] = useState<Filter>("all");
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchCompanies = useCallback(async (f: Filter) => {
    setLoading(true);
    try {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const params = new URLSearchParams({ filter: f, tz });
      const res = await fetch(`/api/admin/companies?${params}`);
      if (!res.ok) return;
      const data = await res.json();
      setCompanies(data.companies);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCompanies(filter);
  }, [filter, fetchCompanies]);

  function openCompany(id: string) {
    router.push({ name: "settings.admin.company", id });
  }

  return (
    <div>
      <SubpageStickyBar onBack={() => router.push({ name: "settings" })} hideSave>
        <div className="inline-flex items-center gap-0.5 p-0.5 bg-secondary rounded-lg">
          {TABS.map((tab) => {
            const isActive = filter === tab.value;
            return (
              <button
                key={tab.value}
                type="button"
                onClick={() => setFilter(tab.value)}
                className={
                  "h-7 px-2.5 text-[11px] font-medium rounded-md transition-colors " +
                  (isActive ? "bg-card text-foreground shadow-sm" : "text-muted-foreground")
                }
              >
                {t(tab.labelKey)}
              </button>
            );
          })}
        </div>
      </SubpageStickyBar>
      <div className="max-w-2xl mx-auto pt-5 md:pt-4">
        <div className="mb-5">
          <div className="text-xs text-muted-foreground">{t("settingsBreadcrumb")}</div>
          <h2 className="text-xl font-medium text-foreground mt-1">{t("companiesTitle")}</h2>
        </div>

      {loading && companies.length === 0 ? (
        <div className="bg-card border border-border rounded-2xl p-8 text-center text-sm text-muted-foreground">
          {t("loading")}
        </div>
      ) : companies.length === 0 ? (
        <div className="bg-card border border-border rounded-2xl p-8 text-center text-sm text-muted-foreground">
          {t("noCompanies")}
        </div>
      ) : (
        <div className="bg-card border border-border rounded-xl overflow-hidden divide-y divide-border">
          {companies.map((company) => {
            const nameColor =
              company.subscriptionStatus === "ACTIVE" && company.plan === "PRO"
                ? "text-emerald-600"
                : company.subscriptionStatus === "ACTIVE" && company.plan === "BASIC"
                ? "text-blue-500"
                : "";
            const overLimit =
              company.scanLimit !== null && company.monthlyViews >= (company.scanLimit ?? 0);
            return (
              <button
                key={company.id}
                type="button"
                onClick={() => openCompany(company.id)}
                className="flex items-center gap-2.5 w-full px-4 py-2.5 text-left transition-colors"
              >
                <span
                  className={
                    "text-sm truncate flex-1 min-w-0 " +
                    (nameColor || (company.name ? "text-foreground" : "text-muted-foreground italic"))
                  }
                >
                  {company.name || t("noName")}
                </span>
                <div className="flex items-center gap-2 text-xs text-muted-foreground shrink-0 tabular-nums">
                  <span>📁{company.categoriesCount}</span>
                  <span>📦{company.itemsCount}</span>
                  {company.monthlyViews > 0 ? (
                    <span className={overLimit ? "text-red-500" : "text-blue-500"}>
                      👁{company.monthlyViews}
                      {company.todayViews > 0 ? (
                        <span className="text-muted-foreground">({company.todayViews})</span>
                      ) : null}
                    </span>
                  ) : null}
                  {company.messagesCount > 0 ? (
                    <span className="text-red-500 font-medium">💬{company.messagesCount}</span>
                  ) : null}
                </div>
              </button>
            );
          })}
        </div>
      )}
      </div>
    </div>
  );
}
