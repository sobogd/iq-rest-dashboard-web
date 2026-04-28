"use client";

import { useState, useRef, useEffect } from "react";
import { useTranslations } from "next-intl";
import { QRCodeSVG } from "qrcode.react";
import { toast } from "sonner";
import { Loader2, ArrowRight } from "lucide-react";

const PRESETS = [
  {
    id: "dark-dining",
    label: "Dark dining",
    bg: "url('https://nbg1.your-objectstorage.com/sobogd/files/backgrounds/dark-dining-v2.jpeg')",
    overlay: "rgba(0,0,0,0.15), rgba(0,0,0,0.35)",
    accentColor: "#2a2018",
  },
  {
    id: "fresh-plate",
    label: "Fresh plate",
    bg: "url('https://nbg1.your-objectstorage.com/sobogd/files/backgrounds/fresh-plate-v2.jpeg')",
    overlay: "rgba(0,0,0,0.2), rgba(0,0,0,0.35)",
    accentColor: "#6e5e4a",
  },
  {
    id: "warm-bakery",
    label: "Warm bakery",
    bg: "url('https://nbg1.your-objectstorage.com/sobogd/files/backgrounds/warm-bakery.jpeg')",
    overlay: "rgba(0,0,0,0.2), rgba(0,0,0,0.35)",
    accentColor: "#7a6a52",
  },
  {
    id: "rustic-wood",
    label: "Rustic wood",
    bg: "url('https://nbg1.your-objectstorage.com/sobogd/files/backgrounds/rustic-wood.jpeg')",
    overlay: "rgba(0,0,0,0.2), rgba(0,0,0,0.35)",
    accentColor: "#6a5040",
  },
  {
    id: "greenery",
    label: "Greenery",
    bg: "url('https://nbg1.your-objectstorage.com/sobogd/files/backgrounds/greenery-v2.jpeg')",
    overlay: "rgba(0,0,0,0.2), rgba(0,0,0,0.35)",
    accentColor: "#4a5a38",
  },
  {
    id: "ocean-night",
    label: "Ocean night",
    bg: "url('https://nbg1.your-objectstorage.com/sobogd/files/backgrounds/ocean-night.jpeg')",
    overlay: "rgba(0,0,0,0.15), rgba(0,0,0,0.3)",
    accentColor: "#1a3858",
  },
  {
    id: "midnight",
    label: "Midnight",
    bg: "url('https://nbg1.your-objectstorage.com/sobogd/files/backgrounds/midnight.jpeg')",
    overlay: "rgba(0,0,0,0.1), rgba(0,0,0,0.25)",
    accentColor: "#18243e",
  },
  {
    id: "wine-dine",
    label: "Wine & dine",
    bg: "url('https://nbg1.your-objectstorage.com/sobogd/files/backgrounds/wine-dine.jpeg')",
    overlay: "rgba(0,0,0,0.15), rgba(0,0,0,0.3)",
    accentColor: "#5e2030",
  },
];

const TOTAL_STEPS = 4;

type DishState = {
  name: string;
  price: string;
  photoFile: File | null;
  photoPreview: string | null;
};

type CoverState = {
  presetIdx: number;
  uploadedFile: File | null;
  uploadedPreview: string | null;
};

type OnboardingState = {
  restaurantName: string;
  category: string;
  dish: DishState;
  cover: CoverState;
};

const inputClass =
  "w-full h-10 px-3 text-sm text-foreground bg-card border border-input rounded-lg placeholder:text-muted-foreground focus:outline-none focus:border-foreground focus:ring-2 focus:ring-foreground/5 transition-colors";

const labelClass = "block text-xs font-medium text-foreground mb-1.5 tracking-tight";

function ProgressBar({ step }: { step: number }) {
  return (
    <div className="flex items-center gap-1.5 mb-6">
      {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
        <div
          key={i}
          className={`h-1 flex-1 min-w-0 rounded-full transition-colors duration-300 ${
            i < step ? "bg-foreground" : "bg-border"
          }`}
        />
      ))}
      <span className="text-[11px] text-muted-foreground ml-2 tabular-nums whitespace-nowrap">
        {step} / {TOTAL_STEPS}
      </span>
    </div>
  );
}

