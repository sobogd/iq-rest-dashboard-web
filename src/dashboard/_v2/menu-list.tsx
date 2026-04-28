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
import { fetchSubscriptionStatus, patchItem, reorderCategories, reorderItem } from "./api";
import { useRestaurant } from "./restaurant-context";
import type { Category, Dish } from "./types";
import { DashboardEvent, track } from "@/lib/dashboard-events";

interface SubData {
 plan: string | null;
 subscriptionStatus: string | null;
 trialEndsAt: string | null;
}

export function MenuList({ initialCategories, initialSub = null }: { initialCategories: Category[]; initialSub?: SubData | null }) {
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

 useEffect(() => {
 track(DashboardEvent.SHOWED_MENU);
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
 setOpenIds((p) => ({ ...p, [id]: !p[id] }));
 }
 function expandAll() {
 track(DashboardEvent.CLICKED_EXPAND_ALL);
 const map: Record<string, boolean> = {};
 categories.forEach((c) => {
 map[c.id] = true;
 });
 setOpenIds(map);
 }
 function collapseAll() {
 track(DashboardEvent.CLICKED_COLLAPSE_ALL);
 setOpenIds({});
 }

 async function moveCategory(idx: number, dir: number) {
 track(DashboardEvent.SORTED_CATEGORY);
 const next = moveItem(categories, idx, dir);
 setCategories(next);
 try {
 await reorderCategories(next.map((c, i) => ({ id: c.id, sortOrder: i })));
 } catch {
 track(DashboardEvent.ERROR_SORT);
 }
 }

 async function moveDish(categoryId: string, idx: number, dir: number) {
 track(DashboardEvent.SORTED_ITEM);
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
 } catch {
 track(DashboardEvent.ERROR_SORT);
 }
 }

 async function toggleDishVisible(categoryId: string, dishId: string) {
 track(DashboardEvent.TOGGLED_ITEM_VISIBLE);
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
 } catch {
 track(DashboardEvent.ERROR_TOGGLE);
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
 className="sticky z-10 -mx-4 md:-mx-6 -mt-5 md:-mt-4 px-4 md:px-6 py-2 bg-card/90 backdrop-blur-md border-b border-border"
 style={{ top: "var(--topbar-h, 0px)" }}
 >
 <div className="max-w-2xl mx-auto flex items-center justify-between gap-3">
 <div className="flex items-center gap-2 min-w-0">
 {menuUrl ? (
 <span onClickCapture={() => track(DashboardEvent.CLICKED_PREVIEW_MENU)}>
 <PreviewButton url={menuUrl} />
 </span>
 ) : null}
 {menuUrl ? (
 <ShareButton
 onClick={() => {
 track(DashboardEvent.CLICKED_SHARE_MENU);
 setShareOpen(true);
 }}
 />
 ) : null}
 </div>
 {categories.length > 0 ? (
 <button
 type="button"
 onClick={allOpen ? collapseAll : expandAll}
 className="inline-flex items-center gap-1.5 h-8 px-2.5 text-xs font-medium text-muted-foreground rounded-lg transition-colors shrink-0"
 >
 {allOpen ? <CollapseIcon size={14} /> : <ExpandIcon size={14} />}
 {allOpen ? t("collapse") : t("expand")}
 </button>
 ) : null}
 </div>
 </div>

 <div className="max-w-2xl mx-auto pt-5 md:pt-4">
 <PageHeader
 title={t("title")}
 subtitle={t("subtitle")}
 action={
 <SubscriptionChip
 sub={sub}
 onClick={() => {
 track(DashboardEvent.CLICKED_SUBSCRIPTION_CHIP);
 router.push({ name: "settings.billing" });
 }}
 />
 }
 />

 {categories.length === 0 ? (
 <EmptyState
 title={t("noCategories")}
 subtitle={t("noCategoriesSub")}
 action={
 <button
 type="button"
 onClick={() => {
 track(DashboardEvent.CLICKED_ADD_CATEGORY);
 router.push({ name: "category.new" });
 }}
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
 track(DashboardEvent.CLICKED_ADD_CATEGORY);
 router.push({ name: "category.new" });
 }}
 className="w-full mt-2.5 h-11 text-sm font-medium text-muted-foreground border border-dashed border-input rounded-xl flex items-center justify-center gap-2 transition-colors"
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
 onMoveUp: () => void;
 onMoveDown: () => void;
 onMoveDish: (categoryId: string, idx: number, dir: number) => void;
 onToggleDishVisible: (categoryId: string, dishId: string) => void;
}) {
 const t = useTranslations("dashboard.menu");
 const router = useDashboardRouter();
 return (
 <div className="bg-card border border-border rounded-xl overflow-hidden">
 <div className="flex items-center gap-1 px-3 py-2.5">
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
 track(DashboardEvent.CLICKED_CATEGORY_ROW);
 router.push({ name: "category.edit", id: category.id });
 }}
 className="flex-1 min-w-0 text-left"
 >
 <span className="text-base font-medium text-foreground truncate block">
 {getMlWithFallback(category.name, defaultLang, defaultLang)}
 </span>
 </button>

 <div className="flex items-center gap-0.5 shrink-0">
 <button type="button" onClick={onMoveUp} disabled={isFirst} className={iconBtn} aria-label={t("moveCategoryUp")}>
 <ArrowUpIcon size={14} />
 </button>
 <button type="button" onClick={onMoveDown} disabled={isLast} className={iconBtn} aria-label={t("moveCategoryDown")}>
 <ArrowDownIcon size={14} />
 </button>
 <button
 type="button"
 onClick={() => {
 track(DashboardEvent.CLICKED_CATEGORY_ROW);
 router.push({ name: "category.edit", id: category.id });
 }}
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
 track(DashboardEvent.CLICKED_ADD_ITEM);
 router.push({ name: "item.new", categoryId: category.id });
 }}
 className="w-full flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground transition-colors border-t border-border"
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
 onMoveUp,
 onMoveDown,
 onToggleVisible,
}: {
 dish: Dish;
 defaultLang: string;
 currencySymbol: string;
 isFirst: boolean;
 isLast: boolean;
 onMoveUp: () => void;
 onMoveDown: () => void;
 onToggleVisible: () => void;
}) {
 const t = useTranslations("dashboard.menu");
 const tc = useTranslations("dashboard.common");
 const router = useDashboardRouter();
 const rowCls =
 "flex items-center gap-2 px-3 py-2 transition-colors " +
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
 track(DashboardEvent.CLICKED_ITEM_ROW);
 router.push({ name: "item.edit", id: dish.id });
 }}
 className="flex-1 min-w-0 text-left flex items-center gap-3"
 >
 <div className="min-w-0 flex-1">
 <div className="text-sm font-medium text-foreground truncate">
 {getMlWithFallback(dish.name, defaultLang, defaultLang)}
 </div>
 </div>
 <div className="text-sm text-muted-foreground tabular-nums shrink-0">{currencySymbol + dish.price}</div>
 </button>

 <div className="flex items-center gap-0.5 shrink-0 pl-1">
 <button
 type="button"
 onClick={onToggleVisible}
 className={iconBtn}
 aria-label={dish.visible ? t("hideDish") : t("showDish")}
 >
 {dish.visible ? <EyeIcon size={14} /> : <EyeOffIcon size={14} />}
 </button>
 <button
 type="button"
 onClick={() => {
 track(DashboardEvent.CLICKED_ITEM_ROW);
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
