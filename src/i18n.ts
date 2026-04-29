import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";

// Eagerly bundle every locale file in src/locales so build output ships
// translations with the JS bundle (no async fetches at runtime). Adding a
// new <lang>.json next to en.json is automatically picked up.
const modules = import.meta.glob<{ default: Record<string, unknown> }>(
  "./locales/*.json",
  { eager: true },
);

const SUPPORTED = [
  "en", "es", "de", "fr", "it", "pt", "nl", "pl", "ru", "uk",
  "sv", "da", "no", "fi", "cs", "el", "tr", "ro", "hu", "bg",
  "hr", "sk", "sl", "et", "lv", "lt", "sr", "ca", "ga", "is",
  "fa", "ar", "ja", "ko", "zh",
] as const;

const RTL = new Set(["ar", "fa"]);

const resources = Object.fromEntries(
  Object.entries(modules)
    .map(([path, mod]) => {
      const m = path.match(/\/locales\/([a-z-]+)\.json$/);
      return m ? [m[1], { translation: mod.default }] : null;
    })
    .filter(Boolean) as [string, { translation: Record<string, unknown> }][],
);

void i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    fallbackLng: "en",
    supportedLngs: SUPPORTED as unknown as string[],
    nonExplicitSupportedLngs: true,
    load: "languageOnly",
    debug: false,
    interpolation: { escapeValue: false, prefix: "{", suffix: "}" },
    resources,
  });

if (typeof document !== "undefined") {
  const apply = (lng: string) => {
    const short = (lng || "en").toLowerCase().split(/[-_]/)[0];
    document.documentElement.setAttribute("lang", short);
    document.documentElement.setAttribute("dir", RTL.has(short) ? "rtl" : "ltr");
  };
  apply(i18n.language || "en");
  i18n.on("languageChanged", apply);
}

export default i18n;
