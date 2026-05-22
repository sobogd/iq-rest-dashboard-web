import type { ReactNode } from "react";
import { useTranslations } from "next-intl";
import type { Restaurant } from "@/dashboard/_v2/types";

// Stripped-down chrome for the kitchen kiosk. No top header, no bottom nav,
// no sidebar — KitchenPage is the only thing the staff sees. The only piece
// of chrome we keep is a slim ribbon: restaurant name on the left, a "tap
// to enable sound" affordance on the right while autoplay is locked.
//
// We intentionally do NOT render the dashboard SyncIndicator / TopBar —
// kitchen staff don't have anywhere to navigate to.

interface KitchenShellProps {
  restaurant: Restaurant;
  soundReady: boolean;
  onEnableSound: () => void | Promise<void>;
  children: ReactNode;
}

export function KitchenShell({ restaurant, soundReady, onEnableSound, children }: KitchenShellProps) {
  const t = useTranslations("dashboard.kitchen");
  return (
    <div className="min-h-dvh bg-background antialiased tracking-tight">
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
      <div className="px-4 md:px-6 py-2 flex items-center justify-between gap-3">
        <div className="text-sm font-medium text-foreground truncate">
          {restaurant.name || t("fallbackName")}
        </div>
      </div>
      <main className="px-4 md:px-6 pb-6">{children}</main>
    </div>
  );
}
