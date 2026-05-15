"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useRestaurant } from "./restaurant-context";
import { useDashboardRouter } from "../_spa/router";
import {
 CheckIcon,
 ChevronLeftIcon,
 ChevronRightIcon,
 CopyIcon,
 MessageIcon,
 MoreVerticalIcon,
 PlusIcon,
 ReceiptIcon,
 RefreshIcon,
 SplitIcon,
 SwapIcon,
 TrashIcon,
} from "./icons";
import { ConfirmDialog, EmptyState, Modal, PageHeader } from "./ui";
import { FloorMap } from "./tables";
import {
 formatPrice,
 formatTimeShort,
 minutesSince,
 currencySymbolOf,
 parseDecimal,
 newId,
} from "./helpers";
import { getMlWithFallback } from "./i18n";
import { inputClass } from "./tokens";
import { createOrder, deleteOrder, patchOrder, splitOrder } from "./api";
import type {
 Category,
 Dish,
 DishOption,
 OptionVariant,
 Order,
 OrderItem,
 OrderItemOptionSnapshot,
 OrderItemStatus,
 TableEntity,
} from "./types";
import { track } from "@/lib/dashboard-events";

const ITEM_STATUS_KEYS: Record<OrderItemStatus, "statusPending" | "statusCooking" | "statusReady" | "statusServed"> = {
 pending: "statusPending",
 cooking: "statusCooking",
 ready: "statusReady",
 served: "statusServed",
};

// In-progress states (cooking) use the app's primary brand colour so they
// match the Save button and other CTA chrome; ready / served stay emerald;
// pending stays neutral grey.
const ITEM_STATUS_CLS: Record<OrderItemStatus, string> = {
 pending: "bg-secondary text-muted-foreground border-border",
 cooking: "bg-primary/10 text-primary border-primary/30",
 ready: "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-900",
 served: "bg-secondary text-muted-foreground border-border",
};

const STATUS_DOT_CLS: Record<OrderItemStatus, string> = {
 pending: "bg-slate-700 dark:bg-slate-400",
 cooking: "bg-amber-500 dark:bg-amber-400",
 ready: "bg-blue-600 dark:bg-blue-500",
 served: "bg-emerald-600 dark:bg-emerald-500",
};

const STATUS_ORDER: OrderItemStatus[] = ["pending", "cooking", "ready", "served"];

function calcItemPrice(item: OrderItem): number {
 const base = parseDecimal(item.basePriceSnapshot) || 0;
 const extras = item.options.reduce(
 (sum, o) => sum + (parseDecimal(o.priceDelta) || 0) * (o.quantity ?? 1),
 0,
 );
 return base + extras;
}

function calcOrderTotal(order: Order): number {
 return order.items.reduce((sum, it) => sum + calcItemPrice(it), 0);
}

// ── Modal navigation state ──
//
// list      — список заказов выбранного стола (только если есть заказы)
// order     — деталка одного заказа
// addItem   — степпер добавления блюда (категория → блюдо → конфиг).
//             orderId === null означает «order ещё не создан»; будет создан
//             в БД при сохранении первого блюда.

type ModalView =
 | { kind: "list" }
 | { kind: "order"; orderId: string }
 | {
 kind: "addItem";
 orderId: string | null;
 step: "category" | "dish" | "configure";
 categoryId?: string;
 dishId?: string;
 };

