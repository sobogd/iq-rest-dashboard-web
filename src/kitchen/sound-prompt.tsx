import { useTranslations } from "next-intl";

// Sound-enable modal. Browser autoplay policy requires a user gesture to
// unlock AudioContext, and silent first-tap auto-unlock proved unreliable
// in practice — Safari sometimes swallowed the gesture, sometimes the
// initial tap landed on an item whose touch handler called
// stopPropagation. So we surface an explicit modal on every page load
// where the kiosk isn't already audible. Two buttons; no backdrop
// dismiss, so the staff makes a deliberate choice.

interface SoundPromptProps {
  open: boolean;
  onEnable: () => void | Promise<void>;
  onDismiss: () => void;
}

export function SoundPrompt({ open, onEnable, onDismiss }: SoundPromptProps) {
  const t = useTranslations("dashboard.kitchen");
  if (!open) return null;
  return (
    <div
      role="alertdialog"
      aria-live="polite"
      className="fixed inset-0 z-[70] bg-black/60 backdrop-blur-sm flex items-center justify-center px-6"
    >
      <div className="w-full max-w-sm bg-card border border-border rounded-2xl p-6 text-center">
        <div className="w-12 h-12 mx-auto rounded-full bg-amber-500/10 flex items-center justify-center mb-4 text-2xl">
          🔔
        </div>
        <h2 className="text-lg font-medium text-foreground mb-1">{t("soundPromptTitle")}</h2>
        <p className="text-sm text-muted-foreground leading-snug mb-5">{t("soundPromptMessage")}</p>
        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={() => void onEnable()}
            className="w-full h-11 text-sm font-medium text-primary-foreground bg-primary-gradient rounded-lg"
          >
            {t("soundEnable")}
          </button>
          <button
            type="button"
            onClick={onDismiss}
            className="w-full h-11 text-sm font-medium text-foreground bg-secondary rounded-lg"
          >
            {t("soundDismiss")}
          </button>
        </div>
      </div>
    </div>
  );
}
