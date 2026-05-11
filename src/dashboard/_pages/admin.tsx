"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { apiUrl } from "@/lib/api";
import { useTranslations } from "next-intl";
import { SubpageStickyBar } from "../_v2/ui";
import { BoxIcon, EyeIcon, FolderIcon, MessageIcon, RefreshIcon } from "../_v2/icons";
import { Mail, ArrowUpDown, ListChecks, Trash2, X as XIcon, Check } from "lucide-react";
import { formatDateShort } from "./_admin-helpers";
import { useDashboardRouter } from "../_spa/router";
import { AdminCompanyPage } from "./admin-company";
import { useScrollLock } from "../_v2/use-scroll-lock";

interface Company {
  id: string;
  name: string | null;
  plan: string;
  subscriptionStatus: string;
  trialEndsAt: string | null;
  categoriesCount: number;
  itemsCount: number;
  messagesCount: number;
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

  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [modalCompanyId, setModalCompanyId] = useState<string | null>(null);
  useScrollLock(Boolean(modalCompanyId));
  const [sortByLastVisit, setSortByLastVisit] = useState(false);
  const [scanDetails, setScanDetails] = useState(false);
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [bulkBusy, setBulkBusy] = useState(false);
  const selectedCount = selectedIds.size;

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

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function applyBulkDelete() {
    if (selectedIds.size === 0) return;
    setBulkBusy(true);
    try {
      await Promise.all(
        [...selectedIds].map((id) =>
          fetch(apiUrl(`/api/admin/companies/${id}`), {
            method: "DELETE",
            credentials: "include",
          }).catch(() => undefined),
        ),
      );
      setSelectedIds(new Set());
      setSelectMode(false);
      setConfirmDelete(false);
      void fetchCompanies("refresh");
    } finally {
      setBulkBusy(false);
    }
  }

  return (
    <div>
      <SubpageStickyBar onBack={() => router.push({ name: "settings" })} hideSave>
        <div className="flex items-center gap-1.5">
          {selectMode ? (
            <>
              <button
                type="button"
                onClick={() => selectedCount > 0 && setConfirmDelete(true)}
                disabled={selectedCount === 0 || bulkBusy}
                title={`Delete ${selectedCount}`}
                className="h-8 w-8 inline-flex items-center justify-center rounded-md bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/40 disabled:opacity-40"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() => {
                  setSelectMode(false);
                  setSelectedIds(new Set());
                }}
                title="Clear"
                className="h-8 w-8 inline-flex items-center justify-center rounded-md bg-secondary text-muted-foreground hover:text-foreground"
              >
                <XIcon className="h-3.5 w-3.5" />
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => {
                  setSelectMode(true);
                  setSelectedIds(new Set());
                }}
                title="Select companies"
                className="h-8 w-8 inline-flex items-center justify-center bg-secondary rounded-md text-muted-foreground hover:text-foreground"
              >
                <ListChecks className="h-3.5 w-3.5" />
              </button>
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
                <ArrowUpDown className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setScanDetails((v) => !v)}
                title="Scan details (1d/30d/45d/60d/85d)"
                className={
                  "h-8 w-8 inline-flex items-center justify-center rounded-md transition-colors " +
                  (scanDetails
                    ? "bg-primary text-primary-foreground"
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
          )}
        </div>
      </SubpageStickyBar>
      <div className="max-w-2xl mx-auto pt-5 md:pt-4">
        {loading && companies.length === 0 ? (
          <div className="text-xs text-muted-foreground py-8 text-center">{t("loading")}</div>
        ) : companies.length === 0 ? (
          <div className="text-xs text-muted-foreground py-8 text-center">{t("noCompanies")}</div>
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
                  onClick={() => {
                    if (selectMode) {
                      toggleSelect(company.id);
                      return;
                    }
                    setModalCompanyId(company.id);
                  }}
                  className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-left hover:bg-muted/40 transition-colors"
                >
                  {selectMode ? (
                    <span
                      className={
                        "shrink-0 inline-flex items-center justify-center w-3.5 h-3.5 rounded border " +
                        (selectedIds.has(company.id)
                          ? "bg-primary border-primary text-primary-foreground"
                          : "border-border bg-card")
                      }
                      aria-hidden
                    >
                      {selectedIds.has(company.id) ? <Check className="w-2.5 h-2.5" /> : null}
                    </span>
                  ) : null}
                  <span
                    className={
                      "font-medium truncate flex-1 " +
                      (nameColor ||
                        (company.name ? "text-foreground" : "text-muted-foreground italic"))
                    }
                  >
                    {company.name || t("noName")}
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
                      <>
                        {company.monthlyViews > 0 ? (
                          <span className="inline-flex items-center gap-0.5 text-blue-500" title="Scans, last 30 days">
                            <EyeIcon size={10} />
                            {company.monthlyViews}
                          </span>
                        ) : null}
                        {company.todayScans > 0 ? (
                          <span className="inline-flex items-center gap-0.5 text-emerald-600" title="Scans today">
                            <EyeIcon size={10} />
                            {company.todayScans}
                          </span>
                        ) : null}
                      </>
                    )}
                    {company.messagesCount > 0 ? (
                      <span className="inline-flex items-center gap-0.5 text-red-500 font-medium">
                        <MessageIcon size={10} />
                        {company.messagesCount}
                      </span>
                    ) : null}
                    {company.emailsSentCount > 0 ? (
                      <span className="inline-flex items-center gap-0.5 text-amber-500" title="Email templates sent">
                        <Mail size={10} />
                        {company.emailsSentCount}
                      </span>
                    ) : null}
                  </span>
                  {company.lastVisit ? (
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

      {confirmDelete ? (
        <div onClick={() => setConfirmDelete(false)} className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div onClick={(e) => e.stopPropagation()} className="w-full max-w-sm bg-card border border-border rounded-xl shadow-xl">
            <div className="px-4 py-3 border-b border-border">
              <h3 className="text-sm font-semibold text-foreground">Delete companies</h3>
            </div>
            <p className="px-4 py-3 text-sm text-muted-foreground">
              Delete {selectedCount} selected compan{selectedCount === 1 ? "y" : "ies"}? This cannot be undone.
            </p>
            <div className="px-4 py-3 border-t border-border flex items-center gap-2">
              <button type="button" onClick={() => setConfirmDelete(false)} className="flex-1 h-9 text-sm font-medium text-foreground bg-secondary rounded-md hover:bg-muted">
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void applyBulkDelete()}
                disabled={bulkBusy}
                className="flex-1 h-9 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700 disabled:opacity-60"
              >
                {bulkBusy ? "…" : "Delete"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
