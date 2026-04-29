"use client";

import { useState } from "react";
import { apiUrl } from "@/lib/api";
import { useTranslations } from "next-intl";

export function ImpersonationBanner({ currentEmail }: { currentEmail: string }) {
 const t = useTranslations("dashboard.impersonation");
 const [exiting, setExiting] = useState(false);

 async function handleExit() {
 if (exiting) return;
 setExiting(true);
 try {
 const res = await fetch(apiUrl("/api/admin/impersonate/exit"), {
        credentials: "include", method: "POST" });
 if (res.ok) {
 window.location.href = "/dashboard/settings/admin/companies";
 } else {
 setExiting(false);
 }
 } catch {
 setExiting(false);
 }
 }

 return (
 <div className="bg-amber-500 text-amber-950 text-xs font-medium flex items-center justify-center gap-2 py-1.5 px-4 sticky top-0 z-30">
 <span>{t("loggedInAs", { email: currentEmail })}</span>
 <button
 type="button"
 onClick={handleExit}
 disabled={exiting}
 className="inline-flex items-center gap-1 rounded-md bg-amber-950/15 px-2 py-0.5 transition-colors disabled:opacity-50"
 >
 {exiting ? t("exiting") : t("exit")}
 </button>
 </div>
 );
}
