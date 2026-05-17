import { createFileRoute } from "@tanstack/react-router";
import { LazyDashboardHost } from "@/dashboard/lazy-dashboard-host";

export const Route = createFileRoute("/$locale/dashboard/$")({
  component: LazyDashboardHost,
});
