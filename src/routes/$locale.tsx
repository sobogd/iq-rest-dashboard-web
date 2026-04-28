import { Outlet, createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";

export const Route = createFileRoute("/$locale")({
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
