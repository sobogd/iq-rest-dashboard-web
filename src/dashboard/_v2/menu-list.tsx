"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { useFlip } from "./use-flip";
import { Collapsible } from "./collapsible";
import { useDashboardRouter } from "../_spa/router";
import {
 ArrowDownIcon,
 ArrowUpIcon,
 ChevronDownIcon,
 ClockIcon,
 CollapseIcon,
 EditIcon,
 ExpandIcon,
 EyeIcon,
 EyeOffIcon,
 PlusIcon,
 SparklesIcon,
} from "./icons";
import { EmptyState, PreviewButton, ShareButton, ShareModal, SubscriptionChip } from "./ui";
import { iconBtn, primaryBtn } from "./tokens";
import { getMlWithFallback } from "./i18n";
import { currencySymbolOf, moveItem } from "./helpers";
import { dismissScanBanner, fetchSubscriptionStatus, patchItem, reorderCategories, reorderItemsBulk } from "./api";
import { useRestaurant } from "./restaurant-context";
import type { Category, Dish } from "./types";
import { track } from "@/lib/dashboard-events";
import { MenuOnboarding } from "./menu-onboarding";
import { ScanModal } from "./scan-modal";

interface SubData {
 plan: string | null;
 subscriptionStatus: string | null;
 trialEndsAt: string | null;
}

