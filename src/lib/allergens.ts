/**
 * EU 14 Major Food Allergens
 * Based on EU Regulation No. 1169/2011
 */

export type AllergenCode =
  | "gluten"
  | "crustaceans"
  | "eggs"
  | "fish"
  | "peanuts"
  | "soybeans"
  | "dairy"
  | "nuts"
  | "celery"
  | "mustard"
  | "sesame"
  | "sulphites"
  | "lupin"
  | "molluscs";

export interface Allergen {
  code: AllergenCode;
  icon: string;
}

export const ALLERGENS: Allergen[] = [
  { code: "gluten", icon: "🌾" },
  { code: "crustaceans", icon: "🦐" },
  { code: "eggs", icon: "🥚" },
  { code: "fish", icon: "🐟" },
  { code: "peanuts", icon: "🥜" },
  { code: "soybeans", icon: "🫘" },
  { code: "dairy", icon: "🥛" },
  { code: "nuts", icon: "🌰" },
  { code: "celery", icon: "🥬" },
  { code: "mustard", icon: "🟡" },
  { code: "sesame", icon: "⚪" },
  { code: "sulphites", icon: "🍷" },
  { code: "lupin", icon: "🌸" },
  { code: "molluscs", icon: "🦪" },
];

export const ALLERGENS_MAP = new Map<AllergenCode, Allergen>(
  ALLERGENS.map((a) => [a.code, a])
);

export function getAllergenByCode(code: string): Allergen | undefined {
  return ALLERGENS_MAP.get(code as AllergenCode);
}

export function getAllergenIcon(code: string): string {
  return getAllergenByCode(code)?.icon ?? "⚠️";
}
