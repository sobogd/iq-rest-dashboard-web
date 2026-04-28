import { Outlet, createFileRoute, Link } from "@tanstack/react-router";
import { ChevronRight } from "lucide-react";
import { useTranslation } from "react-i18next";

export const Route = createFileRoute("/dashboard/settings")({
  component: SettingsLayout,
});

const ROWS: { to: string; titleKey: string; descKey: string }[] = [
  { to: "/dashboard/settings/about", titleKey: "settings.about", descKey: "settings.aboutDesc" },
  { to: "/dashboard/settings/contacts", titleKey: "settings.contacts", descKey: "settings.contactsDesc" },
  { to: "/dashboard/settings/branding", titleKey: "settings.branding", descKey: "settings.brandingDesc" },
  { to: "/dashboard/settings/general", titleKey: "settings.general", descKey: "settings.generalDesc" },
  { to: "/dashboard/settings/tables", titleKey: "settings.tables", descKey: "settings.tablesDesc" },
  { to: "/dashboard/settings/orders", titleKey: "settings.orders", descKey: "settings.ordersDesc" },
  { to: "/dashboard/settings/bookings", titleKey: "settings.bookings", descKey: "settings.bookingsDesc" },
  { to: "/dashboard/settings/languages", titleKey: "settings.languages", descKey: "settings.languagesDesc" },
  { to: "/dashboard/settings/billing", titleKey: "settings.billing", descKey: "settings.billingDesc" },
  { to: "/dashboard/settings/support", titleKey: "settings.support", descKey: "settings.supportDesc" },
];

function SettingsLayout() {
  return <Outlet />;
}

export function SettingsHub() {
  const { t } = useTranslation();
  return (
    <div className="max-w-2xl mx-auto space-y-2.5">
      <h1 className="text-xl font-medium text-neutral-900 mb-3">{t("nav.settings")}</h1>
      {ROWS.map((r) => (
        <Link
          key={r.to}
          to={r.to}
          className="block p-4 bg-white border border-neutral-200 rounded-xl flex items-center justify-between gap-3"
        >
          <div className="min-w-0">
            <div className="text-sm font-medium text-neutral-900">{t(r.titleKey)}</div>
            <div className="text-xs text-neutral-500 mt-0.5">{t(r.descKey)}</div>
          </div>
          <ChevronRight size={16} className="text-neutral-400 shrink-0" />
        </Link>
      ))}
    </div>
  );
}
