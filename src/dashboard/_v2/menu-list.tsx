"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useFlip } from "./use-flip";
import { Collapsible } from "./collapsible";
import { useDashboardRouter } from "../_spa/router";
import {
 ArrowDownIcon,
 ArrowLeftIcon,
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
 currentGroupId = null,
}: {
 initialCategories: Category[];
 initialSub?: SubData | null;
 onPersisted?: () => void;
 scanBannerDismissed?: boolean;
 currentGroupId?: string | null;
}) {
 const t = useTranslations("dashboard.menu");
 const tsub = useTranslations("dashboard.subscriptionChip");
 const tBilling = useTranslations("dashboard.settings.billing");
 const restaurant = useRestaurant();
 const router = useDashboardRouter();
 const qc = useQueryClient();
 const { defaultLang, currency, menuUrl } = restaurant;
 const currencySymbol = currencySymbolOf(currency);

 const [categories, setCategories] = useState<Category[]>(initialCategories);
 // Flat layout: top-level (ungrouped) categories + groups with their nested
 // categories all visible on the same page. currentGroupId from the URL is
 // ignored — kept only so older deep links don't 404.
 // All non-group categories regardless of parent — drives bulk operations
 // (expand-all, item totals, scan-banner visibility).
 const scopedLeaves = useMemo(
   () =>
     categories
       .filter((c) => !c.isGroup)
       .sort((a, b) => a.sortOrder - b.sortOrder),
   [categories],
 );
 const ungroupedCategories = useMemo(
   () =>
     categories
       .filter((c) => !c.isGroup && (c.parentId ?? null) === null)
       .sort((a, b) => a.sortOrder - b.sortOrder),
   [categories],
 );
 const topLevelGroups = useMemo(
   () =>
     categories
       .filter((c) => c.isGroup)
       .sort((a, b) => a.sortOrder - b.sortOrder),
   [categories],
 );
 const categoriesInGroup = (groupId: string) =>
   categories
     .filter((c) => !c.isGroup && c.parentId === groupId)
     .sort((a, b) => a.sortOrder - b.sortOrder);
 const currentGroup = useMemo(
   () => (currentGroupId ? categories.find((c) => c.id === currentGroupId && c.isGroup) ?? null : null),
   [categories, currentGroupId],
 );
 const groupsFlipRef = useFlip<HTMLDivElement>([topLevelGroups.map((c) => c.id).join(",")]);
 const ungroupedFlipRef = useFlip<HTMLDivElement>([ungroupedCategories.map((c) => c.id).join(",")]);
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

 // Seeded sample dishes are named "Sample: …" — exclude them so the scan
 // modal only warns about real items the owner actually added.
 const existingRealItemsCount = scopedLeaves.reduce(
  (sum, c) =>
   sum +
   c.dishes.filter((d) => !getMlWithFallback(d.name, defaultLang, defaultLang).startsWith("Sample: ")).length,
  0,
 );

 // "Empty" depends on the current depth: at top-level, count leaves + groups;
 // inside a group, just leaves of that group.
 // Empty layout: no categories and no groups anywhere.
 const noCategories = scopedLeaves.length === 0 && topLevelGroups.length === 0;
 const scanBannerVisible = noCategories || !bannerLocallyDismissed;

 async function handleDismissBanner() {
  track("dash_scan_banner_dismiss");
  setBannerLocallyDismissed(true);
  try {
   await dismissScanBanner();
   // Refresh the restaurant cache so the dismissed flag survives a
   // route round-trip (menu → form → back) without the banner popping
   // back via the old initialSub / scanBannerDismissed prop.
   await qc.invalidateQueries({ queryKey: ["restaurant"] });
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

 // anyOpen treats both leaf categories and group containers. Groups default
 // to open (openIds[id] !== false) so any group not explicitly closed counts
 // as "open" — keeps the icon flipping correctly when only groups are open.
 const anyOpen =
 scopedLeaves.some((c) => openIds[c.id]) ||
 topLevelGroups.some((g) => openIds[g.id] !== false);

 function toggleCategory(id: string) {
 setOpenIds((p) => {
 const next = !p[id];
 track(next ? "dash_menu_category_expand" : "dash_menu_category_collapse");
 return { ...p, [id]: next };
 });
 }
 function expandAll() {
 track("dash_menu_expand");
 setOpenIds((prev) => {
 const next = { ...prev };
 scopedLeaves.forEach((c) => { next[c.id] = true; });
 topLevelGroups.forEach((g) => { next[g.id] = true; });
 return next;
 });
 }
 function collapseAll() {
 track("dash_menu_collapse");
 setOpenIds((prev) => {
 const next = { ...prev };
 scopedLeaves.forEach((c) => { next[c.id] = false; });
 topLevelGroups.forEach((g) => { next[g.id] = false; });
 return next;
 });
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

 async function moveGroup(idx: number, dir: number) {
 track(dir < 0 ? "dash_menu_group_sort_up" : "dash_menu_group_sort_down");
 const reordered = moveItem(topLevelGroups, idx, dir);
 const idToOrder = new Map(reordered.map((g, i) => [g.id, i]));
 setCategories((cats) =>
   cats.map((c) => (idToOrder.has(c.id) ? { ...c, sortOrder: idToOrder.get(c.id)! } : c)),
 );
 catReorderAborterRef.current?.abort();
 const ac = new AbortController();
 catReorderAborterRef.current = ac;
 try {
 await reorderCategories(
   reordered.map((g, i) => ({ id: g.id, sortOrder: i })),
   ac.signal,
 );
 } catch (e) {
 if (isAbort(e)) return;
 }
 }

 async function moveCategory(siblings: Category[], idx: number, dir: number) {
 // Reorder happens within the passed sibling list (per-group or ungrouped).
 track(dir < 0 ? "dash_menu_category_sort_up" : "dash_menu_category_sort_down");
 const reorderedSiblings = moveItem(siblings, idx, dir);
 const idToOrder = new Map(reorderedSiblings.map((c, i) => [c.id, i]));
 setCategories((cats) =>
   cats.map((c) => (idToOrder.has(c.id) ? { ...c, sortOrder: idToOrder.get(c.id)! } : c)),
 );
 catReorderAborterRef.current?.abort();
 const ac = new AbortController();
 catReorderAborterRef.current = ac;
 try {
 await reorderCategories(
   reorderedSiblings.map((c, i) => ({ id: c.id, sortOrder: i })),
   ac.signal,
 );
 } catch (e) {
 if (isAbort(e)) return;
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
 className="sticky z-10 -mx-4 md:-mx-6 -mt-5 md:-mt-4 px-4 md:px-6 h-14 flex items-center bg-subheader/90 backdrop-blur-md border-b border-border md:border-border/60"
 style={{ top: "var(--topbar-h, 0px)" }}
 >
 <div className="w-full max-w-5xl mx-auto md:px-6 flex items-center justify-between gap-3">
 <div className="flex items-center gap-2 min-w-0">
 {currentGroup ? (
 <button
 type="button"
 onClick={() => router.push({ name: "menu" })}
 className="inline-flex items-center gap-1 h-8 px-2.5 text-xs font-medium text-muted-foreground bg-secondary rounded-md"
 aria-label={t("backToMenu", { defaultValue: "Back to menu" })}
 >
 <ArrowLeftIcon size={14} />
 <span className="truncate max-w-[200px]">
 {getMlWithFallback(currentGroup.name, defaultLang, defaultLang)}
 </span>
 </button>
 ) : (
 <>
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
 </>
 )}
 </div>
 {scopedLeaves.length > 0 ? (
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

 <div className="max-w-5xl mx-auto md:px-6 pt-4">
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
 <div className="relative rounded-xl border border-border bg-gradient-to-br from-orange-500/10 to-amber-500/5 p-4 mb-2.5">
 <div className="flex items-start gap-3 md:items-center">
 <ClockIcon size={20} className="shrink-0 mt-0.5 md:mt-0 text-primary" />
 <div className="flex-1 min-w-0">
 <p className="text-sm font-semibold">
 {trialExpired ? tsub("trialExpired") : tsub("trialDays", { days: daysLeft })}
 </p>
 <p className="text-xs text-muted-foreground mt-0.5">
 {trialExpired ? tBilling("menuUnavailableTip") : tBilling("trialEnds", { date: trialEndsAt!.toLocaleDateString() })}
 </p>
 <div className="mt-3 flex gap-2 md:hidden">
 <button
 type="button"
 onClick={goBilling}
 className={primaryBtn + " inline-flex items-center gap-1.5"}
 >
 {tBilling("manage")}
 </button>
 {trialing && (
 <button
 type="button"
 onClick={dismissTrialBanner}
 className="h-8 px-3 text-xs font-medium text-foreground bg-transparent border border-border rounded-lg transition-colors inline-flex items-center"
 >
 {t("scan.banner.dismiss")}
 </button>
 )}
 </div>
 </div>
 {trialing && (
 <button
 type="button"
 onClick={dismissTrialBanner}
 className="hidden md:inline-flex h-8 px-3 text-xs font-medium text-foreground bg-transparent border border-border rounded-lg transition-colors items-center shrink-0"
 >
 {t("scan.banner.dismiss")}
 </button>
 )}
 <button
 type="button"
 onClick={goBilling}
 className={primaryBtn + " hidden md:inline-flex items-center gap-1.5 shrink-0"}
 >
 {tBilling("manage")}
 </button>
 </div>
 </div>
 );
 })()}

 {scanBannerVisible && !currentGroupId && (
 <div className="relative rounded-xl border border-border bg-gradient-to-br from-orange-500/10 to-amber-500/5 p-4 mb-2.5">
 <div className="flex items-start gap-3 md:items-center">
 <SparklesIcon size={20} className="shrink-0 mt-0.5 md:mt-0 text-primary" />
 <div className="flex-1 min-w-0">
 <p className="text-sm font-semibold">{t("scan.banner.title")}</p>
 <p className="text-xs text-muted-foreground mt-0.5">{t("scan.banner.subtitle")}</p>
 <div className="mt-3 flex gap-2 md:hidden">
 <button
 type="button"
 onClick={() => { track("dash_scan_banner_cta"); setScanModalOpen(true); }}
 className={primaryBtn + " inline-flex items-center gap-1.5"}
 >
 <SparklesIcon size={14} />
 {t("scan.banner.cta")}
 </button>
 {!noCategories && (
 <button
 type="button"
 onClick={() => void handleDismissBanner()}
 className="h-8 px-3 text-xs font-medium text-foreground bg-transparent border border-border rounded-lg transition-colors inline-flex items-center"
 >
 {t("scan.banner.dismiss")}
 </button>
 )}
 </div>
 </div>
 {!noCategories && (
 <button
 type="button"
 onClick={() => void handleDismissBanner()}
 className="hidden md:inline-flex h-8 px-3 text-xs font-medium text-foreground bg-transparent border border-border rounded-lg transition-colors items-center shrink-0"
 >
 {t("scan.banner.dismiss")}
 </button>
 )}
 <button
 type="button"
 onClick={() => { track("dash_scan_banner_cta"); setScanModalOpen(true); }}
 className={primaryBtn + " hidden md:inline-flex items-center gap-1.5 shrink-0"}
 >
 <SparklesIcon size={14} />
 {t("scan.banner.cta")}
 </button>
 </div>
 </div>
 )}


 {noCategories ? (
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
 className={primaryBtn + " inline-flex items-center gap-1.5"}
 >
 <PlusIcon size={14} />
 {t("addCategory")}
 </button>
 }
 />
 ) : (
 <div className="space-y-3">
 {/* Ungrouped categories first (no group header). */}
 {ungroupedCategories.length > 0 && (
 <div ref={ungroupedFlipRef} className="space-y-3">
 {ungroupedCategories.map((cat, idx) => (
 <div key={cat.id} data-flip-id={cat.id}>
 <CategoryAccordion
 category={cat}
 defaultLang={defaultLang}
 currencySymbol={currencySymbol}
 isOpen={!!openIds[cat.id]}
 onToggle={() => toggleCategory(cat.id)}
 isFirst={idx === 0}
 isLast={idx === ungroupedCategories.length - 1}
 isFirstCategory={idx === 0}
 onMoveUp={() => moveCategory(ungroupedCategories, idx, -1)}
 onMoveDown={() => moveCategory(ungroupedCategories, idx, 1)}
 onMoveDish={moveDish}
 onToggleDishVisible={toggleDishVisible}
 />
 </div>
 ))}
 </div>
 )}

 {/* Each group: borderless header (chevron + name + buttons),
     followed by its child categories + a scoped "Add category"
     button. Click anywhere on the header toggles the group. */}
 {topLevelGroups.length > 0 && (
 <div ref={groupsFlipRef} className="space-y-3">
 {topLevelGroups.map((g, gi) => {
 const kids = categoriesInGroup(g.id);
 const isGroupOpen = openIds[g.id] !== false;
 return (
 <GroupBlock
 key={g.id}
 g={g}
 gi={gi}
 kids={kids}
 isGroupOpen={isGroupOpen}
 topLevelGroupsLength={topLevelGroups.length}
 openIds={openIds}
 defaultLang={defaultLang}
 currencySymbol={currencySymbol}
 t={t}
 toggleCategory={toggleCategory}
 moveGroup={moveGroup}
 moveCategory={moveCategory}
 moveDish={moveDish}
 toggleDishVisible={toggleDishVisible}
 onEditGroup={() => {
 track("dash_menu_group_edit");
 router.push({ name: "group.edit", id: g.id });
 }}
 />
 );
 })}
 </div>
 )}

 <div className="flex items-center justify-center gap-6 pt-6 pb-8 md:pb-0">
 <button
 type="button"
 onClick={() => {
 track("dash_menu_add_category");
 router.push({ name: "category.new" });
 }}
 data-onboarding-target="add-category"
 className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
 >
 <PlusIcon size={14} />
 {t("addCategory")}
 </button>
 <button
 type="button"
 onClick={() => {
 track("dash_menu_add_group");
 router.push({ name: "group.new" });
 }}
 className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
 >
 <PlusIcon size={14} />
 {t("addGroup", { defaultValue: "Add group" })}
 </button>
 </div>
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
 {/* Guided menu tour for first-time owners (re-enabled). */}
 {scopedLeaves.length > 0 ? <MenuOnboarding onActive={expandAll} /> : null}
 </>
 );
}

function GroupBlock({
 g,
 gi,
 kids,
 isGroupOpen,
 topLevelGroupsLength,
 openIds,
 defaultLang,
 currencySymbol,
 t,
 toggleCategory,
 moveGroup,
 moveCategory,
 moveDish,
 toggleDishVisible,
 onEditGroup,
}: {
 g: Category;
 gi: number;
 kids: Category[];
 isGroupOpen: boolean;
 topLevelGroupsLength: number;
 openIds: Record<string, boolean>;
 defaultLang: string;
 currencySymbol: string;
 t: ReturnType<typeof useTranslations>;
 toggleCategory: (id: string) => void;
 moveGroup: (idx: number, dir: number) => void;
 moveCategory: (siblings: Category[], idx: number, dir: number) => void;
 moveDish: (categoryId: string, idx: number, dir: number) => void;
 toggleDishVisible: (categoryId: string, dishId: string) => void;
 onEditGroup: () => void;
}) {
 const kidsFlipRef = useFlip<HTMLDivElement>([kids.map((c) => c.id).join(",")]);
 return (
 <div data-flip-id={g.id} className="space-y-3">
 <div
 role="button"
 tabIndex={0}
 onClick={() => toggleCategory(g.id)}
 onKeyDown={(e) => {
 if (e.key === "Enter" || e.key === " ") {
 e.preventDefault();
 toggleCategory(g.id);
 }
 }}
 className="flex items-center gap-2 pl-0 pr-0 py-1 cursor-pointer select-none"
 >
 <span className="w-6 h-6 -ml-1 inline-flex items-center justify-center text-muted-foreground shrink-0">
 <span
 className="transition-transform duration-150 inline-flex"
 style={{ transform: isGroupOpen ? "rotate(0deg)" : "rotate(-90deg)" }}
 >
 <ChevronDownIcon size={14} />
 </span>
 </span>
 <span className="min-w-0 text-lg font-semibold text-foreground/70 truncate">
 {getMlWithFallback(g.name, defaultLang, defaultLang)}
 </span>
 <span className="flex-1" />
 <div className="flex items-center gap-0.5 shrink-0">
 <span className="inline-flex items-center gap-0">
 <button
 type="button"
 onClick={(e) => { e.stopPropagation(); moveGroup(gi, -1); }}
 disabled={gi === 0}
 className={iconBtn}
 aria-label={t("moveCategoryUp")}
 >
 <ArrowUpIcon size={14} />
 </button>
 <button
 type="button"
 onClick={(e) => { e.stopPropagation(); moveGroup(gi, 1); }}
 disabled={gi === topLevelGroupsLength - 1}
 className={iconBtn}
 aria-label={t("moveCategoryDown")}
 >
 <ArrowDownIcon size={14} />
 </button>
 </span>
 <button
 type="button"
 onClick={(e) => { e.stopPropagation(); onEditGroup(); }}
 className={iconBtn + " justify-end pr-0 -mr-1"}
 aria-label={t("editCategory")}
 >
 <EditIcon size={14} />
 </button>
 </div>
 </div>

 <Collapsible open={isGroupOpen} style={{ marginTop: 0 }}>
 <div ref={kidsFlipRef} className="space-y-3 pt-2">
 {kids.map((cat, ci) => (
 <div key={cat.id} data-flip-id={cat.id}>
 <CategoryAccordion
 category={cat}
 defaultLang={defaultLang}
 currencySymbol={currencySymbol}
 isOpen={!!openIds[cat.id]}
 onToggle={() => toggleCategory(cat.id)}
 isFirst={ci === 0}
 isLast={ci === kids.length - 1}
 isFirstCategory={false}
 onMoveUp={() => moveCategory(kids, ci, -1)}
 onMoveDown={() => moveCategory(kids, ci, 1)}
 onMoveDish={moveDish}
 onToggleDishVisible={toggleDishVisible}
 />
 </div>
 ))}
 </div>
 </Collapsible>
 </div>
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
 <span className="flex-1 min-w-0 text-sm font-semibold text-foreground/70 truncate block">
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
