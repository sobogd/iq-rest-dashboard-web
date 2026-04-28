import { createFileRoute, redirect } from "@tanstack/react-router";
import { api } from "@/lib/api";

export const Route = createFileRoute("/$locale/")({
  beforeLoad: async ({ params }) => {
    const auth = await api<{ authenticated: boolean; onboardingStep?: number }>("/auth/check").catch(
      () => ({ authenticated: false } as { authenticated: boolean; onboardingStep?: number }),
    );
    if (!auth.authenticated) {
      throw redirect({ to: "/$locale/login", params: { locale: params.locale } });
    }
    if ((auth.onboardingStep ?? 0) < 3) {
      throw redirect({ to: "/$locale/onboarding", params: { locale: params.locale } });
    }
    throw redirect({ to: "/$locale/dashboard", params: { locale: params.locale } });
  },
});
