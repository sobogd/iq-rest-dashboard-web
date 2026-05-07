// Convert between API shapes (server) and UI types (multilingual fields, snake-cased local state).

import type {
 ApiCategory,
 ApiItem,
 ApiTable,
 ApiRestaurant,
 ApiReservation,
 ApiOrder,
 ApiScheduleDay,
} from "./api";
import type {
 Category,
 Dish,
 TableEntity,
 Restaurant,
 Booking,
 Order,
 Ml,
 ReservationSchedule,
} from "./types";
import { normalizeOrderItems } from "./api";
import { getMenuUrl } from "@/lib/menu-url";

export function scheduleFromApi(
 raw: ApiScheduleDay[] | null | undefined,
 fallbackFrom: string,
 fallbackTo: string,
): ReservationSchedule {
 if (Array.isArray(raw) && raw.length === 7) {
  return raw.map((d) => ({
   closed: !!d.closed,
   from: d.from || fallbackFrom,
   to: d.to || fallbackTo,
   lunchFrom: d.lunchFrom || null,
   lunchTo: d.lunchTo || null,
  }));
 }
 // Legacy single-window — open every day with the same hours, no lunch.
 return Array.from({ length: 7 }, () => ({
  closed: false,
  from: fallbackFrom,
  to: fallbackTo,
  lunchFrom: null,
  lunchTo: null,
 }));
}

export function categoryToMl(category: ApiCategory, defaultLang: string): Ml {
 const map: Ml = {};
 map[defaultLang] = category.name || "";
 if (category.translations && typeof category.translations === "object") {
 for (const [lang, value] of Object.entries(category.translations)) {
 if (typeof value === "string") {
 map[lang] = value;
 } else if (value && typeof value === "object" && "name" in value) {
 map[lang] = (value as { name?: string }).name || "";
 }
 }
 }
 return map;
}

interface ItemTranslationEntry {
 name?: string;
 description?: string;
}

export function itemNameMl(item: ApiItem, defaultLang: string): Ml {
 const map: Ml = {};
 map[defaultLang] = item.name || "";
 if (item.translations && typeof item.translations === "object") {
 for (const [lang, value] of Object.entries(item.translations)) {
 if (value && typeof value === "object" && "name" in value) {
 const v = value as ItemTranslationEntry;
 if (v.name !== undefined) map[lang] = v.name;
 }
 }
 }
 return map;
}

export function itemDescriptionMl(item: ApiItem, defaultLang: string): Ml {
 const map: Ml = {};
 map[defaultLang] = item.description || "";
 if (item.translations && typeof item.translations === "object") {
 for (const [lang, value] of Object.entries(item.translations)) {
 if (value && typeof value === "object" && "description" in value) {
 const v = value as ItemTranslationEntry;
 if (v.description !== undefined) map[lang] = v.description;
 }
 }
 }
 return map;
}

// Pack name + description Ml back into the API translations field, dropping the default-lang
// entry (which lives in the top-level name/description columns).
export function buildItemTranslations(
 nameMl: Ml,
 descMl: Ml,
 defaultLang: string,
): Record<string, ItemTranslationEntry> | null {
 const out: Record<string, ItemTranslationEntry> = {};
 const langs = new Set<string>([...Object.keys(nameMl || {}), ...Object.keys(descMl || {})]);
 langs.delete(defaultLang);
 for (const lang of langs) {
 const name = (nameMl?.[lang] || "").trim();
 const description = (descMl?.[lang] || "").trim();
 if (name || description) {
 out[lang] = {};
 if (name) out[lang].name = name;
 if (description) out[lang].description = description;
 }
 }
 return Object.keys(out).length > 0 ? out : null;
}

export function buildCategoryTranslations(
 nameMl: Ml,
 defaultLang: string,
): Record<string, { name: string }> | null {
 const out: Record<string, { name: string }> = {};
 for (const lang of Object.keys(nameMl || {})) {
 if (lang === defaultLang) continue;
 const name = (nameMl[lang] || "").trim();
 if (name) out[lang] = { name };
 }
 return Object.keys(out).length > 0 ? out : null;
}

export function apiCategoryToCategory(
 category: ApiCategory,
 items: ApiItem[],
 defaultLang: string,
): Category {
 const dishes: Dish[] = items
 .filter((i) => i.categoryId === category.id)
 .sort((a, b) => a.sortOrder - b.sortOrder)
 .map((item) => ({
 id: item.id,
 name: itemNameMl(item, defaultLang),
 description: itemDescriptionMl(item, defaultLang),
 price: item.price.toFixed(2),
 visible: item.isActive,
 allergens: item.allergens || [],
 options: item.options || [],
 photoUrl: item.imageUrl || null,
 sortOrder: item.sortOrder,
 categoryId: item.categoryId,
 isExample: item.isExample === true,
 }));
 return {
 id: category.id,
 name: categoryToMl(category, defaultLang),
 sortOrder: category.sortOrder,
 dishes,
 };
}

