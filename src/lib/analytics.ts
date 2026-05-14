import { apiUrl } from "@/lib/api";

/** Detect Google-Ads-origin from the current URL. The marketing site
 *  propagates `gads / gclid / gbraid / wbraid` across internal navigation
 *  via its <LinkForward> wrapper; the dashboard SPA inherits whichever
 *  of those happens to be on the URL at event time. Reading per-call
 *  keeps the dashboard's analytics call stateless — no client storage,
 *  no consent banner required. */
function readGoogleAdsFromUrl(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const sp = new URLSearchParams(window.location.search);
    return (
      sp.get("gads") === "1" ||
      !!sp.get("gclid") ||
      !!sp.get("gbraid") ||
      !!sp.get("wbraid")
    );
  } catch {
    return false;
  }
}

// Single sink: POST /api/usage/event. credentials:include lets the API attach
// companyId server-side from the iqr_session cookie when the user is logged in.
// Server derives geo + device + platform on its own.
export function trackEvent(event: string): void {
  if (typeof window === "undefined") return;
  const referrer = typeof document !== "undefined" ? document.referrer || null : null;
  const isGoogleAds = readGoogleAdsFromUrl();
  fetch(apiUrl("/api/usage/event"), {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ event, occurredAt: Date.now(), referrer, isGoogleAds }),
    keepalive: true,
  }).catch(() => {});
}
