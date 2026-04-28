import { createFileRoute } from "@tanstack/react-router";
import { OnboardingClient } from "@/onboarding/onboarding-client";

export const Route = createFileRoute("/onboarding")({
  component: OnboardingClient,
});
