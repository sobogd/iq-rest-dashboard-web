// Detects when the dashboard-api has been redeployed by watching the
// `X-App-Version` header that the api middleware stamps on every response.
//
// Behaviour:
//   1. The first non-empty version we see becomes the "boot version".
//   2. Any later response with a different version flips `stale` to true.
//   3. The root router subscribes to navigation completions; on the next
//      navigation while `stale` is true we do a full `location.reload()`
//      so the user picks up the new bundle.
//
// The user never sees a banner or toast — the refresh happens silently
// when they next move between pages, so an in-progress form is never
// auto-discarded. If a form has unsaved changes the browser will still
// fire its native beforeunload prompt because reload() respects it.

const HEADER = "x-app-version";

let bootVersion: string | null = null;
let stale = false;

export function observeResponseVersion(res: Response | null | undefined): void {
  if (!res) return;
  const v = res.headers.get(HEADER);
  if (!v) return;
  if (bootVersion === null) {
    bootVersion = v;
    return;
  }
  if (v !== bootVersion) {
    stale = true;
  }
}

export function isStaleVersion(): boolean {
  return stale;
}

export function reloadIfStale(): void {
  if (!stale) return;
  if (typeof window === "undefined") return;
  // Reload picks the same URL (preserves the user's current location) and
  // refetches index.html, which references the freshly hashed bundle.
  window.location.reload();
}
