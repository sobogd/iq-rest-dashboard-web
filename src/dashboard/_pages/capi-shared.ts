// Meta CAPI event types that can be sent manually. Names must match the
// dashboard-api allow-list (AdminController.CAPI_EVENTS).
export const CAPI_EVENTS: Array<{ name: string; desc: string }> = [
  { name: "CompleteRegistration", desc: "Conversion — campaign optimization goal" },
  { name: "Lead", desc: "Lead / sign-up intent" },
  { name: "ViewContent", desc: "Viewed demo / content (learning)" },
  { name: "InitiateCheckout", desc: "Started onboarding / checkout" },
  { name: "Subscribe", desc: "Started a subscription" },
  { name: "Purchase", desc: "Paid subscription (value)" },
  { name: "PageView", desc: "Landing page view (top funnel)" },
];
