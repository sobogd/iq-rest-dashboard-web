export type DietCode =
  | "vegan"
  | "vegetarian"
  | "pescatarian"
  | "gluten_free"
  | "lactose_free"
  | "nut_free"
  | "sugar_free"
  | "low_carb"
  | "keto"
  | "halal"
  | "kosher"
  | "spicy"
  | "organic";

export interface Diet {
  code: DietCode;
}

export const DIETS: Diet[] = [
  { code: "vegan" },
  { code: "vegetarian" },
  { code: "pescatarian" },
  { code: "gluten_free" },
  { code: "lactose_free" },
  { code: "nut_free" },
  { code: "sugar_free" },
  { code: "low_carb" },
  { code: "keto" },
  { code: "halal" },
  { code: "kosher" },
  { code: "spicy" },
  { code: "organic" },
];

export const DIET_CODES: DietCode[] = DIETS.map((d) => d.code);

export const DIETS_SET = new Set<string>(DIET_CODES);

export function isDietCode(code: string): code is DietCode {
  return DIETS_SET.has(code);
}