function Header({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <>
      <h1 className="text-xl font-medium text-foreground tracking-tight mb-1.5">{title}</h1>
      <p className="text-[13px] text-muted-foreground leading-snug mb-5">{subtitle}</p>
    </>
  );
}

function Actions({
  onBack,
  onContinue,
  canContinue = true,
  continueLabel,
  loading = false,
}: {
  onBack?: () => void;
  onContinue: () => void;
  canContinue?: boolean;
  continueLabel: string;
  loading?: boolean;
}) {
  return (
    <div className="flex gap-2.5 mt-6">
      {onBack && (
        <button
          type="button"
          onClick={onBack}
          className="w-20 h-10 text-sm font-medium text-foreground bg-transparent border border-input rounded-lg hover:border-foreground transition-colors tracking-tight"
        >
          Back
        </button>
      )}
      <button
        type="button"
        onClick={onContinue}
        disabled={!canContinue || loading}
        className="flex-1 h-10 text-sm font-medium text-background bg-foreground rounded-lg hover:bg-foreground/90 active:scale-[0.99] transition-all tracking-tight disabled:bg-input disabled:text-muted-foreground disabled:cursor-not-allowed disabled:active:scale-100 flex items-center justify-center gap-2"
      >
        {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
        {continueLabel}
      </button>
    </div>
  );
}

// ─── Step 1: Restaurant name ────────────────────────────────────────────────

function Step1({
  state,
  setState,
  onContinue,
  t,
}: {
  state: OnboardingState;
  setState: React.Dispatch<React.SetStateAction<OnboardingState>>;
  onContinue: () => void;
  t: ReturnType<typeof useTranslations<"onboarding">>;
}) {
  return (
    <>
      <ProgressBar step={1} />
      <Header title={t("step1.setupText")} subtitle={t("step1.subtitle")} />

      <label htmlFor="restaurant-name" className={labelClass}>
        {t("step1.nameLabel")}
      </label>
      <input
        id="restaurant-name"
        type="text"
        placeholder={t("step1.namePlaceholder")}
        autoFocus
        value={state.restaurantName}
        onChange={(e) => setState((s) => ({ ...s, restaurantName: e.target.value }))}
        onKeyDown={(e) => {
          if (e.key === "Enter" && state.restaurantName.trim()) onContinue();
        }}
        className={inputClass}
      />
      <p className="text-xs text-muted-foreground mt-2">{t("step1.nameHint")}</p>

      <Actions
        onContinue={onContinue}
        canContinue={state.restaurantName.trim().length > 0}
        continueLabel={t("continue")}
      />
    </>
  );
}

// ─── Step 2: First dish ─────────────────────────────────────────────────────

function Step2({
  state,
  setState,
  onBack,
  onContinue,
  t,
}: {
  state: OnboardingState;
  setState: React.Dispatch<React.SetStateAction<OnboardingState>>;
  onBack: () => void;
  onContinue: () => void;
  t: ReturnType<typeof useTranslations<"onboarding">>;
}) {
  useEffect(() => {
    return () => {
      if (state.dish.photoPreview?.startsWith("blob:")) {
        URL.revokeObjectURL(state.dish.photoPreview);
      }
    };
  }, [state.dish.photoPreview]);

  const handlePhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const preview = URL.createObjectURL(file);
    setState((s) => ({ ...s, dish: { ...s.dish, photoFile: file, photoPreview: preview } }));
  };

  const canContinue =
    state.category.trim().length > 0 &&
    state.dish.name.trim().length > 0 &&
    state.dish.price.trim().length > 0;

  return (
    <>
      <ProgressBar step={2} />
      <Header title={t("step2.title")} subtitle={t("step2.motivation")} />

      <label htmlFor="category" className={labelClass}>
        {t("step2.categoryLabel")}
      </label>
      <input
        id="category"
        type="text"
        placeholder={t("step2.categoryPlaceholder")}
        value={state.category}
        onChange={(e) => setState((s) => ({ ...s, category: e.target.value }))}
        className={`${inputClass} mb-5`}
      />

      <div className="border-t border-border -mx-1 my-1 mb-5" />

      <label htmlFor="dish-name" className={labelClass}>
        {t("step2.dishNameLabel")}
      </label>
      <input
        id="dish-name"
        type="text"
        placeholder={t("step2.dishNamePlaceholder")}
        value={state.dish.name}
        onChange={(e) =>
          setState((s) => ({ ...s, dish: { ...s.dish, name: e.target.value } }))
        }
        className={`${inputClass} mb-4`}
      />

      <div className="flex gap-3 items-start">
        <div className="flex-1 min-w-0">
          <label htmlFor="price" className={labelClass}>
            {t("step2.priceLabel")}
          </label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground pointer-events-none">
              €
            </span>
            <input
              id="price"
              type="text"
              inputMode="decimal"
              placeholder="12.50"
              value={state.dish.price}
              onChange={(e) =>
                setState((s) => ({ ...s, dish: { ...s.dish, price: e.target.value } }))
              }
              className={`${inputClass} pl-6`}
            />
          </div>
        </div>

        <div className="flex-shrink-0">
          <label className={labelClass}>{t("step2.photoLabel")}</label>
          <label
            htmlFor="dish-photo"
            className={`relative flex items-center justify-center gap-1.5 h-10 px-3 border border-dashed rounded-lg cursor-pointer transition-all overflow-hidden ${
              state.dish.photoPreview
                ? "border-foreground p-0 aspect-square"
                : "border-input bg-secondary text-muted-foreground hover:border-foreground hover:text-foreground hover:bg-card"
            }`}
          >
            {state.dish.photoPreview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={state.dish.photoPreview}
                alt=""
                className="absolute inset-0 w-full h-full object-cover"
              />
            ) : (
              <>
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <rect x="3" y="3" width="18" height="18" rx="2" />
                  <circle cx="9" cy="9" r="2" />
                  <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
                </svg>
                <span className="text-[13px] font-medium tracking-tight">
                  {t("step2.addPhoto")}
                </span>
              </>
            )}
            <input
              id="dish-photo"
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handlePhoto}
            />
          </label>
        </div>
      </div>
      <p className="text-xs text-muted-foreground mt-3">{t("step2.photoHint")}</p>

      <Actions
        onBack={onBack}
        onContinue={onContinue}
        canContinue={canContinue}
        continueLabel={t("continue")}
      />
    </>
  );
}

