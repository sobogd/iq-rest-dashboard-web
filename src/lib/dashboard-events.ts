import { trackEvent } from "@/lib/analytics";

export function setDashboardUserId(_userId: string): void {
  // identify happens via /api/analytics/identify auth cookie
}

export function track(event: string, _meta?: Record<string, unknown>): void {
  trackEvent(event);
}
