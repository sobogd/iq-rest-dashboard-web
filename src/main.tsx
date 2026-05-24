import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { FullPageLoader } from "./components/full-page-loader";
import { bootstrapI18n } from "./i18n";
import { observeResponseVersion } from "./lib/version-check";
import { isKioskHost, isDemoMode } from "./lib/device-mode";
import "./styles.css";

// Wrap global fetch once so every response — wherever in the codebase it
// came from — gets its X-App-Version header observed. Cleaner than
// threading observeResponseVersion through ~30 fetch call sites in
// dashboard/_v2/api.ts and elsewhere.
if (typeof window !== "undefined") {
  const originalFetch = window.fetch.bind(window);
  window.fetch = async (...args: Parameters<typeof fetch>) => {
    const res = await originalFetch(...args);
    try {
      observeResponseVersion(res);
    } catch {
      // Never let header-reading throw poison a real request.
    }
    return res;
  };
}

const rootEl = document.getElementById("root");
if (!rootEl) throw new Error("#root not found");

// Kitchen-host PWA bootstrap. Swaps the admin manifest for the kitchen-
// specific one (different name, fullscreen display) and registers a
// service worker. The SW's primary purpose is **storage persistence**:
// once installed via Add-to-Home-Screen on iPad, the kitchen escapes
// Safari's 7-day ITP eviction so a paired tablet survives long idle
// stretches without re-pairing. Offline functionality is a side effect.
function setupKitchenPwa(): void {
  const existing = document.querySelector('link[rel="manifest"]') as HTMLLinkElement | null;
  if (existing) {
    existing.href = "/k-manifest.webmanifest";
  } else {
    const link = document.createElement("link");
    link.rel = "manifest";
    link.href = "/k-manifest.webmanifest";
    document.head.appendChild(link);
  }
  const titleEl = document.querySelector('meta[name="apple-mobile-web-app-title"]');
  if (titleEl) titleEl.setAttribute("content", "Kitchen");
  if ("serviceWorker" in navigator) {
    // Defer registration to the load event so the boot path isn't held up
    // by SW install on slower tablets.
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("/k-sw.js", { scope: "/" }).catch(() => {
        // Registration failure is non-fatal — the kitchen still works,
        // just without install-as-PWA benefits.
      });
    });
  }
}

// Two entrypoints share one bundle:
//   - kitchen.*  → tiny kiosk shell with no router, no admin/settings code.
//   - everything else → full admin SPA with TanStack Router.
//
// Each branch is a dynamic import so Vite emits separate chunks and the
// kitchen tablet doesn't download routes/admin/forms code it never uses.
// i18n bootstrap is awaited in parallel because both branches need it.
void (async () => {
  const i18nReady = bootstrapI18n();

  // Public landing demo: render the real KDS kiosk with hardcoded sample
  // data, no pairing, no API. Must come before the kiosk-host branch so it
  // also works on non-k.* hosts (e.g. local dev), and must NOT register the
  // PWA/SW — we don't want the demo installed as the kitchen home screen.
  const demo = isDemoMode();

  if (demo || isKioskHost()) {
    if (!demo) setupKitchenPwa();
    const [{ KitchenApp }] = await Promise.all([
      import("./kitchen/kitchen-app"),
      i18nReady,
    ]);
    createRoot(rootEl).render(
      <StrictMode>
        <KitchenApp demo={demo} />
      </StrictMode>,
    );
    return;
  }

  const [routerMod] = await Promise.all([import("./admin-bootstrap"), i18nReady]);
  routerMod.mountAdmin(rootEl, FullPageLoader);
})();
