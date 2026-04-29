function viteEnv(): Record<string, string | undefined> {
  return (import.meta as { env?: Record<string, string | undefined> }).env || {};
}

/** Origin of the dashboard SPA itself (used in share/about contexts that point at the admin app). */
export function getAppOrigin(): string {
  const env = viteEnv();
  return env.VITE_APP_URL || env.NEXT_PUBLIC_APP_URL || window.location.origin;
}

/** Origin of the public QR menu site (separate Next.js app). Defaults to dashboard origin. */
export function getPublicMenuOrigin(): string {
  const env = viteEnv();
  return env.VITE_PUBLIC_MENU_URL || getAppOrigin();
}

export function getMenuUrl(slug: string): string {
  return getPublicMenuOrigin() + "/m/" + slug;
}

/** Display-friendly prefix without scheme: "iq-rest.com/m/" */
export function getMenuUrlPrefix(): string {
  const origin = getPublicMenuOrigin().replace(/^https?:\/\//, "");
  return origin + "/m/";
}