export function MenuList({
 initialCategories,
 initialSub = null,
 onPersisted,
 scanBannerDismissed = false,
}: {
 initialCategories: Category[];
 initialSub?: SubData | null;
 onPersisted?: () => void;
 scanBannerDismissed?: boolean;
}) {
 const t = useTranslations("dashboard.menu");
 const tsub = useTranslations("dashboard.subscriptionChip");
 const tBilling = useTranslations("dashboard.settings.billing");
 const restaurant = useRestaurant();
 const router = useDashboardRouter();
 const { defaultLang, currency, menuUrl } = restaurant;
 const currencySymbol = currencySymbolOf(currency);

 const [categories, setCategories] = useState<Category[]>(initialCategories);
 const categoriesFlipRef = useFlip<HTMLDivElement>([categories.map((c) => c.id).join(",")]);
 // Persist menu UI state (open categories + scroll position) across
 // navigations to the item / category edit pages. sessionStorage so it
 // resets per tab.
 const STATE_KEY = "dash_menu_list_state_v1";
 const [openIds, setOpenIds] = useState<Record<string, boolean>>(() => {
 try {
 const saved = JSON.parse(sessionStorage.getItem(STATE_KEY) || "{}");
 if (saved && typeof saved.openIds === "object" && saved.openIds) return saved.openIds;
 } catch {
 // ignore corrupt JSON
 }
 const map: Record<string, boolean> = {};
 initialCategories.forEach((c) => {
 map[c.id] = true;
 });
 return map;
 });
 const [shareOpen, setShareOpen] = useState(false);
 const [sub, setSub] = useState<SubData | null>(initialSub);
 const [bannerLocallyDismissed, setBannerLocallyDismissed] = useState(scanBannerDismissed);
 const [scanModalOpen, setScanModalOpen] = useState(false);
 const TRIAL_DISMISS_KEY = "dash_trial_banner_dismissed_until";
 const [trialDismissedUntil, setTrialDismissedUntil] = useState<number>(() => {
 try {
 const raw = localStorage.getItem(TRIAL_DISMISS_KEY);
 return raw ? Number(raw) || 0 : 0;
 } catch {
 return 0;
 }
 });
 function dismissTrialBanner() {
 track("dash_trial_banner_dismiss");
 const until = Date.now() + 86400_000;
 try { localStorage.setItem(TRIAL_DISMISS_KEY, String(until)); } catch { /* ignore */ }
 setTrialDismissedUntil(until);
 }

 const existingRealItemsCount = categories.reduce(
  (sum, c) => sum + c.dishes.filter((d) => !d.isExample).length,
  0,
 );

 // Always show when the menu is empty (no categories at all),
 // otherwise honour the per-restaurant dismissed flag.
 const noCategories = categories.length === 0;
 const scanBannerVisible = noCategories || !bannerLocallyDismissed;

 async function handleDismissBanner() {
  track("dash_scan_banner_dismiss");
  setBannerLocallyDismissed(true);
  try {
   await dismissScanBanner();
  } catch {
   // ignore — UI already hidden
  }
 }

 useEffect(() => {
 if (!initialSub) {
 fetchSubscriptionStatus().then((s) => {
 if (s) setSub({ plan: s.plan, subscriptionStatus: s.subscriptionStatus, trialEndsAt: s.trialEndsAt });
 });
 }
 }, [initialSub]);

 // Persist openIds whenever they change.
 useEffect(() => {
 try {
 const prev = JSON.parse(sessionStorage.getItem(STATE_KEY) || "{}");
 sessionStorage.setItem(STATE_KEY, JSON.stringify({ ...prev, openIds }));
 } catch {
 // sessionStorage might be disabled; OK to drop persistence.
 }
 }, [openIds]);

 // Restore window scroll on mount, then continuously persist scrollY on
 // scroll. Continuous-save (rather than save-on-unmount) is required
 // because the SPA router scrolls the window to 0 on push() *before*
 // React unmounts this component — by the time our cleanup fires, the
 // saved scrollY would already be 0.
 useLayoutEffect(() => {
 let saved: { scrollY?: number } = {};
 try { saved = JSON.parse(sessionStorage.getItem(STATE_KEY) || "{}"); } catch { /* ignore */ }
 if (typeof saved.scrollY === "number") {
 // Defer to next frame so list rows have committed full layout, otherwise
 // the page is still short and scrollTo clamps to a smaller value.
 requestAnimationFrame(() => window.scrollTo(0, saved.scrollY!));
 }
 let last = 0;
 let pending = false;
 const onScroll = () => {
 last = window.scrollY;
 if (pending) return;
 pending = true;
 requestAnimationFrame(() => {
 pending = false;
 try {
 const prev = JSON.parse(sessionStorage.getItem(STATE_KEY) || "{}");
 sessionStorage.setItem(STATE_KEY, JSON.stringify({ ...prev, scrollY: last }));
 } catch { /* ignore */ }
 });
 };
 window.addEventListener("scroll", onScroll, { passive: true });
 return () => window.removeEventListener("scroll", onScroll);
 }, []);

 useEffect(() => {
 setCategories(initialCategories);
 setOpenIds((prev) => {
 let changed = false;
 const next = { ...prev };
 initialCategories.forEach((c) => {
 if (!(c.id in next)) {
 next[c.id] = true;
 changed = true;
 }
 });
 return changed ? next : prev;
 });
 }, [initialCategories]);

 const anyOpen = categories.length > 0 && categories.some((c) => openIds[c.id]);

 function toggleCategory(id: string) {
 setOpenIds((p) => {
 const next = !p[id];
 track(next ? "dash_menu_category_expand" : "dash_menu_category_collapse");
 return { ...p, [id]: next };
 });
 }
 function expandAll() {
 track("dash_menu_expand");
 const map: Record<string, boolean> = {};
 categories.forEach((c) => {
 map[c.id] = true;
 });
 setOpenIds(map);
 }
 function collapseAll() {
 track("dash_menu_collapse");
 // Set false explicitly per id rather than {} — otherwise the
 // initialCategories effect below treats missing ids as "new" and
 // re-opens every category after the next data refresh
 // (e.g. after moveCategory fires onPersisted).
 const map: Record<string, boolean> = {};
 categories.forEach((c) => {
 map[c.id] = false;
 });
 setOpenIds(map);
 }

 // ── Race-safe writes via AbortController ─────────────────────────────────
 //
 // Each rapid click cancels the previous in-flight request for the same
 // resource and fires a fresh one with the latest desired state. The server
 // sees only one live operation per resource (per-dish for visibility,
 // per-category for dish reorder, single for category reorder). PATCH/bulk
 // endpoints are idempotent — last-arriving response is the authoritative
 // state. AbortError is silently ignored (request superseded by user).
 const catReorderAborterRef = useRef<AbortController | null>(null);
 const dishReorderAbortersRef = useRef<Map<string, AbortController>>(new Map());
 const visibilityAbortersRef = useRef<Map<string, AbortController>>(new Map());
 const visibilityOriginalRef = useRef<Map<string, { visible: boolean; categoryId: string }>>(new Map());

 useEffect(() => () => {
 catReorderAborterRef.current?.abort();
 dishReorderAbortersRef.current.forEach((ac) => ac.abort());
 visibilityAbortersRef.current.forEach((ac) => ac.abort());
 }, []);

 const isAbort = (e: unknown) => (e as { name?: string } | null)?.name === "AbortError";

 async function moveCategory(idx: number, dir: number) {
 track(dir < 0 ? "dash_menu_category_sort_up" : "dash_menu_category_sort_down");
 const next = moveItem(categories, idx, dir);
 setCategories(next);
 catReorderAborterRef.current?.abort();
 const ac = new AbortController();
 catReorderAborterRef.current = ac;
 try {
 await reorderCategories(next.map((c, i) => ({ id: c.id, sortOrder: i })), ac.signal);
 // No onPersisted refetch — local optimistic state is authoritative.
 // A refetch here would race with concurrent ops and overwrite newer
 // local state with a stale server snapshot.
 } catch (e) {
 if (isAbort(e)) return;
 // Server failed — local state stays optimistic.
 }
 }

 async function moveDish(categoryId: string, idx: number, dir: number) {
 track(dir < 0 ? "dash_menu_item_sort_up" : "dash_menu_item_sort_down");
 const cat = categories.find((c) => c.id === categoryId);
 if (!cat) return;
 const reordered = moveItem(cat.dishes, idx, dir);
 setCategories((cats) =>
 cats.map((c) => (c.id === categoryId ? { ...c, dishes: reordered } : c)),
 );
 dishReorderAbortersRef.current.get(categoryId)?.abort();
 const ac = new AbortController();
 dishReorderAbortersRef.current.set(categoryId, ac);
 try {
 await reorderItemsBulk(reordered.map((d, i) => ({ id: d.id, sortOrder: i })), ac.signal);
 } catch (e) {
 if (isAbort(e)) return;
 }
 }

 async function toggleDishVisible(categoryId: string, dishId: string) {
 track("dash_menu_item_click");
 const cat = categories.find((c) => c.id === categoryId);
 const dish = cat?.dishes.find((d) => d.id === dishId);
 if (!dish) return;
 const nextVisible = !dish.visible;
 // Capture original (pre-burst) state once per dish for revert-on-error.
 if (!visibilityOriginalRef.current.has(dishId)) {
 visibilityOriginalRef.current.set(dishId, { visible: dish.visible, categoryId });
 }
 setCategories((cats) =>
 cats.map((c) =>
 c.id === categoryId
 ? {
 ...c,
 dishes: c.dishes.map((d) => (d.id === dishId ? { ...d, visible: nextVisible } : d)),
 }
 : c,
 ),
 );
 visibilityAbortersRef.current.get(dishId)?.abort();
 const ac = new AbortController();
 visibilityAbortersRef.current.set(dishId, ac);
 try {
 await patchItem(dishId, { isActive: nextVisible }, ac.signal);
 visibilityOriginalRef.current.delete(dishId);
 } catch (e) {
 if (isAbort(e)) return;
 // Final request failed — revert to original pre-burst state.
 const orig = visibilityOriginalRef.current.get(dishId);
 if (orig) {
 setCategories((cats) =>
 cats.map((c) =>
 c.id === orig.categoryId
 ? {
 ...c,
 dishes: c.dishes.map((d) => (d.id === dishId ? { ...d, visible: orig.visible } : d)),
 }
 : c,
 ),
 );
 visibilityOriginalRef.current.delete(dishId);
 }
 }
 }

 return (
 <>
 <div
 className="sticky z-10 -mx-4 md:-mx-6 -mt-5 md:-mt-4 px-4 md:px-6 h-14 flex items-center bg-card border-b border-border/60"
 style={{ top: "var(--topbar-h, 0px)" }}
 >
 <div className="w-full max-w-2xl mx-auto flex items-center justify-between gap-3">
 <div className="flex items-center gap-2 min-w-0">
 {menuUrl ? (
 <PreviewButton
 url={menuUrl}
 onOpen={() => track("dash_menu_preview_open")}
 onboardingTarget="preview"
 />
 ) : null}
 {menuUrl ? (
 <ShareButton
 onClick={() => {
 track("dash_menu_share_open");
 setShareOpen(true);
 }}
 onboardingTarget="share"
 />
 ) : null}
 </div>
 {categories.length > 0 ? (
 <button
 type="button"
 onClick={anyOpen ? collapseAll : expandAll}
 className="relative inline-flex items-center justify-center h-8 px-2.5 text-xs font-medium text-muted-foreground bg-secondary hover:text-foreground rounded-md transition-colors shrink-0"
 >
 {/* width reservation: longer label fixes the width */}
 <span className="invisible inline-flex items-center gap-1.5" aria-hidden>
 <ExpandIcon size={14} />
 {t("expand").length >= t("collapse").length ? t("expand") : t("collapse")}
 </span>
 <span className="absolute inset-0 inline-flex items-center justify-center gap-1.5">
 {anyOpen ? <CollapseIcon size={14} /> : <ExpandIcon size={14} />}
 {anyOpen ? t("collapse") : t("expand")}
 </span>
 </button>
 ) : null}
 </div>
 </div>

 <div className="max-w-2xl mx-auto pt-5">
 {(() => {
 const isPaid = !!(sub && sub.subscriptionStatus === "ACTIVE" && sub.plan && sub.plan !== "FREE");
 if (isPaid) return null;
 const trialEndsAt = sub?.trialEndsAt ? new Date(sub.trialEndsAt) : null;
 const trialing = !isPaid && trialEndsAt !== null && trialEndsAt > new Date();
 const trialExpired = !isPaid && trialEndsAt !== null && trialEndsAt <= new Date();
 if (!trialing && !trialExpired) return null;
 // Expired banner cannot be dismissed (menu blocked).
 if (trialing && trialDismissedUntil > Date.now()) return null;
 const daysLeft = trialing && trialEndsAt
 ? Math.max(1, Math.ceil((trialEndsAt.getTime() - Date.now()) / 86400000))
 : 0;
 const goBilling = () => {
 track("dash_menu_plan");
 router.push({ name: "settings.billing", from: "menu" });
 };
 return (
 <div className={`relative rounded-xl border border-border bg-gradient-to-br from-orange-500/10 to-amber-500/5 p-4 mb-2.5 ${trialing ? "pr-10" : ""}`}>
 {trialing && (
 <button
 type="button"
 onClick={dismissTrialBanner}
 className="absolute top-2 right-2 h-7 w-7 inline-flex items-center justify-center rounded-md text-muted-foreground hover:bg-muted/50"
 aria-label={t("scan.banner.dismiss")}
 >
 ×
 </button>
 )}
 <div className="flex items-start gap-3">
 <div
 className="flex items-center justify-center h-10 w-10 rounded-xl shrink-0 text-white"
 style={{ background: "linear-gradient(to bottom right, hsl(9,100%,58%), #f59e0b)" }}
 >
 <ClockIcon size={16} />
 </div>
 <div className="flex-1 min-w-0">
 <p className="text-sm font-semibold">
 {trialExpired ? tsub("trialExpired") : tsub("trialDays", { days: daysLeft })}
 </p>
 <p className="text-xs text-muted-foreground mt-0.5">
 {trialExpired ? tBilling("menuUnavailableTip") : tBilling("trialEnds", { date: trialEndsAt!.toLocaleDateString() })}
 </p>
 <button
 type="button"
 onClick={goBilling}
 className="mt-3 inline-flex items-center gap-2 h-9 px-4 rounded-lg text-white text-sm font-semibold shadow-md hover:opacity-90"
 style={{ background: "linear-gradient(to right, hsl(9,100%,58%), #f59e0b)" }}
 >
 {tBilling("manage")}
 </button>
 </div>
 </div>
 </div>
 );
 })()}

 {scanBannerVisible && (
 <div className={`relative rounded-xl border border-border bg-gradient-to-br from-orange-500/10 to-amber-500/5 p-4 mb-2.5 ${noCategories ? "" : "pr-10"}`}>
 {!noCategories && (
 <button
 type="button"
 onClick={() => void handleDismissBanner()}
 className="absolute top-2 right-2 h-7 w-7 inline-flex items-center justify-center rounded-md text-muted-foreground hover:bg-muted/50"
 aria-label={t("scan.banner.dismiss")}
 >
 ×
 </button>
 )}
 <div className="flex items-start gap-3">
 <div
 className="flex items-center justify-center h-10 w-10 rounded-xl shrink-0 text-white"
 style={{ background: "linear-gradient(to bottom right, hsl(9,100%,58%), #f59e0b)" }}
 >
 <SparklesIcon size={16} />
 </div>
 <div className="flex-1 min-w-0">
 <p className="text-sm font-semibold">{t("scan.banner.title")}</p>
 <p className="text-xs text-muted-foreground mt-0.5">{t("scan.banner.subtitle")}</p>
 <button
 type="button"
 onClick={() => { track("dash_scan_banner_cta"); setScanModalOpen(true); }}
 className="mt-3 inline-flex items-center gap-2 h-9 px-4 rounded-lg text-white text-sm font-semibold shadow-md hover:opacity-90"
 style={{ background: "linear-gradient(to right, hsl(9,100%,58%), #f59e0b)" }}
 >
 {t("scan.banner.cta")}
 </button>
 </div>
 </div>
 </div>
 )}

 {categories.length === 0 ? (
 <EmptyState
 title={t("noCategories")}
 subtitle={t("noCategoriesSub")}
 action={
 <button
 type="button"
 onClick={() => {
 track("dash_menu_add_category");
 router.push({ name: "category.new" });
 }}
 data-onboarding-target="add-category"
 className={primaryBtn + " w-full inline-flex items-center justify-center"}
 >
 {t("addCategory")}
 </button>
 }
 />
 ) : (
 <div>
 <div ref={categoriesFlipRef} className="space-y-3">
 {categories.map((cat, idx) => (
 <div key={cat.id} data-flip-id={cat.id}>
 <CategoryAccordion
 category={cat}
 defaultLang={defaultLang}
 currencySymbol={currencySymbol}
 isOpen={!!openIds[cat.id]}
 onToggle={() => toggleCategory(cat.id)}
 isFirst={idx === 0}
 isLast={idx === categories.length - 1}
 isFirstCategory={idx === 0}
 onMoveUp={() => moveCategory(idx, -1)}
 onMoveDown={() => moveCategory(idx, 1)}
 onMoveDish={moveDish}
 onToggleDishVisible={toggleDishVisible}
 />
 </div>
 ))}
 </div>

 <button
 type="button"
 onClick={() => {
 track("dash_menu_add_category");
 router.push({ name: "category.new" });
 }}
 data-onboarding-target="add-category"
 className="w-full mt-3 h-12 text-sm font-medium text-muted-foreground/60 border border-dashed border-input rounded-xl flex items-center justify-center gap-2 transition-colors"
 >
 <PlusIcon size={14} />
 {t("addCategory")}
 </button>
 </div>
 )}
 </div>

 <ShareModal
 open={shareOpen}
 onClose={() => setShareOpen(false)}
 url={menuUrl}
 restaurantName={restaurant.name}
 />
 <ScanModal
 open={scanModalOpen}
 onClose={() => setScanModalOpen(false)}
 existingRealItemsCount={existingRealItemsCount}
 onSaved={() => {
 setBannerLocallyDismissed(true);
 onPersisted?.();
 }}
 />
 {categories.length > 0 ? <MenuOnboarding onActive={expandAll} /> : null}
 </>
 );
}

