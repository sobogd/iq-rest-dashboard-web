import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Loader2 } from "lucide-react";
import { useSendOtp, useVerifyOtp } from "@/lib/auth";
import { ApiError } from "@/lib/api";

export const Route = createFileRoute("/login")({
  component: LoginPage,
});

const CODE_LENGTH = 6;
const RESEND_COOLDOWN = 60;

const inputClass =
  "w-full h-10 px-3 text-sm text-neutral-100 bg-neutral-900 border border-neutral-800 rounded-lg placeholder:text-neutral-500 focus:outline-none focus:border-neutral-100 focus:ring-2 focus:ring-neutral-100/5 transition-colors";
const labelClass = "block text-xs font-medium text-neutral-100 mb-1.5 tracking-tight";
const primaryBtn =
  "w-full h-10 text-sm font-medium text-neutral-950 bg-neutral-100 rounded-lg hover:bg-neutral-100/90 active:scale-[0.99] transition-all tracking-tight disabled:bg-neutral-800 disabled:text-neutral-500 disabled:cursor-not-allowed disabled:active:scale-100 flex items-center justify-center gap-2";

function isValidEmail(s: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.trim());
}

function LoginPage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const [screen, setScreen] = useState<"email" | "code">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState<string[]>(Array(CODE_LENGTH).fill(""));
  const [errorMsg, setErrorMsg] = useState("");
  const [cooldown, setCooldown] = useState(0);

  const sendOtp = useSendOtp();
  const verifyOtp = useVerifyOtp();

  useEffect(() => {
    if (cooldown <= 0) return;
    const id = setInterval(() => setCooldown((c) => Math.max(0, c - 1)), 1000);
    return () => clearInterval(id);
  }, [cooldown]);

  async function submitEmail() {
    if (!isValidEmail(email)) return;
    setErrorMsg("");
    try {
      await sendOtp.mutateAsync({ email: email.trim().toLowerCase(), locale: i18n.language });
      setScreen("code");
      setCooldown(RESEND_COOLDOWN);
    } catch (err) {
      setErrorMsg(err instanceof ApiError ? err.message : t("auth.errors.sendFailed"));
    }
  }

  async function submitCode() {
    const c = code.join("");
    if (c.length !== CODE_LENGTH) return;
    setErrorMsg("");
    try {
      const r = await verifyOtp.mutateAsync({ email, code: c });
      navigate({ to: r.onboardingStep < 3 ? "/onboarding" : "/dashboard" });
    } catch (err) {
      setErrorMsg(err instanceof ApiError ? err.message : t("auth.errors.invalid"));
      setCode(Array(CODE_LENGTH).fill(""));
    }
  }

  async function resendCode() {
    if (cooldown > 0) return;
    try {
      await sendOtp.mutateAsync({ email, locale: i18n.language });
      setCooldown(RESEND_COOLDOWN);
    } catch {
      // ignore
    }
  }

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 antialiased flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="text-sm font-semibold tracking-tight">{t("appName")}</div>
        </div>

        {screen === "email" ? (
          <EmailScreen
            email={email}
            setEmail={setEmail}
            onContinue={submitEmail}
            loading={sendOtp.isPending}
            error={errorMsg}
            t={t}
          />
        ) : (
          <CodeScreen
            email={email}
            code={code}
            setCode={setCode}
            onVerify={submitCode}
            onBack={() => {
              setScreen("email");
              setErrorMsg("");
              setCode(Array(CODE_LENGTH).fill(""));
            }}
            onResend={resendCode}
            loading={verifyOtp.isPending}
            cooldown={cooldown}
            error={errorMsg}
            t={t}
          />
        )}
      </div>
    </div>
  );
}

function EmailScreen({
  email,
  setEmail,
  onContinue,
  loading,
  error,
  t,
}: {
  email: string;
  setEmail: (s: string) => void;
  onContinue: () => void;
  loading: boolean;
  error: string;
  t: ReturnType<typeof useTranslation>["t"];
}) {
  const canContinue = isValidEmail(email);
  return (
    <>
      <h1 className="text-xl font-medium tracking-tight mb-1.5">{t("auth.title")}</h1>
      <p className="text-xs text-neutral-400 leading-snug mb-5">{t("auth.subtitle")}</p>

      {error && (
        <div className="mb-4 p-3 bg-red-950/40 border border-red-900/50 rounded-lg text-red-400 text-xs leading-snug">
          {error}
        </div>
      )}

      <label htmlFor="email" className={labelClass}>
        {t("auth.emailLabel")}
      </label>
      <input
        id="email"
        type="email"
        inputMode="email"
        autoComplete="email"
        placeholder="you@example.com"
        autoFocus
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && canContinue) onContinue();
        }}
        disabled={loading}
        className={inputClass}
      />

      <button
        type="button"
        onClick={onContinue}
        disabled={!canContinue || loading}
        className={`${primaryBtn} mt-4`}
      >
        {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
        {t("auth.continueEmail")}
      </button>

      <p className="text-xs text-neutral-500 leading-snug text-center mt-6">
        {t("auth.consent")}
      </p>
    </>
  );
}

