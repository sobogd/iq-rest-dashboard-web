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

// Persisted across reloads. Once the staff has explicitly opted in, the
// kiosk treats them as "wants sound on" forever and silently re-unlocks
// the AudioContext on the first user interaction after each reload —
// no need to re-tap the Enable-sound banner every page refresh.
const PREF_KEY = "k-sound-pref";

export function getSoundPreference(): boolean {
  try {
    return window.localStorage.getItem(PREF_KEY) === "1";
  } catch {
    return false;
  }
}

export function setSoundPreference(on: boolean): void {
  try {
    window.localStorage.setItem(PREF_KEY, on ? "1" : "0");
  } catch {
    // ignore — private mode etc.
  }
}

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
    // Wake the context any time the tab returns to the foreground. iOS
    // suspends AudioContext on screen lock / app switch and doesn't
    // auto-resume — without this hook the kiosk goes silent until the
    // user re-taps "Enable sound".
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible" && audioCtx && audioCtx.state === "suspended") {
        void audioCtx.resume();
      }
    });
  } catch {
    // ignore — sound will simply not play
  }
}

export function playOrderChime(): void {
  if (!unlocked || !audioCtx) return;
  const ctx = audioCtx;
  // Safari/iOS aggressively suspends the context when the tab is in the
  // background, then leaves it suspended after returning. Resuming on
  // every chime attempt is cheap and pulls the kiosk back to audible
  // state without staff intervention.
  if (ctx.state === "suspended") {
    void ctx.resume();
  }
  // Three rising chirps — 660 → 880 → 1175 Hz. Triangle wave is brighter
  // than sine through a tablet speaker, and a longer attack envelope
  // (~25 ms) cuts the click sound on cheap drivers. Gain pushed close
  // to clipping (0.9) because kitchens are loud.
  const tones: { freq: number; at: number }[] = [
    { freq: 660, at: 0 },
    { freq: 880, at: 0.18 },
    { freq: 1175, at: 0.36 },
  ];
  const now = ctx.currentTime;
  for (const t of tones) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "triangle";
    osc.frequency.value = t.freq;
    const start = now + t.at;
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(0.9, start + 0.025);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.4);
    osc.connect(gain).connect(ctx.destination);
    osc.start(start);
    osc.stop(start + 0.45);
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
