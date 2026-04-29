import { createFileRoute, redirect } from "@tanstack/react-router";
import { apiUrl } from "@/lib/api";

type Locale = "en" | "es";
const SUPPORTED: Locale[] = ["en", "es"];

const COUNTRY_TO_LOCALE: Record<string, Locale> = {
  // Spanish-speaking countries
  ES: "es", MX: "es", AR: "es", CO: "es", CL: "es", PE: "es", VE: "es",
  EC: "es", GT: "es", CU: "es", BO: "es", DO: "es", HN: "es", PY: "es",
  SV: "es", NI: "es", CR: "es", PA: "es", UY: "es", PR: "es", GQ: "es",
};

function isSupported(v: string | null | undefined): v is Locale {
  return !!v && (SUPPORTED as string[]).includes(v);
}

function pickFromBrowser(): Locale {
  if (typeof navigator === "undefined") return "en";
  const lng = navigator.language.split("-")[0].toLowerCase();
  return isSupported(lng) ? lng : "en";
}

async function pickLocale(): Promise<Locale> {
  // Geo from backend (cf-ipcountry header). Fall back to navigator language.
  try {
    const res = await fetch(apiUrl("/api/geo/currency"), {
      credentials: "include",
      cache: "no-store",
    });
    if (res.ok) {
      const data = (await res.json()) as { country?: string | null };
      const country = (data.country || "").toUpperCase();
      const mapped = COUNTRY_TO_LOCALE[country];
      if (mapped) return mapped;
      if (country) return "en";
    }
  } catch {
    // ignore — fall through to browser language
  }
  return pickFromBrowser();
}

export const Route = createFileRoute("/")({
  beforeLoad: async () => {
    const locale = await pickLocale();
    throw redirect({ to: "/$locale", params: { locale } });
  },
});
