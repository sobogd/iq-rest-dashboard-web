import { apiUrl } from "@/lib/api";

const SEARCH_HOST_REGEX =
  /(?:^|\.)(google|bing|yandex|duckduckgo|yahoo|baidu|ecosia|qwant|startpage|mojeek|brave)\.[a-z.]+$/i;

function searchReferrerHost(): string | null {
  try {
    const ref = document.referrer;
    if (!ref) return null;
    const host = new URL(ref).hostname;
    return SEARCH_HOST_REGEX.test(host) ? host : null;
  } catch {
    return null;
  }
}

export function trackEvent(event: string): void {
  if (typeof window === "undefined") return;
  const host = searchReferrerHost();
  const qs = host ? `?r=${encodeURIComponent(host)}` : "";
  fetch(apiUrl(`/api/track/${encodeURIComponent(event)}${qs}`), {
    method: "POST",
    credentials: "include",
    keepalive: true,
  }).catch(() => {});
}
