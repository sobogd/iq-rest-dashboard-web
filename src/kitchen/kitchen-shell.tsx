import type { CSSProperties, ReactNode } from "react";

// Stripped-down chrome for the kitchen kiosk. Full-viewport flex column
// so KitchenPage can lay its content out like a kanban (header + scrolling
// columns) instead of relying on document-level scroll.
//
// Safe-area handling: when installed as a PWA, iOS draws the SPA under the
// notch / clock area. We render a fixed-height "notch backplate" with
// bg-background so the area above sticky content stays opaque even while
// the table cards scroll horizontally underneath. The previous
// padding-top approach left a transparent strip that revealed scrolling
// content through the safe-area gap.

interface KitchenShellProps {
  children: ReactNode;
}

// Real devices report the cutout via env(safe-area-inset-top). The landing
// demo runs inside an iframe with no safe area, so the phone-frame preview
// drives `--kiosk-notch` instead; take the larger of the two. The backplate
// is opaque (bg-background), so scrolling content never shows through the gap.
const TOP_INSET = "max(env(safe-area-inset-top), var(--kiosk-notch, 0px))";

const shellStyle: CSSProperties = {
  // Filter bar honours `top: var(--topbar-h)`; matches the notch height
  // so when used in sticky-mode the bar floats below the cutout.
  ["--topbar-h" as never]: TOP_INSET,
  paddingLeft: "env(safe-area-inset-left)",
  paddingRight: "env(safe-area-inset-right)",
  paddingBottom: "env(safe-area-inset-bottom)",
  height: "100dvh",
};

const notchStyle: CSSProperties = {
  height: TOP_INSET,
};

export function KitchenShell({ children }: KitchenShellProps) {
  return (
    <div className="bg-background antialiased tracking-tight flex flex-col" style={shellStyle}>
      <div className="shrink-0 bg-background" style={notchStyle} />
      <main className="flex-1 min-h-0 flex flex-col overflow-hidden">{children}</main>
    </div>
  );
}
