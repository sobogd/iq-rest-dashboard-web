import { useEffect, useState } from "react";
import type { StreamState } from "./use-kitchen-stream";

// Full-screen modal shown when the kitchen has been disconnected from the
// dashboard-api for more than `GRACE_MS`. Brief blips (LB reconnects, page
// transitions) are absorbed by the grace window — only sustained outages
// surface. The overlay blocks the underlying UI so staff don't keep
// tapping items thinking the changes are being saved.
//
// Manual reconnect button calls into the stream hook's `reconnect()`,
// which resets the exponential backoff so the next attempt is immediate.

const GRACE_MS = 2_000;

interface OfflineOverlayProps {
  streamState: StreamState;
  onReconnect: () => void;
  // Set when an out-of-band probe (kitchen-app polls /devices/me) detects
  // the API is unreachable even though the SSE socket hasn't surfaced an
  // error yet. Forces the overlay to show without waiting for the SSE
  // watchdog to time out.
  forceOffline?: boolean;
}

export function OfflineOverlay({
  streamState,
  onReconnect,
  forceOffline = false,
}: OfflineOverlayProps) {
  const [navigatorOffline, setNavigatorOffline] = useState<boolean>(() =>
    typeof navigator !== "undefined" && !navigator.onLine,
  );
  const [delayedShow, setDelayedShow] = useState(false);

  useEffect(() => {
    const update = () => setNavigatorOffline(!navigator.onLine);
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);

  // Suppress flicker for short disconnects. Overlay shows instantly when
  // the browser reports `offline` OR the active probe failed — both are
  // unambiguous signals.
  useEffect(() => {
    if (navigatorOffline || forceOffline) {
      setDelayedShow(true);
      return;
    }
    if (streamState === "open") {
      setDelayedShow(false);
      return;
    }
    const id = setTimeout(() => setDelayedShow(true), GRACE_MS);
    return () => clearTimeout(id);
  }, [streamState, navigatorOffline, forceOffline]);

  if (!delayedShow) return null;

  const stale = navigatorOffline ? "No internet connection" : "Connection lost";
  const sub = navigatorOffline
    ? "The tablet is offline. Reconnect to Wi-Fi to receive new orders."
    : streamState === "connecting"
      ? "Reconnecting…"
      : "Server unreachable.";

  return (
    <div
      role="alertdialog"
      aria-live="assertive"
      className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm flex items-center justify-center px-6"
    >
      <div className="w-full max-w-sm bg-card border border-border rounded-2xl p-6 text-center">
        <div className="w-12 h-12 mx-auto rounded-full bg-red-500/10 flex items-center justify-center mb-4">
          <span className="w-2.5 h-2.5 rounded-full bg-red-500" />
        </div>
        <h2 className="text-lg font-medium text-foreground mb-1">{stale}</h2>
        <p className="text-sm text-muted-foreground leading-snug mb-5">{sub}</p>
        <button
          type="button"
          onClick={onReconnect}
          className="w-full h-10 text-sm font-medium text-primary-foreground bg-primary-gradient rounded-lg"
        >
          Reconnect now
        </button>
        <div className="text-[11px] text-muted-foreground mt-3">
          New status changes will be retried automatically once the connection is back.
        </div>
      </div>
    </div>
  );
}
