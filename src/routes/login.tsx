import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useSendOtp, useVerifyOtp } from "@/lib/auth";
import { ApiError } from "@/lib/api";

export const Route = createFileRoute("/login")({
  component: LoginPage,
});

type Step = "email" | "code";

function LoginPage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);

  const sendOtp = useSendOtp();
  const verifyOtp = useVerifyOtp();

  async function submitEmail(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await sendOtp.mutateAsync({ email: email.trim().toLowerCase(), locale: i18n.language });
      setStep("code");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to send code");
    }
  }

  async function submitCode(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      const r = await verifyOtp.mutateAsync({ email, code });
      navigate({ to: r.onboardingStep < 3 ? "/onboarding" : "/dashboard" });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Invalid code");
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-neutral-50 px-4">
      <div className="w-full max-w-sm">
        <h1 className="text-2xl font-medium text-neutral-900 mb-6 text-center">
          {t("auth.loginTitle")}
        </h1>
        {step === "email" ? (
          <form onSubmit={submitEmail} className="space-y-3">
            <label className="block">
              <span className="text-sm text-neutral-700">{t("auth.emailLabel")}</span>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1 w-full h-10 px-3 rounded-lg border border-neutral-300 bg-white text-sm"
                placeholder="you@example.com"
                autoFocus
              />
            </label>
            <button
              type="submit"
              disabled={sendOtp.isPending}
              className="w-full h-10 rounded-lg bg-neutral-900 text-white text-sm font-medium disabled:opacity-60"
            >
              {sendOtp.isPending ? "…" : t("auth.continue")}
            </button>
          </form>
        ) : (
          <form onSubmit={submitCode} className="space-y-3">
            <p className="text-sm text-neutral-600 text-center">
              Code sent to <span className="font-medium">{email}</span>
            </p>
            <input
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              required
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              className="w-full h-12 px-3 rounded-lg border border-neutral-300 bg-white text-center text-xl font-mono tracking-[0.4em]"
              autoFocus
            />
            <button
              type="submit"
              disabled={verifyOtp.isPending || code.length !== 6}
              className="w-full h-10 rounded-lg bg-neutral-900 text-white text-sm font-medium disabled:opacity-60"
            >
              {verifyOtp.isPending ? "…" : t("auth.continue")}
            </button>
            <button
              type="button"
              onClick={() => setStep("email")}
              className="w-full h-9 text-sm text-neutral-500"
            >
              ← Use different email
            </button>
          </form>
        )}
        {error ? <p className="mt-3 text-sm text-red-600 text-center">{error}</p> : null}
      </div>
    </div>
  );
}
