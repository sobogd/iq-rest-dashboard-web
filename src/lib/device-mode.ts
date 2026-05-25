// Kiosk subdomain runtime mode.
//
// The dashboard SPA is served on multiple origins from the same bundle:
//   - app.iq-rest.com    → cookie-authed admin/dashboard
//   - device.iq-rest.com → unified kiosk entry (device-authed). One pairing
//                           screen; the device TYPE returned by the pairing
//                           response decides which board renders. No per-role
//                           subdomain needed.
//   - k/w/r.iq-rest.com  → legacy per-role kiosk hosts. Kept alive so already-
//                           paired tablets keep working without re-pairing —
//                           the bundle still treats them as kiosks and the
//                           board is chosen by the bootstrapped device type,
//                           not by the host.
//
// `isKioskHost()` decides "mount KitchenApp vs admin" (main.tsx). The render
// branch itself is driven by the bootstrapped `device.type`, NOT the host —
// so the unified host needs no role in its name.

const TOKEN_KEY = "iqr_device_token";
const TYPE_KEY = "iqr_device_type";

export type KioskRole = "kitchen" | "waiter" | "reservation";
export type DeviceType = "KITCHEN" | "WAITER" | "RESERVATION";

// Legacy per-role host → device type. Used only as a fallback before the
// device type has been stored (first PATCH right after a deploy on an
// already-paired tablet). Once the type is persisted it wins.
export function roleToDeviceType(role: KioskRole): DeviceType {
  return role === "kitchen" ? "KITCHEN" : role === "waiter" ? "WAITER" : "RESERVATION";
}

export function getKioskRole(): KioskRole | null {
  if (typeof window === "undefined") return null;
  const host = window.location.hostname.toLowerCase();
  if (host === "k" || host.startsWith("k.")) return "kitchen";
  if (host === "w" || host.startsWith("w.")) return "waiter";
  if (host === "r" || host.startsWith("r.")) return "reservation";
  return null;
}

// Unified kiosk entry host — no role baked into the hostname.
function isUnifiedKioskHost(): boolean {
  if (typeof window === "undefined") return false;
  const host = window.location.hostname.toLowerCase();
  return host === "device" || host.startsWith("device.");
}

export function isKioskHost(): boolean {
  return getKioskRole() !== null || isUnifiedKioskHost();
}

// Persisted device type (authoritative once bootstrap has run). Drives the
// kitchen-only PATCH rewrite in api.ts without depending on the host.
export function getStoredDeviceType(): DeviceType | null {
  if (typeof window === "undefined") return null;
  try {
    const v = window.localStorage.getItem(TYPE_KEY);
    return v === "KITCHEN" || v === "WAITER" || v === "RESERVATION" ? v : null;
  } catch {
    return null;
  }
}

export function setStoredDeviceType(type: DeviceType): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(TYPE_KEY, type);
  } catch {
    // ignore
  }
}

// Public, no-auth kitchen-display demo. Driven by `?demo=1` so the marketing
// landing can embed a real KDS in an iframe (tablet frame) without pairing a
// device or touching the API. Recognised on any host (not just k.*) so it
// also works in local dev. Optional `lang` query picks the UI language.
export function isDemoMode(): boolean {
  if (typeof window === "undefined") return false;
  return new URLSearchParams(window.location.search).get("demo") === "1";
}

export function getDemoLang(): string | null {
  if (typeof window === "undefined") return null;
  return new URLSearchParams(window.location.search).get("lang");
}

// Initial KDS zoom (root font-size %) for the demo. The landing passes a
// larger value (e.g. 150) when the visitor is on a phone, since the iframe
// renders at a fixed 1024px logical width and can't sense the real device —
// the parent has to decide. Falls back to 100 (normal scale).
export function getDemoZoom(): number {
  if (typeof window === "undefined") return 100;
  const raw = new URLSearchParams(window.location.search).get("zoom");
  const n = raw ? Number.parseInt(raw, 10) : NaN;
  return Number.isFinite(n) ? n : 100;
}

// Back-compat alias — older call sites only branched on "is this a
// kiosk?", not which role. Keep returning true for any kiosk host so the
// /api proxy + device token wiring lights up uniformly.
export function isKitchenHost(): boolean {
  return isKioskHost();
}

export function getDeviceToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setDeviceToken(token: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(TOKEN_KEY, token);
  } catch {
    // ignore
  }
}

export function clearDeviceToken(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(TOKEN_KEY);
    window.localStorage.removeItem(TYPE_KEY);
  } catch {
    // ignore
  }
}
