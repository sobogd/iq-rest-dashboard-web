import { Outlet, createFileRoute, redirect } from "@tanstack/react-router";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { SUPPORTED_LOCALES } from "@/lib/i18n-compat";

export const Route = createFileRoute("/$locale")({
  // Reject anything that's not one of our supported short codes — this
  // covers en-US, en_US, EN, ru-RU, etc. that Google or browser-language
  // detection can drop into the URL.
  beforeLoad: ({ params }) => {
    const raw = (params as { locale?: string }).locale;
    if (!raw || !(SUPPORTED_LOCALES as readonly string[]).includes(raw)) {
      const short = (raw || "").toLowerCase().split(/[-_]/)[0];
      const next = (SUPPORTED_LOCALES as readonly string[]).includes(short) ? short : "en";
      throw redirect({ to: "/$locale", params: { locale: next }, replace: true });
    }
  },
  component: LocaleLayout,
});

function LocaleLayout() {
  const { locale } = Route.useParams();
  const { i18n } = useTranslation();
  useEffect(() => {
    if (i18n.language !== locale) void i18n.changeLanguage(locale);
  }, [locale, i18n]);
  return <Outlet />;
}
