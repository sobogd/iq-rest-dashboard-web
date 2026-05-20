import { useEffect, useRef, useState } from "react";
import { useQueryClient, type QueryClient } from "@tanstack/react-query";
import { useOrdersStreamStateStore } from "./orders-sync-state";

// Connects to the dashboard-api SSE stream and surfaces order events into the
// TanStack Query cache. Mutations from this tab, other tabs, other devices,
// and the QR public menu all flow through here within ~100ms, replacing the
// previous 30s poll-based UI.
//
// Hardening:
//  - Manual reconnect with exponential backoff when EventSource closes or
//    fails (the browser only auto-reconnects from CONNECTING state, never
//    from CLOSED — silent death is real otherwise).
//  - Watchdog: server emits a typed `ping` every 15s; if we don't see any
//    event/ping for 45s we force a reconnect (covers half-open TCP sockets
//    behind NAT/LB that never surface as `error`).
//  - `visibilitychange` + `online` + `focus` listeners: when the tab returns
//    from sleep/background, immediately verify liveness — reconnect if not
//    OPEN and invalidate the orders cache so we never display stale data
//    while reconnecting.

interface OrderEvent {
  action: "created" | "updated" | "deleted" | "split";
  restaurantId: string;
  order?: unknown;
  createdOrder?: unknown;
  orderId?: string;
}

type ConnectionState = "connecting" | "open" | "closed";

const WATCHDOG_INTERVAL_MS = 5_000;
const WATCHDOG_STALE_MS = 45_000;
const RECONNECT_BASE_MS = 1_000;
const RECONNECT_MAX_MS = 30_000;

export function useOrdersStream(restaurantId: string | null | undefined): ConnectionState {
  const qc = useQueryClient();
  const [state, setState] = useState<ConnectionState>("closed");
  const setGlobal = useOrdersStreamStateStore((s) => s.set);

  // Stash callbacks so the connect closure stays stable across rerenders.
  const stateRef = useRef(setState);
  stateRef.current = setState;
  const globalRef = useRef(setGlobal);
  globalRef.current = setGlobal;

  useEffect(() => {
    if (!restaurantId) {
      setState("closed");
      setGlobal("closed");
      return;
    }

    let cancelled = false;
    let es: EventSource | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let watchdogTimer: ReturnType<typeof setInterval> | null = null;
    let lastActivityAt = Date.now();
    let attempt = 0;

    const setStates = (s: ConnectionState) => {
      stateRef.current(s);
      globalRef.current(s);
    };

    const clearTimers = () => {
      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
      }
      if (watchdogTimer) {
        clearInterval(watchdogTimer);
        watchdogTimer = null;
      }
    };

    const closeStream = () => {
      if (es) {
        try {
          es.close();
        } catch {
          // ignore
        }
        es = null;
      }
    };

    const scheduleReconnect = (immediate = false) => {
      if (cancelled) return;
      if (reconnectTimer) return;
      const delay = immediate
        ? 0
        : Math.min(RECONNECT_MAX_MS, RECONNECT_BASE_MS * Math.pow(2, attempt));
      attempt += 1;
      reconnectTimer = setTimeout(() => {
        reconnectTimer = null;
        connect();
      }, delay);
    };

    const forceReconnect = (immediate = true) => {
      closeStream();
      setStates("connecting");
      scheduleReconnect(immediate);
      // Pull fresh data through the polling path while the stream is down so
      // the UI is never visibly stale during a reconnect window.
      void qc.invalidateQueries({ queryKey: ["orders"] });
      void qc.invalidateQueries({ queryKey: ["reservations"] });
    };

    const connect = () => {
      if (cancelled) return;
      closeStream();
      setStates("connecting");
      lastActivityAt = Date.now();

      const base = import.meta.env.VITE_API_URL || "/api";
      const url = `${base}/orders/stream?restaurantId=${encodeURIComponent(restaurantId)}`;
      const next = new EventSource(url, { withCredentials: true });
      es = next;

      next.addEventListener("ready", () => {
        lastActivityAt = Date.now();
        attempt = 0;
        setStates("open");
        // First successful (re)connection: refetch in case we missed events
        // while disconnected. Cheap insurance, runs once per connect.
        void qc.invalidateQueries({ queryKey: ["orders"] });
        void qc.invalidateQueries({ queryKey: ["reservations"] });
      });

      next.addEventListener("ping", () => {
        lastActivityAt = Date.now();
      });

      next.addEventListener("order", (e) => {
        lastActivityAt = Date.now();
        try {
          const event = JSON.parse((e as MessageEvent).data) as OrderEvent;
          applyEvent(qc, event);
        } catch {
          void qc.invalidateQueries({ queryKey: ["orders"] });
        }
      });

      next.onerror = () => {
        // The browser auto-reconnects only while in CONNECTING; once CLOSED
        // it gives up silently. We always tear down and re-open ourselves
        // so we control backoff and surface accurate state to the UI.
        setStates("connecting");
        if (next.readyState === EventSource.CLOSED) {
          closeStream();
          scheduleReconnect();
        }
      };
    };

    const watchdog = () => {
      if (cancelled) return;
      if (!es) return;
      const sinceLast = Date.now() - lastActivityAt;
      if (sinceLast > WATCHDOG_STALE_MS) {
        // No ping/order for too long — the socket is probably half-open.
        forceReconnect(true);
      }
    };

    const onVisible = () => {
      if (typeof document !== "undefined" && document.visibilityState !== "visible") return;
      // Tab came back from background. Treat as suspect — verify liveness.
      if (!es || es.readyState !== EventSource.OPEN) {
        forceReconnect(true);
        return;
      }
      const sinceLast = Date.now() - lastActivityAt;
      if (sinceLast > WATCHDOG_STALE_MS / 2) {
        forceReconnect(true);
      } else {
        // Cheap safety: pull fresh data even when stream looks healthy.
        void qc.invalidateQueries({ queryKey: ["orders"] });
        void qc.invalidateQueries({ queryKey: ["reservations"] });
      }
    };

    const onOnline = () => {
      forceReconnect(true);
    };

    connect();
    watchdogTimer = setInterval(watchdog, WATCHDOG_INTERVAL_MS);

    if (typeof document !== "undefined") {
      document.addEventListener("visibilitychange", onVisible);
    }
    if (typeof window !== "undefined") {
      window.addEventListener("online", onOnline);
      window.addEventListener("focus", onVisible);
    }

    return () => {
      cancelled = true;
      clearTimers();
      closeStream();
      if (typeof document !== "undefined") {
        document.removeEventListener("visibilitychange", onVisible);
      }
      if (typeof window !== "undefined") {
        window.removeEventListener("online", onOnline);
        window.removeEventListener("focus", onVisible);
      }
      setStates("closed");
    };
  }, [restaurantId, qc, setGlobal]);

  return state;
}