// ─── Step 3: Cover ──────────────────────────────────────────────────────────

function Step3({
  state,
  setState,
  onBack,
  onContinue,
  submitting,
  t,
}: {
  state: OnboardingState;
  setState: React.Dispatch<React.SetStateAction<OnboardingState>>;
  onBack: () => void;
  onContinue: () => void;
  submitting: boolean;
  t: ReturnType<typeof useTranslations<"onboarding">>;
}) {
  const { presetIdx, uploadedPreview } = state.cover;

  const handleSelect = (idx: number) => {
    if (state.cover.uploadedPreview?.startsWith("blob:")) {
      URL.revokeObjectURL(state.cover.uploadedPreview);
    }
    setState((s) => ({
      ...s,
      cover: { ...s.cover, presetIdx: idx, uploadedFile: null, uploadedPreview: null },
    }));
  };

  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (state.cover.uploadedPreview?.startsWith("blob:")) {
      URL.revokeObjectURL(state.cover.uploadedPreview);
    }
    const preview = URL.createObjectURL(file);
    setState((s) => ({ ...s, cover: { ...s.cover, uploadedFile: file, uploadedPreview: preview } }));
  };

  const uploadActive = !!uploadedPreview;

  return (
    <>
      <ProgressBar step={3} />
      <Header title={t("step3.title")} subtitle={t("step3.subtitle")} />

      <div className="grid grid-cols-3 gap-2">
        {PRESETS.map((preset, i) => {
          const isActive = !uploadActive && i === presetIdx;
          return (
            <button
              key={preset.id}
              type="button"
              onClick={() => handleSelect(i)}
              className={`relative aspect-square rounded-[10px] overflow-hidden cursor-pointer transition-transform duration-150 hover:-translate-y-0.5 ${
                isActive ? "outline outline-2 outline-foreground outline-offset-2" : ""
              }`}
              style={{
                background: `linear-gradient(${preset.overlay}), ${preset.bg}`,
                backgroundSize: "cover",
                backgroundPosition: "center",
              }}
            >
              {isActive ? (
                <span className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full bg-card text-foreground flex items-center justify-center">
                  <svg width="9" height="9" viewBox="0 0 12 12" fill="none">
                    <polyline points="2,6 5,9 10,3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </span>
              ) : (
                <span
                  className="absolute top-1.5 right-1.5 w-3 h-3 rounded-full border border-white/40"
                  style={{ backgroundColor: preset.accentColor }}
                />
              )}
              <span className="absolute bottom-1.5 left-2 right-2 text-[10px] font-medium text-background tracking-tight text-left [text-shadow:0_1px_4px_rgba(0,0,0,0.7)]">
                {preset.label}
              </span>
            </button>
          );
        })}

        {/* 9th cell — upload own photo */}
        <label
          htmlFor="cover-upload"
          className={`relative aspect-square rounded-[10px] border border-dashed cursor-pointer transition-all overflow-hidden flex flex-col items-center justify-center gap-1 ${
            uploadActive
              ? "border-foreground outline outline-2 outline-foreground outline-offset-2"
              : "border-input bg-secondary text-muted-foreground hover:border-foreground hover:text-foreground hover:bg-card"
          }`}
          style={
            uploadActive
              ? { backgroundImage: `url('${uploadedPreview}')`, backgroundSize: "cover", backgroundPosition: "center" }
              : undefined
          }
        >
          {uploadActive ? (
            <>
              <span className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full bg-card text-foreground flex items-center justify-center">
                <svg width="9" height="9" viewBox="0 0 12 12" fill="none">
                  <polyline points="2,6 5,9 10,3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </span>
              <span className="absolute bottom-1.5 left-2 right-2 text-[10px] font-medium text-background tracking-tight text-left [text-shadow:0_1px_4px_rgba(0,0,0,0.7)]">
                {t("step3.yourPhoto")}
              </span>
            </>
          ) : (
            <>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="17 8 12 3 7 8" />
                <line x1="12" y1="3" x2="12" y2="15" />
              </svg>
              <span className="text-[10px] font-medium tracking-tight">{t("step3.upload")}</span>
            </>
          )}
          <input id="cover-upload" type="file" accept="image/*" className="hidden" onChange={handleUpload} />
        </label>
      </div>

      <p className="text-xs text-muted-foreground mt-3">
        {t("step3.changeLater")}
      </p>

      <Actions
        onBack={onBack}
        onContinue={onContinue}
        continueLabel={t("continue")}
        loading={submitting}
      />
    </>
  );
}

