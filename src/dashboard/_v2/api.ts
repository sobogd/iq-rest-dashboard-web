// API client for the new dashboard. Thin wrappers over fetch with typed return shapes.

import type { Ml, DishOption } from "./types";
import { apiUrl } from "@/lib/api";
// (Ml retained for OrderItem option snapshots even though categories/items use richer shapes.)

// ── Restaurant ──

export interface ApiRestaurant {
 id: string;
 title: string;
 subtitle: string | null;
 description: string | null;
 slug: string | null;
 currency: string;
 source: string | null;
 backgroundType: string | null;
 accentColor: string;
 address: string | null;
 x: string | null;
 y: string | null;
 phone: string | null;
 instagram: string | null;
 whatsapp: string | null;
 languages: string[];
 defaultLanguage: string;
 hideTitle: boolean;
 reservationsEnabled: boolean;
 reservationMode: string;
 reservationSlotMinutes: number;
 workingHoursStart: string;
 workingHoursEnd: string;
 ordersEnabled: boolean;
 orderNameEnabled: boolean;
 orderPhoneEnabled: boolean;
 orderAddressEnabled: boolean;
 orderMode: string;
 scanBannerDismissed?: boolean;
}

export async function fetchRestaurant(): Promise<ApiRestaurant | null> {
 const res = await fetch(apiUrl("/api/restaurant"), {
        credentials: "include", cache: "no-store" });
 if (!res.ok) return null;
 return (await res.json()) as ApiRestaurant;
}

export async function updateRestaurant(
 patch: Partial<ApiRestaurant> & { source?: string | null },
): Promise<ApiRestaurant> {
 const res = await fetch(apiUrl("/api/restaurant"), {
        credentials: "include",
 method: "POST",
 headers: { "Content-Type": "application/json" },
 body: JSON.stringify(patch),
 });
 if (!res.ok) throw new Error("Failed to save restaurant");
 return (await res.json()) as ApiRestaurant;
}

export async function updateRestaurantLanguages(
 languages: string[],
 defaultLanguage: string,
): Promise<ApiRestaurant> {
 const res = await fetch(apiUrl("/api/restaurant/languages"), {
        credentials: "include",
 method: "PUT",
 headers: { "Content-Type": "application/json" },
 body: JSON.stringify({ languages, defaultLanguage }),
 });
 if (!res.ok) throw new Error("Failed to update languages");
 return (await res.json()) as ApiRestaurant;
}

export async function dismissScanBanner(): Promise<void> {
 await fetch(apiUrl("/api/restaurant/dismiss-scan-banner"), {
  credentials: "include",
  method: "POST",
 });
}

// ── Scan menu ──

export interface ScanMenuItem {
 name: string;
 price: number;
 description?: string;
}
export interface ScanMenuCategory {
 name: string;
 items: ScanMenuItem[];
}

export async function scanMenuParse(images: string[]): Promise<{
 ok: true;
 categories: ScanMenuCategory[];
} | { ok: false; error: string }> {
 const res = await fetch(apiUrl("/api/scan-menu/parse"), {
  credentials: "include",
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ images }),
 });
 if (!res.ok) {
  const data: { message?: string } = await res.json().catch(() => ({}));
  return { ok: false, error: data.message ?? `HTTP ${res.status}` };
 }
 const data = (await res.json()) as { categories: ScanMenuCategory[] };
 return { ok: true, categories: data.categories };
}

export async function scanMenuSave(
 categories: ScanMenuCategory[],
 replaceExisting: boolean,
): Promise<{ ok: true; categoriesCount: number; itemsCount: number } | { ok: false; error: string }> {
 const res = await fetch(apiUrl("/api/scan-menu/save"), {
  credentials: "include",
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ categories, replaceExisting }),
 });
 if (!res.ok) {
  const data: { message?: string } = await res.json().catch(() => ({}));
  return { ok: false, error: data.message ?? `HTTP ${res.status}` };
 }
 const data = (await res.json()) as { categoriesCount: number; itemsCount: number };
 return { ok: true, categoriesCount: data.categoriesCount, itemsCount: data.itemsCount };
}

// ── Categories ──

// Server stores category translations as { [lang]: { name } } JSON.
export type CategoryTranslations = Record<string, { name: string }> | null;

export interface ApiCategory {
 id: string;
 name: string;
 translations: CategoryTranslations;
 sortOrder: number;
 isActive: boolean;
}

export async function fetchCategories(): Promise<ApiCategory[]> {
 const res = await fetch(apiUrl("/api/categories"), {
        credentials: "include", cache: "no-store" });
 if (!res.ok) return [];
 return (await res.json()) as ApiCategory[];
}

