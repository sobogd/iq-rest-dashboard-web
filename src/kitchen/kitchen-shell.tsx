import type { CSSProperties, ReactNode } from "react";
import { useTranslations } from "next-intl";

// Stripped-down chrome for the kitchen kiosk. No restaurant header, no
// bottom nav, no sidebar — KitchenPage owns the entire viewport. Only
// piece of chrome that ever appears is the amber "Sound disabled" ribbon
// while autoplay is locked; once unlocked, even that disappears.
//
// Safe-area handling: when installed as a PWA, iOS / iPadOS draws the SPA
// under the notch / clock area. We set `--topbar-h` to the top inset so
// KitchenPage's sticky filter bar (which honours that var) sits below
// the notch instead of clipping under it, and pad the top/sides/bottom
// of the chrome so the sound banner and content also clear the device's
// physical cutouts.

interface KitchenShellProps {
  soundReady: boolean;
  onEnableSound: () => void | Promise<void>;
  children: ReactNode;
}

const shellStyle: CSSProperties = {
  // Filter bar's sticky `top: var(--topbar-h)` keys off this. Mirrors
  // the value of the top safe-area inset so the bar floats just below
  // the notch when fullscreen-installed.
  ["--topbar-h" as never]: "env(safe-area-inset-top)",
  paddingTop: "env(safe-area-inset-top)",
  paddingLeft: "env(safe-area-inset-left)",
  paddingRight: "env(safe-area-inset-right)",
  paddingBottom: "env(safe-area-inset-bottom)",
};

export function KitchenShell({ soundReady, onEnableSound, children }: KitchenShellProps) {
  const t = useTranslations("dashboard.kitchen");
  return (
    <div className="min-h-dvh bg-background antialiased tracking-tight" style={shellStyle}>
      {!soundReady ? (
        <div className="bg-amber-500/10 border-b border-amber-500/40 px-4 py-2 flex items-center justify-between gap-3 text-sm">
          <div className="text-amber-700 dark:text-amber-300 leading-snug">
            <span className="font-medium">{t("soundOffTitle")}</span>{" "}
            {t("soundOffHint")}
          </div>
          <button
            type="button"
            onClick={() => void onEnableSound()}
            className="h-8 px-3 text-xs font-medium text-white bg-amber-600 rounded-md shrink-0"
          >
            {t("soundEnable")}
          </button>
        </div>
      ) : null}
      <main className="px-4 md:px-6 py-4">{children}</main>
    </div>
  );
}
