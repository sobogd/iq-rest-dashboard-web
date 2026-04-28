import { Outlet, createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { api } from "@/lib/api";
import { useLogout } from "@/lib/auth";

export const Route = createFileRoute("/dashboard")({
  beforeLoad: async () => {
    const auth = await api<{ authenticated: boolean }>("/auth/check").catch(() => ({ authenticated: false }));
    if (!auth.authenticated) {
      throw redirect({ to: "/login" });
    }
  },
  component: DashboardLayout,
});

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
      <header className="border-b border-neutral-200 bg-white">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <span className="text-sm font-medium text-neutral-900">{t("appName")} Dashboard</span>
          <nav className="flex items-center gap-3 text-sm">
            <span className="text-neutral-700">{t("nav.menu")}</span>
            <span className="text-neutral-400">{t("nav.orders")}</span>
            <span className="text-neutral-400">{t("nav.reservations")}</span>
            <span className="text-neutral-400">{t("nav.analytics")}</span>
            <span className="text-neutral-400">{t("nav.settings")}</span>
            <button
              type="button"
              onClick={handleLogout}
              className="text-neutral-500 hover:text-neutral-900"
            >
              Log out
            </button>
          </nav>
        </div>
      </header>
      <main className="max-w-5xl mx-auto px-4 py-5">
        <Outlet />
      </main>
    </div>
  );
}
