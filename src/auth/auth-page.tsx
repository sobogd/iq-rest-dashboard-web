"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { apiUrl } from "@/lib/api";
import { useLocale, useTranslations } from "next-intl";
import { Loader2 } from "lucide-react";
import { identify } from "@/lib/analytics";
import { track } from "@/lib/dashboard-events";
import { landingUrl } from "@/lib/landing-url";
import { LegalModal, type LegalView } from "@/components/legal-modal";

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: Record<string, unknown>) => void;
          renderButton: (element: HTMLElement, config: Record<string, unknown>) => void;
        };
      };
    };
  }
}

const GOOGLE_CLIENT_ID =
  ((import.meta as { env?: Record<string, string | undefined> }).env?.VITE_GOOGLE_CLIENT_ID) ||
  "576149678945-vjqlc4sce6bsne3p0n63bqdvf33k43s0.apps.googleusercontent.com";
const CODE_LENGTH = 6;
const RESEND_COOLDOWN = 60;

const ERROR_MAP: Record<string, string> = {
  CODE_EXPIRED: "errors.codeExpired",
  NO_CODE: "errors.noCode",
  INVALID_CODE: "errors.invalidCode",
  TOO_MANY_ATTEMPTS: "errors.tooManyAttempts",
};

const isValidEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());

type Screen = "email" | "verify";

// ─── Theme-adaptive classes ──────────────────────────────────────────────────

const inputClass =
  "w-full h-10 px-3 text-sm text-foreground bg-card border border-input rounded-lg placeholder:text-muted-foreground focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 invalid:[&:not(:placeholder-shown)]:border-destructive invalid:[&:not(:placeholder-shown)]:focus:ring-destructive/20 transition-colors";

const labelClass = "block text-xs font-medium text-foreground mb-1.5 tracking-tight";

const primaryButtonClass =
  "w-full h-10 text-sm font-medium text-primary-foreground bg-primary rounded-lg hover:bg-primary/90 active:scale-[0.99] transition-all tracking-tight disabled:bg-input disabled:text-muted-foreground disabled:cursor-not-allowed disabled:active:scale-100 flex items-center justify-center gap-2";

const secondaryButtonClass =
  "w-full h-10 text-sm font-medium text-foreground bg-card border border-input rounded-lg hover:border-foreground active:scale-[0.99] transition-all tracking-tight flex items-center justify-center gap-2";

function Logo() {
  const locale = useLocale();
  return (
    <div className="flex justify-center mb-5">
      <a
        href={landingUrl(locale)}
        className="text-3xl font-semibold tracking-tight text-foreground hover:opacity-80 transition-opacity"
      >
        IQ <span className="text-primary">Rest</span>
      </a>
    </div>
  );
}

// ─── Google "G" icon (official colors) ──────────────────────────────────────

function GoogleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </svg>
  );
}

// ─── Email screen ────────────────────────────────────────────────────────────