// Mutates the cached orders array in place of a network refetch. Falls back
// to invalidation when a slim payload (no `order` body) arrives or the
// cache is empty.
function applyEvent(qc: QueryClient, event: OrderEvent): void {
  const key = ["orders"] as const;
  const existing = qc.getQueryData<unknown[]>(key);
  if (!Array.isArray(existing)) {
    void qc.invalidateQueries({ queryKey: key });
    return;
  }

  if (event.action === "deleted") {
    if (!event.orderId) return;
    qc.setQueryData<unknown[]>(key, existing.filter(byId((x) => x !== event.orderId)));
    return;
  }

  if (!event.order) {
    void qc.invalidateQueries({ queryKey: key });
    return;
  }

  if (event.action === "created") {
    qc.setQueryData<unknown[]>(key, mergeUpsert(existing, [event.order]));
    return;
  }

  if (event.action === "updated") {
    qc.setQueryData<unknown[]>(key, mergeUpsert(existing, [event.order]));
    return;
  }

  if (event.action === "split") {
    const next = [event.order];
    if (event.createdOrder) next.push(event.createdOrder);
    qc.setQueryData<unknown[]>(key, mergeUpsert(existing, next));
    return;
  }
}

function byId(predicate: (id: string) => boolean) {
  return (x: unknown): boolean => {
    const id = (x as { id?: string })?.id;
    return typeof id === "string" ? predicate(id) : true;
  };
}

function mergeUpsert(existing: unknown[], incoming: unknown[]): unknown[] {
  const map = new Map<string, unknown>();
  for (const o of existing) {
    const id = (o as { id?: string })?.id;
    if (id) map.set(id, o);
  }
  for (const o of incoming) {
    const id = (o as { id?: string })?.id;
    if (id) map.set(id, o);
  }
  return [...map.values()];
}