export async function createCategory(payload: {
 name: string;
 translations?: CategoryTranslations;
 isActive?: boolean;
}): Promise<ApiCategory> {
 const res = await fetch(apiUrl("/api/categories"), {
        credentials: "include",
 method: "POST",
 headers: { "Content-Type": "application/json" },
 body: JSON.stringify(payload),
 });
 if (!res.ok) throw new Error("Failed to create category");
 return (await res.json()) as ApiCategory;
}

export async function updateCategory(
 id: string,
 payload: { name: string; translations?: CategoryTranslations; isActive?: boolean; sortOrder?: number },
): Promise<ApiCategory> {
 const res = await fetch(apiUrl(`/api/categories/${id}`), {
        credentials: "include",
 method: "PUT",
 headers: { "Content-Type": "application/json" },
 body: JSON.stringify(payload),
 });
 if (!res.ok) throw new Error("Failed to update category");
 return (await res.json()) as ApiCategory;
}

export async function deleteCategory(id: string): Promise<void> {
 const res = await fetch(apiUrl(`/api/categories/${id}`), {
        credentials: "include", method: "DELETE" });
 if (!res.ok) throw new Error("Failed to delete category");
}

export async function reorderCategories(
 items: { id: string; sortOrder: number }[],
): Promise<ApiCategory[]> {
 const res = await fetch(apiUrl("/api/categories/reorder"), {
        credentials: "include",
 method: "POST",
 headers: { "Content-Type": "application/json" },
 body: JSON.stringify({ items }),
 });
 if (!res.ok) throw new Error("Failed to reorder categories");
 return (await res.json()) as ApiCategory[];
}

// ── Items ──

// Server stores item translations as { [lang]: { name?, description? } } JSON.
export type ItemTranslations = Record<string, { name?: string; description?: string }> | null;

export interface ApiItem {
 id: string;
 name: string;
 description: string | null;
 translations: ItemTranslations;
 price: number;
 imageUrl: string | null;
 allergens: string[];
 options: DishOption[] | null;
 sortOrder: number;
 isActive: boolean;
 isExample?: boolean;
 categoryId: string;
}

export async function fetchItems(): Promise<ApiItem[]> {
 const res = await fetch(apiUrl("/api/items"), {
        credentials: "include", cache: "no-store" });
 if (!res.ok) return [];
 return (await res.json()) as ApiItem[];
}

export async function createItem(payload: {
 name: string;
 description?: string | null;
 price: number;
 imageUrl?: string | null;
 categoryId: string;
 isActive?: boolean;
 translations?: ItemTranslations;
 allergens?: string[];
 options?: DishOption[] | null;
}): Promise<ApiItem> {
 const res = await fetch(apiUrl("/api/items"), {
        credentials: "include",
 method: "POST",
 headers: { "Content-Type": "application/json" },
 body: JSON.stringify(payload),
 });
 if (!res.ok) throw new Error("Failed to create item");
 return (await res.json()) as ApiItem;
}

export async function updateItem(
 id: string,
 payload: {
 name: string;
 description?: string | null;
 price: number;
 imageUrl?: string | null;
 categoryId: string;
 isActive?: boolean;
 translations?: ItemTranslations;
 allergens?: string[];
 options?: DishOption[] | null;
 sortOrder?: number;
 },
): Promise<ApiItem> {
 const res = await fetch(apiUrl(`/api/items/${id}`), {
        credentials: "include",
 method: "PUT",
 headers: { "Content-Type": "application/json" },
 body: JSON.stringify(payload),
 });
 if (!res.ok) throw new Error("Failed to update item");
 return (await res.json()) as ApiItem;
}

export async function patchItem(
 id: string,
 payload: { isActive?: boolean },
): Promise<ApiItem> {
 const res = await fetch(apiUrl(`/api/items/${id}`), {
        credentials: "include",
 method: "PATCH",
 headers: { "Content-Type": "application/json" },
 body: JSON.stringify(payload),
 });
 if (!res.ok) throw new Error("Failed to update item");
 return (await res.json()) as ApiItem;
}

export async function deleteItem(id: string): Promise<void> {
 const res = await fetch(apiUrl(`/api/items/${id}`), {
        credentials: "include", method: "DELETE" });
 if (!res.ok) throw new Error("Failed to delete item");
}

export interface ReorderSwap {
 id: string;
 sortOrder: number;
}

