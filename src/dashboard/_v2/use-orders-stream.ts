import { useEffect, useState } from "react";
import { useQueryClient, type QueryClient } from "@tanstack/react-query";
import { useOrdersStreamStateStore } from "./orders-sync-state";

// Connects to the dashboard-api SSE stream and surfaces order events into the
// TanStack Query cache. Mutations from this tab, other tabs, other devices,
// and the QR public menu all flow through here within ~100ms, replacing the
// previous 30s poll-based UI.
//
// The poll is intentionally kept alive in dashboard-host as a fallback — if
// SSE disconnects (CDN flake, server restart, network), we still converge
// within 30s and the user sees no permanent drift.

interface OrderEvent {
  action: "created" | "updated" | "deleted" | "split";
  restaurantId: string;
  order?: unknown;
  createdOrder?: unknown;
  orderId?: string;
}

type ConnectionState = "connecting" | "open" | "closed";

export function useOrdersStream(restaurantId: string | null | undefined): ConnectionState {
  const qc = useQueryClient();
  const [state, setState] = useState<ConnectionState>("closed");
  const setGlobal = useOrdersStreamStateStore((s) => s.set);

  useEffect(() => {
    if (!restaurantId) {
      setGlobal("closed");
      return;
    }
    setState("connecting");
    setGlobal("connecting");

    const base = import.meta.env.VITE_API_URL || "/api";
    const url = `${base}/orders/stream?restaurantId=${encodeURIComponent(restaurantId)}`;
    const es = new EventSource(url, { withCredentials: true });

    es.addEventListener("ready", () => {
      setState("open");
      setGlobal("open");
    });
    es.addEventListener("order", (e) => {
      try {
        const event = JSON.parse((e as MessageEvent).data) as OrderEvent;
        applyEvent(qc, event);
      } catch {
        // Best-effort: refetch on bad payload so we never get stuck.
        void qc.invalidateQueries({ queryKey: ["orders"] });
      }
    });
    es.onerror = () => {
      // EventSource auto-reconnects internally; we just surface the state
      // so the UI can show a disconnected indicator.
      setState("connecting");
      setGlobal("connecting");
    };

    return () => {
      es.close();
      setState("closed");
      setGlobal("closed");
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
    // Slim payload (truncated past pg NOTIFY limit) — refetch the whole list.
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
