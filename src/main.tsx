import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { FullPageLoader } from "./components/full-page-loader";
import { bootstrapI18n } from "./i18n";
import { observeResponseVersion } from "./lib/version-check";
import { isKitchenHost } from "./lib/device-mode";
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

// Two entrypoints share one bundle:
//   - kitchen.*  → tiny kiosk shell with no router, no admin/settings code.
//   - everything else → full admin SPA with TanStack Router.
//
// Each branch is a dynamic import so Vite emits separate chunks and the
// kitchen tablet doesn't download routes/admin/forms code it never uses.
// i18n bootstrap is awaited in parallel because both branches need it.
void (async () => {
  const i18nReady = bootstrapI18n();

  if (isKitchenHost()) {
    const [{ KitchenApp }] = await Promise.all([
      import("./kitchen/kitchen-app"),
      i18nReady,
    ]);
    createRoot(rootEl).render(
      <StrictMode>
        <KitchenApp />
      </StrictMode>,
    );
    return;
  }

  const [routerMod] = await Promise.all([import("./admin-bootstrap"), i18nReady]);
  routerMod.mountAdmin(rootEl, FullPageLoader);
})();
