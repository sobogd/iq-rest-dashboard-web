"use client";

import { type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { DashboardRouterProvider } from "./router";

interface Props {
  locale: string;
  children: ReactNode;
}

/** Client-side wrapper that supplies the SPA router using the current
 * pathname/search as the initial path. Mounts ABOVE DashboardChrome so its
 * BottomNav / TopBar can call `useDashboardRouter()`.
 */
export function DashboardSpaWrapper({ locale, children }: Props) {
  const pathname = usePathname() || "/dashboard";
  const search = typeof window !== "undefined" ? window.location.search : "";
  const initialPath = pathname + search;
  return (
    <DashboardRouterProvider initialPath={initialPath} locale={locale}>
      {children}
    </DashboardRouterProvider>
  );
}
