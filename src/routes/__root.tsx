import { Outlet, createRootRouteWithContext } from "@tanstack/react-router";
import type { QueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { trackEvent } from "@/lib/analytics";

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  component: RootLayout,
});

const FROM_REGEX = /^[a-z0-9_]{1,32}$/;
const FROM_FIRED_KEY = "dash_from_fired";

function fireFromAndClean(): void {
  if (typeof window === "undefined") return;
  const sp = new URLSearchParams(window.location.search);
  const raw = sp.get("from");
  if (!raw) return;
  const source = raw.toLowerCase();
  if (!FROM_REGEX.test(source)) return;

  // Fire once per tab session — protects against StrictMode double-mount
  // and SPA navigations that preserve the query string.
  try {
    if (window.sessionStorage.getItem(FROM_FIRED_KEY) === source) return;
    window.sessionStorage.setItem(FROM_FIRED_KEY, source);
  } catch {
    // sessionStorage blocked — fall through, accept a possible double-fire.
  }

  trackEvent(`dash_from_${source}`);

  sp.delete("from");
  const qs = sp.toString();
  const newUrl = window.location.pathname + (qs ? `?${qs}` : "") + window.location.hash;
  window.history.replaceState({}, "", newUrl);
}

function RootLayout() {
  useEffect(() => {
    fireFromAndClean();
  }, []);

  return <Outlet />;
}
