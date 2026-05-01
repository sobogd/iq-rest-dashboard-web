"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { apiUrl } from "@/lib/api";
import { ChevronRightIcon } from "../../_v2/icons";
import { PageHeader } from "../../_v2/ui";
import { LogoutLink } from "../../settings/logout-link";
import { track } from "@/lib/dashboard-events";
import { useDashboardRouter } from "../router";
import type { View } from "../types";

interface CardDef {
  view: View;
  titleKey: string;
  descKey: string;
  event: string;
}

const CARDS: CardDef[] = [
  { view: { name: "settings.about" }, titleKey: "about", descKey: "aboutDesc", event: "dash_settings_click_tab_about" },
  { view: { name: "settings.contacts" }, titleKey: "contacts", descKey: "contactsDesc", event: "dash_settings_click_tab_contacts" },
  { view: { name: "settings.branding" }, titleKey: "branding", descKey: "brandingDesc", event: "dash_settings_click_tab_brand" },
  { view: { name: "settings.general" }, titleKey: "general", descKey: "generalDesc", event: "dash_settings_click_tab_general" },
  { view: { name: "settings.tables" }, titleKey: "tables", descKey: "tablesDesc", event: "dash_settings_click_tab_tables" },
  { view: { name: "settings.orders" }, titleKey: "orders", descKey: "ordersDesc", event: "dash_settings_click_tab_orders" },
  { view: { name: "settings.bookings" }, titleKey: "bookings", descKey: "bookingsDesc", event: "dash_settings_click_tab_bookings" },
  { view: { name: "settings.languages" }, titleKey: "languages", descKey: "languagesDesc", event: "dash_settings_click_tab_langs" },
  { view: { name: "settings.billing" }, titleKey: "billing", descKey: "billingDesc", event: "dash_settings_click_tab_billing" },
  { view: { name: "settings.support" }, titleKey: "support", descKey: "supportDesc", event: "dash_settings_click_tab_support" },
];

export function SettingsHubView({
  isAdmin,
  impersonatedBy,
}: {
  isAdmin: boolean;
  impersonatedBy?: string | null;
}) {
  const t = useTranslations("dashboard.settingsHub");
  const router = useDashboardRouter();
  const [exiting, setExiting] = useState(false);

  async function handleExitImpersonation() {
    if (exiting) return;
    setExiting(true);
    try {
      const res = await fetch(apiUrl("/api/admin/impersonate/exit"), {
        credentials: "include",
        method: "POST",
      });
      if (res.ok) {
        window.location.assign("/");
      } else {
        setExiting(false);
      }
    } catch {
      setExiting(false);
    }
  }

  useEffect(() => {
  }, []);

  return (
    <div className="max-w-2xl mx-auto">
      <PageHeader title={t("title")} subtitle={t("subtitle")} />
      <div className="space-y-2.5">
        {CARDS.map((card) => (
          <button
            key={card.titleKey}
            type="button"
            onClick={() => {
              track(card.event);
              router.push(card.view);
            }}
            className="w-full text-left p-4 bg-card border border-border rounded-xl transition-colors flex items-center justify-between gap-3"
          >
            <div className="min-w-0">
              <div className="text-sm font-medium text-foreground">{t(`rows.${card.titleKey}` as never)}</div>
              <div className="text-xs text-muted-foreground leading-snug mt-0.5">{t(`rows.${card.descKey}` as never)}</div>
            </div>
            <ChevronRightIcon size={16} className="text-muted-foreground shrink-0" />
          </button>
        ))}
        {isAdmin ? (
          <>
            <button
              type="button"
              onClick={() => {
                router.push({ name: "settings.admin.companies" });
              }}
              className="w-full text-left p-4 bg-card border border-border rounded-xl transition-colors flex items-center justify-between gap-3"
            >
              <div className="min-w-0">
                <div className="text-sm font-medium text-foreground">{t("rows.companies")}</div>
                <div className="text-xs text-muted-foreground leading-snug mt-0.5">{t("rows.companiesDesc")}</div>
              </div>
              <ChevronRightIcon size={16} className="text-muted-foreground shrink-0" />
            </button>
            <button
              type="button"
              onClick={() => {
                router.push({ name: "settings.admin.sessions" });
              }}
              className="w-full text-left p-4 bg-card border border-border rounded-xl transition-colors flex items-center justify-between gap-3"
            >
              <div className="min-w-0">
                <div className="text-sm font-medium text-foreground">{t("rows.sessions")}</div>
                <div className="text-xs text-muted-foreground leading-snug mt-0.5">{t("rows.sessionsDesc")}</div>
              </div>
              <ChevronRightIcon size={16} className="text-muted-foreground shrink-0" />
            </button>
            <button
              type="button"
              onClick={() => {
                router.push({ name: "settings.admin.pulse" });
              }}
              className="w-full text-left p-4 bg-card border border-border rounded-xl transition-colors flex items-center justify-between gap-3"
            >
              <div className="min-w-0">
                <div className="text-sm font-medium text-foreground">Pulse</div>
                <div className="text-xs text-muted-foreground leading-snug mt-0.5">
                  Cookieless aggregate counters (top events, timeline)
                </div>
              </div>
              <ChevronRightIcon size={16} className="text-muted-foreground shrink-0" />
            </button>
          </>
        ) : null}
        {impersonatedBy ? (
          <button
            type="button"
            onClick={handleExitImpersonation}
            disabled={exiting}
            className="w-full text-left p-4 bg-card border border-border rounded-xl transition-colors flex items-center justify-between gap-3 disabled:opacity-60"
          >
            <div className="min-w-0">
              <div className="text-sm font-medium text-red-600">{t("exitImpersonation")}</div>
              <div className="text-xs text-muted-foreground leading-snug mt-0.5">
                {t("exitImpersonationDesc", { email: impersonatedBy })}
              </div>
            </div>
            <ChevronRightIcon size={16} className="text-muted-foreground shrink-0" />
          </button>
        ) : (
          <LogoutLink />
        )}
      </div>
    </div>
  );
}
