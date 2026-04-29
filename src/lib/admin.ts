// Admin configuration. Domain configurable via VITE_ADMIN_EMAIL_DOMAIN env.
export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  const env = (import.meta as { env?: Record<string, string | undefined> }).env;
  const domain = (env?.VITE_ADMIN_EMAIL_DOMAIN || "iq-rest.com").toLowerCase();
  return email.toLowerCase().endsWith("@" + domain);
}
