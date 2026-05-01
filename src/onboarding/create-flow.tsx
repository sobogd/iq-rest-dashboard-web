import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { AuthPage } from "@/auth/auth-page";
import { CUISINE_KEYS, CUISINE_META, type CuisineKey } from "@/onboarding/cuisine";
import { track } from "@/lib/dashboard-events";
import {
  WizardActions,
  WizardCard,
  WizardHeader,
  WizardLogo,
  WizardProgress,
} from "@/shared/wizard";

const TOTAL_STEPS = 3;

export function CreateFlow() {
  const t = useTranslations("dashboard.createFlow");
  const [step, setStep] = useState(1);
  const [cuisine, setCuisine] = useState<CuisineKey | null>(null);
  const [restaurantName, setRestaurantName] = useState("");

  useEffect(() => {
    track("create_flow_first_view");
  }, []);

  const next = () => setStep((s) => Math.min(s + 1, TOTAL_STEPS));
  const back = () => setStep((s) => Math.max(s - 1, 1));

  // Memoise the context object so AuthPage's useCallback deps stay stable across rerenders —
  // otherwise a new object reference per render re-initialises Google Identity Services every tick.
  const signupContext = useMemo(
    () => (cuisine ? { cuisine, restaurantName: restaurantName.trim() } : undefined),
    [cuisine, restaurantName],
  );

  return (
    <WizardCard>
      <WizardLogo />
      <WizardProgress step={step} totalSteps={TOTAL_STEPS} />

      {step === 1 && (
        <CuisineStep
          selected={cuisine}
          onSelect={(c) => {
            track("create_flow_pick_cuisine", { cuisine: c });
            setCuisine(c);
          }}
          onContinue={() => {
            track("create_flow_cuisine_continue", { cuisine });
            next();
          }}
          t={t}
        />
      )}

      {step === 2 && (
        <NameStep
          value={restaurantName}
          onChange={setRestaurantName}
          onBack={() => {
            track("create_flow_name_back");
            back();
          }}
          onContinue={() => {
            track("create_flow_name_continue");
            next();
          }}
          t={t}
        />
      )}

      {step === 3 && cuisine && (
        <>
          <WizardHeader title={t("step3.title")} subtitle={t("step3.subtitle")} />
          <AuthPage embedded skipAuthCheck signupContext={signupContext} />
        </>
      )}
    </WizardCard>
  );
}

function CuisineStep({
  selected,
  onSelect,
  onContinue,
  t,
}: {
  selected: CuisineKey | null;
  onSelect: (c: CuisineKey) => void;
  onContinue: () => void;
  t: ReturnType<typeof useTranslations<"dashboard.createFlow">>;
}) {
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (selected) onContinue();
      }}
    >
      <WizardHeader title={t("step1.title")} subtitle={t("step1.subtitle")} />

      <div className="grid grid-cols-2 gap-2">
        {CUISINE_KEYS.map((key) => {
          const isActive = selected === key;
          return (
            <button
              key={key}
              type="button"
              onClick={() => onSelect(key)}
              className={`flex items-center gap-2 h-12 px-3 rounded-lg border text-left transition-all ${
                isActive
                  ? "border-primary bg-primary/5 text-foreground"
                  : "border-input bg-card text-foreground hover:border-foreground"
              }`}
            >
              <span className="text-lg" aria-hidden>
                {CUISINE_META[key].emoji}
              </span>
              <span className="text-[13px] font-medium tracking-tight truncate">
                {t(`cuisines.${key}`)}
              </span>
            </button>
          );
        })}
      </div>

      <WizardActions
        continueLabel={t("continue")}
        backLabel={t("back")}
        continueDisabled={!selected}
      />
    </form>
  );
}

function NameStep({
  value,
  onChange,
  onBack,
  onContinue,
  t,
}: {
  value: string;
  onChange: (v: string) => void;
  onBack: () => void;
  onContinue: () => void;
  t: ReturnType<typeof useTranslations<"dashboard.createFlow">>;
}) {
  const trimmed = value.trim();
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (trimmed) onContinue();
      }}
    >
      <WizardHeader title={t("step2.title")} subtitle={t("step2.subtitle")} />

      <label htmlFor="create-flow-name" className="block text-xs font-medium text-foreground mb-1.5 tracking-tight">
        {t("step2.nameLabel")}
      </label>
      <input
        id="create-flow-name"
        type="text"
        required
        autoFocus
        placeholder={t("step2.namePlaceholder")}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => track("create_flow_focus_name")}
        className="w-full h-10 px-3 text-sm text-foreground bg-card border border-input rounded-lg placeholder:text-muted-foreground focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-colors"
      />

      <WizardActions
        onBack={onBack}
        backLabel={t("back")}
        continueLabel={t("continue")}
        continueDisabled={!trimmed}
      />
    </form>
  );
}
