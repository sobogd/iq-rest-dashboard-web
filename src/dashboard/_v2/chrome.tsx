"use client";

import { useEffect, useRef, ReactNode } from "react";
import { useTranslations } from "next-intl";
import {
 CalendarIcon,
 ChartIcon,
 FlameIcon,
 GridIcon,
 ReceiptIcon,
 SettingsIcon,
} from "./icons";
import { RestaurantProvider } from "./restaurant-context";
import { SubProvider, type Sub } from "./sub-context";
import type { Restaurant, TabId } from "./types";
import { track } from "@/lib/dashboard-events";
import { useDashboardRouter } from "../_spa/router";
import type { View } from "../_spa/types";

const HEADER_NAV_EVENT: Record<TabId, string> = {
 menu: "dash_header_nav_menu",
 reservations: "dash_header_nav_booking",
 orders: "dash_header_nav_orders",
 kitchen: "dash_header_nav_kitchen",
 analytics: "dash_header_nav_analytics",
 settings: "dash_header_nav_settings",
};

const BOTTOM_NAV_EVENT: Record<TabId, string> = {
 menu: "dash_bottom_bar_nav_menu",
 reservations: "dash_bottom_bar_nav_booking",
 orders: "dash_bottom_bar_nav_orders",
 kitchen: "dash_bottom_bar_nav_kitchen",
 analytics: "dash_bottom_bar_nav_analytics",
 settings: "dash_bottom_bar_nav_settings",
};

interface NavTab {
 id: TabId;
 labelKey: "menu" | "reservations" | "orders" | "kitchen" | "analytics" | "settings";
 view: View;
 icon: React.ComponentType<{ size?: number; className?: string }>;
}

const KITCHEN_ENABLED = process.env.NEXT_PUBLIC_KITCHEN === "TRUE";

const NAV_TABS: NavTab[] = [
 { id: "menu", labelKey: "menu", view: { name: "menu" }, icon: GridIcon },
 { id: "reservations", labelKey: "reservations", view: { name: "reservations" }, icon: CalendarIcon },
 { id: "orders", labelKey: "orders", view: { name: "orders" }, icon: ReceiptIcon },
 ...(KITCHEN_ENABLED
 ? [{ id: "kitchen" as TabId, labelKey: "kitchen" as const, view: { name: "kitchen" } as View, icon: FlameIcon }]
 : []),
 { id: "analytics", labelKey: "analytics", view: { name: "analytics" }, icon: ChartIcon },
 { id: "settings", labelKey: "settings", view: { name: "settings" }, icon: SettingsIcon },
];

function viewToTab(viewName: string): TabId {
 if (viewName === "reservations") return "reservations";
 if (viewName === "orders" || viewName.startsWith("orders.")) return "orders";
 if (viewName === "kitchen") return "kitchen";
 if (viewName === "analytics") return "analytics";
 if (viewName === "settings" || viewName.startsWith("settings.")) return "settings";
 return "menu";
}

export function DashboardChrome({
 restaurant,
 sub,
 children,
}: {
 restaurant: Restaurant;
 sub: Sub;
 children: ReactNode;
}) {
 // Always-on vertical scrollbar prevents layout shift on collapse/expand.
 useEffect(() => {
 const prev = document.documentElement.style.overflowY;
 document.documentElement.style.overflowY = "scroll";
 return () => {
 document.documentElement.style.overflowY = prev;
 };
 }, []);

 const { view } = useDashboardRouter();
 const activeTab = viewToTab(view.name);
 const isAuth = view.name.startsWith("auth.");

 if (isAuth) {
 // Auth renders fullscreen — no top/bottom dashboard nav.
 return (
 <RestaurantProvider restaurant={restaurant}>
 <SubProvider sub={sub}>
<div className="min-h-dvh bg-background antialiased tracking-tight">{children}</div>
 </SubProvider>
 </RestaurantProvider>
 );
 }

 return (
 <RestaurantProvider restaurant={restaurant}>
 <SubProvider sub={sub}>
<div className="min-h-dvh bg-background antialiased tracking-tight">
 <TopBar restaurant={restaurant} activeTab={activeTab} />
 <main
 className="px-4 md:px-6 py-5 md:py-4 md:pb-10"
 style={{ paddingBottom: "calc(6rem + env(safe-area-inset-bottom))" }}
 >{children}</main>
 <BottomNav activeTab={activeTab} />
 </div>
 </SubProvider>
 </RestaurantProvider>
 );
}

