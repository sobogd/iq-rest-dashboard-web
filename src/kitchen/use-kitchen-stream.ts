import { useCallback, useEffect, useRef, useState } from "react";

// SSE stream for a paired kitchen device. Mirrors the admin `useOrdersStream`
// but talks to /api/devices/stream (with the device bearer as a query param
// because EventSource cannot set headers) and surfaces a `device-revoked`
// callback so the kiosk can force-logout the moment the admin hits Revoke.
//
// Returns the current connection state + a `reconnect()` action for the
// offline overlay's manual retry button.

type OrderEventAction = "created" | "updated" | "deleted" | "split";

export interface KitchenOrderEvent {
  action: OrderEventAction;
  restaurantId: string;
  order?: unknown;
  createdOrder?: unknown;
  orderId?: string;
}

export type StreamState = "connecting" | "open" | "closed";

const WATCHDOG_INTERVAL_MS = 3_000;
// Server sends a ping every 15s. 20s without any event = TCP went quiet,
// network is gone. Aggressive on purpose — surfacing the offline overlay
// 20s sooner is worth more than tolerating a flaky LB hop.
const WATCHDOG_STALE_MS = 20_000;
const RECONNECT_BASE_MS = 1_000;
const RECONNECT_MAX_MS = 30_000;

interface UseKitchenStreamArgs {
  token: string | null;
  onOrder: (event: KitchenOrderEvent) => void;
  onRevoked: () => void;
}

interface UseKitchenStreamReturn {
  state: StreamState;
  reconnect: () => void;
}

export function useKitchenStream({
  token,
  onOrder,
  onRevoked,
}: UseKitchenStreamArgs): UseKitchenStreamReturn {
  const orderRef = useRef(onOrder);
  orderRef.current = onOrder;
  const revokeRef = useRef(onRevoked);
  revokeRef.current = onRevoked;

  const [state, setState] = useState<StreamState>("closed");

  // Exposed via the return value so the offline overlay can fire a manual
  // retry. Held in a ref so a single source-of-truth function survives
  // re-renders without re-wiring the effect.
  const reconnectRef = useRef<() => void>(() => {});
  const reconnect = useCallback(() => reconnectRef.current(), []);

  useEffect(() => {
    if (!token) {
      setState("closed");
      reconnectRef.current = () => {};
      return;
    }

    let cancelled = false;
    let es: EventSource | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let watchdogTimer: ReturnType<typeof setInterval> | null = null;
    let lastActivityAt = Date.now();
    let attempt = 0;

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
      if (cancelled || reconnectTimer) return;
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
      setState("connecting");
      scheduleReconnect(immediate);
    };

    reconnectRef.current = () => {
      // Manual retry from the offline overlay. Reset backoff so the next
      // attempt fires immediately rather than at the current exponential
      // step (which can be 30s after enough failures).
      attempt = 0;
      forceReconnect(true);
    };

    const connect = () => {
      if (cancelled) return;
      closeStream();
      setState("connecting");
      lastActivityAt = Date.now();

      // Same-origin: kitchen.* nginx proxies /api/devices/stream to the
      // dashboard-api backend so we avoid CORS + withCredentials on the
      // EventSource. (Admin SPA uses the absolute VITE_API_URL; kitchen
      // doesn't, by design.)
      const url = `/api/devices/stream?token=${encodeURIComponent(token)}`;
      // No withCredentials — we're same-origin in kitchen mode and the
      // token is in the URL (the only way to auth an EventSource without
      // Authorization headers).
      const next = new EventSource(url);
      es = next;

      next.addEventListener("ready", () => {
        lastActivityAt = Date.now();
        attempt = 0;
        setState("open");
      });
      next.addEventListener("ping", () => {
        lastActivityAt = Date.now();
      });
      next.addEventListener("order", (e) => {
        lastActivityAt = Date.now();
        try {
          const parsed = JSON.parse((e as MessageEvent).data) as KitchenOrderEvent;
          orderRef.current(parsed);
        } catch {
          // ignore — malformed payload, the next refresh will reconcile.
        }
      });
      next.addEventListener("device-revoked", () => {
        revokeRef.current();
      });
      next.onerror = () => {
        if (next.readyState === EventSource.CLOSED) {
          closeStream();
          setState("closed");
          scheduleReconnect();
        } else {
          setState("connecting");
        }
      };
    };

    const watchdog = () => {
      if (cancelled || !es) return;
      const sinceLast = Date.now() - lastActivityAt;
      if (sinceLast > WATCHDOG_STALE_MS) {
        // No pings for 20s = connection is dead even if EventSource still
        // reports OPEN. Mark closed *before* the reconnect attempt so the
        // overlay can show during the retry window instead of waiting for
        // the next failed connect() to surface.
        setState("closed");
        forceReconnect(true);
      }
    };

    const onVisible = () => {
      if (document.visibilityState !== "visible") return;
      if (!es || es.readyState !== EventSource.OPEN) {
        forceReconnect(true);
      }
    };
    const onOnline = () => forceReconnect(true);
    const onOffline = () => setState("closed");

    connect();
    watchdogTimer = setInterval(watchdog, WATCHDOG_INTERVAL_MS);
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    window.addEventListener("focus", onVisible);

    return () => {
      cancelled = true;
      reconnectRef.current = () => {};
      clearTimers();
      closeStream();
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
      window.removeEventListener("focus", onVisible);
      setState("closed");
    };
  }, [token]);

  return { state, reconnect };
}
