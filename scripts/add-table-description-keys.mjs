// One-off: add dashboard.tables.{descriptionLabel,descriptionPlaceholder}
// keys to every locale. Hand-authored translations.
import { readFileSync, writeFileSync, readdirSync } from "fs";
import { resolve, join } from "path";

// Order: descriptionLabel, descriptionPlaceholder
const TRANSLATIONS = {
  ar: ["الوصف", "ملاحظة قصيرة عن هذه الطاولة"],
  bg: ["Описание", "Кратка бележка за тази маса"],
  ca: ["Descripció", "Una nota breu sobre aquesta taula"],
  cs: ["Popis", "Krátká poznámka o tomto stole"],
  da: ["Beskrivelse", "En kort note om dette bord"],
  de: ["Beschreibung", "Eine kurze Notiz zu diesem Tisch"],
  el: ["Περιγραφή", "Μια σύντομη σημείωση για αυτό το τραπέζι"],
  en: ["Description", "A short note about this table"],
  es: ["Descripción", "Una nota breve sobre esta mesa"],
  et: ["Kirjeldus", "Lühike märkus selle laua kohta"],
  fa: ["توضیحات", "یادداشتی کوتاه درباره این میز"],
  fi: ["Kuvaus", "Lyhyt huomautus tästä pöydästä"],
  fr: ["Description", "Une courte note sur cette table"],
  ga: ["Cur síos", "Nóta gairid faoin mbord seo"],
  hr: ["Opis", "Kratka bilješka o ovom stolu"],
  hu: ["Leírás", "Rövid megjegyzés erről az asztalról"],
  is: ["Lýsing", "Stutt athugasemd um þetta borð"],
  it: ["Descrizione", "Una breve nota su questo tavolo"],
  ja: ["説明", "このテーブルについての短いメモ"],
  ko: ["설명", "이 테이블에 대한 짧은 메모"],
  lt: ["Aprašymas", "Trumpa pastaba apie šį stalą"],
  lv: ["Apraksts", "Īsa piezīme par šo galdu"],
  nl: ["Beschrijving", "Een korte notitie over deze tafel"],
  no: ["Beskrivelse", "En kort notis om dette bordet"],
  pl: ["Opis", "Krótka notatka o tym stoliku"],
  pt: ["Descrição", "Uma nota breve sobre esta mesa"],
  ro: ["Descriere", "O scurtă notă despre această masă"],
  ru: ["Описание", "Краткая заметка об этом столике"],
  sk: ["Popis", "Krátka poznámka o tomto stole"],
  sl: ["Opis", "Kratka opomba o tej mizi"],
  sr: ["Опис", "Кратка белешка о овом столу"],
  sv: ["Beskrivning", "En kort anteckning om detta bord"],
  tr: ["Açıklama", "Bu masa hakkında kısa bir not"],
  uk: ["Опис", "Коротка нотатка про цей столик"],
  zh: ["描述", "关于这张桌子的简短说明"],
};

const dir = resolve(import.meta.dirname, "..", "src", "locales");
const files = readdirSync(dir).filter((f) => f.endsWith(".json"));
let touched = 0;
for (const f of files) {
  const code = f.replace(/\.json$/, "");
  const t = TRANSLATIONS[code];
  if (!t) { console.log(`skip ${code} — no translation`); continue; }
  const path = join(dir, f);
  const data = JSON.parse(readFileSync(path, "utf8"));
  const tables = data?.dashboard?.tables;
  if (!tables || typeof tables !== "object") { console.log(`skip ${code} — no dashboard.tables`); continue; }
  if (tables.descriptionLabel && tables.descriptionPlaceholder) { console.log(`skip ${code} — already present`); continue; }
  tables.descriptionLabel = t[0];
  tables.descriptionPlaceholder = t[1];
  writeFileSync(path, JSON.stringify(data, null, 2) + "\n");
  touched++;
  console.log(`patched ${code}`);
}
console.log(`\nTotal: ${touched} files`);
