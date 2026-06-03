// Meta CAPI event types that can be sent manually. Names must match the
// dashboard-api allow-list (AdminController.CAPI_EVENTS).
export interface CapiLogRow {
  id: string;
  fbclid: string;
  eventName: string;
  status: string;
  createdAt: string;
}

export interface CapiHistoryRow {
  id: string;
  eventName: string;
  status: string;
  createdAt: string;
}

export interface CapiEntry {
  id: string;
  fbclid: string;
  eventName: string;
  status: string;
  response: unknown;
  createdAt: string;
}

/** Compact local timestamp "DD.MM HH:MM". */
export function fmtAt(iso: string): string {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getDate())}.${p(d.getMonth() + 1)} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

export const CAPI_EVENTS: Array<{ name: string; short: string; desc: string }> = [
  { name: "ViewContent", short: "View", desc: "Viewed demo / content (learning)" },
  { name: "InitiateCheckout", short: "Checkout", desc: "Started onboarding / checkout" },
  { name: "CompleteRegistration", short: "Register", desc: "Conversion — campaign optimization goal" },
  { name: "Subscribe", short: "Subscribe", desc: "Started a subscription" },
];

export const CAPI_SHORT = new Map(CAPI_EVENTS.map((e) => [e.name, e.short]));
