export function getAppOrigin(): string {
  return process.env.NEXT_PUBLIC_APP_URL || "https://iq-rest.com";
}

export function getMenuUrl(slug: string): string {
  return getAppOrigin() + "/m/" + slug;
}

/** Display-friendly prefix without scheme: "localhost:8123/m/" or "iq-rest.com/m/" */
export function getMenuUrlPrefix(): string {
  const origin = getAppOrigin().replace(/^https?:\/\//, "");
  return origin + "/m/";
}
