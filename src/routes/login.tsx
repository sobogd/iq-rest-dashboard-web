import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";

export const Route = createFileRoute("/login")({
  component: LoginPage,
});

function LoginPage() {
  const { t } = useTranslation();
  return (
    <div className="min-h-screen flex items-center justify-center bg-neutral-50 px-4">
      <div className="w-full max-w-sm">
        <h1 className="text-2xl font-medium text-neutral-900 mb-6 text-center">
          {t("auth.loginTitle")}
        </h1>
        <form className="space-y-3">
          <label className="block">
            <span className="text-sm text-neutral-700">{t("auth.emailLabel")}</span>
            <input
              type="email"
              className="mt-1 w-full h-10 px-3 rounded-lg border border-neutral-300 bg-white text-sm"
              placeholder="you@example.com"
            />
          </label>
          <button
            type="submit"
            className="w-full h-10 rounded-lg bg-neutral-900 text-white text-sm font-medium"
          >
            {t("auth.continue")}
          </button>
        </form>
      </div>
    </div>
  );
}