// ─── Step 4: Done ───────────────────────────────────────────────────────────

function Step4({
  state,
  menuSlug,
  onGoToDashboard,
  t,
}: {
  state: OnboardingState;
  menuSlug: string;
  onGoToDashboard: () => void;
  t: ReturnType<typeof useTranslations<"onboarding">>;
}) {
  const [copied, setCopied] = useState(false);
  const menuUrl = menuSlug ? `https://iq-rest.com/m/${menuSlug}` : "";
  const displayUrl = menuSlug ? `iq-rest.com/m/${menuSlug}` : "";

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(menuUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard unavailable
    }
  };

  return (
    <>
      <ProgressBar step={4} />
      <Header title={t("step4.title")} subtitle={t("step4.subtitle")} />

      {menuUrl && (
        <div className="flex justify-center mb-6">
          <div className="w-[160px] h-[160px] bg-card rounded-2xl p-3 shadow-[0_8px_24px_rgba(0,0,0,0.12)]">
            <QRCodeSVG
              value={menuUrl}
              size={136}
              bgColor="#ffffff"
              fgColor="#000000"
              level="M"
            />
          </div>
        </div>
      )}

      {menuUrl && (
        <div className="flex items-center justify-between gap-2 p-3 bg-secondary border border-border rounded-lg">
          <span className="text-xs text-muted-foreground truncate">{displayUrl}</span>
          <button
            type="button"
            onClick={handleCopy}
            className="text-xs font-medium text-foreground hover:text-foreground/70 transition-colors flex items-center gap-1 flex-shrink-0"
          >
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
            </svg>
            {copied ? "✓" : t("step4.copy")}
          </button>
        </div>
      )}

      <Actions
        onContinue={onGoToDashboard}
        continueLabel={t("step4.goToDashboard")}
      />
    </>
  );
}