export function OrdersPage({
 orders,
 setOrders,
 tables,
 categories,
 defaultLang,
 currency,
}: {
 orders: Order[];
 setOrders: React.Dispatch<React.SetStateAction<Order[]>>;
 tables: TableEntity[];
 categories: Category[];
 defaultLang: string;
 currency: string;
}) {
 const t = useTranslations("dashboard.orders");
 const tc = useTranslations("dashboard.common");
 const router = useRouter();
 const restaurant = useRestaurant();
 const dashRouter = useDashboardRouter();
 const currencySymbol = currencySymbolOf(currency);

 const NO_TABLE = "__no_table__";
 const [activeTableId, setActiveTableId] = useState<string | null>(null);
 const [view, setView] = useState<ModalView | null>(null);
 const [creating, setCreating] = useState(false);
 const [confirmDeleteOrder, setConfirmDeleteOrder] = useState<string | null>(null);
 const [confirmCompleteOrder, setConfirmCompleteOrder] = useState<string | null>(null);
 const [moreOpen, setMoreOpen] = useState(false);
 const [changeTableForOrder, setChangeTableForOrder] = useState<string | null>(null);
 const [splitForOrder, setSplitForOrder] = useState<string | null>(null);
 const [headerBack, setHeaderBack] = useState<(() => void) | null>(null);
 const [wizardTitle, setWizardTitle] = useState<string | null>(null);
 const [wizardFooter, setWizardFooter] = useState<React.ReactNode | null>(null);
 const [openedFrom, setOpenedFrom] = useState<"table" | "list">("table");

 const activeOrders = orders.filter((o) => o.status === "active");
 const occupiedIds = useMemo(
 () => new Set(activeOrders.map((o) => o.tableId).filter((x): x is string => !!x)),
 [activeOrders],
 );
 const noTableOrders = activeOrders.filter((o) => !o.tableId);

 // Stol → "все позиции ready" (для зелёного тона плитки).
 const readyIds = useMemo(() => {
 const result = new Set<string>();
 for (const tbl of tables) {
 const tableOrders = activeOrders.filter((o) => o.tableId === tbl.id);
 if (tableOrders.length === 0) continue;
 const allItems = tableOrders.flatMap((o) => o.items);
 if (allItems.length === 0) continue;
 if (allItems.every((it) => it.status === "ready" || it.status === "served")) {
 result.add(tbl.id);
 }
 }
 return result;
 }, [tables, activeOrders]);

 function tileBadge(tableId: string): number | null {
 const tableOrders = activeOrders.filter((o) => o.tableId === tableId);
 return tableOrders.length || null;
 }

 const activeTable =
 activeTableId && activeTableId !== NO_TABLE
 ? tables.find((tbl) => tbl.id === activeTableId) || null
 : null;
 const isNoTable = activeTableId === NO_TABLE;
 const activeTableOrders = isNoTable
 ? noTableOrders
 : activeTable
 ? activeOrders.filter((o) => o.tableId === activeTable.id)
 : [];

 const currentOrder =
 view && view.kind !== "list" && view.kind !== "addItem"
 ? orders.find((o) => o.id === view.orderId) || null
 : view && view.kind === "addItem" && view.orderId
 ? orders.find((o) => o.id === view.orderId) || null
 : null;

 function openTable(id: string) {
 setActiveTableId(id);
 setOpenedFrom("table");
 setView({ kind: "list" });
 }

 function closeModal() {
 setView(null);
 setActiveTableId(null);
 }

 async function persistOrder(orderId: string, patch: Partial<Order>, base?: Order) {
 // First-item adds give us `base` explicitly because the closure-captured
 // `orders` does not yet see the order that ensureOrderForFirstItem just
 // pushed via setOrders — the state update is async. Without that, we
 // bail before calling patchOrder and the first item silently fails to
 // persist server-side; on the next poll the optimistic UI snaps back to
 // the empty server-side order and the user sees their first dish vanish.
 const target = base ?? orders.find((o) => o.id === orderId);
 if (!target) return;
 const next: Order = { ...target, ...patch };
 setOrders((all) => {
 if (all.some((o) => o.id === orderId)) {
 return all.map((o) => (o.id === orderId ? next : o));
 }
 return [...all, next];
 });
 try {
 await patchOrder(orderId, {
 status: next.status === "active" ? "in_progress" : next.status,
 items: next.items,
 total: calcOrderTotal(next),
 });
 } catch {
 }
 }

 function setItemStatus(orderId: string, itemId: string, status: OrderItemStatus) {
 const order = orders.find((o) => o.id === orderId);
 if (!order) return;
 const items = order.items.map((it) => (it.id === itemId ? { ...it, status } : it));
 persistOrder(orderId, { items });
 }

 function removeItem(orderId: string, itemId: string) {
 track("dash_orders_order_remove_item");
 const order = orders.find((o) => o.id === orderId);
 if (!order) return;
 const items = order.items.filter((it) => it.id !== itemId);
 persistOrder(orderId, { items });
 }

 function duplicateItem(orderId: string, itemId: string) {
 track("dash_orders_order_duplicate_item");
 const order = orders.find((o) => o.id === orderId);
 if (!order) return;
 const src = order.items.find((it) => it.id === itemId);
 if (!src) return;
 const copy: OrderItem = {
 ...src,
 id: newId(),
 status: "pending",
 createdAt: new Date().toISOString(),
 options: src.options.map((o) => ({ ...o })),
 };
 persistOrder(orderId, { items: [...order.items, copy] });
 }

 function completeOrder(orderId: string) {
 track("dash_orders_order_complete_order");
 persistOrder(orderId, { status: "completed" });
 const stillHasOrders = activeTableId
 ? activeOrders.some((o) => o.id !== orderId && o.tableId === activeTableId)
 : false;
 if (openedFrom !== "list" && stillHasOrders) {
 setView({ kind: "list" });
 } else {
 closeModal();
 }
 }

 async function removeOrder(orderId: string) {
 track("dash_orders_order_delete_order");
 setOrders((all) => all.filter((o) => o.id !== orderId));
 const stillHasOrders = activeTableId
 ? activeOrders.some((o) => o.id !== orderId && o.tableId === activeTableId)
 : false;
 if (openedFrom !== "list" && stillHasOrders) setView({ kind: "list" });
 else closeModal();
 try {
 await deleteOrder(orderId);
 router.refresh();
 } catch {
 }
 }

 // Лениво создаём заказ, когда сохраняется первое блюдо.
 async function ensureOrderForFirstItem(): Promise<Order | null> {
 if (!activeTableId) return null;
 let table: TableEntity | null = null;
 if (activeTableId !== NO_TABLE) {
 table = tables.find((tbl) => tbl.id === activeTableId) ?? null;
 if (!table) return null;
 }
 if (creating) return null;
 setCreating(true);
 try {
 const created = await createOrder(table ? { tableNumber: table.number } : {});
 const newOrder: Order = {
 id: created.id,
 tableId: table?.id ?? null,
 tableNumber: table?.number ?? null,
 dailyNumber: created.dailyNumber,
 guestName: "",
 createdAt: created.createdAt,
 status: "active",
 items: [],
 total: 0,
 };
 setOrders((all) => [...all, newOrder]);
 router.refresh();
 return newOrder;
 } catch {
 return null;
 } finally {
 setCreating(false);
 }
 }

 async function handleChangeTable(orderId: string, table: TableEntity) {
 track("dash_orders_order_change_table");
 setOrders((all) =>
 all.map((o) =>
 o.id === orderId ? { ...o, tableId: table.id, tableNumber: table.number } : o,
 ),
 );
 closeModal();
 try {
 await patchOrder(orderId, { tableNumber: table.number });
 router.refresh();
 } catch {
 }
 }

 async function handleSplit(orderId: string, itemIds: string[]) {
 track("dash_orders_order_split");
 const source = orders.find((o) => o.id === orderId);
 if (!source) return;
 const idSet = new Set(itemIds);
 const taken = source.items.filter((it) => idSet.has(it.id));
 const kept = source.items.filter((it) => !idSet.has(it.id));
 if (taken.length === 0) return;
 const sourceTotal = kept.reduce((sum, it) => sum + calcItemPrice(it), 0);
 const createdTotal = taken.reduce((sum, it) => sum + calcItemPrice(it), 0);
 try {
 const res = await splitOrder(orderId, { itemIds, sourceTotal, createdTotal });
 const newOrder: Order = {
 id: res.created.id,
 tableId: source.tableId,
 tableNumber: source.tableNumber,
 dailyNumber: res.created.dailyNumber,
 guestName: "",
 createdAt: res.created.createdAt,
 status: "active",
 items: taken,
 total: createdTotal,
 };
 setOrders((all) => [
 ...all.map((o) => (o.id === orderId ? { ...o, items: kept, total: sourceTotal } : o)),
 newOrder,
 ]);
 router.refresh();
 setView({ kind: "list" });
 } catch {
 }
 }

 async function handleAddItem(itemData: { options: OrderItemOptionSnapshot[]; notes: string }, dish: Dish) {
 track("dash_orders_order_save_item");
 const currentView = view;
 if (!currentView || currentView.kind !== "addItem") return;
 let orderId = currentView.orderId;
 let baseOrder: Order | null = null;
 if (!orderId) {
 const newOrder = await ensureOrderForFirstItem();
 if (!newOrder) return;
 orderId = newOrder.id;
 baseOrder = newOrder;
 }
 const newItem: OrderItem = {
 id: newId(),
 dishId: dish.id,
 dishNameSnapshot: dish.name,
 basePriceSnapshot: dish.price,
 options: itemData.options,
 notes: itemData.notes,
 status: "pending",
 createdAt: new Date().toISOString(),
 };
 // Prefer the fresh order returned by ensureOrderForFirstItem — `orders`
 // (closure) hasn't seen it yet, so falling back to .find would lose
 // the new order entirely on the very first dish.
 const base: Order | undefined = baseOrder ?? orders.find((o) => o.id === orderId);
 const items = [...(base?.items ?? []), newItem];
 persistOrder(orderId, { items }, base);
 setView({ kind: "order", orderId });
 }

 if (!restaurant.orderSettings.acceptOrders) {
 return (
 <div className="max-w-5xl mx-auto md:px-6">
 <PageHeader title={t("title")} />
 <div className="bg-card border border-border rounded-2xl px-6 py-12 flex flex-col items-center text-center">
 <div className="text-sm font-semibold text-foreground mb-2">{t("disabledTitle")}</div>
 <p className="text-sm text-muted-foreground mb-6 max-w-md leading-relaxed">{t("disabledBody")}</p>
 <button
 type="button"
 onClick={() => dashRouter.push({ name: "settings.orders" })}
 className="inline-flex items-center h-10 px-5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 active:scale-[0.99] transition"
 >
 {t("disabledCta")}
 </button>
 </div>
 </div>
 );
 }


 // Заголовок, подзаголовок, контент и футер модалки зависят от уровня.
 let modalTitle: React.ReactNode = "";
 let modalSubtitle: React.ReactNode = undefined;
 let modalContent: React.ReactNode = null;
 let modalFooter: React.ReactNode = null;
 let modalSize: "sm" | "md" | "lg" = "md";
 if (view?.kind === "list" || view?.kind === "addItem") modalSize = "sm";
 if (view) {
 if (view.kind === "list") {
 const tableLabel = isNoTable
 ? t("noTableLabel", { defaultValue: "No table" })
 : t("tableLabel", { number: activeTable?.number ?? "?" });
 modalTitle = tableLabel;
 modalContent = (
 <OrderListView
 orders={activeTableOrders}
 currencySymbol={currencySymbol}
 onSelect={(orderId) => {
 track("dash_orders_click_order");
 setView({ kind: "order", orderId });
 }}
 />
 );
 if (!isNoTable) {
 modalFooter = (
 <div className="flex justify-end">
 <button
 type="button"
 onClick={() =>
 setView({ kind: "addItem", orderId: null, step: "category" })
 }
 className="inline-flex items-center gap-1.5 h-8 px-3 text-xs font-medium text-primary-foreground bg-primary rounded-lg transition-colors"
 >
 <PlusIcon size={13} />
 {activeTableOrders.length === 0 ? t("startOrder") : t("newOrder")}
 </button>
 </div>
 );
 }
 } else if (view.kind === "order" && currentOrder) {
 const total = calcOrderTotal(currentOrder);
 const overall = computeOrderStatus(currentOrder);
 const overallText = overall
 ? overall === "served"
 ? t("statusServed")
 : t("inProgress", { defaultValue: "In progress" })
 : null;
 const orderLabel = t("orderLabel", {
 defaultValue: "Order #{number}",
 number: currentOrder.dailyNumber,
 });
 modalTitle = (
 <span>
 {orderLabel}
 {overall && overallText ? (
 <>
 {" · "}
 <span className={OVERALL_STATUS_TEXT_CLS[overall]}>{overallText}</span>
 </>
 ) : null}
 </span>
 );
 modalSubtitle = (
 <span>
 {t("createdLabel", { defaultValue: "Created" })}: {formatTimeShort(currentOrder.createdAt)}
 {" · "}
 {t("total")}: {formatPrice(total, currencySymbol)}
 </span>
 );
 modalContent = (
 <OrderDetailView
 order={currentOrder}
 defaultLang={defaultLang}
 currencySymbol={currencySymbol}
 onItemStatusChange={(itemId, status) =>
 setItemStatus(currentOrder.id, itemId, status)
 }
 onRemoveItem={(itemId) => removeItem(currentOrder.id, itemId)}
 onDuplicateItem={(itemId) => duplicateItem(currentOrder.id, itemId)}
 />
 );
 const hasUnservedItems =
 currentOrder.items.length > 0 &&
 currentOrder.items.some((it) => it.status !== "served");
 modalFooter = (
 <div className="flex items-center justify-between gap-2">
 <div className="relative">
 <button
 type="button"
 onClick={() => setMoreOpen((v) => !v)}
 className="w-8 h-8 inline-flex items-center justify-center rounded-lg text-foreground bg-card border border-border transition-colors"
 aria-label="More"
 title="More"
 >
 <MoreVerticalIcon size={14} />
 </button>
 {moreOpen ? (
 <>
 <div
 className="fixed inset-0 z-40"
 onClick={() => setMoreOpen(false)}
 />
 <div className="absolute left-0 bottom-full mb-2 z-50 min-w-[180px] bg-card border border-border rounded-lg shadow-lg overflow-hidden">
 {tables.length > 0 ? (
 <button
 type="button"
 onClick={() => {
 setMoreOpen(false);
 setChangeTableForOrder(currentOrder.id);
 }}
 className="w-full flex items-center gap-2 px-3 h-9 text-left text-xs font-medium text-foreground transition-colors"
 >
 <SwapIcon size={13} />
 {t("changeTable", { defaultValue: "Change table" })}
 </button>
 ) : null}
 <button
 type="button"
 onClick={() => {
 setMoreOpen(false);
 setSplitForOrder(currentOrder.id);
 }}
 disabled={currentOrder.items.length < 2}
 className="w-full flex items-center gap-2 px-3 h-9 text-left text-xs font-medium text-foreground transition-colors disabled:opacity-40"
 >
 <SplitIcon size={13} />
 {t("splitOrder", { defaultValue: "Split order" })}
 </button>
 <button
 type="button"
 onClick={() => {
 setMoreOpen(false);
 setConfirmDeleteOrder(currentOrder.id);
 }}
 className="w-full flex items-center gap-2 px-3 h-9 text-left text-xs font-medium text-red-600 transition-colors"
 >
 <TrashIcon size={13} />
 {t("deleteOrder")}
 </button>
 </div>
 </>
 ) : null}
 </div>
 <div className="flex items-center gap-2">
 <button
 type="button"
 onClick={() => {
 track("dash_orders_order_add_item");
 setView({
 kind: "addItem",
 orderId: currentOrder.id,
 step: "category",
 });
 }}
 className="inline-flex items-center gap-1.5 h-8 px-3 text-xs font-medium text-foreground bg-card border border-border rounded-lg transition-colors"
 >
 <PlusIcon size={13} />
 {t("dishShort", { defaultValue: "Dish" })}
 </button>
 <button
 type="button"
 onClick={() => setConfirmCompleteOrder(currentOrder.id)}
 disabled={currentOrder.items.length === 0}
 className="inline-flex items-center gap-1.5 h-8 px-3 text-xs font-medium text-primary-foreground bg-primary rounded-lg transition-colors disabled:opacity-40"
 >
 <CheckIcon size={13} />
 {t("closeShort", { defaultValue: "Close" })}
 </button>
 </div>
 </div>
 );
 } else if (view.kind === "addItem") {
 if (view.step === "category") {
 modalTitle = t("selectCategory", { defaultValue: "Select category" });
 } else if (view.step === "dish") {
 modalTitle = t("selectDish", { defaultValue: "Select dish" });
 } else {
 modalTitle = wizardTitle || t("addItem");
 }
 if (view.step === "configure") modalFooter = wizardFooter;
 modalContent = (
 <AddItemView
 categories={categories}
 defaultLang={defaultLang}
 currencySymbol={currencySymbol}
 view={view}
 setView={setView}
 onBackToOrder={() => {
 if (view.orderId) setView({ kind: "order", orderId: view.orderId });
 else setView({ kind: "list" });
 }}
 onAdd={handleAddItem}
 creating={creating}
 onRegisterBack={(fn) => setHeaderBack(() => fn)}
 onTitleChange={setWizardTitle}
 onRegisterFooter={setWizardFooter}
 />
 );
 }
 }

 const reserved = 220;
 const mapHeight = `calc(100dvh - var(--topbar-h, 0px) - ${reserved}px - env(safe-area-inset-bottom))`;

 function openOrderDirect(order: Order) {
 setActiveTableId(order.tableId ?? NO_TABLE);
 setOpenedFrom("list");
 setView({ kind: "order", orderId: order.id });
 }

 const hasTables = tables.length > 0;

 // Tableless restaurants (delivery, takeaway-only, kiosks) still need to
 // place orders — render a list-only view with a "New order" button that
 // skips table selection entirely.
 function startTablelessOrder() {
 track("dash_orders_click_new_no_table");
 setActiveTableId(NO_TABLE);
 setOpenedFrom("list");
 setView({ kind: "addItem", orderId: null, step: "category" });
 }

 return (
 <div className="max-w-5xl mx-auto md:px-6">
 <PageHeader title={t("title")} subtitle={hasTables ? t("tapTable") : undefined} />

 <div className={hasTables ? "lg:flex lg:gap-4 lg:items-start" : ""}>
 {hasTables ? (
 <div
 className="aspect-square mx-auto lg:mx-0 lg:shrink-0 w-full lg:w-auto lg:h-[var(--map-h)]"
 style={{ "--map-h": mapHeight } as React.CSSProperties}
 >
 <FloorMap
 tables={tables}
 selectedId={null}
 onSelectTable={(id) => {
 if (!id) return;
 track("dash_orders_click_table");
 openTable(id);
 }}
 occupiedIds={occupiedIds}
 readyIds={readyIds}
 badgeFor={tileBadge}
 wide
 />
 </div>
 ) : null}

 <div className={(hasTables ? "lg:flex-1 lg:min-w-0 mt-4 lg:mt-0" : "mt-4") + " flex flex-col gap-3"}>
 {!hasTables ? (
 <button
 type="button"
 onClick={startTablelessOrder}
 disabled={creating}
 className="inline-flex items-center justify-center h-10 px-5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 active:scale-[0.99] transition disabled:opacity-50"
 >
 <PlusIcon size={16} className="mr-1.5" />
 {t("newOrder")}
 </button>
 ) : null}
 {activeOrders.length === 0 ? (
 <div className="w-full h-full min-h-[200px] flex items-center justify-center bg-card border border-border rounded-xl px-6 py-10 text-center">
 <div>
 <div className="text-sm font-medium text-foreground mb-1">
 {t("noActiveTitle", { defaultValue: "No active orders" })}
 </div>
 <div className="text-xs text-muted-foreground">
 {t("noActiveBody", {
 defaultValue: "New orders will show up here.",
 })}
 </div>
 </div>
 </div>
 ) : (
 <div className="flex flex-col gap-2">
 {activeOrders.map((o) => (
 <OrderListCard
 key={o.id}
 order={o}
 currencySymbol={currencySymbol}
 onClick={() => openOrderDirect(o)}
 variant="card"
 />
 ))}
 </div>
 )}
 </div>
 </div>


 <Modal
 open={!!view}
 onClose={() => {
 if (!view) return;
 if (view.kind === "addItem") {
 if (view.orderId) setView({ kind: "order", orderId: view.orderId });
 else if (openedFrom === "list") closeModal();
 else setView({ kind: "list" });
 return;
 }
 if (view.kind === "order") {
 if (openedFrom === "list") {
 closeModal();
 } else if (activeTableOrders.length > 1) {
 setView({ kind: "list" });
 } else {
 closeModal();
 }
 return;
 }
 closeModal();
 }}
 onBack={view?.kind === "addItem" ? headerBack : null}
 title={modalTitle}
 subtitle={modalSubtitle}
 size={modalSize}
 footer={modalFooter}
 closeOnBackdrop={view?.kind !== "addItem"}
 >
 {modalContent}
 </Modal>

 <ConfirmDialog
 open={!!confirmDeleteOrder}
 title={t("deleteOrderTitle")}
 message={t("deleteOrderMessage")}
 confirmLabel={tc("delete")}
 onCancel={() => setConfirmDeleteOrder(null)}
 onConfirm={() => {
 if (confirmDeleteOrder) removeOrder(confirmDeleteOrder);
 setConfirmDeleteOrder(null);
 }}
 />

 <ConfirmDialog
 open={!!confirmCompleteOrder}
 title={t("completeOrder")}
 message={
 confirmCompleteOrder &&
 orders
 .find((o) => o.id === confirmCompleteOrder)
 ?.items.some((it) => it.status !== "served")
 ? t("completeOrderUnservedMessage", {
 defaultValue: "Some items are not served yet. Complete order anyway?",
 })
 : t("completeOrderMessage", {
 defaultValue: "Close this order?",
 })
 }
 confirmLabel={t("completeOrder")}
 confirmStyle="primary"
 onCancel={() => setConfirmCompleteOrder(null)}
 onConfirm={() => {
 if (confirmCompleteOrder) completeOrder(confirmCompleteOrder);
 setConfirmCompleteOrder(null);
 }}
 />

 <ChangeTableModal
 orderId={changeTableForOrder}
 orders={orders}
 tables={tables}
 occupiedIds={occupiedIds}
 onClose={() => setChangeTableForOrder(null)}
 onConfirm={async (orderId, table) => {
 await handleChangeTable(orderId, table);
 setChangeTableForOrder(null);
 }}
 />

 <SplitOrderModal
 orderId={splitForOrder}
 orders={orders}
 defaultLang={defaultLang}
 currencySymbol={currencySymbol}
 onClose={() => setSplitForOrder(null)}
 onConfirm={async (orderId, itemIds) => {
 await handleSplit(orderId, itemIds);
 setSplitForOrder(null);
 }}
 />
 </div>
 );
}

