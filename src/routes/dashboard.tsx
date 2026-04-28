import { Outlet, createFileRoute, redirect, Link, useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { CalendarDays, ChartBar, Grid3x3, LogOut, Receipt, Settings } from "lucide-react";
import type { ComponentType } from "react";
import { api } from "@/lib/api";
import { useLogout } from "@/lib/auth";

export const Route = createFileRoute("/dashboard")({
  beforeLoad: async () => {
    const auth = await api<{ authenticated: boolean }>("/auth/check").catch(() => ({
      authenticated: false,
    }));
    if (!auth.authenticated) throw redirect({ to: "/login" });
  },
  component: DashboardLayout,
});

interface NavItem {
  to: string;
  labelKey: "menu" | "orders" | "reservations" | "analytics" | "settings";
  icon: ComponentType<{ size?: number }>;
}

const NAV_ITEMS: NavItem[] = [
  { to: "/dashboard", labelKey: "menu", icon: Grid3x3 },
  { to: "/dashboard/reservations", labelKey: "reservations", icon: CalendarDays },
  { to: "/dashboard/orders", labelKey: "orders", icon: Receipt },
  { to: "/dashboard/analytics", labelKey: "analytics", icon: ChartBar },
  { to: "/dashboard/settings", labelKey: "settings", icon: Settings },
];

function DashboardLayout() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const logout = useLogout();

  async function handleLogout() {
    await logout.mutateAsync();
    navigate({ to: "/login" });
  }

  return (
    <div className="min-h-screen bg-neutral-50">
      <header className="hidden md:block border-b border-neutral-200 bg-white sticky top-0 z-20">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <span className="text-sm font-medium text-neutral-900">IQ Rest</span>
          <nav className="flex items-center gap-1">
            {NAV_ITEMS.map((it) => (
              <Link
                key={it.to}
                to={it.to}
                activeOptions={{ exact: it.to === "/dashboard" }}
                activeProps={{ className: "h-9 px-3 text-sm font-medium rounded-lg bg-neutral-900 text-white inline-flex items-center" }}
                className="h-9 px-3 text-sm font-medium rounded-lg text-neutral-500 inline-flex items-center"
              >
                {t(`nav.${it.labelKey}`)}
              </Link>
            ))}
            <button
              type="button"
              onClick={handleLogout}
              className="h-9 px-3 text-sm font-medium rounded-lg text-neutral-500 inline-flex items-center gap-1"
            >
              <LogOut size={14} /> Log out
            </button>
          </nav>
        </div>
      </header>
      <main className="max-w-5xl mx-auto px-4 py-5 pb-24 md:pb-10">
        <Outlet />
      </main>
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-20 bg-white border-t border-neutral-200">
        <div className="grid grid-cols-5">
          {NAV_ITEMS.map((it) => {
            const Icon = it.icon;
            return (
              <Link
                key={it.to}
                to={it.to}
                activeOptions={{ exact: it.to === "/dashboard" }}
                activeProps={{ className: "py-2.5 flex flex-col items-center gap-0.5 text-neutral-900" }}
                className="py-2.5 flex flex-col items-center gap-0.5 text-neutral-400"
              >
                <Icon size={20} />
                <span className="text-[10px] font-medium">{t(`nav.${it.labelKey}`)}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
