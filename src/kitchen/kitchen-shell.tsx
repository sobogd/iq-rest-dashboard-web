import type { CSSProperties, ReactNode } from "react";

// Stripped-down chrome for the kitchen kiosk. No header, no bottom nav,
// no sidebar — KitchenPage owns the entire viewport. The sound-enable
// prompt is rendered as a modal by KitchenApp instead of a banner here.
//
// Safe-area handling: when installed as a PWA, iOS / iPadOS draws the SPA
// under the notch / clock area. We set `--topbar-h` to the top inset so
// KitchenPage's sticky filter bar (which honours that var) sits below
// the notch instead of clipping under it, and pad the chrome on all
// sides so content also clears the device's physical cutouts.

interface KitchenShellProps {
  children: ReactNode;
}

const shellStyle: CSSProperties = {
  ["--topbar-h" as never]: "env(safe-area-inset-top)",
  paddingTop: "env(safe-area-inset-top)",
  paddingLeft: "env(safe-area-inset-left)",
  paddingRight: "env(safe-area-inset-right)",
  paddingBottom: "env(safe-area-inset-bottom)",
};

export function KitchenShell({ children }: KitchenShellProps) {
  return (
    <div className="min-h-dvh bg-background antialiased tracking-tight" style={shellStyle}>
      <main className="px-4 md:px-6 py-4">{children}</main>
    </div>
  );
}