// ── Level 1: список заказов стола ──

function OrderListView({
 orders,
 currencySymbol,
 onSelect,
}: {
 orders: Order[];
 currencySymbol: string;
 onSelect: (orderId: string) => void;
}) {
 const t = useTranslations("dashboard.orders");
 if (orders.length === 0) {
 return (
 <div className="text-center py-10">
 <ReceiptIcon size={28} className="mx-auto text-muted-foreground/50 mb-2" />
 <p className="text-xs text-muted-foreground">{t("noActiveShort")}</p>
 </div>
 );
 }
 return (
 <div className="-m-5 divide-y divide-border">
 {orders.map((order) => (
 <OrderListCard
 key={order.id}
 order={order}
 currencySymbol={currencySymbol}
 onClick={() => onSelect(order.id)}
 />
 ))}
 </div>
 );
}

function OrderListCard({
 order,
 currencySymbol,
 onClick,
 variant = "row",
}: {
 order: Order;
 currencySymbol: string;
 onClick: () => void;
 variant?: "row" | "card";
}) {
 const t = useTranslations("dashboard.orders");
 const total = calcOrderTotal(order);
 const itemsCount = order.items.length;
 const overallStatus = computeOrderStatus(order);
 const statusLabel = overallStatus === "served"
 ? t("statusServed")
 : overallStatus === "inProgress"
 ? t("inProgress", { defaultValue: "In progress" })
 : null;
 const orderLabel = t("orderLabel", {
 defaultValue: "Order #{number}",
 number: order.dailyNumber,
 });

 const cls =
 variant === "card"
 ? "w-full text-left bg-card border border-border rounded-xl px-4 py-3 transition-colors"
 : "w-full text-left px-5 py-3 transition-colors";
 return (
 <button type="button" onClick={onClick} className={cls}>
 <div className="flex items-center gap-2">
 <div className="min-w-0 flex-1 text-sm font-medium text-foreground truncate">
 {orderLabel}
 {statusLabel && overallStatus ? (
 <>
 <span className="text-muted-foreground font-normal"> · </span>
 <span className={OVERALL_STATUS_TEXT_CLS[overallStatus]}>{statusLabel}</span>
 </>
 ) : null}
 </div>
 <div className="shrink-0 text-sm font-medium text-foreground tabular-nums">
 {formatPrice(total, currencySymbol)}
 </div>
 <ChevronRightIcon size={14} className="shrink-0 text-muted-foreground" />
 </div>
 <div className="text-xs text-muted-foreground mt-0.5 truncate">
 {t("createdLabel", { defaultValue: "Created" })} {formatTimeShort(order.createdAt)}
 {" · "}
 {itemsCount === 1
 ? t("itemOne", { count: itemsCount })
 : t("itemOther", { count: itemsCount })}
 </div>
 </button>
 );
}

