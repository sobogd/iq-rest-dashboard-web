import { useEffect } from "react";
import { useLocale } from "next-intl";
import { landingUrl } from "@/lib/landing-url";

/** Redirects to the marketing landing on mount. Used wherever the dashboard
 *  previously rendered AuthPage — sign-in/sign-up now lives on the landing. */
export function LandingRedirect() {
  const locale = useLocale();
  useEffect(() => {
    window.location.assign(landingUrl(locale || "en"));
  }, [locale]);
  return null;
}
