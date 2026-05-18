import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider, createRouter } from "@tanstack/react-router";
import { Toaster } from "sonner";
import { routeTree } from "./routeTree.gen";
import { ThemeProvider } from "./components/theme-provider";
import { FullPageLoader } from "./components/full-page-loader";
import { bootstrapI18n } from "./i18n";
import "./styles.css";

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