type OverallStatus = "served" | "inProgress";

function computeOrderStatus(order: Order): OverallStatus | null {
 if (order.items.length === 0) return null;
 if (order.items.every((it) => it.status === "served")) return "served";
 return "inProgress";
}

const OVERALL_STATUS_CLS: Record<OverallStatus, string> = {
 served:
 "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-900",
 inProgress:
 "bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-900",
};

const OVERALL_STATUS_TEXT_CLS: Record<OverallStatus, string> = {
 served: "text-emerald-700 dark:text-emerald-300",
 inProgress: "text-primary",
};

// ── Level 2: деталка заказа ──

function OrderDetailView({
 order,
 defaultLang,
 currencySymbol,
 onItemStatusChange,
 onRemoveItem,
 onDuplicateItem,
}: {
 order: Order;
 defaultLang: string;
 currencySymbol: string;
 onItemStatusChange: (itemId: string, status: OrderItemStatus) => void;
 onRemoveItem: (itemId: string) => void;
 onDuplicateItem: (itemId: string) => void;
}) {
 const t = useTranslations("dashboard.orders");

 if (order.items.length === 0) {
 return (
 <div className="text-center py-10">
 <ReceiptIcon size={28} className="mx-auto text-muted-foreground/50 mb-2" />
 <p className="text-xs text-muted-foreground">{t("noItems")}</p>
 </div>
 );
 }

 const sortedItems = [...order.items].sort((a, b) => {
 if (a.dishId !== b.dishId) return a.dishId.localeCompare(b.dishId);
 return a.createdAt.localeCompare(b.createdAt);
 });
 return (
 <div className="-my-3 divide-y divide-border">
 {sortedItems.map((item) => (
 <OrderItemCard
 key={item.id}
 item={item}
 defaultLang={defaultLang}
 currencySymbol={currencySymbol}
 onStatusChange={(status) => onItemStatusChange(item.id, status)}
 onRemove={() => onRemoveItem(item.id)}
 onDuplicate={() => onDuplicateItem(item.id)}
 />
 ))}
 </div>
 );
}

function OrderItemCard({
 item,
 defaultLang,
 currencySymbol,
 onStatusChange,
 onRemove,
 onDuplicate,
}: {
 item: OrderItem;
 defaultLang: string;
 currencySymbol: string;
 onStatusChange: (status: OrderItemStatus) => void;
 onRemove: () => void;
 onDuplicate: () => void;
}) {
 const t = useTranslations("dashboard.orders");
 const statusKey = ITEM_STATUS_KEYS[item.status] || ITEM_STATUS_KEYS.pending;
 const price = calcItemPrice(item);

 return (
 <div className="py-3">
 <div className="flex items-center gap-2">
 <span
 className={"shrink-0 w-2 h-2 rounded-full " + STATUS_DOT_CLS[item.status]}
 title={t(statusKey)}
 aria-label={t(statusKey)}
 />
 <div className="min-w-0 flex-1 flex items-baseline gap-1 text-sm font-medium text-foreground leading-6">
 <span className="min-w-0 truncate">
 {getMlWithFallback(item.dishNameSnapshot, defaultLang, defaultLang)}
 </span>
 <span className="shrink-0 text-[13px] text-muted-foreground font-normal tabular-nums">
 · {formatPrice(price, currencySymbol)}
 </span>
 </div>
 <ItemMoreMenu
 currentStatus={item.status}
 onStatusChange={onStatusChange}
 onDuplicate={onDuplicate}
 onRemove={onRemove}
 statusLabels={{
 pending: t("statusPending"),
 cooking: t("statusCooking"),
 ready: t("statusReady"),
 served: t("statusServed"),
 }}
 duplicateLabel={t("duplicateItem", { defaultValue: "Duplicate" })}
 removeLabel={t("removeItem")}
 />
 </div>
 {item.options.length > 0 ? (
 <div className="text-xs text-muted-foreground mt-0.5 space-y-0.5 pl-4">
 {item.options.map((o, i) => {
 const name = getMlWithFallback(o.variantName, defaultLang, defaultLang);
 const delta = parseDecimal(o.priceDelta) || 0;
 const qty = o.quantity ?? 1;
 const parts: string[] = [];
 if (qty > 1) parts.push(`×${qty}`);
 parts.push(name);
 if (delta > 0) parts.push(`+${formatPrice(delta, currencySymbol)}`);
 return <div key={i}>{parts.join(" · ")}</div>;
 })}
 </div>
 ) : null}
 {item.notes ? (
 <div className="text-xs text-muted-foreground mt-0.5 pl-4">
 {t("notesLabel")}: {item.notes}
 </div>
 ) : null}
 </div>
 );
}

// ── Level 3: добавление блюда (степпер) ──

