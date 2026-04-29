/**
 * Generate src/locales/<lang>.json from src/locales/en.json via Gemini.
 *
 * Idempotent at the top-level-key granularity: keys that already exist in a
 * target locale file are skipped, so re-running the script after adding a
 * new English string only translates the new keys.
 *
 * Usage:
 *   GEMINI_API_KEY=... npx tsx scripts/translate-locales.ts            # all langs
 *   GEMINI_API_KEY=... npx tsx scripts/translate-locales.ts de fr it   # subset
 *
 * Notes:
 *  - Source of truth is en.json. Never overwrite values that exist already
 *    in <lang>.json — drop them by hand if you want a re-translation.
 *  - Each top-level key is sent in one Gemini call. The model receives the
 *    SAME shape and must return the same shape with values translated.
 *  - ICU placeholders ({count}, {name}, …) MUST stay verbatim. The system
 *    prompt insists on this; the script also runs a sanity check.
 */

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(import.meta.dirname ?? __dirname, "..");
const SRC = resolve(ROOT, "src/locales/en.json");
const OUT_DIR = resolve(ROOT, "src/locales");

const LANGUAGE_NAMES: Record<string, string> = {
  de: "German", fr: "French", it: "Italian", pt: "Portuguese", nl: "Dutch",
  pl: "Polish", ru: "Russian", uk: "Ukrainian", sv: "Swedish", da: "Danish",
  no: "Norwegian Bokmål", fi: "Finnish", cs: "Czech", el: "Greek", tr: "Turkish",
  ro: "Romanian", hu: "Hungarian", bg: "Bulgarian", hr: "Croatian", sk: "Slovak",
  sl: "Slovenian", et: "Estonian", lv: "Latvian", lt: "Lithuanian", sr: "Serbian (Latin)",
  ca: "Catalan", ga: "Irish", is: "Icelandic", fa: "Persian (Farsi)", ar: "Arabic",
  ja: "Japanese", ko: "Korean", zh: "Simplified Chinese",
};

const ALL_LANGS = Object.keys(LANGUAGE_NAMES);
const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  console.error("GEMINI_API_KEY is required");
  process.exit(1);
}

const argLangs = process.argv.slice(2).filter((s) => !s.startsWith("-"));
const targets = argLangs.length ? argLangs : ALL_LANGS;
const unknown = targets.filter((l) => !LANGUAGE_NAMES[l]);
if (unknown.length) {
  console.error("Unknown locale code(s):", unknown.join(", "));
  process.exit(1);
}

const source = JSON.parse(readFileSync(SRC, "utf8")) as Record<string, unknown>;

function placeholdersOf(s: string): string[] {
  return s.match(/\{[^}]+\}/g)?.sort() ?? [];
}

function placeholdersMatch(en: string, translated: string): boolean {
  const a = placeholdersOf(en);
  const b = placeholdersOf(translated);
  if (a.length !== b.length) return false;
  return a.every((p, i) => p === b[i]);
}

function validateShape(en: unknown, t: unknown, path = ""): string | null {
  if (typeof en === "string") {
    if (typeof t !== "string") return `${path}: expected string`;
    if (!placeholdersMatch(en, t)) return `${path}: placeholder mismatch (en="${en}" / out="${t}")`;
    return null;
  }
  if (Array.isArray(en)) {
    if (!Array.isArray(t)) return `${path}: expected array`;
    if (en.length !== t.length) return `${path}: array length mismatch`;
    for (let i = 0; i < en.length; i++) {
      const err = validateShape(en[i], t[i], `${path}[${i}]`);
      if (err) return err;
    }
    return null;
  }
  if (en && typeof en === "object") {
    if (!t || typeof t !== "object") return `${path}: expected object`;
    const enObj = en as Record<string, unknown>;
    const tObj = t as Record<string, unknown>;
    for (const k of Object.keys(enObj)) {
      if (!(k in tObj)) return `${path}.${k}: key missing`;
      const err = validateShape(enObj[k], tObj[k], `${path}.${k}`);
      if (err) return err;
    }
    return null;
  }
  // numbers, booleans, null — must match exactly
  if (en !== t) return `${path}: primitive mismatch`;
  return null;
}

