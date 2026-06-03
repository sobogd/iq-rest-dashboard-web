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
import { useRestaurantsOrNull } from "../../_v2/restaurants-context";

interface CardDef {
  view: View;
  titleKey: string;
  descKey: string;
  event: string;
}

const CARDS: CardDef[] = [
  { view: { name: "settings.branding" }, titleKey: "branding", descKey: "brandingDesc", event: "dash_settings_click_tab_brand" },
  { view: { name: "settings.contacts" }, titleKey: "contacts", descKey: "contactsDesc", event: "dash_settings_click_tab_contacts" },
  { view: { name: "settings.general" }, titleKey: "general", descKey: "generalDesc", event: "dash_settings_click_tab_general" },
  { view: { name: "settings.tables" }, titleKey: "tables", descKey: "tablesDesc", event: "dash_settings_click_tab_tables" },
  { view: { name: "settings.devices" }, titleKey: "devices", descKey: "devicesDesc", event: "dash_settings_click_tab_devices" },
  { view: { name: "settings.orders" }, titleKey: "orders", descKey: "ordersDesc", event: "dash_settings_click_tab_orders" },
  { view: { name: "settings.bookings" }, titleKey: "bookings", descKey: "bookingsDesc", event: "dash_settings_click_tab_bookings" },
  { view: { name: "settings.languages" }, titleKey: "languages", descKey: "languagesDesc", event: "dash_settings_click_tab_langs" },
  { view: { name: "settings.billing" }, titleKey: "billing", descKey: "billingDesc", event: "dash_settings_click_tab_billing" },
  { view: { name: "settings.support" }, titleKey: "support", descKey: "supportDesc", event: "dash_settings_click_tab_support" },
];

function AdminToolbar({ router }: { router: ReturnType<typeof useDashboardRouter> }) {
  const [reloading, setReloading] = useState(false);
  async function reloadAllTablets() {
    if (reloading) return;
    if (!window.confirm("Reload every paired tablet system-wide?")) return;
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
  const btn =
    "h-8 px-3 rounded-md text-xs font-medium bg-secondary text-foreground hover:bg-muted transition-colors disabled:opacity-60";
  return (
    <div className="mb-4 flex items-center gap-1.5 flex-wrap">
      <button type="button" onClick={() => router.push({ name: "settings.admin.restaurants" })} className={btn}>
        Restaurants
      </button>
      <button type="button" onClick={() => router.push({ name: "settings.admin.users" })} className={btn}>
        Users
      </button>
      <button type="button" onClick={() => router.push({ name: "settings.admin.usage" })} className={btn}>
        Usage
      </button>
      <button type="button" onClick={() => router.push({ name: "settings.admin.capi" })} className={btn}>
        CAPI
      </button>
      <button type="button" onClick={reloadAllTablets} disabled={reloading} className={btn} title="Reload every paired tablet system-wide">
        {reloading ? "Sending…" : "Reload tablets"}
      </button>
    </div>
  );
}

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
  const restaurants = useRestaurantsOrNull();
  const showSwitcher = !!restaurants && restaurants.isPaid && restaurants.list.length > 0;
  const activeName = restaurants?.list.find((r) => r.id === restaurants.activeId)?.title ?? "";
  // Hide the billing tab when the active restaurant is managed for another
  // company via grant — billing belongs to the owner.
  const canManageBilling = restaurants?.canManageBilling ?? true;
  const cards = canManageBilling
    ? CARDS
    : CARDS.filter((c) => c.view.name !== "settings.billing");

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
    <div className="max-w-5xl mx-auto md:px-6">
      {isAdmin ? (
        <AdminToolbar router={router} />
      ) : null}
      <PageHeader title={t("title")} subtitle={t("subtitle")} />
      {showSwitcher ? (
        <button
          type="button"
          onClick={() => router.push({ name: "settings.restaurants" })}
          className="w-full text-left mb-2.5 p-4 bg-card border border-border rounded-xl flex items-center justify-between gap-3"
        >
          <div className="min-w-0">
            <div className="text-sm font-medium text-foreground">
              {t("activeRestaurant", { name: activeName })}
            </div>
            <div className="text-xs text-muted-foreground leading-snug mt-0.5">
              {restaurants && restaurants.list.length > 1
                ? t("switcherDescMany", { count: restaurants.list.length })
                : t("switcherDescOne")}
            </div>
          </div>
          <ChevronRightIcon size={16} className="text-muted-foreground shrink-0" />
        </button>
      ) : null}
      <div className="space-y-2.5">
        {cards.map((card) => (
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
