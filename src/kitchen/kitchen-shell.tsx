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

const shellStyle: CSSProperties = {
  // Filter bar honours `top: var(--topbar-h)`; matches the notch height
  // so when used in sticky-mode the bar floats below the cutout.
  ["--topbar-h" as never]: "env(safe-area-inset-top)",
  paddingLeft: "env(safe-area-inset-left)",
  paddingRight: "env(safe-area-inset-right)",
  paddingBottom: "env(safe-area-inset-bottom)",
  height: "100dvh",
};

const notchStyle: CSSProperties = {
  height: "env(safe-area-inset-top)",
};

export function KitchenShell({ children }: KitchenShellProps) {
  return (
    <div className="bg-background antialiased tracking-tight flex flex-col" style={shellStyle}>
      <div className="shrink-0 bg-background" style={notchStyle} />
      <main className="flex-1 min-h-0 flex flex-col overflow-hidden">{children}</main>
    </div>
  );
}