const SYSTEM_PROMPT = `
You are a professional translator localising the UI of "IQ Rest" — a SaaS
dashboard that lets restaurants and cafés build a QR-code menu, take
reservations, manage orders and analytics.

Translate the provided JSON values from English to {LANG}. RULES:

1. Return STRICT JSON with EXACTLY the same shape (same keys, same nesting,
   same array lengths). Translate VALUES only.
2. Preserve every ICU-style placeholder verbatim — e.g. "{count}", "{name}",
   "{date}". Never translate, reorder, or rename them.
3. Preserve embedded HTML tags (<b>, <a>, <br>, etc.) and href URLs.
4. Preserve newlines (\\n) inside multi-line strings.
5. Translate marketing copy naturally (not word-for-word). It must read like
   it was written by a native speaker, in the tone of a polished SaaS
   product. Keep brand name "IQ Rest" untranslated.
6. For UI labels and button text, prefer SHORT, idiomatic phrasing — do not
   add explanatory clauses that aren't in the source.
7. For form field labels, status pills, table headers — be concise.
8. Numbers, booleans, null values must be returned unchanged.
9. NEVER add commentary, NEVER add markdown code fences. Output raw JSON.
`.trim();

interface GeminiResponse {
  candidates?: { content?: { parts?: { text?: string }[] } }[];
}

async function translateChunk(langName: string, payload: unknown): Promise<unknown> {
  const body = {
    systemInstruction: { parts: [{ text: SYSTEM_PROMPT.replace("{LANG}", langName) }] },
    contents: [
      {
        role: "user",
        parts: [
          {
            text:
              "Translate the values in this JSON object to " +
              langName +
              ". Return the same JSON shape, values translated.\n\n" +
              JSON.stringify(payload, null, 2),
          },
        ],
      },
    ],
    generationConfig: { temperature: 0.2, responseMimeType: "application/json" },
  };

  const res = await fetch(
    "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent",
    {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey! },
      body: JSON.stringify(body),
    },
  );
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Gemini ${res.status}: ${txt.slice(0, 500)}`);
  }
  const data = (await res.json()) as GeminiResponse;
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error("Gemini returned empty response");
  // responseMimeType=application/json should give clean JSON; still defensive.
  const cleaned = text.trim().replace(/^```json\n?/, "").replace(/```$/, "");
  return JSON.parse(cleaned);
}

async function withRetry<T>(label: string, fn: () => Promise<T>, attempts = 3): Promise<T> {
  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (e) {
      lastErr = e;
      const wait = 1000 * Math.pow(2, i);
      console.warn(`  retry ${label} (attempt ${i + 1}/${attempts}, wait ${wait}ms): ${(e as Error).message}`);
      await new Promise((r) => setTimeout(r, wait));
    }
  }
  throw lastErr;
}

async function translateLang(lang: string): Promise<void> {
  const langName = LANGUAGE_NAMES[lang];
  const outPath = resolve(OUT_DIR, `${lang}.json`);
  const existing = existsSync(outPath)
    ? (JSON.parse(readFileSync(outPath, "utf8")) as Record<string, unknown>)
    : {};

  const out: Record<string, unknown> = { ...existing };
  let translatedKeys = 0;

  for (const key of Object.keys(source)) {
    if (key in out) continue; // idempotent
    process.stdout.write(`  ${lang}: ${key} … `);
    try {
      const translated = await withRetry(`${lang}/${key}`, () =>
        translateChunk(langName, { [key]: source[key] }),
      );
      const wrapped = (translated as Record<string, unknown>)[key];
      const err = validateShape(source[key], wrapped, key);
      if (err) {
        console.log(`SHAPE ERR: ${err}`);
        continue;
      }
      out[key] = wrapped;
      translatedKeys++;
      process.stdout.write("ok\n");
      // Periodically persist so a crash doesn't lose work.
      writeFileSync(outPath, JSON.stringify(out, null, 2) + "\n", "utf8");
    } catch (e) {
      console.log(`FAIL: ${(e as Error).message}`);
    }
  }

  writeFileSync(outPath, JSON.stringify(out, null, 2) + "\n", "utf8");
  console.log(`  ${lang}: wrote ${outPath} (translated ${translatedKeys} new keys)`);
}

async function main() {
  console.log(`Translating to ${targets.length} language(s): ${targets.join(", ")}`);
  for (const lang of targets) {
    console.log(`\n=== ${lang} (${LANGUAGE_NAMES[lang]}) ===`);
    try {
      await translateLang(lang);
    } catch (e) {
      console.error(`  ${lang}: FATAL: ${(e as Error).message}`);
    }
  }
  console.log("\nDone.");
}

void main();
