// Own analytics - sends events to our backend

import { apiUrl } from "@/lib/api";

const SESSION_ID_KEY = "analytics_session_id";
// Apex-domain cookie set by the backend with Domain=.iq-rest.com so the
// landing site and the new dashboard share the same sid. Reading this
// first is what lets a visitor's events from iq-rest.com merge with
// their dashboard activity on dashboard.iq-rest.com.
const SHARED_COOKIE_KEY = "analytics_sid";

function readCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const m = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return m ? decodeURIComponent(m[1]) : null;
}

function getSessionId(): string {
  if (typeof window === "undefined") return "";

  // Cross-origin shared session takes precedence — keeps the sid stable
  // when the same browser visits the landing site and then the dashboard.
  const cookieSid = readCookie(SHARED_COOKIE_KEY);
  if (cookieSid) return cookieSid;

  // Registered users: localStorage (persistent, user accepted privacy policy)
  // Anonymous users: sessionStorage (per-tab, no consent needed)
  let sessionId = localStorage.getItem(SESSION_ID_KEY)
    || sessionStorage.getItem(SESSION_ID_KEY);

  if (!sessionId) {
    sessionId =
      typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : Array.from(crypto.getRandomValues(new Uint8Array(16)))
            .map((b) => b.toString(16).padStart(2, "0"))
            .join("")
            .replace(/(.{8})(.{4})(.{4})(.{4})(.{12})/, "$1-$2-$3-$4-$5");
    // Anonymous by default → sessionStorage only
    sessionStorage.setItem(SESSION_ID_KEY, sessionId);
  }
  return sessionId;
}

function promoteToLocalStorage(id: string) {
  if (typeof window === "undefined") return;
  // User is now authenticated — persist session across browser restarts
  localStorage.setItem(SESSION_ID_KEY, id);
  sessionStorage.removeItem(SESSION_ID_KEY);
}

function isTrackingDisabled(): boolean {
  if (typeof window === "undefined") return true;
  return localStorage.getItem("analytics_disabled") === "true";
}

// Extract gclid and keyword from current URL params (if present)
function getAdParams(): { gclid?: string; keyword?: string } | undefined {
  if (typeof window === "undefined") return undefined;
  const params = new URLSearchParams(window.location.search);
  const gclid = params.get("gclid");
  const keyword = params.get("kw");
  if (!gclid && !keyword) return undefined;
  return {
    ...(gclid && { gclid }),
    ...(keyword && { keyword }),
  };
}

function trackEvent(event: string, meta?: Record<string, string>) {
  if (typeof window === "undefined" || isTrackingDisabled()) return;

  const sessionId = getSessionId();
  const adParams = getAdParams();

  fetch(apiUrl("/api/analytics/event"), {
        credentials: "include",
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      event,
      sessionId,
      ...adParams,
      ...(meta && { meta }),
    }),
    keepalive: true,
  }).catch(() => {
    // Silently fail - analytics should never break the app
  });
}

function getCookie(name: string): string | null {
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

function deleteCookie(name: string) {
  document.cookie = `${name}=; path=/; max-age=0`;
}

function trackReferral() {
  if (typeof window === "undefined" || isTrackingDisabled()) return;
  if (sessionStorage.getItem("referral_sent")) return;

  const from = getCookie("ref_from");
  if (!from) return;

  sessionStorage.setItem("referral_sent", "1");

  const meta: Record<string, string> = { from };
  const slug = getCookie("ref_slug");
  if (slug) {
    meta.slug = slug;
    deleteCookie("ref_slug");
  }
  deleteCookie("ref_from");

  trackEvent(`referral_${from}`, meta);
}

export function disableTracking() {
  if (typeof window !== "undefined") {
    localStorage.setItem("analytics_disabled", "true");
  }
}

export function enableTracking() {
  if (typeof window !== "undefined") {
    localStorage.removeItem("analytics_disabled");
  }
}

export function linkSession(userId: string): Promise<void> {
  if (typeof window === "undefined" || isTrackingDisabled())
    return Promise.resolve();

  const sessionId = getSessionId();

  return fetch(apiUrl("/api/analytics/link-session"), {
        credentials: "include",
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sessionId, userId }),
    keepalive: true,
  })
    .then((res) => res.json())
    .then((data) => {
      const finalId = data.sessionId || sessionId;
      // User authenticated → promote to localStorage
      promoteToLocalStorage(finalId);
    })
    .catch(() => {
      // Silently fail
    });
}

// Page view events
export const page = {
  view: (pageName: string) => {
    trackEvent(`page_view_${pageName.replace(/-/g, "_")}`);
    trackReferral();
  },
};

// Marketing events (landing page)
export const marketing = {
  // Demo
  demoOpen: () => trackEvent("demo_open"),
  demoClose: () => trackEvent("demo_close"),
  demoScrollArrow: () => trackEvent("demo_scroll_arrow"),
  demoInteract: () => trackEvent("demo_interact"),
  heroImagesClick: () => trackEvent("hero_images_click"),
  headerCtaClick: () => trackEvent("header_cta_click"),
  heroCtaClick: () => trackEvent("hero_cta_click"),
  pricingCtaClick: (plan: string) => trackEvent("pricing_cta_click", { plan }),
  // Navigation
  scrollToSection: (section: string) => trackEvent("scroll_to_section", { section }),
  featureLinkClick: (featureId: string) => trackEvent("feature_link_click", { featureId }),
  footerLinkClick: (link: string) => trackEvent("footer_link_click", { link }),
  whatsappClick: () => trackEvent("whatsapp_click"),
  pricingToggle: (cycle: string) => trackEvent("pricing_toggle", { cycle }),
  // AI Menu Scanner
  scannerUpload: (fileCount: string) => trackEvent("scanner_upload", { fileCount }),
  scannerSuccess: (duration: string) => trackEvent("scanner_success", { duration }),
  scannerError: (reason: string) => trackEvent("scanner_error", { reason }),
  scannerCtaClick: () => trackEvent("scanner_cta_click"),
  scannerPreviewShown: () => trackEvent("scanner_preview_shown"),
  scannerPreviewReturning: () => trackEvent("scanner_preview_returning"),
  scannerConversion: () => trackEvent("scanner_conversion"),
};

// Section visibility events (landing page sections)
export const section = {
  view: (name: string) => trackEvent(`section_view_${name.replace(/-/g, "_")}`),
};

// Heartbeat — updates lastSeenAt on Session every 15s while tab is visible
let heartbeatTimer: ReturnType<typeof setInterval> | null = null;

function sendHeartbeat() {
  const sessionId = getSessionId();
  if (!sessionId) return;
  fetch(apiUrl("/api/analytics/heartbeat"), {
        credentials: "include",
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sessionId }),
    keepalive: true,
  }).catch(() => {});
}

function startHeartbeat() {
  if (typeof window === "undefined" || isTrackingDisabled()) return;
  if (heartbeatTimer) return; // already running

  sendHeartbeat(); // immediate first ping

  heartbeatTimer = setInterval(sendHeartbeat, 15_000);

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      if (heartbeatTimer) {
        clearInterval(heartbeatTimer);
        heartbeatTimer = null;
      }
    } else {
      if (!heartbeatTimer && !isTrackingDisabled()) {
        sendHeartbeat();
        heartbeatTimer = setInterval(sendHeartbeat, 15_000);
      }
    }
  });
}

// Export all as analytics object for convenience
export const analytics = {
  trackEvent,
  disableTracking,
  enableTracking,
  linkSession,
  startHeartbeat,
  page,
  marketing,
  section,
};
