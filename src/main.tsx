import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider, createRouter } from "@tanstack/react-router";
import { Toaster } from "sonner";
import { routeTree } from "./routeTree.gen";
import { ThemeProvider } from "./components/theme-provider";
import { FullPageLoader } from "./components/full-page-loader";
import { bootstrapI18n } from "./i18n";
import { observeResponseVersion, reloadIfStale } from "./lib/version-check";
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

// Subscribe to router navigation. After every settled navigation,
// reloadIfStale() short-circuits to a full browser reload when the API
// has signalled a new version since the tab booted. Doing it on
// navigation (not on every API response) means an in-progress form is
// never auto-discarded: the user has to leave the page themselves.
function attachStaleNavigationReload(r: typeof router) {
  r.subscribe("onResolved", () => {
    reloadIfStale();
  });
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30_000,
      refetchOnWindowFocus: false,
    },
  },
});

const router = createRouter({
  routeTree,
  context: { queryClient },
  defaultPreload: "intent",
  // Show the spinner immediately for any async beforeLoad (auth check,
  // redirects, etc.) instead of waiting the default 1s before revealing
  // pending UI.
  defaultPendingComponent: FullPageLoader,
  defaultPendingMs: 0,
});

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

attachStaleNavigationReload(router);

const rootEl = document.getElementById("root");
if (!rootEl) throw new Error("#root not found");

// Wait for the URL-locale's translation bundle before mounting so the
// first paint shows real copy (not raw keys). EN fallback is preloaded
// alongside; other locales are fetched on demand by the languageChanged
// handler in src/i18n.ts.
void bootstrapI18n().then(() => {
  createRoot(rootEl).render(
    <StrictMode>
      <ThemeProvider>
        <QueryClientProvider client={queryClient}>
          <RouterProvider router={router} />
          <Toaster position="top-center" richColors closeButton />
        </QueryClientProvider>
      </ThemeProvider>
    </StrictMode>,
  );
});