// ─── Main ───────────────────────────────────────────────────────────────────

export function OnboardingClient() {
  const t = useTranslations("onboarding");
  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [menuSlug, setMenuSlug] = useState("");
  const [state, setState] = useState<OnboardingState>({
    restaurantName: "",
    category: "",
    dish: { name: "", price: "", photoFile: null, photoPreview: null },
    cover: { presetIdx: 0, uploadedFile: null, uploadedPreview: null },
  });

  const next = () => setStep((s) => Math.min(s + 1, TOTAL_STEPS));
  const back = () => setStep((s) => Math.max(s - 1, 1));

  const handleSubmit = async () => {
    const price = parseFloat(state.dish.price.replace(",", "."));
    if (isNaN(price) || price < 0) {
      toast.error(t("step2.priceRequired"));
      return;
    }

    setSubmitting(true);
    try {
      // Upload dish photo if provided
      let dishImageUrl: string | null = null;
      if (state.dish.photoFile) {
        const fd = new FormData();
        fd.append("file", state.dish.photoFile);
        const r = await fetch("/api/upload", { method: "POST", body: fd });
        if (r.ok) {
          const d = await r.json();
          dishImageUrl = d.url;
        }
      }

      // Upload cover photo if provided (gradient presets need no upload)
      let coverSourceUrl: string | null = null;
      if (state.cover.uploadedFile) {
        const fd = new FormData();
        fd.append("file", state.cover.uploadedFile);
        const r = await fetch("/api/upload", { method: "POST", body: fd });
        if (r.ok) {
          const d = await r.json();
          coverSourceUrl = d.url;
        }
      }

      // Create or update restaurant
      const preset = PRESETS[state.cover.presetIdx];
      const presetBgMatch = preset.bg.match(/url\('([^']+)'\)/);
      const presetImageUrl = presetBgMatch ? presetBgMatch[1] : null;
      const restaurantPayload: Record<string, unknown> = {
        title: state.restaurantName,
        accentColor: preset.accentColor,
      };
      if (coverSourceUrl) restaurantPayload.source = coverSourceUrl;
      else if (presetImageUrl) restaurantPayload.source = presetImageUrl;
      const restaurantRes = await fetch("/api/restaurant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(restaurantPayload),
      });
      if (!restaurantRes.ok) throw new Error("restaurant");
      const restaurant = await restaurantRes.json();

      // Create category
      const catRes = await fetch("/api/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: state.category.trim() }),
      });
      if (!catRes.ok) throw new Error("category");
      const cat = await catRes.json();

      // Create item
      await fetch("/api/items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: state.dish.name.trim(),
          price,
          categoryId: cat.id,
          ...(dishImageUrl && { imageUrl: dishImageUrl }),
        }),
      });

      // Always mark onboarding complete (restaurant POST only sets step=3 on create, not update)
      await fetch("/api/onboarding/complete", { method: "POST" });

      setMenuSlug(restaurant.slug ?? "");
      setStep(4);
    } catch {
      toast.error(t("saveError"));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-[100dvh] bg-secondary flex items-center justify-center px-4 py-4 antialiased tracking-tight">
      <div className="w-[360px] max-w-full bg-card border border-border rounded-2xl p-6 pb-7">
        {step === 1 && (
          <Step1 state={state} setState={setState} onContinue={next} t={t} />
        )}
        {step === 2 && (
          <Step2 state={state} setState={setState} onBack={back} onContinue={next} t={t} />
        )}
        {step === 3 && (
          <Step3
            state={state}
            setState={setState}
            onBack={back}
            onContinue={handleSubmit}
            submitting={submitting}
            t={t}
          />
        )}
        {step === 4 && (
          <Step4
            state={state}
            menuSlug={menuSlug}
            onGoToDashboard={() => { window.location.assign("/dashboard"); }}
            t={t}
          />
        )}
      </div>
    </div>
  );
}