function AddItemView({
 categories,
 defaultLang,
 currencySymbol,
 view,
 setView,
 onBackToOrder,
 onAdd,
 creating,
 onRegisterBack,
 onTitleChange,
 onRegisterFooter,
}: {
 categories: Category[];
 defaultLang: string;
 currencySymbol: string;
 view: Extract<ModalView, { kind: "addItem" }>;
 setView: React.Dispatch<React.SetStateAction<ModalView | null>>;
 onBackToOrder: () => void;
 onAdd: (data: { options: OrderItemOptionSnapshot[]; notes: string }, dish: Dish) => void;
 creating: boolean;
 onRegisterBack: (fn: (() => void) | null) => void;
 onTitleChange: (title: string | null) => void;
 onRegisterFooter: (node: React.ReactNode | null) => void;
}) {
 const t = useTranslations("dashboard.orders");

 function goCategory() {
 setView({ kind: "addItem", orderId: view.orderId, step: "category" });
 }
 function goDish(categoryId: string) {
 setView({ kind: "addItem", orderId: view.orderId, step: "dish", categoryId });
 }
 function goConfigure(categoryId: string, dishId: string) {
 setView({ kind: "addItem", orderId: view.orderId, step: "configure", categoryId, dishId });
 }

 // Register back handler in modal header for category/dish steps.
 // Configure step delegates to DishWizard which registers its own.
 useEffect(() => {
 if (view.step === "dish") {
 onRegisterBack(goCategory);
 }
 // category step: no back; configure: DishWizard registers its own.
 return () => {
 if (view.step !== "configure") onRegisterBack(null);
 };
 // eslint-disable-next-line react-hooks/exhaustive-deps
 }, [view.step, view.categoryId, view.dishId, view.orderId]);

 if (view.step === "configure") {
 const cat = categories.find((c) => c.id === view.categoryId);
 const dish = cat?.dishes.find((d) => d.id === view.dishId);
 if (!dish || !cat) {
 goCategory();
 return null;
 }
 return (
 <DishWizard
 dish={dish}
 defaultLang={defaultLang}
 currencySymbol={currencySymbol}
 creating={creating}
 onBack={() => goDish(cat.id)}
 onAdd={(data) => onAdd(data, dish)}
 onRegisterBack={onRegisterBack}
 onTitleChange={onTitleChange}
 onRegisterFooter={onRegisterFooter}
 />
 );
 }

 if (view.step === "dish") {
 const cat = categories.find((c) => c.id === view.categoryId);
 if (!cat) {
 goCategory();
 return null;
 }
  // Order-flow lists every dish in the category, including ones hidden from
  // the public menu — staff still need a way to add them to in-house orders.
  const visibleDishes = cat.dishes;
 return (
 <div>
 {visibleDishes.length === 0 ? (
 <p className="text-sm text-muted-foreground text-center py-6">{t("noDishesInCategory")}</p>
 ) : (
 <div className="-m-5 divide-y divide-border">
 {visibleDishes.map((d) => (
 <button
 key={d.id}
 type="button"
 onClick={() => {
 track("dash_orders_order_select_item");
 goConfigure(cat.id, d.id);
 }}
 className="w-full text-left flex items-center justify-between gap-3 px-5 py-3 transition-colors"
 >
 <span className="min-w-0 flex-1 text-sm text-foreground truncate">
 {getMlWithFallback(d.name, defaultLang, defaultLang)}
 </span>
 <span className="text-sm text-muted-foreground tabular-nums shrink-0">
 {currencySymbol + d.price}
 </span>
 <ChevronRightIcon size={14} className="shrink-0 text-muted-foreground" />
 </button>
 ))}
 </div>
 )}
 </div>
 );
 }

 // step === "category"
 return (
 <div>
 {categories.length === 0 ? (
 <p className="text-sm text-muted-foreground text-center py-6">{t("noDishesInCategory")}</p>
 ) : (
 <div className="-m-5 divide-y divide-border">
 {categories.map((c) => (
 <button
 key={c.id}
 type="button"
 onClick={() => {
 track("dash_orders_order_select_category");
 goDish(c.id);
 }}
 className="w-full text-left flex items-center justify-between gap-3 px-5 py-3 transition-colors"
 >
 <span className="min-w-0 flex-1 text-sm font-medium text-foreground truncate">
 {getMlWithFallback(c.name, defaultLang, defaultLang)}
 </span>
 <ChevronRightIcon size={14} className="shrink-0 text-muted-foreground" />
 </button>
 ))}
 </div>
 )}
 </div>
 );
}

type WizardSubstep =
 | { kind: "required"; index: number }
 | { kind: "extras"; index: number }
 | { kind: "notes" };

