"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { View } from "./types";
import { pathToView, viewToPath } from "./url";

interface DashboardRouterCtx {
  /** Current (top) view. */
  view: View;
  /** Full back-stack — last item is current. */
  stack: View[];
  /** Push a new view onto the stack and update history. */
  push: (view: View) => void;
  /** Replace the top view (no new history entry within stack — but URL replaces). */
  replace: (view: View) => void;
  /** Reset stack to a single root view (used by bottom tabs). */
  resetTo: (view: View) => void;
  /** Trigger browser back. */
  back: () => void;
  /** True if at least one view sits below current. */
  canGoBack: boolean;
}

const Ctx = createContext<DashboardRouterCtx | null>(null);

interface ProviderProps {
  initialPath: string;
  locale: string;
  children: ReactNode;
}

const HISTORY_KEY = "__dashboardSpa";

interface HistoryState {
  [HISTORY_KEY]?: { stack: View[] };
}

function writeHistory(
  mode: "push" | "replace",
  stack: View[],
  locale: string,
  view: View,
) {
  if (typeof window === "undefined") return;
  const url = `/${locale}${viewToPath(view)}`;
  // Merge with whatever Next.js / next-intl stashed on history.state so we
  // don't strip framework-internal markers (which causes a phantom history
  // entry — the symptom is "back button needs two clicks").
  const existing = (window.history.state as Record<string, unknown> | null) || {};
  const merged = { ...existing, [HISTORY_KEY]: { stack } };
  try {
    if (mode === "push") window.history.pushState(merged, "", url);
    else window.history.replaceState(merged, "", url);
  } catch {
    // ignore
  }
}

export function DashboardRouterProvider({ initialPath, locale, children }: ProviderProps) {
  const [stack, setStack] = useState<View[]>(() => [pathToView(initialPath)]);
  const localeRef = useRef(locale);
  localeRef.current = locale;

  // On first mount, anchor current history entry to our initial stack so the
  // very first popstate (after a forward/back) restores correctly.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const existing = window.history.state as HistoryState | null;
    if (!existing || !existing[HISTORY_KEY]) {
      const url = window.location.pathname + window.location.search;
      const next: HistoryState = { ...(existing || {}), [HISTORY_KEY]: { stack } };
      window.history.replaceState(next, "", url);
    } else if (existing[HISTORY_KEY]?.stack?.length) {
      // Hydrate from history if user navigated back into a previous SPA visit.
      setStack(existing[HISTORY_KEY]!.stack);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sync browser back/forward → in-memory stack.
  useEffect(() => {
    function onPop(e: PopStateEvent) {
      const s = e.state as HistoryState | null;
      const restored = s?.[HISTORY_KEY]?.stack;
      if (restored && restored.length > 0) {
        setStack(restored);
      } else {
        // Fell back outside SPA history — reconstruct from URL.
        setStack([pathToView(window.location.pathname + window.location.search)]);
      }
    }
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  // Forward navigation always reveals a fresh view — scroll the window back
  // to the top so the new screen starts at its head, not where the previous
  // one left off (matters most on iOS, where browsers don't auto-reset
  // because the URL change is a single-page-app pushState, not a full nav).
  const scrollTop = () => {
    if (typeof window !== "undefined") window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  };

  const push = useCallback((v: View) => {
    setStack((prev) => {
      const next = [...prev, v];
      writeHistory("push", next, localeRef.current, v);
      return next;
    });
    scrollTop();
  }, []);

  const replace = useCallback((v: View) => {
    setStack((prev) => {
      const next = prev.length > 0 ? [...prev.slice(0, -1), v] : [v];
      writeHistory("replace", next, localeRef.current, v);
      return next;
    });
    scrollTop();
  }, []);

  const resetTo = useCallback((v: View) => {
    setStack(() => {
      const next = [v];
      writeHistory("push", next, localeRef.current, v);
      return next;
    });
    scrollTop();
  }, []);

  const back = useCallback(() => {
    if (typeof window !== "undefined") window.history.back();
  }, []);

  const value = useMemo<DashboardRouterCtx>(
    () => ({
      view: stack[stack.length - 1],
      stack,
      push,
      replace,
      resetTo,
      back,
      canGoBack: stack.length > 1,
    }),
    [stack, push, replace, resetTo, back],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useDashboardRouter(): DashboardRouterCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useDashboardRouter must be used inside DashboardRouterProvider");
  return ctx;
}
