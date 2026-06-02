"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { showApiError } from "@/lib/show-api-error";
import { createPortal } from "react-dom";
import { useTranslations } from "next-intl";
import { useRestaurant } from "./restaurant-context";
import {
 CheckIcon,
 ChevronLeftIcon,
 ChevronRightIcon,
 CopyIcon,
 MoreVerticalIcon,
 PlusIcon,
 ReceiptIcon,
 RefreshIcon,
 SplitIcon,
 SwapIcon,
 TrashIcon,
} from "./icons";
import { ConfirmDialog, EmptyState, Modal, PageHeader } from "./ui";
import { DiscountModal } from "./discount-modal";
import { FloorMap } from "./tables";
import { CtaState } from "./reservations";
import { useDashboardRouter } from "../_spa/router";
import {
 formatPrice,
 formatTimeShort,
 formatElapsedHMS,
 currencySymbolOf,
 parseDecimal,
 newId,
} from "./helpers";
import { getMlWithFallback } from "./i18n";
import { inputClass } from "./tokens";
import { createOrder, deleteOrder, patchOrder, splitOrder } from "./api";
import type {
 Category,
 Discount,
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
import {
 ITEM_STATUS_KEYS,
 STATUS_DOT_CLS,
 STATUS_TEXT_CLS,
 STATUS_ORDER,
 applyDiscount,
 calcItemPrice,
 calcOrderSubtotal,
 calcOrderTotal,
} from "./orders-shared";
// KitchenPage moved to its own file so the kitchen.* kiosk bundle can
// import it without dragging in the order-creation wizard. Re-exported
// here for callers that still reference `_v2/orders`.
export { KitchenPage } from "./kitchen-page";

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
 kioskLayout,
 demoMode,
}: {
 orders: Order[];
 setOrders: React.Dispatch<React.SetStateAction<Order[]>>;
 tables: TableEntity[];
 categories: Category[];
 defaultLang: string;
 currency: string;
 // Waiter kiosk layout: removes PageHeader, makes the page a flex column
 // (lg: row) filling the viewport. Floor map keeps its square aspect ratio
 // as the priority element; the active-orders list lives next to it in a
 // single card with divider-separated rows, internally scrollable.
 kioskLayout?: boolean;
 // Public landing demo: every mutation runs on local state only — no API
 // calls. createOrder/splitOrder normally need a server-generated id and
 // dailyNumber, so in demo mode we mint those locally. A reload resets the
 // board (the snapshot is rebuilt from scratch).
 demoMode?: boolean;
}) {
 const t = useTranslations("dashboard.orders");
 const tc = useTranslations("dashboard.common");
 const restaurant = useRestaurant();
 const router = useDashboardRouter();
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
 // Discount editor targets. Either an order id (order-level discount) or
 // an {orderId, itemId} pair (item-level discount). Mutually exclusive —
 // the same modal renders for both.
 const [discountForOrder, setDiscountForOrder] = useState<string | null>(null);
 const [discountForItem, setDiscountForItem] = useState<{ orderId: string; itemId: string } | null>(null);
 const [headerBack, setHeaderBack] = useState<(() => void) | null>(null);
 const [wizardTitle, setWizardTitle] = useState<string | null>(null);
 const [wizardFooter, setWizardFooter] = useState<React.ReactNode | null>(null);
 const [openedFrom, setOpenedFrom] = useState<"table" | "list">("table");

 // Sort by daily number so the orders list (global and per-table) reads
 // top→bottom by creation order. Date order ≈ creation order but ties on
 // same-second rows would otherwise be undefined.
 const activeOrders = orders
 .filter((o) => o.status === "active")
 .slice()
 .sort((a, b) => (a.dailyNumber ?? 0) - (b.dailyNumber ?? 0));
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
 // First-item adds pass `base` explicitly because the closure-captured
 // `orders` does not yet see the order ensureOrderForFirstItem just pushed
 // (React batches setOrders). Without `base` the first dish silently fails
 // to persist server-side and the SSE/poll feed wipes the optimistic copy.
 const target = base ?? orders.find((o) => o.id === orderId);
 if (!target) return;
 const next: Order = { ...target, ...patch };
 setOrders((all) => {
 if (all.some((o) => o.id === orderId)) {
 return all.map((o) => (o.id === orderId ? next : o));
 }
 return [...all, next];
 });
 if (demoMode) return;
 try {
 await patchOrder(orderId, {
 status: next.status === "active" ? "in_progress" : next.status,
 items: next.items,
 total: calcOrderTotal(next),
 ...(patch.paymentMethodId !== undefined ? { paymentMethodId: patch.paymentMethodId } : {}),
 ...(patch.discount !== undefined ? { discount: patch.discount } : {}),
 });
 // No invalidate / no rollback — SSE will push the server-confirmed
 // copy back through the cache. On failure we just toast; the next
 // SSE/poll event corrects the optimistic state.
 } catch (err) {
 showApiError(err, "patchOrder");
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

 function completeOrder(orderId: string, paymentMethodId: string | null) {
 track("dash_orders_order_complete_order");
 persistOrder(orderId, { status: "completed", paymentMethodId });
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
 if (demoMode) return;
 try {
 await deleteOrder(orderId);
 } catch (err) {
 showApiError(err, "deleteOrder");
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
 const created = demoMode
 ? {
 id: newId(),
 dailyNumber: Math.max(0, ...orders.map((o) => o.dailyNumber ?? 0)) + 1,
 createdAt: new Date().toISOString(),
 }
 : await createOrder(table ? { tableNumber: table.number } : {});
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
 return newOrder;
 } catch (err) {
 showApiError(err, "createOrder");
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
 if (demoMode) return;
 try {
 await patchOrder(orderId, { tableNumber: table.number });
 } catch (err) {
 showApiError(err, "changeTable");
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
 const res = demoMode
 ? {
 created: {
 id: newId(),
 dailyNumber: Math.max(0, ...orders.map((o) => o.dailyNumber ?? 0)) + 1,
 createdAt: new Date().toISOString(),
 },
 }
 : await splitOrder(orderId, { itemIds });
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
 setView({ kind: "list" });
 } catch (err) {
 showApiError(err, "splitOrder");
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
 className="inline-flex items-center gap-1.5 h-8 px-3 text-xs font-medium text-primary-foreground bg-primary-gradient rounded-lg transition-colors"
 >
 <PlusIcon size={13} />
 {activeTableOrders.length === 0 ? t("startOrder") : t("newOrder")}
 </button>
 </div>
 );
 }
 } else if (view.kind === "order" && currentOrder) {
 const total = calcOrderTotal(currentOrder);
 const orderDiscountAmount = (() => {
   const sub = calcOrderSubtotal(currentOrder);
   return applyDiscount(sub, currentOrder.discount ?? null);
 })();
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
 {currentOrder.discount ? (
 <>
 {" "}
 <DiscountBadge discount={currentOrder.discount} currencySymbol={currencySymbol} />
 </>
 ) : null}
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
 onItemDiscount={(itemId) => setDiscountForItem({ orderId: currentOrder.id, itemId })}
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
 setDiscountForOrder(currentOrder.id);
 }}
 className="w-full flex items-center gap-2 px-3 h-9 text-left text-xs font-medium text-foreground transition-colors"
 >
 <span className="inline-flex items-center justify-center w-[13px] text-[13px] font-bold">%</span>
 {currentOrder.discount
 ? t("discountEdit", { defaultValue: "Edit discount" })
 : t("discountAdd", { defaultValue: "Add discount" })}
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
 onClick={() => {
 // Always go through the confirm modal — even when no payment
 // methods are configured. The modal collapses to just the
 // close-confirmation header + footer in that case, so the
 // staff still gets an explicit "are you sure" step.
 setConfirmCompleteOrder(currentOrder.id);
 }}
 disabled={currentOrder.items.length === 0}
 className="inline-flex items-center gap-1.5 h-8 px-3 text-xs font-medium text-primary-foreground bg-primary-gradient rounded-lg transition-colors disabled:opacity-40"
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

 const floorPane = hasTables ? (
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
 ) : null;

 const ordersPane = !hasTables ? (
 <button
 type="button"
 onClick={startTablelessOrder}
 disabled={creating}
 className="inline-flex items-center justify-center h-10 px-5 rounded-lg bg-primary-gradient text-primary-foreground text-sm font-medium hover:bg-primary/90 active:scale-[0.99] transition disabled:opacity-50 self-start"
 >
 <PlusIcon size={16} className="mr-1.5" />
 {t("newOrder")}
 </button>
 ) : activeOrders.length === 0 ? (
 <div className="bg-card border border-border rounded-xl px-6 py-10 text-center h-full flex items-center justify-center">
 <div>
 <div className="text-sm font-medium text-foreground mb-1">
 {t("noActiveTitle", { defaultValue: "No active orders" })}
 </div>
 <div className="text-xs text-muted-foreground">
 {t("noActiveBody", { defaultValue: "New orders will show up here." })}
 </div>
 </div>
 </div>
 ) : (
 <div className="bg-card border border-border rounded-xl overflow-hidden flex flex-col max-h-full">
 <div className="min-h-0 overflow-y-auto divide-y divide-border">
 {activeOrders.map((o) => (
 <OrderListCard
 key={o.id}
 order={o}
 currencySymbol={currencySymbol}
 onClick={() => openOrderDirect(o)}
 variant="row"
 />
 ))}
 </div>
 </div>
 );

 // Unified dual-pane layout: kanban-like floor map (square, priority on
 // desktop) + a single orders card with divider-separated rows that
 // scroll inside. Admin host adds the standard max-w-5xl container so
 // the page doesn't stretch on wide displays; kiosk host runs
 // edge-to-edge. Outer height pins to viewport (minus topbar) so the
 // orders card has an explicit height to fill — without that the
 // internal scroll has no upper bound and the card sprawls.
 const outerHeightStyle = {
 height:
 "calc(100dvh - var(--topbar-h, 0px) - env(safe-area-inset-top) - env(safe-area-inset-bottom) - 6rem)",
 } as React.CSSProperties;

 // No tables → replace the whole orders surface with the same "add a table"
 // placeholder the bookings page uses. On the dashboard it offers a button to
 // settings; on the waiter kiosk (no admin access) it's just a message.
 if (!hasTables) {
 const showCta = !kioskLayout && !demoMode;
 return (
 <div className={kioskLayout ? "h-full p-4 md:p-6" : "max-w-5xl mx-auto md:px-6"}>
 {!kioskLayout ? <PageHeader title={t("title")} /> : null}
 <CtaState
 title={t("noTablesTitle")}
 body={t("noTablesBody")}
 cta={showCta ? t("noTablesCta") : undefined}
 onClick={showCta ? () => router.push({ name: "settings.tables" }) : undefined}
 />
 </div>
 );
 }

 return (
 <>
 <div
 className={
 (kioskLayout ? "h-full p-4 md:p-6 " : "max-w-5xl mx-auto md:px-6 ") +
 "flex flex-col lg:flex-row gap-3 lg:gap-4 min-h-0"
 }
 style={kioskLayout ? undefined : outerHeightStyle}
 >
 {hasTables ? (
 <div className="aspect-square w-full lg:w-auto lg:h-full lg:aspect-square shrink-0">
 {floorPane}
 </div>
 ) : null}
 <div className="flex-1 min-h-0 lg:min-w-0 flex flex-col gap-3">
 {ordersPane}
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

 <CompleteOrderModal
 open={!!confirmCompleteOrder}
 hasUnserved={
 !!confirmCompleteOrder &&
 (orders.find((o) => o.id === confirmCompleteOrder)?.items.some((it) => it.status !== "served") ?? false)
 }
 paymentMethods={restaurant.paymentMethods}
 onCancel={() => setConfirmCompleteOrder(null)}
 onConfirm={(paymentMethodId) => {
 if (confirmCompleteOrder) completeOrder(confirmCompleteOrder, paymentMethodId);
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

 <DiscountModal
 open={discountForOrder !== null}
 initial={discountForOrder ? orders.find((o) => o.id === discountForOrder)?.discount ?? null : null}
 currencySymbol={currencySymbol}
 title={t("discountOrderTitle", { defaultValue: "Order discount" })}
 onClose={() => setDiscountForOrder(null)}
 onSave={async (next) => {
 if (!discountForOrder) return;
 const target = orders.find((o) => o.id === discountForOrder);
 if (target) {
 await persistOrder(discountForOrder, { discount: next });
 }
 setDiscountForOrder(null);
 }}
 />

 <DiscountModal
 open={discountForItem !== null}
 initial={
 discountForItem
 ? orders
 .find((o) => o.id === discountForItem.orderId)
 ?.items.find((it) => it.id === discountForItem.itemId)
 ?.discount ?? null
 : null
 }
 currencySymbol={currencySymbol}
 title={t("discountItemTitle", { defaultValue: "Item discount" })}
 onClose={() => setDiscountForItem(null)}
 onSave={async (next) => {
 if (!discountForItem) return;
 const target = orders.find((o) => o.id === discountForItem.orderId);
 if (target) {
 const nextItems = target.items.map((it) =>
 it.id === discountForItem.itemId ? { ...it, discount: next } : it,
 );
 await persistOrder(discountForItem.orderId, { items: nextItems });
 }
 setDiscountForItem(null);
 }}
 />
 </>
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
 const orderNum = `#${order.dailyNumber}`;
 const tableLabel =
 order.tableNumber != null
 ? t("tableLabel", { number: order.tableNumber })
 : t("noTableLabel", { defaultValue: "No table" });

 const cls =
 variant === "card"
 ? "w-full text-left bg-card border border-border rounded-xl px-4 py-3 transition-colors"
 : "w-full text-left px-5 py-3 transition-colors";
 return (
 <button type="button" onClick={onClick} className={cls}>
 <div className="flex items-center gap-3">
 <div className="min-w-0 flex-1">
 <div className="flex items-center gap-2">
 <div className="min-w-0 flex-1 text-sm font-medium text-foreground truncate">
 <span>{orderNum}</span>
 <span className="text-muted-foreground font-normal"> · </span>
 <span>{tableLabel}</span>
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
 </div>
 <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1.5">
 <span className="min-w-0 flex-1 truncate">
 {t("createdLabel", { defaultValue: "Created" })} {formatTimeShort(order.createdAt)}
 {" · "}
 {itemsCount === 1
 ? t("itemOne", { count: itemsCount })
 : t("itemOther", { count: itemsCount })}
 </span>
 {order.discount ? (
 <DiscountBadge discount={order.discount} currencySymbol={currencySymbol} />
 ) : null}
 </div>
 </div>
 <ChevronRightIcon size={14} className="shrink-0 text-muted-foreground -mr-2" />
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
 onItemDiscount,
}: {
 order: Order;
 defaultLang: string;
 currencySymbol: string;
 onItemStatusChange: (itemId: string, status: OrderItemStatus) => void;
 onRemoveItem: (itemId: string) => void;
 onDuplicateItem: (itemId: string) => void;
 onItemDiscount: (itemId: string) => void;
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
 onDiscount={() => onItemDiscount(item.id)}
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
 onDiscount,
}: {
 item: OrderItem;
 defaultLang: string;
 currencySymbol: string;
 onStatusChange: (status: OrderItemStatus) => void;
 onRemove: () => void;
 onDuplicate: () => void;
 onDiscount: () => void;
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
 <span className="shrink-0 text-[13px] text-muted-foreground font-normal tabular-nums inline-flex items-center gap-1.5">
 · {formatPrice(price, currencySymbol)}
 {item.discount ? <DiscountBadge discount={item.discount} currencySymbol={currencySymbol} /> : null}
 </span>
 </div>
 <ItemMoreMenu
 currentStatus={item.status}
 onStatusChange={onStatusChange}
 onDuplicate={onDuplicate}
 onDiscount={onDiscount}
 hasDiscount={!!item.discount}
 onRemove={onRemove}
 statusLabels={{
 pending: t("statusPending"),
 cooking: t("statusCooking"),
 ready: t("statusReady"),
 served: t("statusServed"),
 }}
 duplicateLabel={t("duplicateItem", { defaultValue: "Duplicate" })}
 discountLabel={item.discount
 ? t("discountEdit", { defaultValue: "Edit discount" })
 : t("discountAdd", { defaultValue: "Add discount" })}
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
 // Order item creation works against leaf categories only — groups are
 // organizational and never carry dishes themselves.
 const pickable = categories.filter((c) => !c.isGroup);
 return (
 <div>
 {pickable.length === 0 ? (
 <p className="text-sm text-muted-foreground text-center py-6">{t("noDishesInCategory")}</p>
 ) : (
 <div className="-m-5 divide-y divide-border">
 {pickable.map((c) => (
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
 "inline-flex items-center gap-1.5 h-8 px-3 text-xs font-medium text-primary-foreground bg-primary-gradient rounded-lg transition-colors disabled:opacity-40";
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
 className="h-8 px-3 text-xs font-medium text-primary-foreground bg-primary-gradient rounded-lg transition-colors disabled:opacity-40"
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
 <button
 type="button"
 onClick={() => onConfirm(orderId, Array.from(picked))}
 disabled={!canSplit}
 className="inline-flex items-center gap-1.5 h-8 px-3 text-xs font-medium text-primary-foreground bg-primary-gradient rounded-lg transition-colors disabled:opacity-40"
 >
 <SplitIcon size={13} />
 {t("splitOrder", { defaultValue: "Split order" })}
 </button>
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
 onDiscount,
 hasDiscount,
 onRemove,
 statusLabels,
 duplicateLabel,
 discountLabel,
 removeLabel,
}: {
 currentStatus: OrderItemStatus;
 onStatusChange: (status: OrderItemStatus) => void;
 onDuplicate: () => void;
 onDiscount: () => void;
 hasDiscount: boolean;
 onRemove: () => void;
 statusLabels: Record<OrderItemStatus, string>;
 duplicateLabel: string;
 discountLabel: string;
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
 onDiscount();
 }}
 className="w-full flex items-center gap-2 px-3 h-9 text-left text-xs font-medium text-foreground transition-colors"
 >
 <span className="inline-flex items-center justify-center w-[13px] text-[13px] font-bold">%</span>
 {discountLabel}
 {hasDiscount ? <span className="ml-auto text-[10px] text-muted-foreground">●</span> : null}
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


function CompleteOrderModal({
 open,
 hasUnserved,
 paymentMethods,
 onCancel,
 onConfirm,
}: {
 open: boolean;
 hasUnserved: boolean;
 paymentMethods: string[];
 onCancel: () => void;
 onConfirm: (paymentMethodId: string | null) => void;
}) {
 const t = useTranslations("dashboard.orders");
 const tc = useTranslations("dashboard.common");
 const tpm = useTranslations("dashboard.paymentMethods");
 const [selected, setSelected] = useState<string | null>(paymentMethods[0] ?? null);
 useEffect(() => {
 if (open) setSelected(paymentMethods[0] ?? null);
 }, [open, paymentMethods]);
 const hasMethods = paymentMethods.length > 0;
 const baseMsg = hasUnserved
 ? t("completeOrderUnservedMessage", { defaultValue: "Some items are not served yet. Complete order anyway?" })
 : t("completeOrderMessage", { defaultValue: "Close this order?" });
 const subtitle = hasMethods
 ? baseMsg + " " + t("selectPaymentMethod", { defaultValue: "Select a payment method." })
 : baseMsg;
 return (
 <Modal
 open={open}
 onClose={onCancel}
 title={t("completeOrder")}
 subtitle={subtitle}
 size="sm"
 footer={
 <div className="flex gap-2 justify-end">
 <button
 type="button"
 onClick={onCancel}
 className="h-8 px-3 text-xs font-medium text-foreground bg-card border border-border rounded-lg transition-colors"
 >
 {tc("cancel")}
 </button>
 <button
 type="button"
 onClick={() => onConfirm(selected)}
 className="h-8 px-3 text-xs font-medium text-primary-foreground bg-primary-gradient rounded-lg transition-colors"
 >
 {t("completeOrder")}
 </button>
 </div>
 }
 >
 {hasMethods ? (
 <div className="-m-5 divide-y divide-border">
 {paymentMethods.map((code) => {
 const isOn = selected === code;
 return (
 <button
 key={code}
 type="button"
 onClick={() => setSelected(code)}
 className={
 "w-full flex items-center gap-3 px-5 py-3 text-left transition-colors " +
 (isOn ? "bg-primary/5" : "")
 }
 >
 <span className="min-w-0 flex-1 text-sm text-foreground truncate">
 {tpm(code as never, { defaultValue: code })}
 </span>
 {isOn ? <CheckIcon size={14} className="shrink-0 text-primary" /> : null}
 </button>
 );
 })}
 </div>
 ) : null}
 </Modal>
 );
}

// Tiny inline badge rendered next to a price/total whenever a discount
// is set. Percent shows as "-10%"; fixed shows as "-3.00€" (formatted
// via the parent's currency symbol). Emerald colour because savings.
export function DiscountBadge({
 discount,
 currencySymbol,
}: {
 discount: Discount;
 currencySymbol: string;
}) {
 const label =
 discount.type === "percent"
 ? `-${Math.round(discount.value * 100) / 100}%`
 : `-${formatPrice(discount.value, currencySymbol)}`;
 return (
 <span className="inline-flex items-center h-[18px] px-1.5 rounded text-[10px] font-semibold tabular-nums bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 align-middle">
 {label}
 </span>
 );
}
