import { Suspense, lazy } from "react";
import { FullPageLoader } from "@/components/full-page-loader";

// Code-split the dashboard bundle off the initial login/auth path. The
// auth + onboarding bundle no longer has to ship every dashboard page,
// chart library, and form helper before the visitor even sees the login
// screen. Both /$locale/dashboard and the catch-all /$locale/dashboard/$
// route share this entry so Rollup emits a single dashboard chunk.

const DashboardHost = lazy(() =>
  import("./dashboard-host").then((m) => ({ default: m.DashboardHost })),
);

export function LazyDashboardHost() {
  return (
    <Suspense fallback={<FullPageLoader />}>
      <DashboardHost />
    </Suspense>
  );
}
