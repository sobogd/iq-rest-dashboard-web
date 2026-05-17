import i18n from "i18next";
import { initReactI18next } from "react-i18next";

// Lazy locale loading. Previously every locale JSON was bundled eagerly
// (35 × ~32 KB ≈ 1.1 MB raw of JSON in the initial chunk). Vite now emits
// one chunk per locale and we fetch only the URL-locale + EN fallback at
// boot; the rest is pulled on demand when the user switches languages.

export const SUPPORTED_LOCALES = [
  "en", "es", "de", "fr", "it", "pt", "nl", "pl", "ru", "uk",
  "sv", "da", "no", "fi", "cs", "el", "tr", "ro", "hu", "bg",
  "hr", "sk", "sl", "et", "lv", "lt", "sr", "ca", "ga", "is",
  "fa", "ar", "ja", "ko", "zh",
] as const;

const RTL = new Set(["ar", "fa"]);

// Per-locale dynamic imports. Without `eager: true` Vite returns a map
// of `() => Promise<module>` and splits each JSON into its own chunk.
const localeModules = import.meta.glob<{ default: Record<string, unknown> }>(
  "./locales/*.json",
);

function shortLang(lng: string): string {
  return (lng || "en").toLowerCase().split(/[-_]/)[0];
}

async function loadLocaleJson(lng: string): Promise<Record<string, unknown> | null> {
  const short = shortLang(lng);
  const loader = localeModules[`./locales/${short}.json`];
  if (!loader) return null;
  const mod = await loader();
  return mod.default;
}

// Pick the locale to preload before render. Priority:
//   1. First URL path segment if it's a supported locale.
//   2. Browser language.
//   3. EN.
function pickInitialLocale(): string {
  if (typeof window !== "undefined") {
    const seg = window.location.pathname.split("/").filter(Boolean)[0];
    const short = shortLang(seg || "");
    if (short && (SUPPORTED_LOCALES as readonly string[]).includes(short)) return short;
    const nav = shortLang(navigator.language || "en");
    if ((SUPPORTED_LOCALES as readonly string[]).includes(nav)) return nav;
  }
  return "en";
}

function applyHtmlAttrs(lng: string): void {
  if (typeof document === "undefined") return;
  const short = shortLang(lng);
  document.documentElement.setAttribute("lang", short);
  document.documentElement.setAttribute("dir", RTL.has(short) ? "rtl" : "ltr");
}

// Bootstrap i18n with only the locale we actually need on first paint.
// Returns a promise so callers can await before mounting the React tree —
// avoids a flash of missing keys before the bundle lands.
export async function bootstrapI18n(): Promise<void> {
  const initial = pickInitialLocale();

  const initialResources: Record<string, { translation: Record<string, unknown> }> = {};
  const loaded = await loadLocaleJson(initial);
  if (loaded) initialResources[initial] = { translation: loaded };
  // Preload EN as the fallback bundle so missing keys don't render raw.
  if (initial !== "en") {
    const en = await loadLocaleJson("en");
    if (en) initialResources.en = { translation: en };
  }

  await i18n.use(initReactI18next).init({
    lng: initial,
    fallbackLng: "en",
    supportedLngs: SUPPORTED_LOCALES as unknown as string[],
    nonExplicitSupportedLngs: true,
    load: "languageOnly",
    debug: false,
    interpolation: { escapeValue: false, prefix: "{", suffix: "}" },
    resources: initialResources,
  });

  // On switch: fetch + register the new locale's bundle, then re-emit
  // languageChanged so React subtrees refresh with the freshly loaded
  // strings. Skip the work if we already have it cached.
  i18n.on("languageChanged", async (lng) => {
    applyHtmlAttrs(lng);
    if (i18n.hasResourceBundle(lng, "translation")) return;
    const data = await loadLocaleJson(lng);
    if (!data) return;
    i18n.addResourceBundle(lng, "translation", data, true, true);
    void i18n.changeLanguage(lng);
  });

  applyHtmlAttrs(i18n.language || "en");
}

export default i18n;
