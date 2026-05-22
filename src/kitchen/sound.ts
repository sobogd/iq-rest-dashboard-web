// Browser-side new-order chime + screen-wake-lock plumbing for the kitchen
// kiosk. Autoplay rules mean the first sound has to be unlocked by an explicit
// user gesture, so the kitchen shell renders a "tap to enable sound" badge
// until `unlockSound()` runs. After unlock, `playOrderChime()` is safe to call
// from anywhere (SSE event handler, etc.).
//
// Wake lock keeps the tablet screen from dimming during quiet kitchen periods.
// The screen-wake-lock API requests are auto-released by the browser when the
// tab goes hidden, so `requestWakeLock()` is re-attempted on visibilitychange.

let audioCtx: AudioContext | null = null;
let unlocked = false;

interface MinimalWakeLockSentinel {
  release: () => Promise<void>;
}

let wakeLock: MinimalWakeLockSentinel | null = null;
let visibilityHandler: (() => void) | null = null;

export function isSoundUnlocked(): boolean {
  return unlocked;
}

export async function unlockSound(): Promise<void> {
  if (unlocked) return;
  try {
    const Ctx = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    audioCtx = new Ctx();
    // Some browsers leave a fresh context suspended until a user gesture.
    if (audioCtx.state === "suspended") {
      await audioCtx.resume();
    }
    // Play an inaudible blip so iOS unconditionally marks the context as
    // user-activated for subsequent calls.
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    gain.gain.value = 0.0001;
    osc.connect(gain).connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + 0.01);
    unlocked = true;
  } catch {
    // ignore — sound will simply not play
  }
}

export function playOrderChime(): void {
  if (!unlocked || !audioCtx) return;
  const ctx = audioCtx;
  // Two-note "ding-ding" — 880 Hz then 1175 Hz, ~150ms each, with a short
  // decay envelope so it sounds like a bell rather than a square wave.
  const tones: { freq: number; at: number }[] = [
    { freq: 880, at: 0 },
    { freq: 1175, at: 0.16 },
  ];
  for (const t of tones) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = t.freq;
    const start = ctx.currentTime + t.at;
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(0.5, start + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.35);
    osc.connect(gain).connect(ctx.destination);
    osc.start(start);
    osc.stop(start + 0.4);
  }
}

export async function requestWakeLock(): Promise<void> {
  const nav = navigator as Navigator & {
    wakeLock?: { request: (type: "screen") => Promise<MinimalWakeLockSentinel> };
  };
  if (!nav.wakeLock) return;
  try {
    wakeLock = await nav.wakeLock.request("screen");
  } catch {
    wakeLock = null;
  }
  if (!visibilityHandler) {
    visibilityHandler = () => {
      if (document.visibilityState === "visible") {
        void requestWakeLock();
      }
    };
    document.addEventListener("visibilitychange", visibilityHandler);
  }
}

export async function releaseWakeLock(): Promise<void> {
  if (wakeLock) {
    try {
      await wakeLock.release();
    } catch {
      // ignore
    }
    wakeLock = null;
  }
  if (visibilityHandler) {
    document.removeEventListener("visibilitychange", visibilityHandler);
    visibilityHandler = null;
  }
}
