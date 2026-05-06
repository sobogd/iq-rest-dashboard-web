"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useDashboardRouter } from "../_spa/router";
import {
 ArrowDownIcon,
 ArrowUpIcon,
 ChevronDownIcon,
 CollapseIcon,
 EditIcon,
 ExpandIcon,
 EyeIcon,
 EyeOffIcon,
 PlusIcon,
} from "./icons";
import { EmptyState, PageHeader, PreviewButton, ShareButton, ShareModal, SubscriptionChip } from "./ui";
import { iconBtn, primaryBtn } from "./tokens";
import { getMlWithFallback } from "./i18n";
import { currencySymbolOf, moveItem } from "./helpers";
import { dismissScanBanner, fetchSubscriptionStatus, patchItem, reorderCategories, reorderItem } from "./api";
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

const SCAN_BANNER_ALLOWED_EMAIL = "sobogd@gmail.com";

export function MenuList({
 initialCategories,
 initialSub = null,
 onPersisted,
 userEmail = "",
 scanBannerDismissed = false,
}: {
 initialCategories: Category[];
 initialSub?: SubData | null;
 onPersisted?: () => void;
 userEmail?: string;
 scanBannerDismissed?: boolean;
}) {
 const t = useTranslations("dashboard.menu");
 const restaurant = useRestaurant();
 const router = useDashboardRouter();
 const { defaultLang, currency, menuUrl } = restaurant;
 const currencySymbol = currencySymbolOf(currency);

 const [categories, setCategories] = useState<Category[]>(initialCategories);
 const [openIds, setOpenIds] = useState<Record<string, boolean>>(() => {
 const map: Record<string, boolean> = {};
 initialCategories.forEach((c) => {
 map[c.id] = true;
 });
 return map;
 });
 const [shareOpen, setShareOpen] = useState(false);
 const [sub, setSub] = useState<SubData | null>(initialSub);
 const [scanBannerVisible, setScanBannerVisible] = useState(
  userEmail === SCAN_BANNER_ALLOWED_EMAIL && !scanBannerDismissed,
 );
 const [scanModalOpen, setScanModalOpen] = useState(false);

 const existingRealItemsCount = categories.reduce(
  (sum, c) => sum + c.dishes.filter((d) => !d.isExample).length,
  0,
 );

 async function handleDismissBanner() {
  setScanBannerVisible(false);
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

 const allOpen = categories.length > 0 && categories.every((c) => openIds[c.id]);

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

 async function moveCategory(idx: number, dir: number) {
 track(dir < 0 ? "dash_menu_category_sort_up" : "dash_menu_category_sort_down");
 const next = moveItem(categories, idx, dir);
 setCategories(next);
 try {
 await reorderCategories(next.map((c, i) => ({ id: c.id, sortOrder: i })));
 onPersisted?.();
 } catch {
 }
 }

 async function moveDish(categoryId: string, idx: number, dir: number) {
 track(dir < 0 ? "dash_menu_item_sort_up" : "dash_menu_item_sort_down");
 const cat = categories.find((c) => c.id === categoryId);
 if (!cat) return;
 const dish = cat.dishes[idx];
 if (!dish) return;
 setCategories((cats) =>
 cats.map((c) =>
 c.id === categoryId ? { ...c, dishes: moveItem(c.dishes, idx, dir) } : c,
 ),
 );
 try {
 await reorderItem(dish.id, dir < 0 ? "up" : "down");
 onPersisted?.();
 } catch {
 }
 }

 async function toggleDishVisible(categoryId: string, dishId: string) {
 track("dash_menu_item_click");
 const cat = categories.find((c) => c.id === categoryId);
 const dish = cat?.dishes.find((d) => d.id === dishId);
 if (!dish) return;
 const nextVisible = !dish.visible;
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
 try {
 await patchItem(dishId, { isActive: nextVisible });
 onPersisted?.();
 } catch {
 setCategories((cats) =>
 cats.map((c) =>
 c.id === categoryId
 ? {
 ...c,
 dishes: c.dishes.map((d) => (d.id === dishId ? { ...d, visible: !nextVisible } : d)),
 }
 : c,
 ),
 );
 }
 }

 return (
 <>
 <div
 className="sticky z-10 -mx-4 md:-mx-6 -mt-5 md:-mt-4 px-4 md:px-6 h-14 flex items-center bg-[hsl(0_0%_6.5%/0.9)] backdrop-blur-md border-b border-border/60"
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
 <SubscriptionChip
 sub={sub}
 onClick={() => {
 track("dash_menu_plan");
 router.push({ name: "settings.billing" });
 }}
 />
 </div>
 </div>

 <div className="max-w-2xl mx-auto pt-5 md:pt-4">
 <PageHeader
 title={t("title")}
 subtitle={t("subtitle")}
 action={
 categories.length > 0 ? (
 <button
 type="button"
 onClick={allOpen ? collapseAll : expandAll}
 className="inline-flex items-center gap-1.5 h-8 px-2.5 text-xs font-medium text-muted-foreground rounded-lg transition-colors shrink-0"
 >
 {allOpen ? <CollapseIcon size={14} /> : <ExpandIcon size={14} />}
 {allOpen ? t("collapse") : t("expand")}
 </button>
 ) : null
 }
 />

 {scanBannerVisible && (
 <div className="relative rounded-xl border border-border bg-gradient-to-br from-orange-500/10 to-amber-500/5 p-4 pr-10 mb-3">
 <button
 type="button"
 onClick={() => void handleDismissBanner()}
 className="absolute top-2 right-2 h-7 w-7 inline-flex items-center justify-center rounded-md text-muted-foreground hover:bg-muted/50"
 aria-label={t("scan.banner.dismiss")}
 >
 ×
 </button>
 <div className="flex items-start gap-3">
 <div
 className="flex items-center justify-center h-10 w-10 rounded-xl shrink-0 text-white text-lg"
 style={{ background: "linear-gradient(to bottom right, hsl(9,100%,58%), #f59e0b)" }}
 >
 ✨
 </div>
 <div className="flex-1 min-w-0">
 <p className="text-sm font-semibold">{t("scan.banner.title")}</p>
 <p className="text-xs text-muted-foreground mt-0.5">{t("scan.banner.subtitle")}</p>
 <button
 type="button"
 onClick={() => setScanModalOpen(true)}
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
 <div className="space-y-2.5">
 {categories.map((cat, idx) => (
 <CategoryAccordion
 key={cat.id}
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
 ))}
 </div>

 <button
 type="button"
 onClick={() => {
 track("dash_menu_add_category");
 router.push({ name: "category.new" });
 }}
 data-onboarding-target="add-category"
 className="w-full mt-2.5 h-11 text-sm font-medium text-muted-foreground/60 border border-dashed border-input rounded-xl flex items-center justify-center gap-2 transition-colors"
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
 {userEmail === SCAN_BANNER_ALLOWED_EMAIL && (
 <ScanModal
 open={scanModalOpen}
 onClose={() => setScanModalOpen(false)}
 existingRealItemsCount={existingRealItemsCount}
 onSaved={() => {
 setScanBannerVisible(false);
 onPersisted?.();
 }}
 />
 )}
 {categories.length > 0 ? <MenuOnboarding /> : null}
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
 return (
 <div className="bg-card border border-border rounded-xl overflow-hidden">
 <div className="flex items-center gap-1 pl-2 pr-3 py-2.5">
 <button
 type="button"
 onClick={onToggle}
 className="w-8 h-8 flex items-center justify-center rounded-md text-muted-foreground transition-colors shrink-0"
 aria-expanded={isOpen}
 aria-label={isOpen ? t("collapseCategory") : t("expandCategory")}
 >
 <span
 className="transition-transform duration-150 inline-flex"
 style={{ transform: isOpen ? "rotate(0deg)" : "rotate(-90deg)" }}
 >
 <ChevronDownIcon size={14} />
 </span>
 </button>
 <button
 type="button"
 onClick={() => {
 track("dash_menu_category_click");
 router.push({ name: "category.edit", id: category.id });
 }}
 className="flex-1 min-w-0 text-left"
 >
 <span className="text-base font-medium text-foreground truncate block">
 {getMlWithFallback(category.name, defaultLang, defaultLang)}
 </span>
 </button>

 <div className="flex items-center gap-0.5 shrink-0">
 <span
 className="inline-flex items-center gap-0.5"
 data-onboarding-target={isFirstCategory ? "sort" : undefined}
 >
 <button type="button" onClick={onMoveUp} disabled={isFirst} className={iconBtn} aria-label={t("moveCategoryUp")}>
 <ArrowUpIcon size={14} />
 </button>
 <button type="button" onClick={onMoveDown} disabled={isLast} className={iconBtn} aria-label={t("moveCategoryDown")}>
 <ArrowDownIcon size={14} />
 </button>
 </span>
 <button
 type="button"
 onClick={() => {
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

 {isOpen ? (
 <div className="border-t border-border">
 {category.dishes.length === 0 ? (
 <p className="text-sm text-muted-foreground h-12 flex items-center justify-center">
 {t("noDishes")}
 </p>
 ) : (
 <div className="divide-y divide-border">
 {category.dishes.map((dish, idx) => (
 <DishRow
 key={dish.id}
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
 ) : null}
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
 "flex items-center gap-2 pl-2 pr-3 py-2 transition-colors " +
 (dish.visible ? "" : "opacity-50");
 return (
 <div className={rowCls}>
 <div className="flex items-center gap-0.5 shrink-0">
 <button type="button" onClick={onMoveUp} disabled={isFirst} className={iconBtn} aria-label={tc("moveUp")}>
 <ArrowUpIcon size={14} />
 </button>
 <button type="button" onClick={onMoveDown} disabled={isLast} className={iconBtn} aria-label={tc("moveDown")}>
 <ArrowDownIcon size={14} />
 </button>
 </div>

 <button
 type="button"
 onClick={() => {
 track("dash_menu_item_click");
 router.push({ name: "item.edit", id: dish.id });
 }}
 className="flex-1 min-w-0 text-left flex items-center gap-2"
 >
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
 <div className="text-sm text-muted-foreground tabular-nums shrink-0">{currencySymbol + dish.price}</div>
 </button>

 <div className="flex items-center gap-0.5 shrink-0 pl-1">
 <button
 type="button"
 onClick={onToggleVisible}
 data-onboarding-target={isFirstDishOfFirstCategory ? "toggle-dish" : undefined}
 className={iconBtn}
 aria-label={dish.visible ? t("hideDish") : t("showDish")}
 >
 {dish.visible ? <EyeIcon size={14} /> : <EyeOffIcon size={14} />}
 </button>
 <button
 type="button"
 onClick={() => {
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
