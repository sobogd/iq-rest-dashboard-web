import { createFileRoute, redirect } from "@tanstack/react-router";

const SUPPORTED = ["en", "es"] as const;

function pickInitialLocale(): "en" | "es" {
  if (typeof navigator === "undefined") return "en";
  const lng = navigator.language.split("-")[0].toLowerCase();
  return SUPPORTED.includes(lng as (typeof SUPPORTED)[number]) ? (lng as "en" | "es") : "en";
}

export const Route = createFileRoute("/")({
  beforeLoad: () => {
    throw redirect({ to: "/$locale", params: { locale: pickInitialLocale() } });
  },
});
