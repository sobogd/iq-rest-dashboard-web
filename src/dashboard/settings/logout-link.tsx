"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { ChevronRightIcon } from "../_v2/icons";
import { logout } from "../_v2/api";
import { track } from "@/lib/dashboard-events";

export function LogoutLink() {
 const t = useTranslations("dashboard.settingsHub");
 const locale = useLocale();
 const [busy, setBusy] = useState(false);

 async function handle() {
 track("dash_settings_click_logout");
 if (busy) return;
 setBusy(true);
 try {
 await logout();
 window.location.href = `/${locale}/login`;
 } catch {
 setBusy(false);
 }
 }

 return (
 <button
 type="button"
 onClick={handle}
 disabled={busy}
 className="w-full text-left p-4 bg-card border border-border rounded-xl transition-colors flex items-center justify-between gap-3 disabled:opacity-60"
 >
 <div className="min-w-0">
 <div className="text-sm font-medium text-red-600">{busy ? t("loggingOut") : t("logout")}</div>
 <div className="text-xs text-muted-foreground leading-snug mt-0.5">{t("logoutDesc")}</div>
 </div>
 <ChevronRightIcon size={16} className="text-muted-foreground shrink-0" />
 </button>
 );
}
