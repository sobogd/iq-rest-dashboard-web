// Kiosk subdomain runtime mode.
//
// The dashboard SPA is served on multiple origins from the same bundle:
//   - app.iq-rest.com → cookie-authed admin/dashboard
//   - k.iq-rest.com   → kitchen-display kiosk (device-authed)
//   - w.iq-rest.com   → waiter terminal kiosk (device-authed)
//
// One-letter subdomains on purpose — staff types this on touchscreen
// keyboards and every saved character matters. `getKioskRole()` is the
// single source of truth for the routing branch in main.tsx.

const TOKEN_KEY = "iqr_device_token";

export type KioskRole = "kitchen" | "waiter";

export function getKioskRole(): KioskRole | null {
  if (typeof window === "undefined") return null;
  const host = window.location.hostname.toLowerCase();
  if (host === "k" || host.startsWith("k.")) return "kitchen";
  if (host === "w" || host.startsWith("w.")) return "waiter";
  return null;
}

export function isKioskHost(): boolean {
  return getKioskRole() !== null;
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
  } catch {
    // ignore
  }
}
