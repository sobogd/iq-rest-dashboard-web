// Marketing landing origin. Hardcoded so the dashboard build does not need a
// separate env var; flip this constant if the landing moves.
const LANDING_BASE = "https://iq-rest.com";

/** Locale-aware URL of the marketing landing main page. Used by the IQ Rest logo
 *  in the auth/create-flow wizard so a click escapes back to the homepage. */
export function landingUrl(locale: string): string {
  return `${LANDING_BASE}/${locale}`;
}
