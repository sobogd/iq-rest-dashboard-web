export const CUISINE_KEYS = [
  "pizza",
  "sushi",
  "asian",
  "burger",
  "coffee",
  "bar",
  "bakery",
  "restaurant",
] as const;

export type CuisineKey = (typeof CUISINE_KEYS)[number];

export function isCuisineKey(value: unknown): value is CuisineKey {
  return typeof value === "string" && (CUISINE_KEYS as readonly string[]).includes(value);
}

// Chip metadata. Labels are i18n keys under "createFlow.cuisine.<key>".
export const CUISINE_META: Record<CuisineKey, { emoji: string }> = {
  pizza: { emoji: "🍕" },
  sushi: { emoji: "🍣" },
  asian: { emoji: "🍜" },
  burger: { emoji: "🍔" },
  coffee: { emoji: "☕" },
  bar: { emoji: "🍺" },
  bakery: { emoji: "🥐" },
  restaurant: { emoji: "🍽️" },
};
