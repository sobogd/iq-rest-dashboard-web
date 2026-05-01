import { createFileRoute } from "@tanstack/react-router";
import { AuthPage } from "@/auth/auth-page";
import { CreateFlow } from "@/onboarding/create-flow";

type LoginSearch = { create?: boolean };

function LoginRoute() {
  const { create } = Route.useSearch();
  return create ? <CreateFlow /> : <AuthPage />;
}

export const Route = createFileRoute("/$locale/login")({
  validateSearch: (raw: Record<string, unknown>): LoginSearch => {
    const v = raw.create;
    return { create: v === true || v === "true" || v === "1" || undefined };
  },
  component: LoginRoute,
});
