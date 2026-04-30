import { apiUrl } from "@/lib/api";

export function trackEvent(event: string): void {
  if (typeof window === "undefined") return;
  fetch(apiUrl("/api/analytics/event"), {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ event, occurredAt: new Date().toISOString() }),
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
