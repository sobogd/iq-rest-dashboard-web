import { StrictMode } from "react";
import type { ComponentType } from "react";
import type { Root } from "react-dom/client";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider, createRouter } from "@tanstack/react-router";
import { Toaster } from "sonner";
import { routeTree } from "./routeTree.gen";
import { ThemeProvider } from "./components/theme-provider";
import { reloadIfStale } from "./lib/version-check";

// Admin SPA boot. Extracted from main.tsx so the kitchen.* subdomain
// bundle can skip TanStack Router and the admin-only route tree entirely.

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30_000,
      refetchOnWindowFocus: false,
    },
  },
});

function makeRouter(FullPageLoader: ComponentType) {
  return createRouter({
    routeTree,
    context: { queryClient },
    defaultPreload: "intent",
    defaultPendingComponent: FullPageLoader as never,
    defaultPendingMs: 0,
  });
}

const placeholderLoader: ComponentType = () => null;
const router = makeRouter(placeholderLoader);

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

router.subscribe("onResolved", () => {
  reloadIfStale();
});

export function mountAdmin(rootEl: HTMLElement, FullPageLoader: ComponentType): Root {
  // FullPageLoader is forwarded from main.tsx so the spinner is consistent
  // between pre-mount and route-level suspense fallbacks. Swap the real
  // component in for the placeholder used at module load time.
  Object.assign(router.options, { defaultPendingComponent: FullPageLoader });
  const root = createRoot(rootEl);
  root.render(
    <StrictMode>
      <ThemeProvider>
        <QueryClientProvider client={queryClient}>
          <RouterProvider router={router} />
          <Toaster position="top-center" richColors closeButton />
        </QueryClientProvider>
      </ThemeProvider>
    </StrictMode>,
  );
  return root;
}
