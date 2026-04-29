// Tailwind class tokens used across the new dashboard.

// text-[16px] on mobile prevents iOS Safari from auto-zooming when an input
// is focused. Desktop falls back to text-sm for a more compact look.
export const inputClass =
 "w-full h-10 px-3 text-[16px] md:text-sm text-foreground bg-card border border-input rounded-lg placeholder:text-muted-foreground focus:outline-none transition-colors";

export const labelClass =
 "block text-xs font-medium text-foreground mb-2.5";

export const primaryBtn =
 "h-10 px-4 text-sm font-medium text-primary-foreground bg-primary rounded-lg transition-colors";

export const secondaryBtn =
 "h-10 px-4 text-sm font-medium text-foreground bg-card border border-input rounded-lg transition-colors";

export const dangerBtn =
 "h-10 px-4 text-sm font-medium text-red-600 bg-card border border-input rounded-lg transition-colors flex items-center justify-center gap-1.5";

export const iconBtn =
 "w-8 h-8 flex items-center justify-center rounded-md text-muted-foreground transition-colors disabled:text-muted-foreground/50 disabled:cursor-not-allowed";
