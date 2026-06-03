// Shared types + helpers for the admin usage (sessions) screens.
// A "session" is computed in the API: identified activity grouped by the
// effective restaurant, anonymous activity grouped by ip/region — over a
// 30-day window. It has no DB id, so the sub-page id encodes the group
// descriptor (see encodeSessionId / decodeSessionId).

export interface SessionRow {
  kind: "r" | "a";
  rid: string | null;          // restaurantId for kind "r"
  ipkey: string | null;        // ip/region (anon key for kind "a")
  hasIp: boolean;
  country: string;
  region: string | null;
  firstAt: string;
  lastAt: string;
  eventCount: number;
  hasGoogle: boolean;
  hasFacebook: boolean;
  latestFbclid: string | null; // newest fbclid in the group (for CAPI)
  latestFbTs: number | null;
  fbStage?: "reg" | "checkout" | "view" | null; // deepest CAPI event sent for latestFbclid
  userLabel: string | null;
  restaurantLabel: string | null;
}

export interface SessionEvent {
  id: string;
  at: string;
  event: string;
  ip: string | null;
  device: string | null;
  platform: string | null;
  gclid: string | null;
  isFacebookAds: boolean;
}

/** SessionRow + the [from,to] window it was listed under (for events fetch). */
export type SessionData = SessionRow & { from: string; to: string };

export const pad = (n: number) => String(n).padStart(2, "0");

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** Local "3 Aug 12:13:14" (date without year + seconds). */
export function hmsDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

export function countryToFlag(code: string): string {
  if (!code || code === "XX" || code.length !== 2) return "🌐";
  const A = 0x1f1e6;
  const a = "A".charCodeAt(0);
  return String.fromCodePoint(A + code.charCodeAt(0) - a, A + code.charCodeAt(1) - a);
}

/** Emoji + readable name for a device/platform pair. */
export function deviceLabel(device: string | null, platform: string | null): string {
  const p = (platform || "").toLowerCase();
  if (p === "ios") return device === "tablet" ? "📱 iPadOS" : "📱 iOS";
  if (p === "android") return device === "tablet" ? "📱 Android tablet" : "🤖 Android";
  if (p === "windows") return "🪟 Windows";
  if (p === "macos") return "🍎 macOS";
  if (p === "linux") return "🐧 Linux";
  const emoji = device === "mobile" ? "📱" : device === "tablet" ? "📋" : "🖥";
  return `${emoji} ${platform || device || "—"}`;
}

// ── Session id (URL-safe encoding of the group descriptor + window) ──

export function encodeSessionId(data: SessionData): string {
  const json = JSON.stringify(data);
  const bytes = new TextEncoder().encode(json);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function decodeSessionId(id: string): SessionData | null {
  try {
    const b64 = id.replace(/-/g, "+").replace(/_/g, "/");
    const bin = atob(b64);
    const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
    return JSON.parse(new TextDecoder().decode(bytes)) as SessionData;
  } catch {
    return null;
  }
}

/** Stable per-session key for selection sets. */
export function sessionKey(s: SessionRow): string {
  return `${s.kind}:${s.rid ?? s.ipkey}`;
}

/** Descriptor the events/delete endpoints need for one session group. */
export function sessionDescriptor(s: SessionRow) {
  return { kind: s.kind, rid: s.rid, ipkey: s.ipkey, hasIp: s.hasIp };
}
