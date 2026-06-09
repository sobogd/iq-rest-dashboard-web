"use client";

import { useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { Loader2, Save } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { Modal } from "./ui";
import { inputClass, primaryBtn } from "./tokens";

const CODE_LENGTH = 6;
const isValidEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());

// OAuth for the demo "save my menu" claim — full-page redirect to the same
// callbacks the landing uses (redirect_uri must byte-match what's registered).
const GOOGLE_CLIENT_ID =
  (import.meta.env.VITE_GOOGLE_CLIENT_ID as string) ||
  "576149678945-vjqlc4sce6bsne3p0n63bqdvf33k43s0.apps.googleusercontent.com";
const APPLE_SERVICES_ID = (import.meta.env.VITE_APPLE_SERVICES_ID as string) || "com.iqrest.web";
const API_PUBLIC = (import.meta.env.VITE_API_PUBLIC_URL as string) || "https://dashboard-api.iq-rest.com";

const b64url = (s: string) => btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </svg>
  );
}
function AppleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" className="fill-foreground">
      <path d="M17.05 12.54c-.03-2.6 2.12-3.85 2.22-3.91-1.21-1.77-3.1-2.01-3.77-2.04-1.6-.16-3.13.94-3.94.94-.81 0-2.07-.92-3.41-.9-1.75.03-3.37 1.02-4.27 2.59-1.82 3.16-.47 7.84 1.31 10.41.87 1.26 1.9 2.67 3.25 2.62 1.31-.05 1.8-.84 3.38-.84 1.58 0 2.02.84 3.4.82 1.41-.03 2.3-1.28 3.16-2.55.99-1.46 1.4-2.87 1.42-2.94-.03-.01-2.73-1.05-2.76-4.15z" />
      <path d="M14.46 4.84c.72-.87 1.21-2.08 1.07-3.29-1.04.04-2.29.69-3.03 1.56-.66.77-1.24 2-1.09 3.18 1.16.09 2.34-.59 3.05-1.45z" />
    </svg>
  );
}

const ERROR_MAP: Record<string, string> = {
  CODE_EXPIRED: "errors.codeExpired",
  NO_CODE: "errors.sendFailed",
  INVALID_CODE: "errors.invalidCode",
  TOO_MANY_ATTEMPTS: "errors.tooManyAttempts",
};

/** Card shown above the menu for demo accounts. Their data is ephemeral (a
 *  cleanup cron deletes unclaimed demos), so the only call-to-action is "save
 *  your menu" — entering a real email converts the demo into a permanent
 *  account via the claim flow, keeping every edit. Mirrors the trial banner
 *  card on the same page. */
export function DemoSaveBanner() {
  const t = useTranslations("demo");
  const [open, setOpen] = useState(false);

  return (
    <>
      <div className="relative rounded-xl border border-border bg-gradient-to-br from-orange-500/10 to-amber-500/5 p-4 mb-2.5">
        <div className="flex items-start gap-3 md:items-center">
          <Save size={20} className="shrink-0 mt-0.5 md:mt-0 text-primary" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold">{t("bannerText")}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{t("bannerSubtitle")}</p>
            <div className="mt-3 md:hidden">
              <button
                type="button"
                onClick={() => setOpen(true)}
                className={primaryBtn + " inline-flex items-center gap-1.5"}
              >
                <Save size={14} />
                {t("bannerCta")}
              </button>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setOpen(true)}
            className={primaryBtn + " hidden md:inline-flex items-center gap-1.5 shrink-0"}
          >
            <Save size={14} />
            {t("bannerCta")}
          </button>
        </div>
      </div>
      <ClaimModal open={open} onClose={() => setOpen(false)} />
    </>
  );
}

function ClaimModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const t = useTranslations("demo");
  const locale = useLocale();
  const [screen, setScreen] = useState<"email" | "verify" | "done">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [status, setStatus] = useState<"idle" | "loading">("idle");
  const [error, setError] = useState("");
  // true → keep tables + menu; false → start from an empty restaurant. Fake
  // orders/reservations are cleared either way (handled server-side).
  const [keepData, setKeepData] = useState(true);

  const busy = status === "loading";

  // OAuth claim (full-page redirect). State carries the demo claim intent +
  // keep/clean choice; the demo session cookie identifies the account server-side.
  const oauthState = () => b64url(JSON.stringify({ locale, claim: true, keepData }));
  const goGoogle = () => {
    const params = new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID,
      redirect_uri: `${API_PUBLIC}/api/auth/google/callback`,
      response_type: "code",
      scope: "openid email profile",
      access_type: "online",
      prompt: "select_account",
      include_granted_scopes: "true",
      state: oauthState(),
    });
    window.location.assign(`https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`);
  };
  const goApple = () => {
    const params = new URLSearchParams({
      client_id: APPLE_SERVICES_ID,
      redirect_uri: `${API_PUBLIC}/api/auth/apple/callback`,
      response_type: "code",
      response_mode: "form_post",
      scope: "name email",
      state: oauthState(),
    });
    window.location.assign(`https://appleid.apple.com/auth/authorize?${params.toString()}`);
  };

  const sendCode = async () => {
    const trimmed = email.trim().toLowerCase();
    if (!isValidEmail(trimmed)) {
      setError(t("errors.emailInvalid"));
      return;
    }
    setStatus("loading");
    setError("");
    try {
      await api("/auth/demo/claim-start", {
        method: "POST",
        body: JSON.stringify({ email: trimmed, locale }),
      });
      setCode("");
      setScreen("verify");
    } catch {
      setError(t("errors.sendFailed"));
    } finally {
      setStatus("idle");
    }
  };

  const verify = async () => {
    if (code.length !== CODE_LENGTH) return;
    setStatus("loading");
    setError("");
    try {
      await api("/auth/demo/claim-verify", {
        method: "POST",
        body: JSON.stringify({ code, keepData }),
      });
      setScreen("done");
      // Reload so /auth/check re-runs (isDemo now false → banner gone) and the
      // switch path adopts the new session cookies.
      setTimeout(() => window.location.reload(), 1200);
    } catch (e) {
      const key = e instanceof ApiError ? ERROR_MAP[(e.data as { error?: string })?.error || ""] : undefined;
      setError(key ? t(key) : t("errors.verifyFailed"));
      setCode("");
      setStatus("idle");
    }
  };

  const title = screen === "done" ? t("success") : screen === "email" ? t("modalTitle") : t("codeTitle");
  const subtitle =
    screen === "email" ? t("modalSubtitle") : screen === "verify" ? t("codeSubtitle", { email }) : undefined;

  const footer =
    screen === "email" ? (
      <button type="button" onClick={() => void sendCode()} disabled={busy} className={primaryBtn + " inline-flex items-center gap-1.5 disabled:opacity-50"}>
        {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
        {t("sendCode")}
      </button>
    ) : screen === "verify" ? (
      <div className="flex items-center justify-between gap-2 w-full">
        <button
          type="button"
          onClick={() => { setScreen("email"); setError(""); }}
          disabled={busy}
          className="h-8 px-3 text-xs font-medium text-muted-foreground transition-colors disabled:opacity-50"
        >
          {t("changeEmail")}
        </button>
        <button
          type="button"
          onClick={() => void verify()}
          disabled={code.length !== CODE_LENGTH || busy}
          className={primaryBtn + " inline-flex items-center gap-1.5 disabled:opacity-50"}
        >
          {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          {t("verify")}
        </button>
      </div>
    ) : undefined;

  return (
    <Modal
      open={open}
      onClose={() => !busy && onClose()}
      title={title}
      subtitle={subtitle}
      size="sm"
      closeOnBackdrop={!busy}
      footer={footer}
    >
      {error && (
        <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-600 text-xs">{error}</div>
      )}

      {screen === "done" ? (
        <div className="flex justify-center py-2">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : screen === "email" ? (
        <div className="space-y-4">
          {/* Keep the demo menu, or start clean. Orders/bookings are cleared
              either way (they're sample data). */}
          <div>
            <div className="inline-flex w-full items-center rounded-lg border border-border bg-card overflow-hidden">
              <ToggleBtn active={keepData} onClick={() => setKeepData(true)}>{t("keepData")}</ToggleBtn>
              <ToggleBtn active={!keepData} onClick={() => setKeepData(false)}>{t("startClean")}</ToggleBtn>
            </div>
            <p className="mt-2 text-xs text-muted-foreground leading-snug">
              {keepData ? t("keepDataHint") : t("startCleanHint")}
            </p>
          </div>

          <div className="space-y-2">
            <button
              type="button"
              onClick={goGoogle}
              className="w-full h-11 text-sm font-medium text-foreground bg-card border border-border rounded-xl hover:border-foreground active:scale-[0.99] transition-all flex items-center justify-center gap-3"
            >
              <GoogleIcon />
              {t("continueGoogle")}
            </button>
            <button
              type="button"
              onClick={goApple}
              className="w-full h-11 text-sm font-medium text-foreground bg-card border border-border rounded-xl hover:border-foreground active:scale-[0.99] transition-all flex items-center justify-center gap-3"
            >
              <AppleIcon />
              {t("continueApple")}
            </button>
          </div>

          <div className="flex items-center gap-3">
            <span className="h-px flex-1 bg-border" />
            <span className="text-xs text-muted-foreground">{t("or")}</span>
            <span className="h-px flex-1 bg-border" />
          </div>

          <div>
            <label htmlFor="demo-email" className="block text-sm font-medium text-foreground mb-2.5">{t("emailLabel")}</label>
            <input
              id="demo-email"
              type="email"
              inputMode="email"
              autoComplete="email"
              autoFocus
              placeholder={t("emailPlaceholder")}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") void sendCode(); }}
              disabled={busy}
              className={inputClass}
            />
          </div>
        </div>
      ) : (
        <div>
          <label htmlFor="demo-otp" className="block text-sm font-medium text-foreground mb-2.5">{t("codeLabel")}</label>
          <input
            id="demo-otp"
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={CODE_LENGTH}
            autoFocus
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, CODE_LENGTH))}
            onKeyDown={(e) => { if (e.key === "Enter" && code.length === CODE_LENGTH) void verify(); }}
            disabled={busy}
            placeholder="000000"
            className={inputClass + " text-center text-xl tracking-[0.4em] tabular-nums h-12"}
          />
        </div>
      )}
    </Modal>
  );
}

function ToggleBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        "flex-1 h-8 px-3 text-xs font-medium transition-colors " +
        (active ? "bg-primary-gradient text-primary-foreground" : "text-muted-foreground hover:text-foreground")
      }
    >
      {children}
    </button>
  );
}
