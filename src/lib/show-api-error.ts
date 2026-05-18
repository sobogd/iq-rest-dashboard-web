import { toast } from "sonner";
import i18n from "@/i18n";
import { ApiError } from "./api";
import { track } from "./dashboard-events";

// Shows a generic, translated error toast and emits a tracking event whose
// name encodes the backend error so it shows up directly in the admin
// activity log: `dash_error_{status}_{slug}`.
//
// The slug is the backend message trimmed/sanitised — combinatorial explosion
// is a known trade-off; we choose it because the user wants to see the exact
// failure cause without opening event payloads in the admin panel.
export function showApiError(err: unknown, action: string): void {
  const t = i18n.getFixedT(null, "dashboard.common");

  let status = 0;
  let message = "unknown_error";
  if (err instanceof ApiError) {
    status = err.status;
    message = err.message || "unknown_error";
  } else if (err instanceof Error) {
    message = err.message || "unknown_error";
  }

  const slug = sanitiseForEventName(message);
  // Cap event name at 120 chars — analytics backends usually balk past that.
  const eventName = `dash_error_${status || "net"}_${slug}`.slice(0, 120);
  track(eventName, { action, status, message });

  toast.error(t("genericErrorTitle"), {
    description: t("genericErrorMessage"),
  });

  // eslint-disable-next-line no-console
  console.error(`[api] ${action} failed:`, err);
}

function sanitiseForEventName(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 80) || "error";
}