export async function reorderItem(
 itemId: string,
 direction: "up" | "down",
): Promise<ReorderSwap[]> {
 const res = await fetch(apiUrl("/api/items/reorder"), {
        credentials: "include",
 method: "POST",
 headers: { "Content-Type": "application/json" },
 body: JSON.stringify({ itemId, direction }),
 });
 if (!res.ok) throw new Error("Failed to reorder item");
 const data = await res.json();
 // New API returns { swapped: [{id, sortOrder}, ...] }. Tolerate the legacy
 // full-list shape too in case an old API is deployed.
 if (Array.isArray(data)) {
  return (data as ApiItem[]).map((it) => ({ id: it.id, sortOrder: it.sortOrder }));
 }
 if (data && Array.isArray(data.swapped)) return data.swapped as ReorderSwap[];
 return [];
}

// ── Tables ──

export interface ApiTable {
 id: string;
 number: number;
 capacity: number;
 zone: string | null;
 imageUrl: string | null;
 x: number | null;
 y: number | null;
 isActive: boolean;
 sortOrder: number;
}

export async function fetchTables(): Promise<ApiTable[]> {
 const res = await fetch(apiUrl("/api/tables"), {
        credentials: "include", cache: "no-store" });
 if (!res.ok) return [];
 return (await res.json()) as ApiTable[];
}

export async function createTable(payload: {
 number: number;
 capacity: number;
 zone?: string | null;
 imageUrl?: string | null;
 x?: number | null;
 y?: number | null;
}): Promise<ApiTable> {
 const res = await fetch(apiUrl("/api/tables"), {
        credentials: "include",
 method: "POST",
 headers: { "Content-Type": "application/json" },
 body: JSON.stringify(payload),
 });
 if (!res.ok) throw new Error("Failed to create table");
 return (await res.json()) as ApiTable;
}

export async function updateTable(
 id: string,
 payload: Partial<ApiTable>,
): Promise<ApiTable> {
 const res = await fetch(apiUrl(`/api/tables/${id}`), {
        credentials: "include",
 method: "PUT",
 headers: { "Content-Type": "application/json" },
 body: JSON.stringify(payload),
 });
 if (!res.ok) throw new Error("Failed to update table");
 return (await res.json()) as ApiTable;
}

export async function deleteTable(id: string): Promise<void> {
 const res = await fetch(apiUrl(`/api/tables/${id}`), {
        credentials: "include", method: "DELETE" });
 if (!res.ok) throw new Error("Failed to delete table");
}

// ── Reservations ──

export interface ApiReservation {
 id: string;
 date: string;
 startTime: string;
 duration: number;
 guestName: string;
 guestEmail: string;
 guestPhone: string | null;
 guestsCount: number;
 status: string;
 notes: string | null;
 tableId: string;
 table: { number: number; zone: string | null };
}

export async function fetchReservations(): Promise<ApiReservation[]> {
 const res = await fetch(apiUrl("/api/reservations"), {
        credentials: "include", cache: "no-store" });
 if (!res.ok) return [];
 return (await res.json()) as ApiReservation[];
}

export async function patchReservation(
 id: string,
 payload: { status?: string; notes?: string | null },
): Promise<ApiReservation> {
 const res = await fetch(apiUrl(`/api/reservations/${id}`), {
        credentials: "include",
 method: "PATCH",
 headers: { "Content-Type": "application/json" },
 body: JSON.stringify(payload),
 });
 if (!res.ok) throw new Error("Failed to update reservation");
 return (await res.json()) as ApiReservation;
}

// ── Orders ──

export interface ApiOrderItem {
 id: string;
 dishId: string;
 dishNameSnapshot: Ml;
 basePriceSnapshot: string;
 options: { optionName: Ml; variantName: Ml; priceDelta: string }[];
 notes: string;
 status: "pending" | "cooking" | "ready" | "served";
 createdAt: string;
}

export interface ApiOrder {
 id: string;
 restaurantId: string;
 companyId: string;
 items: ApiOrderItem[];
 total: number;
 currency: string;
 customerName: string | null;
 customerPhone: string | null;
 customerAddress: string | null;
 comment: string | null;
 tableNumber: number | null;
 status: string;
 createdAt: string;
 updatedAt: string;
}

export async function fetchOrders(status?: string): Promise<ApiOrder[]> {
 const path = status ? `/api/orders?status=${encodeURIComponent(status)}` : "/api/orders";
 const res = await fetch(apiUrl(path), { credentials: "include", cache: "no-store" });
 if (!res.ok) return [];
 return (await res.json()) as ApiOrder[];
}

export async function createOrder(payload: {
 tableNumber?: number | null;
 items?: unknown[];
 total?: number;
 customerName?: string | null;
}): Promise<ApiOrder> {
 const res = await fetch(apiUrl("/api/orders"), {
        credentials: "include",
 method: "POST",
 headers: { "Content-Type": "application/json" },
 body: JSON.stringify(payload),
 });
 if (!res.ok) throw new Error("Failed to create order");
 return (await res.json()) as ApiOrder;
}

