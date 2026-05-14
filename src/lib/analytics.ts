import { apiUrl } from "@/lib/api";

// Single sink: POST /api/usage/event. credentials:include lets the API attach
// companyId server-side from the iqr_session cookie when the user is logged in.
// Server derives geo + device + platform on its own. Visit-origin fields
// (gclid, is_google_ads, is_search) live only on the first-visit SSR row.
export function trackEvent(event: string): void {
  if (typeof window === "undefined") return;
  fetch(apiUrl("/api/usage/event"), {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ event }),
    keepalive: true,
  }).catch(() => {});
}
