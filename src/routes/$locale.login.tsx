import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";
import { landingUrl } from "@/lib/landing-url";

function LoginRedirect() {
  const { locale } = Route.useParams();
  useEffect(() => {
    window.location.assign(landingUrl(locale || "en"));
  }, [locale]);
  return null;
}

export const Route = createFileRoute("/$locale/login")({
  component: LoginRedirect,
});