function TopBar({ restaurant, activeTab }: { restaurant: Restaurant; activeTab: TabId }) {
 const t = useTranslations("dashboard.nav");
 const headerRef = useRef<HTMLElement | null>(null);

 useEffect(() => {
 const el = headerRef.current;
 if (!el) return;
 function update() {
 if (!el) return;
 // Hidden via `display: none` on mobile (`hidden md:block`) — offsetParent is null;
 // treat it as 0 so sticky sub-bars sit flush at the top instead of inheriting the
 // desktop fallback height.
 const h = el.offsetParent === null ? 0 : el.getBoundingClientRect().height;
 document.documentElement.style.setProperty("--topbar-h", h + "px");
 }
 update();
 const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(update) : null;
 if (ro) ro.observe(el);
 window.addEventListener("resize", update);
 return () => {
 window.removeEventListener("resize", update);
 ro?.disconnect();
 };
 }, []);

 return (
 <header
 ref={headerRef}
 className="hidden md:block sticky top-0 z-20 bg-[hsl(0_0%_9%/0.9)] backdrop-blur-md border-b border-border"
 >
 <div className="max-w-5xl mx-auto px-4 md:px-6">
 <div className="flex items-center justify-between gap-3 py-4">
 <h1 className="min-w-0 text-lg font-medium text-foreground truncate">
 {restaurant.name || t("untitledRestaurant")}
 </h1>
 <TopNav activeTab={activeTab} t={t} />
 </div>
 </div>
 </header>
 );
}

function TopNav({ activeTab, t }: { activeTab: TabId; t: (k: NavTab["labelKey"]) => string }) {
 const router = useDashboardRouter();
 return (
 <nav className="flex items-center gap-1 shrink-0">
 {NAV_TABS.map((tab) => {
 const isActive = activeTab === tab.id;
 const cls = isActive
 ? "bg-foreground text-background"
 : "text-muted-foreground";
 return (
 <button
 key={tab.id}
 type="button"
 onClick={() => {
 track(HEADER_NAV_EVENT[tab.id]);
 router.resetTo(tab.view);
 }}
 className={"h-9 px-3 text-sm font-medium rounded-lg transition-colors inline-flex items-center " + cls}
 >
 {t(tab.labelKey)}
 </button>
 );
 })}
 </nav>
 );
}

function BottomNav({ activeTab }: { activeTab: TabId }) {
 const t = useTranslations("dashboard.nav");
 const router = useDashboardRouter();
 return (
 <nav
 className="md:hidden fixed bottom-0 left-0 right-0 z-20 bg-[hsl(0_0%_9%/0.95)] backdrop-blur-md border-t border-border"
 style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
 >
 <div className="flex items-stretch">
 {NAV_TABS.map((tab) => {
 const isActive = activeTab === tab.id;
 const TabIcon = tab.icon;
 const cls = isActive ? "text-primary" : "text-muted-foreground";
 return (
 <button
 key={tab.id}
 type="button"
 onClick={() => {
 track(BOTTOM_NAV_EVENT[tab.id]);
 router.resetTo(tab.view);
 }}
 className={"flex-1 flex flex-col items-center justify-center gap-0.5 py-2.5 transition-colors " + cls}
 >
 <TabIcon size={20} />
 <span className="text-[10px] font-medium">{t(tab.labelKey)}</span>
 </button>
 );
 })}
 </div>
 </nav>
 );
}