function CategoryAccordion({
 category,
 defaultLang,
 currencySymbol,
 isOpen,
 onToggle,
 isFirst,
 isLast,
 isFirstCategory = false,
 onMoveUp,
 onMoveDown,
 onMoveDish,
 onToggleDishVisible,
}: {
 category: Category;
 defaultLang: string;
 currencySymbol: string;
 isOpen: boolean;
 onToggle: () => void;
 isFirst: boolean;
 isLast: boolean;
 isFirstCategory?: boolean;
 onMoveUp: () => void;
 onMoveDown: () => void;
 onMoveDish: (categoryId: string, idx: number, dir: number) => void;
 onToggleDishVisible: (categoryId: string, dishId: string) => void;
}) {
 const t = useTranslations("dashboard.menu");
 const router = useDashboardRouter();
 const dishesFlipRef = useFlip<HTMLDivElement>([category.dishes.map((d) => d.id).join(",")]);
 return (
 <div className="bg-card border border-border/60 rounded-xl overflow-hidden">
 <div
 role="button"
 tabIndex={0}
 onClick={() => {
 track("dash_menu_category_click");
 onToggle();
 }}
 onKeyDown={(e) => {
 if (e.key === "Enter" || e.key === " ") {
 e.preventDefault();
 track("dash_menu_category_click");
 onToggle();
 }
 }}
 aria-expanded={isOpen}
 aria-label={isOpen ? t("collapseCategory") : t("expandCategory")}
 className="flex items-center gap-1.5 pl-2 pr-3 py-2 cursor-pointer select-none"
 >
 <span className="w-8 h-8 flex items-center justify-center rounded-md text-muted-foreground shrink-0">
 <span
 className="transition-transform duration-150 inline-flex"
 style={{ transform: isOpen ? "rotate(0deg)" : "rotate(-90deg)" }}
 >
 <ChevronDownIcon size={14} />
 </span>
 </span>
 <span className="flex-1 min-w-0 text-sm font-semibold uppercase tracking-wide text-foreground/70 truncate block">
 {getMlWithFallback(category.name, defaultLang, defaultLang)}
 </span>

 <div className="flex items-center gap-0.5 shrink-0">
 <span
 className="inline-flex items-center gap-0"
 data-onboarding-target={isFirstCategory ? "sort" : undefined}
 >
 <button
 type="button"
 onClick={(e) => { e.stopPropagation(); onMoveUp(); }}
 disabled={isFirst}
 className={iconBtn}
 aria-label={t("moveCategoryUp")}
 >
 <ArrowUpIcon size={14} />
 </button>
 <button
 type="button"
 onClick={(e) => { e.stopPropagation(); onMoveDown(); }}
 disabled={isLast}
 className={iconBtn}
 aria-label={t("moveCategoryDown")}
 >
 <ArrowDownIcon size={14} />
 </button>
 </span>
 <button
 type="button"
 onClick={(e) => {
 e.stopPropagation();
 track("dash_menu_category_edit");
 router.push({ name: "category.edit", id: category.id });
 }}
 data-onboarding-target={isFirstCategory ? "edit" : undefined}
 className={iconBtn}
 aria-label={t("editCategory")}
 >
 <EditIcon size={14} />
 </button>
 </div>
 </div>

 <Collapsible open={isOpen}>
 <div className="border-t border-border">
 {category.dishes.length === 0 ? (
 <p className="text-sm text-muted-foreground h-12 flex items-center justify-center">
 {t("noDishes")}
 </p>
 ) : (
 <div ref={dishesFlipRef} className="divide-y divide-border">
 {category.dishes.map((dish, idx) => (
 <div key={dish.id} data-flip-id={dish.id}>
 <DishRow
 dish={dish}
 defaultLang={defaultLang}
 currencySymbol={currencySymbol}
 isFirst={idx === 0}
 isLast={idx === category.dishes.length - 1}
 isFirstDishOfFirstCategory={isFirstCategory && idx === 0}
 onMoveUp={() => onMoveDish(category.id, idx, -1)}
 onMoveDown={() => onMoveDish(category.id, idx, 1)}
 onToggleVisible={() => onToggleDishVisible(category.id, dish.id)}
 />
 </div>
 ))}
 </div>
 )}

 <button
 type="button"
 onClick={() => {
 track("dash_menu_add_item");
 router.push({ name: "item.new", categoryId: category.id });
 }}
 data-onboarding-target={isFirstCategory ? "add-dish" : undefined}
 className="w-full flex items-center gap-2 pl-2 pr-3 py-2 text-sm text-muted-foreground/60 transition-colors border-t border-border"
 >
 <span className="w-8 h-8 flex items-center justify-center shrink-0">
 <PlusIcon size={14} />
 </span>
 {t("addDish")}
 </button>
 </div>
 </Collapsible>
 </div>
 );
}

