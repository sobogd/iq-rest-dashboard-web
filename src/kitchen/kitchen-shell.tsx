import type { ReactNode } from "react";
import { useTranslations } from "next-intl";

// Stripped-down chrome for the kitchen kiosk. No restaurant header, no
// bottom nav, no sidebar — KitchenPage owns the entire viewport. Only
// piece of chrome that ever appears is the amber "Sound disabled" ribbon
// while autoplay is locked; once unlocked, even that disappears.

interface KitchenShellProps {
  soundReady: boolean;
  onEnableSound: () => void | Promise<void>;
  children: ReactNode;
}

export function KitchenShell({ soundReady, onEnableSound, children }: KitchenShellProps) {
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
      <main className="px-4 md:px-6 py-4">{children}</main>
    </div>
  );
}
