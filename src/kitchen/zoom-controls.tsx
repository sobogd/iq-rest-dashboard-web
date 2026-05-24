import { useEffect, useState } from "react";

// In-page zoom for the kitchen kiosk. Implemented by scaling the root
// font-size: Tailwind compiles spacing + typography to rem units, so
// changing `html { font-size: ... }` rescales everything proportionally
// without touching transform (which breaks sticky positioning) or the
// legacy CSS `zoom` property (which iOS Safari ignored entirely until
// very recently). env(safe-area-inset-*) stays in pixels, as desired.
//
// Persisted to localStorage so the staff's chosen scale survives reloads
// and reinstalls of the PWA. Range chosen by trial: 80–150 in 10%
// steps. Out-of-range values are clamped on read.

const STORAGE_KEY = "k-zoom";
const MIN = 80;
const MAX = 200;
const STEP = 10;
const DEFAULT_ZOOM = 100;
const BASE_FONT_PX = 16;

function clampZoom(n: number): number {
  return Math.min(MAX, Math.max(MIN, n));
}

function readStoredZoom(): number {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_ZOOM;
    const n = Number.parseInt(raw, 10);
    if (Number.isNaN(n)) return DEFAULT_ZOOM;
    return clampZoom(n);
  } catch {
    return DEFAULT_ZOOM;
  }
}

function applyZoom(percent: number): void {
  // Setting the root font-size in px scales every rem-based unit Tailwind
  // emits (spacing, typography, sizing). Default at 100% restores to ""
  // so the global stylesheet's value takes back over on unmount.
  if (percent === DEFAULT_ZOOM) {
    document.documentElement.style.fontSize = "";
  } else {
    document.documentElement.style.fontSize = `${(BASE_FONT_PX * percent) / 100}px`;
  }
}

interface ZoomControlsProps {
  // Starting zoom %. Used by the public landing demo to open the kiosk at a
  // larger scale on phones. Defaults to the persisted/100% value.
  initialZoom?: number;
  // When false, the chosen zoom isn't written to localStorage — the demo
  // shouldn't leave a `k-zoom` behind in a real visitor's browser.
  persist?: boolean;
}

export function ZoomControls({ initialZoom, persist = true }: ZoomControlsProps = {}) {
  const [zoom, setZoom] = useState<number>(() =>
    initialZoom !== undefined ? clampZoom(initialZoom) : readStoredZoom(),
  );

  useEffect(() => {
    applyZoom(zoom);
    if (persist) {
      try {
        window.localStorage.setItem(STORAGE_KEY, String(zoom));
      } catch {
        // ignore — zoom will revert next reload on private-mode tabs
      }
    }
    return () => {
      // Reset on unmount so the admin host (which never mounts this
      // component) isn't left zoomed when the kitchen view is closed.
      applyZoom(DEFAULT_ZOOM);
    };
  }, [zoom, persist]);

  const dec = () => setZoom((z) => Math.max(MIN, z - STEP));
  const inc = () => setZoom((z) => Math.min(MAX, z + STEP));

  const btnCls =
    "h-8 w-8 inline-flex items-center justify-center rounded-md text-xs font-semibold bg-secondary text-muted-foreground hover:text-foreground transition-colors disabled:opacity-40";

  return (
    <div className="flex items-center gap-1.5">
      <button type="button" onClick={dec} disabled={zoom <= MIN} className={btnCls} aria-label="Zoom out">
        −
      </button>
      <span className="text-[11px] font-medium text-muted-foreground tabular-nums min-w-[2.5rem] text-center">
        {zoom}%
      </span>
      <button type="button" onClick={inc} disabled={zoom >= MAX} className={btnCls} aria-label="Zoom in">
        +
      </button>
    </div>
  );
}
