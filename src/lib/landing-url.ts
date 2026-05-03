// Marketing landing origin. Override per-environment with VITE_LANDING_URL.
const LANDING_BASE = import.meta.env.VITE_LANDING_URL || "https://iq-rest.com";

/** Locale-aware URL of the marketing landing main page. Used by the IQ Rest logo
 *  in the auth/create-flow wizard so a click escapes back to the homepage. */
export function landingUrl(locale: string): string {
  return `${LANDING_BASE}/${locale}`;
}
