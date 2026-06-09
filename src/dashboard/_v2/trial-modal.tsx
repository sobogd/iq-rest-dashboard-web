"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Clock } from "lucide-react";
import { Modal } from "./ui";
import { primaryBtn, secondaryBtn } from "./tokens";
import { useDashboardRouter } from "../_spa/router";
import { track } from "@/lib/dashboard-events";

const SHOWN_KEY = "dash_trial_modal_shown";
const DAY_MS = 86_400_000;

type TrialSub = {
  plan: string | null;
  subscriptionStatus: string | null;
  trialEndsAt: string | null;
} | null;

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Daily trial reminder — a dismissible modal (NOT blocking; just a nudge).
 * Shown on dashboard open when:
 *   - account is on a trial (or it has expired) and not on a paid plan,
 *   - at least 24h have passed since signup (`accountCreatedAt`),
 *   - it hasn't already been shown today.
 * "Hide" closes it for the rest of the day. Mount AFTER the onboarding modals
 * so it never competes with them (see FirstRunModals).
 */
export function TrialModal({
  sub,
  accountCreatedAt,
}: {
  sub: TrialSub;
  accountCreatedAt?: string | null;
}) {
  const t = useTranslations("trialModal");
  const router = useDashboardRouter();

  const [open, setOpen] = useState<boolean>(() => shouldShow(sub, accountCreatedAt));

  useEffect(() => {
    if (open) track("dash_trial_modal_open");
  }, [open]);

  if (!sub) return null;

  const ends = sub.trialEndsAt ? new Date(sub.trialEndsAt) : null;
  const expired = ends !== null && ends.getTime() <= Date.now();
  const daysLeft = ends ? Math.max(1, Math.ceil((ends.getTime() - Date.now()) / DAY_MS)) : 0;

  // Mark today as "shown" only on an explicit user action (Hide / View plans),
  // NOT on open — otherwise a page refresh would dismiss it for the day. This
  // way the reminder survives reloads until the user actually dismisses it.
  const markShownToday = () => {
    try {
      localStorage.setItem(SHOWN_KEY, todayKey());
    } catch {
      // ignore storage errors
    }
  };

  const hide = () => {
    track("dash_trial_modal_dismiss");
    markShownToday();
    setOpen(false);
  };
  const goPlans = () => {
    track("dash_trial_modal_upgrade");
    markShownToday();
    setOpen(false);
    router.push({ name: "settings.billing", from: "menu" });
  };

  return (
    <Modal
      open={open}
      onClose={hide}
      title={expired ? t("titleExpired") : t("title")}
      size="sm"
      footer={
        <div className="flex items-center justify-end gap-2">
          <button type="button" onClick={hide} className={secondaryBtn}>
            {t("hide")}
          </button>
          <button type="button" onClick={goPlans} className={primaryBtn}>
            {t("viewPlans")}
          </button>
        </div>
      }
    >
      <div className="flex items-start gap-3">
        <Clock className="h-5 w-5 shrink-0 mt-0.5 text-primary" />
        <div className="min-w-0">
          <p className="text-sm font-semibold text-foreground">
            {expired ? t("expiredHeadline") : t("daysLeft", { days: daysLeft })}
          </p>
          <p className="text-xs text-muted-foreground mt-1 leading-snug">{t("body")}</p>
        </div>
      </div>
    </Modal>
  );
}

function shouldShow(sub: TrialSub, accountCreatedAt?: string | null): boolean {
  if (!sub) return false;
  const isPaid = sub.subscriptionStatus === "ACTIVE" && !!sub.plan && sub.plan !== "FREE";
  if (isPaid) return false;
  if (!sub.trialEndsAt) return false;
  // First reminder only ≥24h after signup.
  if (accountCreatedAt) {
    const created = new Date(accountCreatedAt).getTime();
    if (Number.isFinite(created) && Date.now() - created < DAY_MS) return false;
  }
  // Once per day.
  try {
    if (localStorage.getItem(SHOWN_KEY) === todayKey()) return false;
  } catch {
    // ignore storage errors — fall through and show
  }
  return true;
}
