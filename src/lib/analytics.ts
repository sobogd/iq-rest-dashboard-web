import { apiUrl } from "@/lib/api";

const GCLID_KEY = "analytics_gclid";
const SID_COOKIE = "analytics_sid";
const SID_REGEX =
  /^(?:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}|c[a-z0-9]{24})$/i;

function readCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const m = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return m ? decodeURIComponent(m[1]) : null;
}

function apexDomain(): string {
  const host = location.hostname;
  if (host === "iq-rest.com" || host.endsWith(".iq-rest.com")) return ".iq-rest.com";
  return host; // localhost / dev → host-only
}

// Set the analytics_sid cookie synchronously *before* the first fetch goes
// out. Without this, two events fired back-to-back (e.g. auth_showed +
// auth_focus_email on the same tick) both arrive at the server without a
// cookie, and the server mints two different sessions for the same browser.
function ensureSid(): void {
  if (typeof document === "undefined") return;
  const existing = readCookie(SID_COOKIE);
  if (existing && SID_REGEX.test(existing)) return;
  const sid =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : Array.from(crypto.getRandomValues(new Uint8Array(16)))
          .map((b) => b.toString(16).padStart(2, "0"))
          .join("")
          .replace(/(.{8})(.{4})(.{4})(.{4})(.{12})/, "$1-$2-$3-$4-$5");
  const parts = [
    `${SID_COOKIE}=${sid}`,
    `domain=${apexDomain()}`,
    `path=/`,
    `max-age=${365 * 24 * 60 * 60}`,
    `SameSite=Lax`,
  ];
  if (location.protocol === "https:") parts.push("Secure");
  document.cookie = parts.join("; ");
}

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
  ensureSid();
  const gclid = getGclid();

  // Sid-attributed event (rich session analytics)
  fetch(apiUrl("/api/analytics/event"), {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ event, occurredAt: new Date().toISOString(), ...(gclid ? { gclid } : {}) }),
    keepalive: true,
  }).catch(() => {});

  // Cookieless pulse — same event also lands in pulse_events for the unified
  // Pulse admin view (covers landing + auth + onboarding + dashboard).
  // Geo from apex-domain cookies set by soqrmenuweb middleware.
  const country = (readCookie("geo_country") || "").toUpperCase().slice(0, 2);
  const region = (readCookie("geo_region") || "").slice(0, 100);
  fetch(apiUrl("/api/analytics/pulse"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      event,
      ...(gclid ? { gclid } : {}),
      ...(country && /^[A-Z]{2}$/.test(country) ? { country } : {}),
      ...(region ? { region } : {}),
    }),
    keepalive: true,
  }).catch(() => {});
}

export function identify(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  ensureSid();
  return fetch(apiUrl("/api/analytics/identify"), {
    method: "POST",
    credentials: "include",
    keepalive: true,
  })
    .then(() => undefined)
    .catch(() => undefined);
}
