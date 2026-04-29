import { createFileRoute, redirect } from "@tanstack/react-router";
import { apiUrl } from "@/lib/api";
import { SUPPORTED_LOCALES, type SupportedLocale } from "@/lib/i18n-compat";

// Country (ISO 3166-1 alpha-2) → preferred UI locale. Visitors from
// countries not listed fall back to navigator.language, then to "en".
const COUNTRY_TO_LOCALE: Record<string, SupportedLocale> = {
  // Spanish-speaking
  ES: "es", MX: "es", AR: "es", CO: "es", CL: "es", PE: "es", VE: "es",
  EC: "es", GT: "es", CU: "es", BO: "es", DO: "es", HN: "es", PY: "es",
  SV: "es", NI: "es", CR: "es", PA: "es", UY: "es", PR: "es", GQ: "es",
  // German-speaking
  DE: "de", AT: "de", CH: "de", LI: "de",
  // French-speaking
  FR: "fr", BE: "fr", LU: "fr", MC: "fr",
  // Italian-speaking
  IT: "it", SM: "it", VA: "it",
  // Portuguese-speaking
  PT: "pt", BR: "pt", AO: "pt", MZ: "pt", CV: "pt",
  // Dutch
  NL: "nl",
  // Polish
  PL: "pl",
  // Russian
  RU: "ru", BY: "ru", KZ: "ru", KG: "ru",
  // Ukrainian
  UA: "uk",
  // Nordic
  SE: "sv", DK: "da", NO: "no", FI: "fi", IS: "is",
  // Czech / Slovak
  CZ: "cs", SK: "sk",
  // Greek
  GR: "el", CY: "el",
  // Turkish
  TR: "tr",
  // Romanian
  RO: "ro", MD: "ro",
  // Hungarian
  HU: "hu",
  // Bulgarian
  BG: "bg",
  // Croatian / Slovenian / Serbian
  HR: "hr", SI: "sl", RS: "sr", ME: "sr", BA: "sr",
  // Baltic
  EE: "et", LV: "lv", LT: "lt",
  // Catalan
  AD: "ca",
  // Irish (alongside English) — pick en for Ireland to avoid surprises
  // Persian / Arabic
  IR: "fa", AF: "fa", TJ: "fa",
  SA: "ar", AE: "ar", EG: "ar", IQ: "ar", JO: "ar", LB: "ar", LY: "ar",
  MA: "ar", OM: "ar", PS: "ar", QA: "ar", SY: "ar", TN: "ar", YE: "ar",
  KW: "ar", BH: "ar", DZ: "ar", SD: "ar",
  // CJK
  JP: "ja", KR: "ko",
  CN: "zh", TW: "zh", HK: "zh", SG: "zh", MO: "zh",
};

function isSupported(v: string | null | undefined): v is SupportedLocale {
  return !!v && (SUPPORTED_LOCALES as readonly string[]).includes(v);
}

function pickFromBrowser(): SupportedLocale {
  if (typeof navigator === "undefined") return "en";
  const lng = navigator.language.split("-")[0].toLowerCase();
  return isSupported(lng) ? lng : "en";
}

async function pickLocale(): Promise<SupportedLocale> {
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
