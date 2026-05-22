import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { apiUrl } from "@/lib/api";

// First screen rendered when the kitchen subdomain opens with no paired
// device. The owner generates a 6-digit code in `Settings → Devices`,
// reads it out, and the kitchen staff types it here. On success the
// returned device token is persisted and the kiosk reloads into the
// kitchen view.
//
// UX choices:
//   - Big numeric input (six separate boxes) so it works with on-screen
//     keypads on cheap Android tablets.
//   - No "remember me" / "show password" — the code is one-time, expires
//     in two minutes, and the token is stored in localStorage on success.
//   - Errors are inline (no modal) so the staff doesn't lose context.

interface PairingScreenProps {
  onPaired: (token: string) => void;
}

const CODE_LEN = 6;

export function PairingScreen({ onPaired }: PairingScreenProps) {
  const t = useTranslations("dashboard.kitchen");
  const [digits, setDigits] = useState<string[]>(() => Array(CODE_LEN).fill(""));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputsRef = useRef<Array<HTMLInputElement | null>>([]);

  useEffect(() => {
    inputsRef.current[0]?.focus();
  }, []);

  function setDigitAt(idx: number, val: string) {
    setError(null);
    const onlyDigits = val.replace(/\D/g, "");
    if (onlyDigits.length === 0 && val !== "") return;
    if (onlyDigits.length === 0) {
      setDigits((d) => {
        const next = [...d];
        next[idx] = "";
        return next;
      });
      return;
    }
    if (onlyDigits.length > 1) {
      // Pasted whole code into a single box — distribute.
      const chunks = onlyDigits.slice(0, CODE_LEN).split("");
      setDigits((d) => {
        const next = [...d];
        for (let i = 0; i < CODE_LEN; i++) {
          next[i] = chunks[i] ?? "";
        }
        return next;
      });
      const target = Math.min(idx + chunks.length, CODE_LEN - 1);
      inputsRef.current[target]?.focus();
      if (chunks.length === CODE_LEN) {
        void submit(onlyDigits.slice(0, CODE_LEN));
      }
      return;
    }
    setDigits((d) => {
      const next = [...d];
      next[idx] = onlyDigits;
      return next;
    });
    if (idx < CODE_LEN - 1) {
      inputsRef.current[idx + 1]?.focus();
    } else {
      const candidate = [...digits];
      candidate[idx] = onlyDigits;
      if (candidate.every((c) => c !== "")) {
        void submit(candidate.join(""));
      }
    }
  }

  function onKeyDown(idx: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Backspace" && !digits[idx] && idx > 0) {
      inputsRef.current[idx - 1]?.focus();
    } else if (e.key === "Enter") {
      const code = digits.join("");
      if (code.length === CODE_LEN) void submit(code);
    }
  }

  async function submit(code: string) {
    if (submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(apiUrl("/devices/pair"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      if (!res.ok) {
        let msg = t("errorInvalid");
        try {
          const j = await res.json();
          if (j?.message === "Device is revoked") msg = t("errorRevoked");
        } catch {
          // ignore
        }
        setError(msg);
        setDigits(Array(CODE_LEN).fill(""));
        inputsRef.current[0]?.focus();
        return;
      }
      const data = (await res.json()) as { token: string };
      onPaired(data.token);
    } catch {
      setError(t("errorNetwork"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-dvh bg-background flex items-center justify-center px-6">
      <div className="w-full max-w-md text-center">
        <h1 className="text-3xl font-medium text-foreground mb-2">{t("title")}</h1>
        <p className="text-sm text-muted-foreground leading-snug mb-8">
          {t("subtitleBefore")}
          <span className="font-medium text-foreground">{t("settingsPath")}</span>
          {t("subtitleAfter")}
        </p>
        <div className="flex items-center justify-center gap-2 mb-6">
          {digits.map((d, i) => (
            <input
              key={i}
              ref={(el) => {
                inputsRef.current[i] = el;
              }}
              value={d}
              onChange={(e) => setDigitAt(i, e.target.value)}
              onKeyDown={(e) => onKeyDown(i, e)}
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={1}
              disabled={submitting}
              className="w-12 h-16 text-center text-2xl font-medium bg-card border border-border rounded-lg text-foreground focus:outline-none focus:border-primary disabled:opacity-50"
            />
          ))}
        </div>
        {error ? (
          <div className="text-sm text-red-600 mb-4" role="alert">{error}</div>
        ) : null}
        {submitting ? (
          <div className="text-xs text-muted-foreground">{t("pairing")}</div>
        ) : (
          <div className="text-xs text-muted-foreground">{t("expiredHint")}</div>
        )}
      </div>
    </div>
  );
}