export function buildCategories(
 apiCategories: ApiCategory[],
 apiItems: ApiItem[],
 defaultLang: string,
): Category[] {
 return [...apiCategories]
 .sort((a, b) => a.sortOrder - b.sortOrder)
 .map((c) => apiCategoryToCategory(c, apiItems, defaultLang));
}

export function apiTableToTable(t: ApiTable): TableEntity {
 return {
 id: t.id,
 number: t.number,
 name: t.zone || "",
 capacity: t.capacity,
 x: typeof t.x === "number" ? t.x : null,
 y: typeof t.y === "number" ? t.y : null,
 photoUrl: t.imageUrl || null,
 sortOrder: t.sortOrder,
 };
}

export function apiRestaurantToRestaurant(r: ApiRestaurant): Restaurant {
 const slug = r.slug || "";
 return {
 id: r.id,
 name: r.title || "",
 subtitle: r.subtitle || "",
 showTitleOnHomepage: !r.hideTitle,
 slug,
 currency: r.currency,
 backgroundUrl: r.source || null,
 // Older rows have backgroundType=null even when source is a video. Sniff
 // the URL extension before falling back to "image".
 backgroundType: ((): "image" | "video" | null => {
 const stored = r.backgroundType as "image" | "video" | null | undefined;
 if (stored === "video" || stored === "image") return stored;
 if (!r.source) return null;
 return /\.(mp4|webm|mov|m4v|ogg|ogv)(\?|$)/i.test(r.source) ? "video" : "image";
 })(),
 accentColor: r.accentColor || "#000000",
 contacts: {
 phone: r.phone || "",
 instagram: r.instagram || "",
 whatsapp: r.whatsapp || "",
 },
 location: {
 address: r.address || "",
 lat: r.y ? parseFloat(r.y) : null,
 lng: r.x ? parseFloat(r.x) : null,
 },
 languages: r.languages?.length ? r.languages : ["en"],
 defaultLang: r.defaultLanguage || "en",
 menuUrl: slug ? getMenuUrl(slug) : "",
 // Legacy: site is treated as published when slug is set.
 published: !!slug,
 bookingSettings: {
 enabled: r.reservationsEnabled,
 approval: (r.reservationMode === "auto" ? "auto" : "manual") as "auto" | "manual",
 duration: r.reservationSlotMinutes,
 schedule: scheduleFromApi(r.reservationSchedule, r.workingHoursStart, r.workingHoursEnd),
 },
 orderSettings: {
 acceptOrders: r.ordersEnabled,
 modes: {
 internal: r.orderMode === "internal" || r.orderMode === "both",
 whatsapp: r.orderMode === "whatsapp" || r.orderMode === "both",
 },
 requiredFields: {
 name: r.orderNameEnabled,
 phone: r.orderPhoneEnabled,
 address: r.orderAddressEnabled,
 },
 },
 subscription: { plan: null, status: null, renewsAt: null },
 };
}

export function apiReservationToBooking(r: ApiReservation): Booking {
 // Combine date (YYYY-MM-DD) + startTime (HH:MM) into ISO datetime.
 const datePart = r.date.includes("T") ? r.date.slice(0, 10) : r.date;
 const dt = new Date(`${datePart}T${r.startTime}:00`);
 const status: Booking["status"] =
 r.status === "confirmed" || r.status === "cancelled" || r.status === "completed"
 ? r.status
 : "pending";
 return {
 id: r.id,
 guestName: r.guestName,
 guestEmail: r.guestEmail,
 guestPhone: r.guestPhone,
 datetime: dt.toISOString(),
 duration: r.duration,
 guests: r.guestsCount,
 tableId: r.tableId,
 status,
 notes: r.notes || "",
 };
}

export function apiOrderToOrder(o: ApiOrder, tablesByNumber: Map<number, string>): Order {
 const items = normalizeOrderItems(o.items);
 const tableId = o.tableNumber !== null ? tablesByNumber.get(o.tableNumber) || null : null;
 let status: Order["status"];
 if (o.status === "completed") status = "completed";
 else if (o.status === "cancelled") status = "cancelled";
 else status = "active";
 return {
 id: o.id,
 tableId,
 tableNumber: o.tableNumber,
 guestName: o.customerName || "",
 createdAt: o.createdAt,
 status,
 items: items.map((it) => ({
 id: it.id,
 dishId: it.dishId,
 dishNameSnapshot: it.dishNameSnapshot,
 basePriceSnapshot: it.basePriceSnapshot,
 options: it.options.map((opt) => ({
 optionName: opt.optionName,
 variantName: opt.variantName,
 priceDelta: opt.priceDelta,
 })),
 notes: it.notes,
 status: it.status,
 createdAt: it.createdAt,
 })),
 total: Number(o.total) || 0,
 };
}
