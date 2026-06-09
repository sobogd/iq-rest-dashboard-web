"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { Loader2, Sparkles, ScanLine, Pencil, ChevronRight } from "lucide-react";
import type { ReactNode } from "react";
import { Modal } from "./ui";
import { ScanModal } from "./scan-modal";
import { inputClass, primaryBtn, secondaryBtn } from "./tokens";
import { updateRestaurant, fillDemoData, markOnboardingStep } from "./api";

type Step = "name" | "fill" | "scan" | null;

/**
 * First-login onboarding — three modals gated on persisted per-step flags
 * (`onboardingNameDone` / `onboardingFillDone` on the restaurant):
 *   1. Name modal — shows while the name step isn't done. Footer: Skip / Continue.
 *      Either action marks the name step done (server-side), so it never returns.
 *   2. Fill-type modal — shows next while the fill step isn't done (demo data /
 *      scan menu / start from scratch). Any choice marks the fill step done.
 *   3. Scan modal — reachable only from the fill modal; reuses the menu scanner.
 *
 * The initial step is computed once on mount. Mount with `key={restaurant.id}`
 * so switching restaurants re-runs the evaluation with the new flags.
 */
export function OnboardingModals({
  restaurantName,
  onboardingNameDone,
  onboardingFillDone,
  existingRealItemsCount,
  onRefresh,
  onResolved,
}: {
  restaurantName: string;
  onboardingNameDone: boolean;
  onboardingFillDone: boolean;
  existingRealItemsCount: number;
  onRefresh: () => void | Promise<void>;
  /** Fired once the onboarding modals are no longer showing (finished, skipped
   *  or never needed) — lets the parent run the trial reminder afterwards. */
  onResolved?: () => void;
}) {
  const t = useTranslations("onboarding");
  const qc = useQueryClient();

  const initialStep: Step = useMemo(() => {
    if (!onboardingNameDone) return "name";
    if (!onboardingFillDone) return "fill";
    return null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [step, setStep] = useState<Step>(initialStep);
  const [name, setName] = useState(restaurantName);
  const [busy, setBusy] = useState(false);
  // ScanModal fires onSaved() then onClose() on a successful save. Without this
  // guard the onClose handler would bounce back to the "fill" step and re-open
  // the choice modal right after a scan finished.
  const scanSavedRef = useRef(false);

  // Notify the parent whenever no onboarding modal is open (including the
  // initial "nothing to do" case) so the trial reminder can take over.
  useEffect(() => {
    if (step === null) onResolved?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  // Persist a step flag, then refresh the restaurant cache (fire-and-forget;
  // onboarding is non-blocking so failures are ignored).
  const persistStep = (stepName: "name" | "fill") => {
    void markOnboardingStep(stepName)
      .then(() => qc.invalidateQueries({ queryKey: ["restaurant"] }))
      .catch(() => undefined);
  };

  // After the name step, advance to the fill modal only if it isn't done yet.
  const afterName = () => setStep(onboardingFillDone ? null : "fill");

  const skipName = () => {
    if (busy) return;
    persistStep("name");
    afterName();
  };

  const saveName = async () => {
    const trimmed = name.trim();
    if (busy) return;
    if (!trimmed) {
      skipName();
      return;
    }
    setBusy(true);
    try {
      await updateRestaurant({ title: trimmed });
      persistStep("name");
      await qc.invalidateQueries({ queryKey: ["restaurant"] });
    } catch {
      // Non-blocking onboarding — ignore save errors, move on.
    } finally {
      setBusy(false);
      afterName();
    }
  };

  const chooseScratch = () => {
    if (busy) return;
    persistStep("fill");
    setStep(null);
  };

  const chooseDemo = async () => {
    if (busy) return;
    setBusy(true);
    try {
      // fillDemoData() also marks the fill step done server-side.
      await fillDemoData();
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["restaurant"] }),
        qc.invalidateQueries({ queryKey: ["categories"] }),
        qc.invalidateQueries({ queryKey: ["items"] }),
        qc.invalidateQueries({ queryKey: ["tables"] }),
        qc.invalidateQueries({ queryKey: ["orders"] }),
        qc.invalidateQueries({ queryKey: ["reservations"] }),
        qc.invalidateQueries({ queryKey: ["sub"] }),
      ]);
      await onRefresh();
    } catch {
      // ignore
    } finally {
      setBusy(false);
      setStep(null);
    }
  };

  return (
    <>
      <Modal
        open={step === "name"}
        onClose={() => skipName()}
        closeOnBackdrop={false}
        hideClose
        size="sm"
        title={t("name.title")}
        subtitle={t("name.subtitle")}
        footer={
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => skipName()}
              disabled={busy}
              className={secondaryBtn + " disabled:opacity-50"}
            >
              {t("name.skip")}
            </button>
            <button
              type="button"
              onClick={() => void saveName()}
              disabled={busy}
              className={primaryBtn + " inline-flex items-center gap-1.5 disabled:opacity-50"}
            >
              {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              {t("name.continue")}
            </button>
          </div>
        }
      >
        <label htmlFor="onb-name" className="block text-sm font-medium text-foreground mb-2.5">
          {t("name.label")}
        </label>
        <input
          id="onb-name"
          type="text"
          autoFocus
          maxLength={120}
          placeholder={t("name.placeholder")}
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") void saveName();
          }}
          disabled={busy}
          className={inputClass}
        />
      </Modal>

      <Modal
        open={step === "fill"}
        onClose={() => !busy && chooseScratch()}
        closeOnBackdrop={false}
        hideClose
        size="sm"
        title={t("fill.title")}
        subtitle={t("fill.subtitle")}
      >
        <div className="space-y-2.5">
          <OnbChoice icon={<Sparkles className="h-5 w-5" />} title={t("fill.demo")} hint={t("fill.demoHint")} busy={busy} onClick={() => void chooseDemo()} />
          <OnbChoice icon={<ScanLine className="h-5 w-5" />} title={t("fill.scan")} hint={t("fill.scanHint")} disabled={busy} onClick={() => setStep("scan")} />
          <OnbChoice icon={<Pencil className="h-5 w-5" />} title={t("fill.scratch")} hint={t("fill.scratchHint")} disabled={busy} onClick={chooseScratch} />
        </div>
      </Modal>

      <ScanModal
        open={step === "scan"}
        onClose={() => {
          // A save already routed us to null — don't bounce back to "fill".
          if (scanSavedRef.current) {
            scanSavedRef.current = false;
            return;
          }
          setStep("fill");
        }}
        existingRealItemsCount={existingRealItemsCount}
        onSaved={() => {
          scanSavedRef.current = true;
          persistStep("fill");
          setStep(null);
          void onRefresh();
        }}
      />
    </>
  );
}

function OnbChoice({
  icon,
  title,
  hint,
  onClick,
  busy,
  disabled,
}: {
  icon: ReactNode;
  title: string;
  hint: string;
  onClick: () => void;
  busy?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || busy}
      className="w-full text-left rounded-xl border border-border bg-card p-3.5 hover:border-foreground transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-3"
    >
      <span className="shrink-0 text-primary">{icon}</span>
      <span className="flex-1 min-w-0">
        <span className="block text-sm font-medium text-foreground">{title}</span>
        <span className="block text-xs text-muted-foreground mt-0.5">{hint}</span>
      </span>
      {busy ? (
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground shrink-0" />
      ) : (
        <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
      )}
    </button>
  );
}
