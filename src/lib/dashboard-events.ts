import { trackEvent } from "@/lib/analytics";

export function track(event: string, _meta?: Record<string, unknown>): void {
  trackEvent(event);
}