function EmailScreen({
  email,
  setEmail,
  onContinue,
  status,
  errorMessage,
  googleReady,
  googleHiddenRef,
  embedded,
  onOpenLegal,
  t,
}: {
  email: string;
  setEmail: (v: string) => void;
  onContinue: () => void;
  status: "idle" | "loading" | "error";
  errorMessage: string;
  googleReady: boolean;
  googleHiddenRef: React.RefObject<HTMLDivElement | null>;
  embedded: boolean;
  onOpenLegal: (view: "terms" | "policy" | "privacy") => void;
  t: ReturnType<typeof useTranslations<"dashboard.auth">>;
}) {
  return (
    <>
      {!embedded && (
        <>
          <Logo />
          <h1 className="text-xl font-medium text-foreground tracking-tight mb-1.5">
            {t("title")} {t("titleAccent")}
          </h1>
          <p className="text-xs text-muted-foreground leading-snug mb-5">
            {t("subtitle")}
          </p>
        </>
      )}

      {status === "error" && errorMessage && (
        <div className="mb-4 p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/50 rounded-lg text-red-600 dark:text-red-400 text-xs leading-snug">
          {errorMessage}
        </div>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          onContinue();
        }}
      >
        <label htmlFor="email" className={labelClass}>
          {t("emailLabel")}
        </label>
        <input
          id="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          required
          placeholder={t("emailPlaceholder")}
          autoFocus
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onFocus={() => track("auth_focus_email")}
          disabled={status === "loading"}
          className={inputClass}
        />

        <button
          type="submit"
          disabled={status === "loading"}
          className={`${primaryButtonClass} mt-4`}
        >
          {status === "loading" && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          {t("continueEmail")}
        </button>
      </form>

      {GOOGLE_CLIENT_ID && (
        <>
          <div className="flex items-center gap-3 my-5">
            <div className="flex-1 h-px bg-border" />
            <span className="text-[11px] text-muted-foreground tracking-tight">{t("or")}</span>
            <div className="flex-1 h-px bg-border" />
          </div>

          <div className="relative h-10">
            {/* Skeleton shown while SDK loads — reserves space, no layout shift */}
            {!googleReady && (
              <div className="w-full h-10 rounded-lg bg-border animate-pulse" />
            )}
            {/* Custom button visible once SDK is ready */}
            <button
              type="button"
              className={`${secondaryButtonClass} ${!googleReady ? "invisible" : ""}`}
              aria-hidden
            >
              <GoogleIcon />
              {t("continueGoogle")}
            </button>
            {/* Real Google SDK button stretched over custom button, invisible */}
            <div
              ref={googleHiddenRef}
              className="absolute inset-0 opacity-0 overflow-hidden [&_iframe]:!w-full [&_iframe]:!h-full [&>div]:!w-full [&>div]:!h-full"
            />
          </div>
        </>
      )}

      <p className="text-[11px] text-muted-foreground leading-snug text-center mt-6">
        {t("consent.text")}{" "}
        <button
          type="button"
          onClick={() => onOpenLegal("terms")}
          className="text-foreground/70 hover:text-foreground underline underline-offset-2 transition-colors"
        >
          {t("consent.terms")}
        </button>{" "}
        {t("consent.and")}{" "}
        <button
          type="button"
          onClick={() => onOpenLegal("privacy")}
          className="text-foreground/70 hover:text-foreground underline underline-offset-2 transition-colors"
        >
          {t("consent.privacy")}
        </button>
        .
      </p>
    </>
  );
}

// ─── Verify screen ───────────────────────────────────────────────────────────

function VerifyScreen({
  email,
  code,
  setCode,
  onBack,
  onVerify,
  onResend,
  status,
  errorMessage,
  cooldown,
  resendStatus,
  embedded,
  t,
}: {
  email: string;
  code: string[];
  setCode: (code: string[]) => void;
  onBack: () => void;
  onVerify: () => void;
  onResend: () => void;
  status: "idle" | "loading" | "error";
  errorMessage: string;
  cooldown: number;
  resendStatus: "idle" | "loading" | "sent";
  embedded: boolean;
  t: ReturnType<typeof useTranslations<"dashboard.auth">>;
}) {
  const inputsRef = useRef<(HTMLInputElement | null)[]>([]);
  const canVerify = code.every((d) => d !== "");

  const setDigit = (idx: number, value: string) => {
    const digit = value.replace(/\D/g, "").slice(-1);
    const next = [...code];
    next[idx] = digit;
    setCode(next);
    if (digit && idx < CODE_LENGTH - 1) {
      inputsRef.current[idx + 1]?.focus();
    }
  };

  const handleKeyDown = (idx: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace") {
      if (code[idx]) {
        const next = [...code];
        next[idx] = "";
        setCode(next);
      } else if (idx > 0) {
        inputsRef.current[idx - 1]?.focus();
        const next = [...code];
        next[idx - 1] = "";
        setCode(next);
      }
      e.preventDefault();
    } else if (e.key === "ArrowLeft" && idx > 0) {
      inputsRef.current[idx - 1]?.focus();
      e.preventDefault();
    } else if (e.key === "ArrowRight" && idx < CODE_LENGTH - 1) {
      inputsRef.current[idx + 1]?.focus();
      e.preventDefault();
    } else if (e.key === "Enter" && canVerify) {
      onVerify();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "");
    if (!pasted) return;
    e.preventDefault();
    const chars = pasted.slice(0, CODE_LENGTH).split("");
    const next = Array(CODE_LENGTH).fill("") as string[];
    chars.forEach((c, i) => (next[i] = c));
    setCode(next);
    const focusIdx = Math.min(chars.length, CODE_LENGTH - 1);
    inputsRef.current[focusIdx]?.focus();
    // Auto-submit if full code pasted
    if (chars.length === CODE_LENGTH) {
      setTimeout(onVerify, 50);
    }
  };

  return (
    <>
      {!embedded && (
        <>
          <Logo />
          <h1 className="text-xl font-medium text-foreground tracking-tight mb-1.5">
            {t("verifyTitle")}
          </h1>
          <p className="text-[13px] text-muted-foreground leading-snug mb-5">
            {t("verifySubtitle", { email }).split(email).map((part, i, arr) =>
              i < arr.length - 1 ? (
                <span key={i}>
                  {part}
                  <span className="text-foreground font-medium">{email}</span>
                </span>
              ) : (
                <span key={i}>{part}</span>
              )
            )}
          </p>
        </>
      )}
      {embedded && (
        <p className="text-[13px] text-muted-foreground leading-snug mb-5">
          {t("verifySubtitle", { email }).split(email).map((part, i, arr) =>
            i < arr.length - 1 ? (
              <span key={i}>
                {part}
                <span className="text-foreground font-medium">{email}</span>
              </span>
            ) : (
              <span key={i}>{part}</span>
            )
          )}
        </p>
      )}

      {status === "error" && errorMessage && (
        <div className="mb-4 p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/50 rounded-lg text-red-600 dark:text-red-400 text-xs leading-snug">
          {errorMessage}
        </div>
      )}

      <label className={labelClass}>{t("verifyCodeLabel")}</label>
      <div className="flex gap-2" onPaste={handlePaste}>
        {code.map((digit, idx) => (
          <input
            key={idx}
            ref={(el) => { inputsRef.current[idx] = el; }}
            type="text"
            inputMode="numeric"
            autoComplete={idx === 0 ? "one-time-code" : "off"}
            maxLength={1}
            value={digit}
            onChange={(e) => setDigit(idx, e.target.value)}
            onKeyDown={(e) => handleKeyDown(idx, e)}
            onFocus={(e) => { track("auth_focus_otp"); e.target.select(); }}
            autoFocus={idx === 0}
            disabled={status === "loading"}
            className="flex-1 min-w-0 h-12 text-center text-lg font-medium text-foreground bg-card border border-input rounded-lg focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-colors tabular-nums disabled:opacity-50"
          />
        ))}
      </div>

      <p className="text-xs text-muted-foreground mt-3">{t("checkSpam")}</p>

      <button
        type="button"
        onClick={onVerify}
        disabled={!canVerify || status === "loading"}
        className={`${primaryButtonClass} mt-5`}
      >
        {status === "loading" && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
        {t("verifyButton")}
      </button>

      <div className="flex flex-col items-center gap-4 mt-4">
        <button
          type="button"
          onClick={onResend}
          disabled={cooldown > 0 || resendStatus === "loading"}
          className="text-xs font-medium text-foreground hover:text-foreground/70 tracking-tight transition-colors disabled:text-muted-foreground disabled:cursor-not-allowed"
        >
          {resendStatus === "loading" ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : resendStatus === "sent" ? (
            t("resendSent")
          ) : cooldown > 0 ? (
            `${t("resendCode")} (${cooldown}s)`
          ) : (
            t("resendCode")
          )}
        </button>

        <button
          type="button"
          onClick={onBack}
          className="text-xs font-medium text-muted-foreground hover:text-foreground tracking-tight transition-colors flex items-center gap-1"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
            <line x1="19" y1="12" x2="5" y2="12" />
            <polyline points="12 19 5 12 12 5" />
          </svg>
          {t("changeEmail")}
        </button>
      </div>
    </>
  );
}

// ─── Main ────────────────────────────────────────────────────────────────────

type SignupContext = { cuisine: string; restaurantName: string };

export function AuthPage({
  embedded = false,
  signupContext,
  skipAuthCheck = false,
}: {
  /** When true, the AuthPage skips its own logo/heading — caller is expected to render those. */
  embedded?: boolean;
  /** Forwarded to send-otp / google verify so the API can seed a template restaurant. */
  signupContext?: SignupContext;
  /** Skip the "already authenticated" redirect. Useful inside the create-flow wizard so a
   *  half-finished signup attempt doesn't bounce out before the user picks cuisine + name. */
  skipAuthCheck?: boolean;
} = {}) {
  const t = useTranslations("dashboard.auth");
  const locale = useLocale();

  const [screen, setScreen] = useState<Screen>("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState<string[]>(Array(CODE_LENGTH).fill(""));
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const [cooldown, setCooldown] = useState(0);
  const [resendStatus, setResendStatus] = useState<"idle" | "loading" | "sent">("idle");
  const [googleReady, setGoogleReady] = useState(false);
  const [legalView, setLegalView] = useState<LegalView>(null);
  const googleHiddenRef = useRef<HTMLDivElement>(null);

  // Already-authenticated visitors get sent to the right dashboard.
  // Legacy companies → old monolith; everyone else → /<locale>/dashboard
  // (or /<locale>/onboarding if onboardingStep < 3).
  useEffect(() => {
    if (skipAuthCheck) return;
    let cancelled = false;
    fetch(apiUrl("/api/auth/check"), { credentials: "include", cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (cancelled || !data?.authenticated) return;
        if (data.legacyDashboard) {
          window.location.assign(`https://iq-rest.com/${locale}/dashboard`);
          return;
        }
        window.location.assign(`/${locale}/dashboard`);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [locale, skipAuthCheck]);

  // Resend cooldown countdown
  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  // Google Identity Services
  const handleGoogleResponse = useCallback(
    async (response: { credential: string }) => {
      setStatus("loading");
      setErrorMessage("");
      try {
        const res = await fetch(apiUrl("/api/auth/google"), {
        credentials: "include",
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ credential: response.credential, locale, signupContext }),
        });
        const data = await res.json();
        if (res.ok) {
          track("auth_click_google");
          await identify();
          if (data.legacyDashboard) {
            window.location.assign(`https://iq-rest.com/${locale}/dashboard`);
            return;
          }
          // Full reload so server layout re-fetches restaurant + auth state.
          window.location.assign(`/${locale}/dashboard`);
        } else {
          setErrorMessage(data.error || t("errors.sendFailed"));
          setStatus("error");
        }
      } catch {
        setErrorMessage(t("errors.sendFailed"));
        setStatus("error");
      }
    },
    [locale, t, signupContext]
  );

  useEffect(() => {
    if (!GOOGLE_CLIENT_ID) return;

    const initGoogle = () => {
      if (!window.google || !googleHiddenRef.current) return;
      window.google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: handleGoogleResponse,
        ux_mode: "popup",
        auto_select: false,
      });
      window.google.accounts.id.renderButton(googleHiddenRef.current, {
        type: "standard",
        shape: "rectangular",
        theme: "outline",
        size: "large",
        width: 300,
        text: "continue_with",
        logo_alignment: "left",
      });
      setGoogleReady(true);
    };

    if (window.google) {
      initGoogle();
      return;
    }

    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    script.onload = initGoogle;
    document.head.appendChild(script);

    return () => {
      if (script.parentNode) script.parentNode.removeChild(script);
    };
  }, [handleGoogleResponse]);

  useEffect(() => {
    track("auth_showed");
  }, []);

  const handleContinue = async () => {
    const trimmed = email.trim().toLowerCase();
    if (!isValidEmail(trimmed)) {
      setErrorMessage(t("errors.emailInvalid"));
      setStatus("error");
      return;
    }

    setStatus("loading");
    setErrorMessage("");

    try {
      const res = await fetch(apiUrl("/api/auth/send-otp"), {
        credentials: "include",
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: trimmed, locale, signupContext }),
      });
      const data = await res.json();

      if (res.ok) {
        track("auth_click_continue");
        setCode(Array(CODE_LENGTH).fill(""));
        setCooldown(RESEND_COOLDOWN);
        setStatus("idle");
        setScreen("verify");
        track("auth_showed_otp");
      } else {
        setErrorMessage(data.error || t("errors.sendFailed"));
        setStatus("error");
      }
    } catch {
      setErrorMessage(t("errors.sendFailed"));
      setStatus("error");
    }
  };

  const handleBack = () => {
    track("auth_click_change_email");
    setCode(Array(CODE_LENGTH).fill(""));
    setScreen("email");
    setStatus("idle");
    setErrorMessage("");
  };

  const handleVerify = async () => {
    const otp = code.join("");
    if (otp.length !== CODE_LENGTH) return;

    setStatus("loading");
    setErrorMessage("");

    try {
      const res = await fetch(apiUrl("/api/auth/verify-otp"), {
        credentials: "include",
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim().toLowerCase(), code: otp }),
      });
      const data = await res.json();

      if (res.ok) {
        track("auth_click_verify");
        await identify();
        if (data.legacyDashboard) {
          window.location.assign(`https://iq-rest.com/${locale}/dashboard`);
          return;
        }
        window.location.assign(`/${locale}/dashboard`);
      } else {
        const key = ERROR_MAP[data.error];
        setErrorMessage(key ? t(key) : t("errors.verifyFailed"));
        setStatus("error");
        setCode(Array(CODE_LENGTH).fill(""));
      }
    } catch {
      setErrorMessage(t("errors.verifyFailed"));
      setStatus("error");
      setCode(Array(CODE_LENGTH).fill(""));
    }
  };

  const handleResend = async () => {
    if (cooldown > 0 || resendStatus === "loading") return;
    track("auth_click_renew_code");
    setResendStatus("loading");
    setErrorMessage("");
    try {
      const res = await fetch(apiUrl("/api/auth/send-otp"), {
        credentials: "include",
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim().toLowerCase(), locale, signupContext }),
      });
      if (res.ok) {
        setResendStatus("sent");
        setCooldown(RESEND_COOLDOWN);
        setCode(Array(CODE_LENGTH).fill(""));
        setTimeout(() => setResendStatus("idle"), 3000);
      } else {
        setResendStatus("idle");
        setErrorMessage(t("errors.sendFailed"));
        setStatus("error");
      }
    } catch {
      setResendStatus("idle");
      setErrorMessage(t("errors.sendFailed"));
      setStatus("error");
    }
  };

  const inner =
    screen === "email" ? (
      <EmailScreen
        email={email}
        setEmail={setEmail}
        onContinue={handleContinue}
        status={status}
        errorMessage={errorMessage}
        googleReady={googleReady}
        googleHiddenRef={googleHiddenRef}
        embedded={embedded}
        onOpenLegal={(v) => setLegalView(v)}
        t={t}
      />
    ) : (
      <VerifyScreen
        email={email}
        code={code}
        setCode={setCode}
        onBack={handleBack}
        onVerify={handleVerify}
        onResend={handleResend}
        status={status}
        errorMessage={errorMessage}
        cooldown={cooldown}
        resendStatus={resendStatus}
        embedded={embedded}
        t={t}
      />
    );

  if (embedded) return (
    <>
      {inner}
      <LegalModal view={legalView} onClose={() => setLegalView(null)} />
    </>
  );

  return (
    <div className="min-h-[100dvh] bg-background flex items-center justify-center px-4 py-4 antialiased tracking-tight">
      <div className="w-[360px] max-w-full bg-card border border-border rounded-2xl p-6 pb-7">
        {inner}
      </div>
      <LegalModal view={legalView} onClose={() => setLegalView(null)} />
    </div>
  );
}
