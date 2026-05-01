import { createFileRoute, useParams } from "@tanstack/react-router";
import { useEffect } from "react";
import { Loader2 } from "lucide-react";
import { apiUrl } from "@/lib/api";

function LogoutRoute() {
  const { locale } = useParams({ from: "/$locale/logout" });

  useEffect(() => {
    let cancelled = false;
    fetch(apiUrl("/api/auth/logout"), { method: "POST", credentials: "include" })
      .catch(() => {
        // Even if the API call fails, fall through to login — local cookies may still get cleared
        // by the redirect destination's auth-check.
      })
      .finally(() => {
        if (cancelled) return;
        window.location.assign(`/${locale}/login`);
      });
    return () => {
      cancelled = true;
    };
  }, [locale]);

  return (
    <div className="min-h-[100dvh] bg-background flex items-center justify-center">
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
    </div>
  );
}

export const Route = createFileRoute("/$locale/logout")({
  component: LogoutRoute,
});
