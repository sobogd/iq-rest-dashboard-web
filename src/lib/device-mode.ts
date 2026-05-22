// Kitchen subdomain runtime mode.
//
// The dashboard SPA is served on TWO origins from the same bundle:
//   - app.iq-rest.com   → cookie-authed admin/dashboard
//   - k.iq-rest.com → device-authed kiosk
//
// `isKitchenHost()` is the single source of truth for the routing branch
// taken at boot in main.tsx. `getDeviceToken()` / `setDeviceToken()` /
// `clearDeviceToken()` manage the long-lived bearer token the tablet stores
// after a successful pair.

const TOKEN_KEY = "iqr_device_token";

export function isKitchenHost(): boolean {
  if (typeof window === "undefined") return false;
  const host = window.location.hostname.toLowerCase();
  // Prod: k.iq-rest.com. Dev: k.lvh.me, k.localhost. Short subdomain on
  // purpose — staff type this on touchscreen keyboards and every saved
  // character matters.
  return host === "k" || host.startsWith("k.");
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
