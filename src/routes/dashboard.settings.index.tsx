import { createFileRoute } from "@tanstack/react-router";
import { SettingsHub } from "./dashboard.settings";

export const Route = createFileRoute("/dashboard/settings/")({
  component: SettingsHub,
});
