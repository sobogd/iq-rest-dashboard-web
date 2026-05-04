import { Loader2 } from "lucide-react";
import type { ReactNode } from "react";
import { useLocale } from "next-intl";
import { landingUrl } from "@/lib/landing-url";
import { LogoIcon } from "@/shared/logo-icon";

export function WizardCard({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-[100dvh] bg-background flex items-center justify-center px-4 py-4 antialiased tracking-tight">
      <div className="w-[360px] max-w-full bg-card border border-border rounded-2xl p-6 pb-7">
        {children}
      </div>
    </div>
  );
}

export function WizardLogo() {
  const locale = useLocale();
  return (
    <div className="mb-3">
      <a
        href={landingUrl(locale)}
        className="flex items-center gap-1.5 text-[18px] font-semibold tracking-tight text-foreground hover:opacity-80 transition-opacity w-fit"
      >
        <LogoIcon className="h-7 w-7" />
        Rest
      </a>
    </div>
  );
}

export function WizardProgress({ step, totalSteps }: { step: number; totalSteps: number }) {
  return (
    <div className="flex items-center gap-1.5 mb-6">
      {Array.from({ length: totalSteps }).map((_, i) => (
        <div
          key={i}
          className={`h-1 flex-1 min-w-0 rounded-full transition-colors duration-300 ${
            i < step ? "bg-primary" : "bg-border"
          }`}
        />
      ))}
      <span className="text-[11px] text-muted-foreground ml-2 tabular-nums whitespace-nowrap">
        {step} / {totalSteps}
      </span>
    </div>
  );
}

export function WizardHeader({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <>
      <h1 className="text-xl font-medium text-foreground tracking-tight mb-1.5">{title}</h1>
      <p className="text-[13px] text-muted-foreground leading-snug mb-5">{subtitle}</p>
    </>
  );
}

export function WizardActions({
  onBack,
  backLabel = "Back",
  continueLabel,
  loading = false,
  continueDisabled = false,
}: {
  onBack?: () => void;
  backLabel?: string;
  continueLabel: string;
  loading?: boolean;
  continueDisabled?: boolean;
}) {
  return (
    <div className="flex gap-2.5 mt-6">
      {onBack && (
        <button
          type="button"
          onClick={onBack}
          className="w-20 h-10 text-sm font-medium text-foreground bg-transparent border border-input rounded-lg hover:border-foreground transition-colors tracking-tight"
        >
          {backLabel}
        </button>
      )}
      <button
        type="submit"
        disabled={loading || continueDisabled}
        className="flex-1 h-10 text-sm font-medium text-primary-foreground bg-primary rounded-lg hover:bg-primary/90 active:scale-[0.99] transition-all tracking-tight disabled:bg-input disabled:text-muted-foreground disabled:cursor-not-allowed disabled:active:scale-100 flex items-center justify-center gap-2"
      >
        {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
        {continueLabel}
      </button>
    </div>
  );
}
