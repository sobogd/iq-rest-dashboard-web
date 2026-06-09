"use client";

import { useState } from "react";
import { OnboardingModals } from "./onboarding-modals";
import { TrialModal } from "./trial-modal";

type TrialSub = {
  plan: string | null;
  subscriptionStatus: string | null;
  trialEndsAt: string | null;
} | null;

/**
 * Sequences the first-run modals: the onboarding modals (name → fill → scan)
 * run first; only once they're resolved does the daily trial reminder appear,
 * so the trial modal is always last in the queue. Mount with
 * `key={restaurant.id}` so switching restaurants re-evaluates everything.
 */
export function FirstRunModals({
  restaurantName,
  onboardingNameDone,
  onboardingFillDone,
  existingRealItemsCount,
  onRefresh,
  sub,
  accountCreatedAt,
}: {
  restaurantName: string;
  onboardingNameDone: boolean;
  onboardingFillDone: boolean;
  existingRealItemsCount: number;
  onRefresh: () => void | Promise<void>;
  sub: TrialSub;
  accountCreatedAt?: string | null;
}) {
  const [onboardingResolved, setOnboardingResolved] = useState(false);

  return (
    <>
      <OnboardingModals
        restaurantName={restaurantName}
        onboardingNameDone={onboardingNameDone}
        onboardingFillDone={onboardingFillDone}
        existingRealItemsCount={existingRealItemsCount}
        onRefresh={onRefresh}
        onResolved={() => setOnboardingResolved(true)}
      />
      {onboardingResolved ? <TrialModal sub={sub} accountCreatedAt={accountCreatedAt} /> : null}
    </>
  );
}