function CodeScreen({
  email,
  code,
  setCode,
  onVerify,
  onBack,
  onResend,
  loading,
  cooldown,
  error,
  t,
}: {
  email: string;
  code: string[];
  setCode: (c: string[]) => void;
  onVerify: () => void;
  onBack: () => void;
  onResend: () => void;
  loading: boolean;
  cooldown: number;
  error: string;
  t: ReturnType<typeof useTranslation>["t"];
}) {
  const inputsRef = useRef<(HTMLInputElement | null)[]>([]);
  const canVerify = code.every((d) => d !== "");

  function setDigit(idx: number, v: string) {
    const digit = v.replace(/\D/g, "").slice(-1);
    const next = [...code];
    next[idx] = digit;
    setCode(next);
    if (digit && idx < CODE_LENGTH - 1) inputsRef.current[idx + 1]?.focus();
  }

  function onKey(idx: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Backspace") {
      if (code[idx]) {
        const n = [...code];
        n[idx] = "";
        setCode(n);
      } else if (idx > 0) {
        inputsRef.current[idx - 1]?.focus();
        const n = [...code];
        n[idx - 1] = "";
        setCode(n);
      }
      e.preventDefault();
    } else if (e.key === "ArrowLeft" && idx > 0) {
      inputsRef.current[idx - 1]?.focus();
    } else if (e.key === "ArrowRight" && idx < CODE_LENGTH - 1) {
      inputsRef.current[idx + 1]?.focus();
    } else if (e.key === "Enter" && canVerify) {
      onVerify();
    }
  }

  function onPaste(e: React.ClipboardEvent<HTMLInputElement>) {
    const txt = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, CODE_LENGTH);
    if (txt.length === CODE_LENGTH) {
      setCode(txt.split(""));
      inputsRef.current[CODE_LENGTH - 1]?.focus();
      e.preventDefault();
    }
  }

  return (
    <>
      <h1 className="text-xl font-medium tracking-tight mb-1.5">{t("auth.codeTitle")}</h1>
      <p className="text-xs text-neutral-400 leading-snug mb-5">
        {t("auth.codeSubtitle")} <span className="text-neutral-100 font-medium">{email}</span>
      </p>

      {error && (
        <div className="mb-4 p-3 bg-red-950/40 border border-red-900/50 rounded-lg text-red-400 text-xs leading-snug">
          {error}
        </div>
      )}

      <div className="flex gap-2 justify-center mb-5">
        {code.map((d, i) => (
          <input
            key={i}
            ref={(el) => { inputsRef.current[i] = el; }}
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={1}
            value={d}
            onChange={(e) => setDigit(i, e.target.value)}
            onKeyDown={(e) => onKey(i, e)}
            onPaste={onPaste}
            disabled={loading}
            className="w-11 h-12 text-center text-lg font-medium text-neutral-100 bg-neutral-900 border border-neutral-800 rounded-lg focus:outline-none focus:border-neutral-100 focus:ring-2 focus:ring-neutral-100/5 transition-colors tabular-nums"
            autoFocus={i === 0}
          />
        ))}
      </div>

      <button
        type="button"
        onClick={onVerify}
        disabled={!canVerify || loading}
        className={primaryBtn}
      >
        {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
        {t("auth.verify")}
      </button>

      <div className="flex items-center justify-between mt-5 text-xs">
        <button type="button" onClick={onBack} className="text-neutral-400 hover:text-neutral-100">
          ← {t("auth.changeEmail")}
        </button>
        <button
          type="button"
          onClick={onResend}
          disabled={cooldown > 0}
          className="text-neutral-400 hover:text-neutral-100 disabled:text-neutral-600 disabled:cursor-not-allowed"
        >
          {cooldown > 0 ? t("auth.resendIn", { sec: cooldown }) : t("auth.resend")}
        </button>
      </div>
    </>
  );
}