function DishRow({
 dish,
 defaultLang,
 currencySymbol,
 isFirst,
 isLast,
 isFirstDishOfFirstCategory = false,
 onMoveUp,
 onMoveDown,
 onToggleVisible,
}: {
 dish: Dish;
 defaultLang: string;
 currencySymbol: string;
 isFirst: boolean;
 isLast: boolean;
 isFirstDishOfFirstCategory?: boolean;
 onMoveUp: () => void;
 onMoveDown: () => void;
 onToggleVisible: () => void;
}) {
 const t = useTranslations("dashboard.menu");
 const tc = useTranslations("dashboard.common");
 const tBadge = useTranslations("dashboard");
 const router = useDashboardRouter();
 const rowCls =
 "flex items-center gap-2.5 pl-2 pr-3 py-2 transition-colors cursor-pointer select-none";
 const dimCls = dish.visible ? "" : "opacity-50";
 const openDish = () => {
 track("dash_menu_item_click");
 router.push({ name: "item.edit", id: dish.id });
 };
 return (
 <div
 role="button"
 tabIndex={0}
 onClick={openDish}
 onKeyDown={(e) => {
 if (e.key === "Enter" || e.key === " ") {
 e.preventDefault();
 openDish();
 }
 }}
 aria-label={t("editDish")}
 className={rowCls}
 >
 <div className="flex items-center gap-0 shrink-0">
 <button
 type="button"
 onClick={(e) => { e.stopPropagation(); onMoveUp(); }}
 disabled={isFirst}
 className={iconBtn}
 aria-label={tc("moveUp")}
 >
 <ArrowUpIcon size={14} />
 </button>
 <button
 type="button"
 onClick={(e) => { e.stopPropagation(); onMoveDown(); }}
 disabled={isLast}
 className={iconBtn}
 aria-label={tc("moveDown")}
 >
 <ArrowDownIcon size={14} />
 </button>
 </div>

 <div className={"flex-1 min-w-0 text-left flex items-center gap-2 " + dimCls}>
 <div className="min-w-0 flex-1 flex items-center gap-1.5">
 <span className="text-sm font-medium text-foreground truncate">
 {getMlWithFallback(dish.name, defaultLang, defaultLang)}
 </span>
 {dish.isExample && (
 <span className="text-[10px] font-medium uppercase tracking-wide px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200 shrink-0">
 {tBadge("exampleBadge")}
 </span>
 )}
 </div>
 {Number(dish.price) > 0 ? (
 <div className="text-sm text-muted-foreground tabular-nums shrink-0">{currencySymbol + dish.price}</div>
 ) : null}
 </div>

 <div className="flex items-center gap-0.5 shrink-0 pl-1">
 <button
 type="button"
 onClick={(e) => { e.stopPropagation(); onToggleVisible(); }}
 data-onboarding-target={isFirstDishOfFirstCategory ? "toggle-dish" : undefined}
 className={iconBtn}
 aria-label={dish.visible ? t("hideDish") : t("showDish")}
 >
 {dish.visible ? <EyeIcon size={14} /> : <EyeOffIcon size={14} />}
 </button>
 <button
 type="button"
 onClick={(e) => {
 e.stopPropagation();
 track("dash_menu_item_edit");
 router.push({ name: "item.edit", id: dish.id });
 }}
 className={iconBtn}
 aria-label={t("editDish")}
 >
 <EditIcon size={14} />
 </button>
 </div>
 </div>
 );
}