function DishWizard({
 dish,
 defaultLang,
 currencySymbol,
 creating,
 onBack,
 onAdd,
 onRegisterBack,
 onTitleChange,
 onRegisterFooter,
}: {
 dish: Dish;
 defaultLang: string;
 currencySymbol: string;
 creating: boolean;
 onBack: () => void;
 onAdd: (data: { options: OrderItemOptionSnapshot[]; notes: string }) => void;
 onRegisterBack?: (fn: (() => void) | null) => void;
 onTitleChange?: (title: string | null) => void;
 onRegisterFooter?: (node: React.ReactNode | null) => void;
}) {
 const t = useTranslations("dashboard.orders");
 const requiredOpts = (dish.options || []).filter((o) => o.required);
 const extraOpts = (dish.options || []).filter((o) => !o.required);

 const initialSubstep: WizardSubstep =
 requiredOpts.length > 0
 ? { kind: "required", index: 0 }
 : extraOpts.length > 0
 ? { kind: "extras", index: 0 }
 : { kind: "notes" };
 const [substep, setSubstep] = useState<WizardSubstep>(initialSubstep);

 const [reqSelections, setReqSelections] = useState<Record<string, string | string[] | null>>(() => {
 const init: Record<string, string | string[] | null> = {};
 requiredOpts.forEach((opt) => {
 if (opt.type === "single") init[opt.id] = null;
 else init[opt.id] = [];
 });
 return init;
 });
 const [extraQty, setExtraQty] = useState<Record<string, number>>({});
 const [notes, setNotes] = useState("");

 function setQty(variantId: string, qty: number) {
 setExtraQty((s) => {
 const next = { ...s };
 if (qty <= 0) delete next[variantId];
 else next[variantId] = qty;
 return next;
 });
 }

 function buildSnapshots(): OrderItemOptionSnapshot[] {
 const items: OrderItemOptionSnapshot[] = [];
 requiredOpts.forEach((opt) => {
 const sel = reqSelections[opt.id];
 if (opt.type === "single" && typeof sel === "string") {
 const v = opt.variants.find((vv) => vv.id === sel);
 if (v) items.push({ optionName: opt.name, variantName: v.name, priceDelta: v.priceDelta });
 }
 if (opt.type === "multi" && Array.isArray(sel)) {
 sel.forEach((vid) => {
 const v = opt.variants.find((vv) => vv.id === vid);
 if (v) items.push({ optionName: opt.name, variantName: v.name, priceDelta: v.priceDelta });
 });
 }
 });
 extraOpts.forEach((opt) => {
 opt.variants.forEach((v) => {
 const qty = extraQty[v.id] ?? 0;
 if (qty > 0) {
 items.push({ optionName: opt.name, variantName: v.name, priceDelta: v.priceDelta, quantity: qty });
 }
 });
 });
 return items;
 }

 const snapshots = buildSnapshots();
 const totalPrice =
 (parseDecimal(dish.price) || 0) +
 snapshots.reduce((sum, o) => sum + (parseDecimal(o.priceDelta) || 0) * (o.quantity ?? 1), 0);

 function goAfterRequired() {
 if (extraOpts.length > 0) setSubstep({ kind: "extras", index: 0 });
 else setSubstep({ kind: "notes" });
 }

 function advanceFromRequired(idx: number) {
 if (idx + 1 < requiredOpts.length) setSubstep({ kind: "required", index: idx + 1 });
 else goAfterRequired();
 }

 function advanceFromExtras(idx: number) {
 if (idx + 1 < extraOpts.length) setSubstep({ kind: "extras", index: idx + 1 });
 else setSubstep({ kind: "notes" });
 }

 function handleBack() {
 if (substep.kind === "required") {
 if (substep.index === 0) onBack();
 else setSubstep({ kind: "required", index: substep.index - 1 });
 } else if (substep.kind === "extras") {
 if (substep.index > 0) setSubstep({ kind: "extras", index: substep.index - 1 });
 else if (requiredOpts.length > 0) setSubstep({ kind: "required", index: requiredOpts.length - 1 });
 else onBack();
 } else {
 // notes
 if (extraOpts.length > 0) setSubstep({ kind: "extras", index: extraOpts.length - 1 });
 else if (requiredOpts.length > 0) setSubstep({ kind: "required", index: requiredOpts.length - 1 });
 else onBack();
 }
 }

 const stepIndex =
 substep.kind === "required" || substep.kind === "extras" ? substep.index : -1;

 useEffect(() => {
 if (!onRegisterBack) return;
 onRegisterBack(() => handleBack());
 return () => onRegisterBack(null);
 // eslint-disable-next-line react-hooks/exhaustive-deps
 }, [substep.kind, stepIndex, requiredOpts.length, extraOpts.length]);

 // Set modal title per substep.
 useEffect(() => {
 if (!onTitleChange) return;
 if (substep.kind === "required") {
 const opt = requiredOpts[substep.index];
 const name = opt ? getMlWithFallback(opt.name, defaultLang, defaultLang) : "";
 onTitleChange(t("selectOption", { defaultValue: "Select {name}", name }));
 } else if (substep.kind === "extras") {
 const opt = extraOpts[substep.index];
 const name = opt ? getMlWithFallback(opt.name, defaultLang, defaultLang) : "";
 onTitleChange(t("selectOption", { defaultValue: "Select {name}", name }));
 } else {
 onTitleChange(t("commentStep", { defaultValue: "Comment" }));
 }
 return () => onTitleChange(null);
 // eslint-disable-next-line react-hooks/exhaustive-deps
 }, [substep.kind, stepIndex]);

 function pickRequiredVariant(opt: DishOption, idx: number, variantId: string) {
 if (opt.type === "single") {
 setReqSelections((s) => ({ ...s, [opt.id]: variantId }));
 advanceFromRequired(idx);
 } else {
 setReqSelections((s) => {
 const cur = (s[opt.id] as string[]) || [];
 return {
 ...s,
 [opt.id]: cur.includes(variantId) ? cur.filter((v) => v !== variantId) : [...cur, variantId],
 };
 });
 }
 }

 function handleMultiContinue(opt: DishOption, idx: number) {
 const sel = reqSelections[opt.id];
 if (!Array.isArray(sel) || sel.length === 0) return;
 advanceFromRequired(idx);
 }

 function handleAdd() {
 onAdd({ options: snapshots, notes: notes.trim() });
 }

 const currentOpt = substep.kind === "required" ? requiredOpts[substep.index] : null;

 // Footer button (registered to modal footer).
 const multiEnabled =
 substep.kind === "required" &&
 currentOpt &&
 currentOpt.type === "multi" &&
 Array.isArray(reqSelections[currentOpt.id]) &&
 (reqSelections[currentOpt.id] as string[]).length > 0;
 const btnCls =
 "inline-flex items-center gap-1.5 h-8 px-3 text-xs font-medium text-primary-foreground bg-primary rounded-lg transition-colors disabled:opacity-40";
 const footerNode: React.ReactNode = (() => {
 if (substep.kind === "required" && currentOpt && currentOpt.type === "multi") {
 return (
 <div className="flex justify-end">
 <button
 type="button"
 onClick={() => handleMultiContinue(currentOpt, substep.index)}
 disabled={!multiEnabled}
 className={btnCls}
 >
 {t("continue")}
 </button>
 </div>
 );
 }
 if (substep.kind === "extras") {
 return (
 <div className="flex justify-end">
 <button
 type="button"
 onClick={() => advanceFromExtras(substep.index)}
 className={btnCls}
 >
 {t("continue")}
 </button>
 </div>
 );
 }
 if (substep.kind === "notes") {
 return (
 <div className="flex justify-end">
 <button
 type="button"
 onClick={handleAdd}
 disabled={creating}
 className={btnCls}
 >
 {creating ? (
 <span className="inline-block w-3 h-3 border-2 border-current border-r-transparent rounded-full animate-spin" />
 ) : (
 t("addPrice", { price: formatPrice(totalPrice, currencySymbol) })
 )}
 </button>
 </div>
 );
 }
 return null;
 })();

 useEffect(() => {
 if (!onRegisterFooter) return;
 onRegisterFooter(footerNode);
 return () => onRegisterFooter(null);
 // eslint-disable-next-line react-hooks/exhaustive-deps
 }, [
 substep.kind,
 stepIndex,
 multiEnabled,
 creating,
 totalPrice,
 notes,
 ]);

 if (substep.kind === "required" && currentOpt) {
 const isMulti = currentOpt.type === "multi";
 return (
 <div className="-m-5 divide-y divide-border">
 {currentOpt.variants.map((v) => {
 const sel = reqSelections[currentOpt.id];
 const isSelected = isMulti
 ? Array.isArray(sel) && sel.includes(v.id)
 : sel === v.id;
 const delta = parseDecimal(v.priceDelta) || 0;
 return (
 <button
 key={v.id}
 type="button"
 onClick={() => pickRequiredVariant(currentOpt, substep.index, v.id)}
 className="w-full text-left flex items-center justify-between gap-3 px-5 py-3 transition-colors"
 >
 <span className={"min-w-0 flex-1 text-sm truncate " + (isSelected ? "font-medium text-foreground" : "text-foreground")}>
 {getMlWithFallback(v.name, defaultLang, defaultLang)}
 </span>
 {delta > 0 ? (
 <span className="text-sm text-muted-foreground tabular-nums shrink-0">
 {`+${delta.toFixed(2)}`}
 </span>
 ) : null}
 {isMulti ? (
 <span
 className={
 "w-4 h-4 inline-flex items-center justify-center rounded border shrink-0 " +
 (isSelected
 ? "bg-primary border-primary text-primary-foreground"
 : "border-input")
 }
 >
 {isSelected ? <CheckIcon size={10} /> : null}
 </span>
 ) : (
 <ChevronRightIcon size={14} className="shrink-0 text-muted-foreground" />
 )}
 </button>
 );
 })}
 </div>
 );
 }

 if (substep.kind === "extras") {
 const opt = extraOpts[substep.index];
 if (!opt) return null;
 return (
 <div className="-m-5 divide-y divide-border">
 {opt.variants.map((v) => {
 const qty = extraQty[v.id] ?? 0;
 const delta = parseDecimal(v.priceDelta) || 0;
 return (
 <div
 key={v.id}
 className="flex items-center justify-between gap-3 px-5 py-3"
 >
 <div className="min-w-0 flex-1">
 <div className="text-sm text-foreground truncate">
 {getMlWithFallback(v.name, defaultLang, defaultLang)}
 </div>
 {delta > 0 ? (
 <div className="text-[11px] text-muted-foreground tabular-nums">
 {t("perEach", { amount: delta.toFixed(2) })}
 </div>
 ) : null}
 </div>
 <div className="flex items-center gap-2 shrink-0">
 <button
 type="button"
 onClick={() => setQty(v.id, qty - 1)}
 disabled={qty <= 0}
 className="w-8 h-8 rounded-md border border-border text-foreground transition-colors disabled:opacity-30"
 aria-label={t("decrease")}
 >
 −
 </button>
 <div className="w-6 text-center text-sm font-medium text-foreground tabular-nums">
 {qty}
 </div>
 <button
 type="button"
 onClick={() => setQty(v.id, qty + 1)}
 className="w-8 h-8 rounded-md border border-border text-foreground transition-colors"
 aria-label={t("increase")}
 >
 +
 </button>
 </div>
 </div>
 );
 })}
 </div>
 );
 }

 // notes
 const dishNameDisplay = getMlWithFallback(dish.name, defaultLang, defaultLang);
 return (
 <div className="-m-5 divide-y divide-border">
 <div className="px-5 py-3">
 <div className="flex items-start justify-between gap-3">
 <div className="text-sm font-medium text-foreground min-w-0 flex-1">
 {dishNameDisplay}
 </div>
 <div className="text-sm font-medium text-foreground tabular-nums shrink-0">
 {formatPrice(totalPrice, currencySymbol)}
 </div>
 </div>
 {snapshots.length > 0 ? (
 <div className="text-xs text-muted-foreground mt-1 space-y-0.5">
 {snapshots.map((o, i) => {
 const name = getMlWithFallback(o.variantName, defaultLang, defaultLang);
 const delta = parseDecimal(o.priceDelta) || 0;
 const qty = o.quantity ?? 1;
 const parts: string[] = [name];
 if (delta > 0) parts.push(`+${formatPrice(delta, currencySymbol)}`);
 if (qty > 1) parts.push(`× ${qty}`);
 return <div key={i}>{parts.join(" ")}</div>;
 })}
 </div>
 ) : null}
 </div>
 <div className="px-5 py-3">
 <NotesTextarea
 value={notes}
 onChange={setNotes}
 placeholder={t("notesLabel") + ": " + t("notesPlaceholder")}
 />
 </div>
 </div>
 );
}

function NotesTextarea({
 value,
 onChange,
 placeholder,
}: {
 value: string;
 onChange: (v: string) => void;
 placeholder: string;
}) {
 const ref = useRef<HTMLTextAreaElement | null>(null);
 useEffect(() => {
 const el = ref.current;
 if (!el) return;
 el.style.height = "auto";
 el.style.height = Math.max(50, el.scrollHeight) + "px";
 }, [value]);
 return (
 <textarea
 ref={ref}
 id="item-notes"
 value={value}
 onChange={(e) => onChange(e.target.value)}
 onFocus={() => track("dash_orders_order_focus_note")}
 placeholder={placeholder}
 className="w-full bg-transparent border-0 outline-none resize-none text-sm text-foreground placeholder:text-muted-foreground p-0 m-0"
 style={{ minHeight: 50 }}
 />
 );
}

// ── Change-table modal ──

