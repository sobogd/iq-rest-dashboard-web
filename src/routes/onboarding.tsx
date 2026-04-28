import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/onboarding")({
  component: OnboardingPage,
});

function OnboardingPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-neutral-50 p-6">
      <div className="max-w-md w-full text-center">
        <h1 className="text-2xl font-medium text-neutral-900 mb-3">Welcome</h1>
        <p className="text-sm text-neutral-600">Onboarding flow — coming soon.</p>
      </div>
    </div>
  );
}