export async function patchOrder(
 id: string,
 payload: { status?: string; items?: ApiOrderItem[]; total?: number },
): Promise<ApiOrder> {
 const res = await fetch(apiUrl(`/api/orders/${id}`), {
        credentials: "include",
 method: "PATCH",
 headers: { "Content-Type": "application/json" },
 body: JSON.stringify(payload),
 });
 if (!res.ok) throw new Error("Failed to update order");
 return (await res.json()) as ApiOrder;
}

export async function deleteOrder(id: string): Promise<void> {
 const res = await fetch(apiUrl(`/api/orders/${id}`), {
        credentials: "include", method: "DELETE" });
 if (!res.ok) throw new Error("Failed to delete order");
}

// ── Support ──

export interface ApiSupportMessage {
 id: string;
 message: string;
 isAdmin: boolean;
 createdAt: string;
}

export async function fetchSupportMessages(): Promise<ApiSupportMessage[]> {
 const res = await fetch(apiUrl("/api/support/messages"), {
        credentials: "include", cache: "no-store" });
 if (!res.ok) return [];
 return (await res.json()) as ApiSupportMessage[];
}

export async function sendSupportMessage(message: string): Promise<ApiSupportMessage> {
 const res = await fetch(apiUrl("/api/support/messages"), {
        credentials: "include",
 method: "POST",
 headers: { "Content-Type": "application/json" },
 body: JSON.stringify({ message }),
 });
 if (!res.ok) throw new Error("Failed to send message");
 return (await res.json()) as ApiSupportMessage;
}

// ── Subscription / Stripe ──

export async function fetchSubscriptionStatus(): Promise<{
 plan: string | null;
 subscriptionStatus: string | null;
 currentPeriodEnd: string | null;
 billingCycle: string | null;
 trialEndsAt: string | null;
} | null> {
 const res = await fetch(apiUrl("/api/restaurant/subscription"), {
        credentials: "include", cache: "no-store" });
 if (!res.ok) return null;
 return await res.json();
}

export async function createCheckoutSession(
 plan: "BASIC" | "PRO",
 cycle: "MONTHLY" | "YEARLY",
 currency?: string,
): Promise<string | null> {
 const priceLookupKey = cycle === "YEARLY" ? "basic_yearly" : "basic_monthly";
 const locale = typeof window !== "undefined" ? (window.location.pathname.match(/^\/([a-z]{2})\b/)?.[1] || "en") : "en";
 const res = await fetch(apiUrl("/api/stripe/checkout"), {
        credentials: "include",
 method: "POST",
 headers: { "Content-Type": "application/json" },
 body: JSON.stringify({ priceLookupKey, locale, currency }),
 });
 if (!res.ok) {
 const text = await res.text().catch(() => "");
 console.error("Checkout error:", res.status, text);
 return null;
 }
 const data = await res.json();
 return data.url || null;
}

export async function openBillingPortal(locale?: string): Promise<string | null> {
 const res = await fetch(apiUrl("/api/stripe/portal"), {
        credentials: "include",
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locale: locale || "en" }) });
 if (!res.ok) return null;
 const data = await res.json();
 return data.url || null;
}

// ── Logout ──

export async function logout(): Promise<void> {
 await fetch(apiUrl("/api/auth/logout"), {
        credentials: "include", method: "POST" });
}

// ── Order serialization helpers (kitchen + orders pages) ──
//
// Server stores Order.items as a JSON array on the row. We extend each item with a
// per-item kitchen status and option snapshots client-side, persisting via PATCH /orders/[id].

export function normalizeOrderItems(items: unknown): ApiOrderItem[] {
 if (!Array.isArray(items)) return [];
 return items
 .filter((x): x is Record<string, unknown> => typeof x === "object" && x !== null)
 .map((raw, idx) => {
 const r = raw as Record<string, unknown>;
 const id = typeof r.id === "string" ? r.id : `it_${idx}_${Date.now()}`;
 const status = (r.status as ApiOrderItem["status"]) || "pending";
 return {
 id,
 dishId: typeof r.dishId === "string" ? r.dishId : "",
 dishNameSnapshot: (r.dishNameSnapshot as Ml) || {},
 basePriceSnapshot: typeof r.basePriceSnapshot === "string"
 ? r.basePriceSnapshot
 : String(r.basePriceSnapshot ?? "0"),
 options: Array.isArray(r.options) ? (r.options as ApiOrderItem["options"]) : [],
 notes: typeof r.notes === "string" ? r.notes : "",
 status,
 createdAt: typeof r.createdAt === "string" ? r.createdAt : new Date().toISOString(),
 };
 });
}