function ChangeTableModal({
 orderId,
 orders,
 tables,
 occupiedIds,
 onClose,
 onConfirm,
}: {
 orderId: string | null;
 orders: Order[];
 tables: TableEntity[];
 occupiedIds: Set<string>;
 onClose: () => void;
 onConfirm: (orderId: string, table: TableEntity) => void | Promise<void>;
}) {
 const t = useTranslations("dashboard.orders");
 const tc = useTranslations("dashboard.common");
 const order = orders.find((o) => o.id === orderId) || null;
 const [selectedId, setSelectedId] = useState<string | null>(null);
 useEffect(() => {
 setSelectedId(order?.tableId ?? null);
 }, [order?.id, order?.tableId]);

 if (!orderId || !order) return null;
 const selectedTable = selectedId ? tables.find((tbl) => tbl.id === selectedId) : null;
 const isSame = selectedTable && selectedTable.id === order.tableId;

 return (
 <Modal
 open={!!orderId}
 onClose={onClose}
 title={t("changeTable", { defaultValue: "Change table" })}
 size="sm"
 closeOnBackdrop={false}
 footer={
 <div className="flex items-center justify-end gap-2">
 <button
 type="button"
 onClick={onClose}
 className="h-8 px-3 text-xs font-medium text-foreground bg-card border border-border rounded-lg transition-colors"
 >
 {tc("cancel")}
 </button>
 <button
 type="button"
 onClick={() => {
 if (selectedTable) onConfirm(orderId, selectedTable);
 }}
 disabled={!selectedTable || isSame === true}
 className="h-8 px-3 text-xs font-medium text-primary-foreground bg-primary rounded-lg transition-colors disabled:opacity-40"
 >
 {tc("save")}
 </button>
 </div>
 }
 >
 <div className="-m-5 aspect-square w-auto [&_.floor-map]:border-0 [&_.floor-map]:rounded-none">
 <FloorMap
 tables={tables}
 selectedId={selectedId}
 onSelectTable={(id) => setSelectedId(id)}
 occupiedIds={occupiedIds}
 wide
 />
 </div>
 </Modal>
 );
}

// ── Split-order modal ──

function SplitOrderModal({
 orderId,
 orders,
 defaultLang,
 currencySymbol,
 onClose,
 onConfirm,
}: {
 orderId: string | null;
 orders: Order[];
 defaultLang: string;
 currencySymbol: string;
 onClose: () => void;
 onConfirm: (orderId: string, itemIds: string[]) => void | Promise<void>;
}) {
 const t = useTranslations("dashboard.orders");
 const tc = useTranslations("dashboard.common");
 const order = orders.find((o) => o.id === orderId) || null;
 const [picked, setPicked] = useState<Set<string>>(new Set());
 useEffect(() => {
 setPicked(new Set());
 }, [orderId]);

 if (!orderId || !order) return null;

 const items = order.items;
 const pickedItems = items.filter((it) => picked.has(it.id));
 const keptItems = items.filter((it) => !picked.has(it.id));
 const pickedTotal = pickedItems.reduce((sum, it) => sum + calcItemPrice(it), 0);
 const keptTotal = keptItems.reduce((sum, it) => sum + calcItemPrice(it), 0);
 const canSplit = pickedItems.length > 0 && keptItems.length > 0;

 function toggle(id: string) {
 setPicked((cur) => {
 const next = new Set(cur);
 if (next.has(id)) next.delete(id);
 else next.add(id);
 return next;
 });
 }

 return (
 <Modal
 open={!!orderId}
 onClose={onClose}
 title={t("splitOrder", { defaultValue: "Split order" })}
 subtitle={t("splitOrderHint", {
 defaultValue: "Pick items to move into a new order",
 })}
 size="sm"
 closeOnBackdrop={false}
 footer={
 <div className="flex items-center justify-between gap-2">
 <div className="text-xs text-muted-foreground tabular-nums">
 {formatPrice(keptTotal, currencySymbol)} · {formatPrice(pickedTotal, currencySymbol)}
 </div>
 <div className="flex items-center gap-2">
 <button
 type="button"
 onClick={onClose}
 className="h-8 px-3 text-xs font-medium text-foreground bg-card border border-border rounded-lg transition-colors"
 >
 {tc("cancel")}
 </button>
 <button
 type="button"
 onClick={() => onConfirm(orderId, Array.from(picked))}
 disabled={!canSplit}
 className="inline-flex items-center gap-1.5 h-8 px-3 text-xs font-medium text-primary-foreground bg-primary rounded-lg transition-colors disabled:opacity-40"
 >
 <SplitIcon size={13} />
 {t("splitOrder", { defaultValue: "Split order" })}
 </button>
 </div>
 </div>
 }
 >
 <div className="-m-5 divide-y divide-border">
 {items.map((item) => {
 const isPicked = picked.has(item.id);
 const price = calcItemPrice(item);
 return (
 <button
 key={item.id}
 type="button"
 onClick={() => toggle(item.id)}
 className={
 "w-full flex items-center gap-3 px-5 py-3 text-left transition-colors " +
 (isPicked ? "bg-primary/5" : "")
 }
 >
 <span
 className={
 "w-4 h-4 rounded border inline-flex items-center justify-center shrink-0 " +
 (isPicked
 ? "bg-primary border-primary text-primary-foreground"
 : "border-input")
 }
 >
 {isPicked ? <CheckIcon size={10} /> : null}
 </span>
 <span className="min-w-0 flex-1 text-sm text-foreground truncate">
 {getMlWithFallback(item.dishNameSnapshot, defaultLang, defaultLang)}
 </span>
 <span className="text-sm text-muted-foreground tabular-nums shrink-0">
 {formatPrice(price, currencySymbol)}
 </span>
 </button>
 );
 })}
 </div>
 </Modal>
 );
}

function ItemMoreMenu({
 currentStatus,
 onStatusChange,
 onDuplicate,
 onRemove,
 statusLabels,
 duplicateLabel,
 removeLabel,
}: {
 currentStatus: OrderItemStatus;
 onStatusChange: (status: OrderItemStatus) => void;
 onDuplicate: () => void;
 onRemove: () => void;
 statusLabels: Record<OrderItemStatus, string>;
 duplicateLabel: string;
 removeLabel: string;
}) {
 const [open, setOpen] = useState(false);
 const btnRef = useRef<HTMLButtonElement | null>(null);
 const [pos, setPos] = useState<
 { right: number; top?: number; bottom?: number } | null
 >(null);
 useEffect(() => {
 if (!open) {
 setPos(null);
 return;
 }
 const el = btnRef.current;
 if (!el) return;
 const r = el.getBoundingClientRect();
 const dropdownH = 260;
 const spaceBelow = window.innerHeight - r.bottom;
 const right = window.innerWidth - r.right;
 if (spaceBelow < dropdownH && r.top > spaceBelow) {
 setPos({ right, bottom: window.innerHeight - r.top + 4 });
 } else {
 setPos({ right, top: r.bottom + 4 });
 }
 }, [open]);
 const transitions = STATUS_ORDER.filter((s) => s !== currentStatus);
 return (
 <div className="relative shrink-0">
 <button
 ref={btnRef}
 type="button"
 onClick={() => setOpen((v) => !v)}
 className="w-7 h-7 flex items-center justify-center rounded-md text-muted-foreground transition-colors"
 aria-label="More"
 >
 <MoreVerticalIcon size={14} />
 </button>
 {open && pos
 ? createPortal(
 <>
 <div className="fixed inset-0 z-[60]" onClick={() => setOpen(false)} />
 <div
 className="fixed z-[70] min-w-[180px] max-h-[80vh] overflow-y-auto bg-card border border-border rounded-lg shadow-lg"
 style={{
 right: pos.right,
 ...(pos.top !== undefined ? { top: pos.top } : {}),
 ...(pos.bottom !== undefined ? { bottom: pos.bottom } : {}),
 }}
 >
 <div className="py-1">
 {transitions.map((s) => (
 <button
 key={s}
 type="button"
 onClick={() => {
 setOpen(false);
 track("dash_orders_order_status_click");
 onStatusChange(s);
 }}
 className="w-full flex items-center gap-2 px-3 h-9 text-left text-xs font-medium text-foreground transition-colors"
 >
 <span className="w-[13px] h-[13px] inline-flex items-center justify-center shrink-0">
 <span className={"w-2 h-2 rounded-full " + STATUS_DOT_CLS[s]} />
 </span>
 {statusLabels[s]}
 </button>
 ))}
 </div>
 <div className="border-t border-border" />
 <div className="py-1">
 <button
 type="button"
 onClick={() => {
 setOpen(false);
 onDuplicate();
 }}
 className="w-full flex items-center gap-2 px-3 h-9 text-left text-xs font-medium text-foreground transition-colors"
 >
 <CopyIcon size={13} />
 {duplicateLabel}
 </button>
 <button
 type="button"
 onClick={() => {
 setOpen(false);
 onRemove();
 }}
 className="w-full flex items-center gap-2 px-3 h-9 text-left text-xs font-medium text-red-600 transition-colors"
 >
 <TrashIcon size={13} />
 {removeLabel}
 </button>
 </div>
 </div>
 </>,
 document.body,
 )
 : null}
 </div>
 );
}

