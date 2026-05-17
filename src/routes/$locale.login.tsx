import { createFileRoute } from "@tanstack/react-router";
import { Suspense, lazy } from "react";
import { AuthPage } from "@/auth/auth-page";
import { FullPageLoader } from "@/components/full-page-loader";

// CreateFlow is shown only on /login?create=true, so it stays out of the
// default login bundle — visitors hitting /login pay only for AuthPage.
const CreateFlow = lazy(() =>
  import("@/onboarding/create-flow").then((m) => ({ default: m.CreateFlow })),
);

type LoginSearch = { create?: boolean };

function LoginRoute() {
  const { create } = Route.useSearch();
  if (create) {
    return (
      <Suspense fallback={<FullPageLoader />}>
        <CreateFlow />
      </Suspense>
    );
  }
  return <AuthPage />;
}

export const Route = createFileRoute("/$locale/login")({
  validateSearch: (raw: Record<string, unknown>): LoginSearch => {
    const v = raw.create;
    return { create: v === true || v === "true" || v === "1" || undefined };
  },
  component: LoginRoute,
});
