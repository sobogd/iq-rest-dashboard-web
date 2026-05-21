// Per-tab active restaurant id. AuthGuard validates the id against the
// user's company on every request, so a stale value is harmless (server
// falls back to primary). sessionStorage = per-tab so two tabs can edit
// different restaurants without stepping on each other. Cookie is the
// bootstrap fallback for first-paint SSR-style probes (the API also reads
// it as a backup when no header is sent).

const STORAGE_KEY = "iqr_active_restaurant_id";
const COOKIE_NAME = "iqr_active_restaurant_id";

export function getActiveRestaurantId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const fromSession = window.sessionStorage.getItem(STORAGE_KEY);
    if (fromSession) return fromSession;
  } catch {
    // sessionStorage blocked (Safari private etc.) — fall through to cookie
  }
  const match = document.cookie.split("; ").find((c) => c.startsWith(`${COOKIE_NAME}=`));
  if (match) return decodeURIComponent(match.split("=")[1] || "") || null;
  return null;
}

export function setActiveRestaurantId(id: string | null): void {
  if (typeof window === "undefined") return;
  try {
    if (id) window.sessionStorage.setItem(STORAGE_KEY, id);
    else window.sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore — cookie fallback below still wires the value
  }
  const maxAge = id ? 60 * 60 * 24 * 365 : 0;
  document.cookie = `${COOKIE_NAME}=${id ? encodeURIComponent(id) : ""}; path=/; max-age=${maxAge}; samesite=lax`;
}

export function activeRestaurantHeader(): Record<string, string> {
  const id = getActiveRestaurantId();
  return id ? { "X-Restaurant-Id": id } : {};
}
