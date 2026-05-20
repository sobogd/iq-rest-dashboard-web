/** Thin fetch wrapper. Sends cookies, prefixes with VITE_API_URL. */

import { landingUrl } from "./landing-url";
import { observeResponseVersion } from "./version-check";

const BASE = import.meta.env.VITE_API_URL || "/api";

// Endpoints that are EXPECTED to return 401 when the visitor is unauthenticated
// (initial auth probe etc.). For those we surface the error to the caller
// without nuking the session — the dashboard layouts already handle the
// "not logged in" case explicitly.
const AUTH_PROBE_PATHS = new Set(["/auth/check", "/auth/google", "/auth/verify-otp", "/auth/send-otp"]);

let isLoggingOut = false;

function currentLocale(): string {
  if (typeof window === "undefined") return "en";
  const seg = window.location.pathname.split("/").filter(Boolean)[0];
  return /^[a-z]{2}$/i.test(seg || "") ? (seg as string) : "en";
}

/** Fired on any unexpected 401 from the API. Clears any leftover client state
 *  and bounces the user to the marketing landing — the session cookie is
 *  already gone or invalid, no point pretending we're signed in. */
function handleUnauthorized(): void {
  if (isLoggingOut) return;
  isLoggingOut = true;
  // Fire-and-forget logout so the server-side row is cleared too. We don't
  // await it — the cookie is dead either way and we want the redirect fast.
  fetch(`${BASE}/auth/logout`, { method: "POST", credentials: "include" }).catch(() => undefined);
  if (typeof window !== "undefined") {
    window.location.assign(landingUrl(currentLocale()));
  }
}

/** Build a full API URL from a path that may start with `/` or `/api/`.
 *  Use this for raw fetch() calls that bypass the api() wrapper. */
export function apiUrl(path: string): string {
  const stripped = path.replace(/^\/api(\/|$)/, "/");
  const clean = stripped.startsWith("/") ? stripped : `/${stripped}`;
  return `${BASE}${clean}`;
}

export class ApiError extends Error {
  status: number;
  data: unknown;
  constructor(status: number, data: unknown, message: string) {
    super(message);
    this.status = status;
    this.data = data;
  }
}

export async function api<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
    ...init,
  });
  observeResponseVersion(res);
  const text = await res.text();
  const data = text ? safeJson(text) : undefined;
  if (!res.ok) {
    if (res.status === 401 && !AUTH_PROBE_PATHS.has(path.replace(/^\/api/, ""))) {
      handleUnauthorized();
    }
    throw new ApiError(res.status, data, (data as { message?: string })?.message || res.statusText);
  }
  return data as T;
}

function safeJson(text: string) {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}
