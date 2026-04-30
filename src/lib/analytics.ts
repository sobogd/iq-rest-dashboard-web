import { apiUrl } from "@/lib/api";

const GCLID_KEY = "analytics_gclid";

function getGclid(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const params = new URLSearchParams(window.location.search);
    const fromUrl = params.get("gclid");
    if (fromUrl) {
      try { localStorage.setItem(GCLID_KEY, fromUrl); } catch {}
      return fromUrl;
    }
    return localStorage.getItem(GCLID_KEY);
  } catch {
    return null;
  }
}

export function trackEvent(event: string): void {
  if (typeof window === "undefined") return;
  const gclid = getGclid();
  fetch(apiUrl("/api/analytics/event"), {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ event, occurredAt: new Date().toISOString(), ...(gclid ? { gclid } : {}) }),
    keepalive: true,
  }).catch(() => {});
}

export function identify(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  return fetch(apiUrl("/api/analytics/identify"), {
    method: "POST",
    credentials: "include",
    keepalive: true,
  })
    .then(() => undefined)
    .catch(() => undefined);
}
