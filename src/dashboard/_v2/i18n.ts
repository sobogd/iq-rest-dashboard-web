// Language config and multilingual helpers.

import type { Ml } from "./types";

export interface LanguageMeta {
 code: string;
 label: string;
 short: string;
 flag: string;
}

// Full list of supported menu languages (matches /messages/*.json).
export const AVAILABLE_LANGUAGES: LanguageMeta[] = [
 { code: "en", label: "English", short: "EN", flag: "🇬🇧" },
 { code: "es", label: "Español", short: "ES", flag: "🇪🇸" },
 { code: "de", label: "Deutsch", short: "DE", flag: "🇩🇪" },
 { code: "fr", label: "Français", short: "FR", flag: "🇫🇷" },
 { code: "it", label: "Italiano", short: "IT", flag: "🇮🇹" },
 { code: "pt", label: "Português", short: "PT", flag: "🇵🇹" },
 { code: "nl", label: "Nederlands", short: "NL", flag: "🇳🇱" },
 { code: "pl", label: "Polski", short: "PL", flag: "🇵🇱" },
 { code: "ru", label: "Русский", short: "RU", flag: "🇷🇺" },
 { code: "uk", label: "Українська", short: "UK", flag: "🇺🇦" },
 { code: "sv", label: "Svenska", short: "SV", flag: "🇸🇪" },
 { code: "da", label: "Dansk", short: "DA", flag: "🇩🇰" },
 { code: "no", label: "Norsk", short: "NO", flag: "🇳🇴" },
 { code: "fi", label: "Suomi", short: "FI", flag: "🇫🇮" },
 { code: "cs", label: "Čeština", short: "CS", flag: "🇨🇿" },
 { code: "el", label: "Ελληνικά", short: "EL", flag: "🇬🇷" },
 { code: "tr", label: "Türkçe", short: "TR", flag: "🇹🇷" },
 { code: "ro", label: "Română", short: "RO", flag: "🇷🇴" },
 { code: "hu", label: "Magyar", short: "HU", flag: "🇭🇺" },
 { code: "bg", label: "Български", short: "BG", flag: "🇧🇬" },
 { code: "hr", label: "Hrvatski", short: "HR", flag: "🇭🇷" },
 { code: "sk", label: "Slovenčina", short: "SK", flag: "🇸🇰" },
 { code: "sl", label: "Slovenščina", short: "SL", flag: "🇸🇮" },
 { code: "et", label: "Eesti", short: "ET", flag: "🇪🇪" },
 { code: "lv", label: "Latviešu", short: "LV", flag: "🇱🇻" },
 { code: "lt", label: "Lietuvių", short: "LT", flag: "🇱🇹" },
 { code: "sr", label: "Српски", short: "SR", flag: "🇷🇸" },
 { code: "ca", label: "Català", short: "CA", flag: "🇪🇸" },
 { code: "ga", label: "Gaeilge", short: "GA", flag: "🇮🇪" },
 { code: "is", label: "Íslenska", short: "IS", flag: "🇮🇸" },
 { code: "fa", label: "فارسی", short: "FA", flag: "🇮🇷" },
 { code: "ar", label: "العربية", short: "AR", flag: "🇸🇦" },
 { code: "ja", label: "日本語", short: "JA", flag: "🇯🇵" },
 { code: "ko", label: "한국어", short: "KO", flag: "🇰🇷" },
 { code: "zh", label: "中文", short: "ZH", flag: "🇨🇳" },
];

export const ALLERGENS: { code: string; label: string }[] = [
 { code: "gluten", label: "Gluten" },
 { code: "lactose", label: "Lactose" },
 { code: "eggs", label: "Eggs" },
 { code: "nuts", label: "Tree nuts" },
 { code: "peanuts", label: "Peanuts" },
 { code: "fish", label: "Fish" },
 { code: "shellfish", label: "Shellfish" },
 { code: "soy", label: "Soy" },
 { code: "sesame", label: "Sesame" },
 { code: "celery", label: "Celery" },
 { code: "mustard", label: "Mustard" },
 { code: "sulfites", label: "Sulfites" },
 { code: "lupin", label: "Lupin" },
 { code: "molluscs", label: "Molluscs" },
];

export function getLanguagesByCodes(codes: string[]): LanguageMeta[] {
 return codes
 .map((c) => AVAILABLE_LANGUAGES.find((l) => l.code === c))
 .filter((l): l is LanguageMeta => !!l);
}

export function getMl(value: Ml | string | null | undefined, lang: string): string {
 if (!value) return "";
 if (typeof value === "string") return value;
 return value[lang] || "";
}

export function getMlWithFallback(
 value: Ml | string | null | undefined,
 lang: string,
 defaultLang = "en",
): string {
 if (!value) return "";
 if (typeof value === "string") return value;
 return (
 value[lang] ||
 value[defaultLang] ||
 Object.values(value).find((v) => v) ||
 ""
 );
}

export function setMl(value: Ml | null | undefined, lang: string, newValue: string): Ml {
 const base = (value && typeof value === "object") ? value : {};
 return { ...base, [lang]: newValue };
}

export function emptyMl(languages: string[]): Ml {
 const obj: Ml = {};
 languages.forEach((code) => {
 obj[code] = "";
 });
 return obj;
}

// Translate text via existing /api/translate endpoint (Gemini-backed).
export async function translateText(
 text: string,
 fromLang: string,
 toLang: string,
): Promise<string> {
 const res = await fetch("/api/translate", {
 method: "POST",
 headers: { "Content-Type": "application/json" },
 body: JSON.stringify({
 text,
 sourceLanguage: fromLang,
 targetLanguage: toLang,
 }),
 });
 if (!res.ok) throw new Error("Translate failed");
 const data = await res.json();
 return (data.translatedText || data.translated || data.text || text) as string;
}
