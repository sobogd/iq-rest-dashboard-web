import { createFileRoute } from "@tanstack/react-router";
import { DashboardHost } from "@/dashboard/dashboard-host";

export const Route = createFileRoute("/$locale/dashboard")({
  component: DashboardHost,
});
