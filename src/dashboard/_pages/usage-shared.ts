// Shared types + helpers for the admin usage (sessions) screens.
// A "session" is computed in the API (grouped by fingerprint within a window);
// it has no DB id, so the sub-page id is the session payload encoded into the
// URL (see encodeSessionId / decodeSessionId).

export interface SessionRow {
  ipkey: string | null;
  hasIp: boolean;
  country: string;
  region: string | null;
  device: string | null;
  platform: string | null;
  firstAt: string;
  lastAt: string;
  eventCount: number;
  hasGoogle: boolean;
  hasFacebook: boolean;
  userId: string | null;
  restaurantId: string | null;
  userLabel: string | null;
  restaurantLabel: string | null;
}

export interface SessionEvent {
  id: string;
  at: string;
  event: string;
  gclid: string | null;
  isFacebookAds: boolean;
  fbSentEvents: string[];
}

/** SessionRow + the local day it was listed under (so "back" returns to it). */
export type SessionData = SessionRow & { day: string };

export const pad = (n: number) => String(n).padStart(2, "0");

/** Local HH:MM:SS for an ISO timestamp (admin's own timezone). */
export function hms(iso: string): string {
  const d = new Date(iso);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

/** Local HH:MM (no seconds). */
export function hm(iso: string): string {
  const d = new Date(iso);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** OS name only, no emoji. */
export function osName(platform: string | null, device: string | null): string {
  const p = (platform || "").toLowerCase();
  if (p === "ios") return "iOS";
  if (p === "android") return "Android";
  if (p === "windows") return "Windows";
  if (p === "macos") return "macOS";
  if (p === "linux") return "Linux";
  return platform || device || "—";
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

// ── Local-day helpers (admin timezone) ──

export function todayLocal(): string {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function shiftDayLocal(day: string, delta: number): string {
  const [y, m, d] = day.split("-").map(Number);
  const dt = new Date(y, m - 1, d + delta);
  return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function dayLabel(day: string): string {
  const t = todayLocal();
  if (day === t) return "Today";
  if (day === shiftDayLocal(t, -1)) return "Yesterday";
  const [, m, d] = day.split("-").map(Number);
  return `${d} ${MONTHS[m - 1]}`;
}

/** Absolute [from, to) instants for the admin's local day. */
export function localDayWindow(day: string): { from: string; to: string } {
  const [y, m, d] = day.split("-").map(Number);
  const start = new Date(y, m - 1, d, 0, 0, 0, 0);
  const end = new Date(y, m - 1, d + 1, 0, 0, 0, 0);
  return { from: start.toISOString(), to: end.toISOString() };
}

// ── Session id (URL-safe encoding of the session payload) ──

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
    const json = new TextDecoder().decode(bytes);
    return JSON.parse(json) as SessionData;
  } catch {
    return null;
  }
}

/** Stable per-session key for selection sets. */
export function sessionKey(s: SessionRow): string {
  return `${s.ipkey}|${s.hasIp}|${s.country}|${s.device}|${s.platform}|${s.firstAt}|${s.lastAt}`;
}

/** Descriptor the delete endpoint needs for one session. */
export function sessionDescriptor(s: SessionRow) {
  return {
    ipkey: s.ipkey,
    hasIp: s.hasIp,
    country: s.country,
    device: s.device,
    platform: s.platform,
    from: s.firstAt,
    to: s.lastAt,
  };
}