// ── Kitchen page (unchanged structure, just relocated) ──

export function KitchenPage({
 orders,
 setOrders,
 tables,
 categories,
 defaultLang,
}: {
 orders: Order[];
 setOrders: React.Dispatch<React.SetStateAction<Order[]>>;
 tables: TableEntity[];
 categories: Category[];
 defaultLang: string;
}) {
 const t = useTranslations("dashboard.orders");
 const [, setTick] = useState(0);
 const [statusFilter, setStatusFilter] = useState<OrderItemStatus[]>([]);
 const [categoryFilter, setCategoryFilter] = useState<string[]>([]);

 useEffect(() => {
 const id = setInterval(() => setTick((t) => t + 1), 15000);
 return () => clearInterval(id);
 }, []);

 function setItemStatus(orderId: string, itemId: string, status: OrderItemStatus) {
 const order = orders.find((o) => o.id === orderId);
 if (!order) return;
 const items = order.items.map((it) => (it.id === itemId ? { ...it, status } : it));
 setOrders((all) => all.map((o) => (o.id === orderId ? { ...o, items } : o)));
 patchOrder(orderId, { items, total: calcOrderTotal({ ...order, items }) }).catch(() => {
 });
 }

 function toggleStatus(id: OrderItemStatus) {
 setStatusFilter((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));
 }
 function toggleCategory(id: string) {
 setCategoryFilter((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));
 }

 const dishToCategory = (() => {
 const map: Record<string, string> = {};
 categories.forEach((cat) => {
 cat.dishes.forEach((d) => {
 map[d.id] = cat.id;
 });
 });
 return map;
 })();

 function filterItems(items: OrderItem[]): OrderItem[] {
 return items.filter((it) => {
 if (it.status === "served") return false;
 if (statusFilter.length > 0 && !statusFilter.includes(it.status)) return false;
 if (categoryFilter.length > 0 && !categoryFilter.includes(dishToCategory[it.dishId])) return false;
 return true;
 });
 }

 const visibleOrders = orders
 .filter((o) => o.status === "active")
 .map((o) => ({ ...o, _filteredItems: filterItems(o.items) }))
 .filter((o) => o._filteredItems.length > 0)
 .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

 const STATUS_FILTERS: { id: OrderItemStatus; labelKey: "statusPending" | "statusCooking" | "statusReady" }[] = [
 { id: "pending", labelKey: "statusPending" },
 { id: "cooking", labelKey: "statusCooking" },
 { id: "ready", labelKey: "statusReady" },
 ];

 const pillBase = "shrink-0 inline-flex items-center h-7 px-3 rounded-full text-xs font-medium transition-colors";
 const pillOn = "bg-foreground text-background";
 const pillOff = "bg-card text-foreground border border-border";

 return (
 <div>
 <style>{`
 .no-scrollbar::-webkit-scrollbar { display: none; }
 .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
 `}</style>

 <div
 className="sticky z-10 -mx-4 md:-mx-6 -mt-5 md:-mt-4 bg-card/90 backdrop-blur-md border-b border-border/60"
 style={{ top: "var(--topbar-h, 0px)" }}
 >
 <div className="flex items-center gap-1.5 overflow-x-auto px-4 md:px-6 py-2 no-scrollbar">
 {STATUS_FILTERS.map((s) => {
 const on = statusFilter.includes(s.id);
 return (
 <button
 key={s.id}
 type="button"
 onClick={() => toggleStatus(s.id)}
 className={pillBase + " " + (on ? pillOn : pillOff)}
 >
 {t(s.labelKey)}
 </button>
 );
 })}

 {categories.length > 0 ? (
 <div className="shrink-0 self-stretch w-px bg-secondary mx-1" />
 ) : null}

 {categories.map((cat) => {
 const on = categoryFilter.includes(cat.id);
 return (
 <button
 key={cat.id}
 type="button"
 onClick={() => toggleCategory(cat.id)}
 className={pillBase + " " + (on ? pillOn : pillOff)}
 >
 {getMlWithFallback(cat.name, defaultLang, defaultLang)}
 </button>
 );
 })}
 </div>
 </div>

 {visibleOrders.length === 0 ? (
 <div className="max-w-2xl mx-auto pt-7 md:pt-6">
 <EmptyState
 title={t("kitchenClear")}
 subtitle={t("kitchenClearSub")}
 />
 </div>
 ) : (
 <div className="-mx-4 md:-mx-6 mt-5 md:mt-8">
 <div className="overflow-x-auto pb-4 px-4 md:px-6">
 <div className="flex items-stretch gap-3" style={{ width: "max-content" }}>
 {visibleOrders.map((order) => (
 <KitchenOrderCard
 key={order.id}
 order={order}
 filteredItems={order._filteredItems}
 table={tables.find((t) => t.id === order.tableId) || null}
 defaultLang={defaultLang}
 onItemStatusChange={(itemId, status) => setItemStatus(order.id, itemId, status)}
 />
 ))}
 </div>
 </div>
 </div>
 )}
 </div>
 );
}

function KitchenOrderCard({
 order,
 filteredItems,
 table,
 defaultLang,
 onItemStatusChange,
}: {
 order: Order;
 filteredItems: OrderItem[];
 table: TableEntity | null;
 defaultLang: string;
 onItemStatusChange: (itemId: string, status: OrderItemStatus) => void;
}) {
 const t = useTranslations("dashboard.orders");
 const items = filteredItems || order.items.filter((it) => it.status !== "served");
 const allReady = items.length > 0 && items.every((it) => it.status === "ready");
 const elapsed = minutesSince(order.createdAt);
 const cardCls = allReady ? "bg-emerald-50 border-emerald-300" : "bg-card border-border";

 return (
 <div className={"w-72 shrink-0 rounded-xl border " + cardCls + " flex flex-col"}>
 <div className="px-3.5 py-3 border-b border-border/60">
 <div className="flex items-center justify-between gap-2">
 <div className="text-base font-medium text-foreground">
 {t("tableLabel", { number: table ? table.number : order.tableNumber ?? "?" })}
 </div>
 <div className="text-xs text-muted-foreground tabular-nums">
 {t("elapsed", { time: formatTimeShort(order.createdAt), minutes: elapsed })}
 </div>
 </div>
 {table?.name ? <div className="text-xs text-muted-foreground mt-0.5">{table.name}</div> : null}
 </div>

 <div className="flex-1 p-2 space-y-1.5">
 {items.map((item) => (
 <KitchenItem
 key={item.id}
 item={item}
 defaultLang={defaultLang}
 onStatusChange={(status) => onItemStatusChange(item.id, status)}
 />
 ))}
 </div>
 </div>
 );
}

function KitchenItem({
 item,
 defaultLang,
 onStatusChange,
}: {
 item: OrderItem;
 defaultLang: string;
 onStatusChange: (status: OrderItemStatus) => void;
}) {
 const t = useTranslations("dashboard.orders");
 const nextStatus: Record<OrderItemStatus, OrderItemStatus> = {
 pending: "cooking",
 cooking: "ready",
 ready: "pending",
 served: "pending",
 };
 const statusKey = ITEM_STATUS_KEYS[item.status] || ITEM_STATUS_KEYS.pending;
 const statusCls = ITEM_STATUS_CLS[item.status] || ITEM_STATUS_CLS.pending;

 return (
 <button
 type="button"
 onClick={() => onStatusChange(nextStatus[item.status])}
 className="w-full text-left p-2.5 rounded-lg bg-card border border-border transition-colors"
 >
 <div className="flex items-start justify-between gap-2 mb-1.5">
 <div className="text-sm font-medium text-foreground leading-tight">
 {getMlWithFallback(item.dishNameSnapshot, defaultLang, defaultLang)}
 </div>
 <span
 className={
 "shrink-0 inline-flex items-center h-5 px-1.5 text-[10px] font-medium border rounded-full " +
 statusCls
 }
 >
 {t(statusKey)}
 </span>
 </div>

 {item.options.length > 0 ? (
 <div className="text-xs text-muted-foreground">
 {item.options.map((o, i) => (
 <span key={i}>
 {i > 0 ? " · " : ""}
 {getMlWithFallback(o.variantName, defaultLang, defaultLang)}
 {(o.quantity ?? 1) > 1 ? ` × ${o.quantity}` : ""}
 </span>
 ))}
 </div>
 ) : null}

 {item.notes ? (
 <div className="inline-flex items-start gap-1 text-xs text-amber-700 mt-1.5 px-1.5 py-0.5 bg-amber-50 rounded">
 <MessageIcon size={11} className="mt-0.5 shrink-0" />
 <span>{item.notes}</span>
 </div>
 ) : null}
 </button>
 );
}
