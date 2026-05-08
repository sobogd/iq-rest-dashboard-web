"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { ChevronLeftIcon, ClockIcon, MessageIcon, PlusIcon, ReceiptIcon, TrashIcon } from "./icons";
import { ConfirmDialog, EmptyState, PageHeader } from "./ui";
import { FloorMap } from "./tables";
import { formatPrice, formatTimeShort, minutesSince, currencySymbolOf, parseDecimal, newId } from "./helpers";
import { getMlWithFallback } from "./i18n";
import { inputClass } from "./tokens";
import { createOrder, deleteOrder, patchOrder } from "./api";
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

const ITEM_STATUS_CLS: Record<OrderItemStatus, string> = {
 pending: "bg-secondary text-muted-foreground border-border",
 cooking: "bg-amber-50 text-amber-700 border-amber-200",
 ready: "bg-emerald-50 text-emerald-700 border-emerald-200",
 served: "bg-secondary text-muted-foreground border-border",
};

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

type OrdersView =
 | { name: "list" }
 | { name: "order"; orderId: string }
 | { name: "addItem"; orderId: string; step: "category"; categoryId?: undefined; dishId?: undefined }
 | { name: "addItem"; orderId: string; step: "dish"; categoryId: string; dishId?: undefined }
 | { name: "addItem"; orderId: string; step: "configure"; categoryId: string; dishId: string };

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
 const router = useRouter();
 const [view, setView] = useState<OrdersView>({ name: "list" });
 const [selectedTableId, setSelectedTableId] = useState<string | null>(null);
 const [creating, setCreating] = useState(false);
 const currencySymbol = currencySymbolOf(currency);

 const activeOrders = orders.filter((o) => o.status === "active");
 const currentOrder =
 view.name !== "list" ? orders.find((o) => o.id === view.orderId) || null : null;

 useEffect(() => {
 }, []);

 useEffect(() => {
 if (view.name !== "list" && !currentOrder) {
 setView({ name: "list" });
 }
 }, [view, currentOrder]);

 async function persistOrder(orderId: string, patch: Partial<Order>) {
 setOrders((all) => all.map((o) => (o.id === orderId ? { ...o, ...patch } : o)));
 const target = orders.find((o) => o.id === orderId);
 if (!target) return;
 const next = { ...target, ...patch };
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

 function completeOrder(orderId: string) {
 track("dash_orders_order_complete_order");
 persistOrder(orderId, { status: "completed" });
 setView({ name: "list" });
 }

 async function removeOrder(orderId: string) {
 track("dash_orders_order_delete_order");
 setOrders((all) => all.filter((o) => o.id !== orderId));
 setView({ name: "list" });
 try {
 await deleteOrder(orderId);
 router.refresh();
 } catch {
 }
 }

 function appendItem(orderId: string, item: OrderItem) {
 const order = orders.find((o) => o.id === orderId);
 if (!order) return;
 const items = [...order.items, item];
 persistOrder(orderId, { items });
 }

 async function startOrderForTable(tableId: string) {
 track("dash_orders_click_start_order");
 if (creating) return;
 const table = tables.find((t) => t.id === tableId);
 if (!table) return;
 setCreating(true);
 try {
 const created = await createOrder({ tableNumber: table.number });
 const newOrder: Order = {
 id: created.id,
 tableId,
 tableNumber: table.number,
 guestName: "",
 createdAt: created.createdAt,
 status: "active",
 items: [],
 total: 0,
 };
 setOrders((all) => [...all, newOrder]);
 setView({ name: "addItem", orderId: created.id, step: "category" });
 router.refresh();
 } catch {
 // silent
 } finally {
 setCreating(false);
 }
 }

 // ── Add-item flow drilldown ──

 if (view.name === "addItem" && currentOrder) {
 return (
 <AddItemFlow
 order={currentOrder}
 tables={tables}
 categories={categories}
 defaultLang={defaultLang}
 currencySymbol={currencySymbol}
 view={view}
 setView={setView}
 onCancel={() => setView({ name: "order", orderId: currentOrder.id })}
 onAdd={(item) => {
 appendItem(currentOrder.id, item);
 setView({ name: "order", orderId: currentOrder.id });
 }}
 />
 );
 }

 if (view.name === "order" && currentOrder) {
 return (
 <OrderDetailPage
 order={currentOrder}
 tables={tables}
 defaultLang={defaultLang}
 currencySymbol={currencySymbol}
 onBack={() => setView({ name: "list" })}
 onAddItem={() => {
 track("dash_orders_order_add_item");
 setView({ name: "addItem", orderId: currentOrder.id, step: "category" });
 }}
 onItemStatusChange={(itemId, status) => setItemStatus(currentOrder.id, itemId, status)}
 onRemoveItem={(itemId) => removeItem(currentOrder.id, itemId)}
 onComplete={() => completeOrder(currentOrder.id)}
 onDelete={() => removeOrder(currentOrder.id)}
 />
 );
 }

 const occupiedIds = new Set(
 activeOrders.map((o) => o.tableId).filter((x): x is string => !!x),
 );
 // Orders submitted without a table (e.g. takeaway / pickup, or guests who
 // didn't pick a table on the public menu) need a place to live, since the
 // table-grid view filters by tableId.
 const noTableOrders = activeOrders.filter((o) => !o.tableId);
 const NO_TABLE = "__no_table__";
 const isNoTableView = selectedTableId === NO_TABLE;
 const selectedTable =
 selectedTableId && !isNoTableView ? tables.find((t) => t.id === selectedTableId) : null;
 const selectedTableOrders = isNoTableView
 ? noTableOrders
 : selectedTableId
 ? activeOrders.filter((o) => o.tableId === selectedTableId)
 : [];

 if (tables.length === 0) {
 return (
 <div className="max-w-2xl mx-auto" onClick={() => track("dash_orders_click_map_empty")}>
 <PageHeader
 title={t("title")}
 subtitle={activeOrders.length === 1 ? t("subtitleOne", { count: activeOrders.length }) : t("subtitleOther", { count: activeOrders.length })}
 />
 <EmptyState
 title={t("noTablesTitle")}
 subtitle={t("noTablesSub")}
 />
 </div>
 );
 }

 return (
 <div className="max-w-2xl mx-auto">
 <PageHeader
 title={t("title")}
 subtitle={activeOrders.length === 1 ? t("subtitleOne", { count: activeOrders.length }) : t("subtitleOther", { count: activeOrders.length })}
 />

 <style>{`
 .orders-layout { display: flex; flex-direction: column; gap: 1rem; align-items: flex-start; }
 .orders-col-left { width: 100%; }
 .orders-col-right { width: 100%; min-width: 0; }
 @media (min-width: 768px) {
 .orders-layout { flex-direction: row; }
 .orders-col-left { flex: 0 0 280px; width: 280px; }
 .orders-col-right { flex: 1 1 0%; min-width: 0; width: auto; }
 }
 `}</style>

 <div className="orders-layout">
 <div className="orders-col-left">
 <FloorMap
 tables={tables}
 selectedId={isNoTableView ? null : selectedTableId}
 onSelectTable={(id) => {
 track("dash_orders_click_table");
 setSelectedTableId(id);
 }}
 occupiedIds={occupiedIds}
 />
 {noTableOrders.length > 0 ? (
 <button
 type="button"
 onClick={() => {
 track("dash_orders_click_no_table");
 setSelectedTableId(NO_TABLE);
 }}
 className={
 "w-full mt-2 h-11 rounded-xl border text-sm font-medium flex items-center justify-between px-3 transition-colors " +
 (isNoTableView
 ? "bg-foreground text-background border-foreground"
 : "bg-card text-foreground border-border")
 }
 >
 <span>{t("noTableLabel", { defaultValue: "No table" })}</span>
 <span
 className={
 "inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 text-[11px] font-semibold rounded-full " +
 (isNoTableView ? "bg-background text-foreground" : "bg-foreground text-background")
 }
 >
 {noTableOrders.length}
 </span>
 </button>
 ) : null}
 </div>

 <div className="orders-col-right">
 {!selectedTable && !isNoTableView ? (
 activeOrders.length === 0 ? (
 <EmptyState
 title={t("noActive")}
 subtitle={t("noActiveSub")}
 />
 ) : (
 <div className="text-center py-10 px-4 bg-card border border-border rounded-xl">
 <p className="text-sm text-muted-foreground">{t("tapTable")}</p>
 </div>
 )
 ) : (
 <div>
 <div className="bg-card border border-border rounded-xl p-4">
 <div className="flex items-baseline justify-between gap-3 mb-3">
 <div>
 <div className="text-sm font-medium text-foreground">
 {isNoTableView
 ? t("noTableLabel", { defaultValue: "No table" })
 : t("tableLabel", { number: selectedTable!.number })}
 {!isNoTableView && selectedTable!.name ? (
 <span className="text-muted-foreground font-normal"> · {selectedTable!.name}</span>
 ) : null}
 </div>
 <div className="text-xs text-muted-foreground mt-0.5">
 {selectedTableOrders.length === 0
 ? t("noActiveShort")
 : selectedTableOrders.length === 1
 ? t("activeOrderOne", { count: selectedTableOrders.length })
 : t("activeOrderOther", { count: selectedTableOrders.length })}
 </div>
 </div>
 </div>

 {selectedTableOrders.length > 0 ? (
 <div className="space-y-2.5">
 {selectedTableOrders.map((order) => (
 <OrderListCard
 key={order.id}
 order={order}
 currencySymbol={currencySymbol}
 onClick={() => {
 track("dash_orders_click_order");
 setView({ name: "order", orderId: order.id });
 }}
 hideTable
 />
 ))}
 </div>
 ) : null}
 </div>

 {!isNoTableView ? (
 <button
 type="button"
 onClick={() => startOrderForTable(selectedTable!.id)}
 disabled={creating}
 className="w-full h-11 mt-3 text-sm font-medium text-muted-foreground border border-dashed border-input rounded-xl flex items-center justify-center gap-2 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
 >
 {creating ? (
 <span className="w-4 h-4 border-2 border-input border-t-neutral-900 rounded-full animate-spin" />
 ) : (
 <PlusIcon size={14} />
 )}
 {selectedTableOrders.length === 0 ? t("startOrder") : t("newOrder")}
 </button>
 ) : null}
 </div>
 )}
 </div>
 </div>
 </div>
 );
}

function OrderListCard({
 order,
 currencySymbol,
 onClick,
 hideTable,
}: {
 order: Order;
 currencySymbol: string;
 onClick: () => void;
 hideTable?: boolean;
}) {
 const t = useTranslations("dashboard.orders");
 const total = calcOrderTotal(order);
 const itemsCount = order.items.length;
 const allReady =
 itemsCount > 0 && order.items.every((it) => it.status === "ready" || it.status === "served");
 const anyCooking = order.items.some((it) => it.status === "cooking");

 return (
 <button
 type="button"
 onClick={onClick}
 className="w-full text-left bg-card border border-border rounded-xl p-3.5 transition-colors"
 >
 <div className="flex items-center justify-between gap-3 mb-1.5">
 <div className="flex items-center gap-2 min-w-0">
 <div className="text-sm font-medium text-foreground truncate">
 {hideTable
 ? formatTimeShort(order.createdAt)
 : t("tableLabel", { number: order.tableNumber ?? "?" })}
 </div>
 {allReady ? (
 <span className="inline-flex items-center h-5 px-2 text-[10px] font-medium border rounded-full bg-emerald-50 text-emerald-700 border-emerald-200">
 All ready
 </span>
 ) : anyCooking ? (
 <span className="inline-flex items-center h-5 px-2 text-[10px] font-medium border rounded-full bg-amber-50 text-amber-700 border-amber-200">
 Cooking
 </span>
 ) : null}
 </div>
 <div className="text-sm font-medium text-foreground tabular-nums shrink-0">
 {formatPrice(total, currencySymbol)}
 </div>
 </div>
 <div className="flex items-center gap-3 text-xs text-muted-foreground">
 {!hideTable ? (
 <div className="inline-flex items-center gap-1">
 <ClockIcon size={11} />
 <span>{formatTimeShort(order.createdAt)}</span>
 </div>
 ) : null}
 <div className="inline-flex items-center gap-1">
 <ReceiptIcon size={11} />
 <span>
 {itemsCount === 1 ? t("itemOne", { count: itemsCount }) : t("itemOther", { count: itemsCount })}
 </span>
 </div>
 </div>
 </button>
 );
}

function OrderDetailPage({
 order,
 tables,
 defaultLang,
 currencySymbol,
 onBack,
 onAddItem,
 onItemStatusChange,
 onRemoveItem,
 onComplete,
 onDelete,
}: {
 order: Order;
 tables: TableEntity[];
 defaultLang: string;
 currencySymbol: string;
 onBack: () => void;
 onAddItem: () => void;
 onItemStatusChange: (itemId: string, status: OrderItemStatus) => void;
 onRemoveItem: (itemId: string) => void;
 onComplete: () => void;
 onDelete: () => void;
}) {
 const t = useTranslations("dashboard.orders");
 const tc = useTranslations("dashboard.common");
 const table = tables.find((tbl) => tbl.id === order.tableId);
 const total = calcOrderTotal(order);
 const allServed = order.items.length > 0 && order.items.every((it) => it.status === "served");
 const [confirmDelete, setConfirmDelete] = useState(false);

 useEffect(() => {
 window.scrollTo({ top: 0, behavior: "auto" });
 }, []);

 return (
 <div>
 <div
 className="sticky z-10 -mx-4 md:-mx-6 -mt-5 md:-mt-4 px-4 md:px-6 py-2 bg-[hsl(0_0%_6.5%/0.9)] backdrop-blur-md border-b border-border/60"
 style={{ top: "var(--topbar-h, 0px)" }}
 >
 <div className="max-w-2xl mx-auto flex items-center justify-between gap-3">
 <button
 type="button"
 onClick={() => { track("dash_orders_order_back"); onBack(); }}
 className="inline-flex items-center gap-1 h-8 -ml-1 pl-1 pr-2 text-xs font-medium text-muted-foreground rounded-md transition-colors"
 >
 <ChevronLeftIcon size={14} />
 {tc("back")}
 </button>
 <button
 type="button"
 onClick={onComplete}
 disabled={order.items.length === 0}
 className="h-8 px-3 text-xs font-medium text-primary-foreground bg-primary rounded-lg transition-colors"
 >
 {t("completeOrder")}
 </button>
 </div>
 </div>

 <ConfirmDialog
 open={confirmDelete}
 title={t("deleteOrderTitle")}
 message={t("deleteOrderMessage")}
 confirmLabel={tc("delete")}
 onCancel={() => setConfirmDelete(false)}
 onConfirm={() => {
 setConfirmDelete(false);
 onDelete();
 }}
 />

 <div className="max-w-2xl mx-auto pt-7 md:pt-6">
 <div className="mb-5">
 <div className="text-xs text-muted-foreground">{t("ordersBreadcrumb")}</div>
 <h2 className="text-xl font-medium text-foreground mt-1">
 {t("tableLabel", { number: table ? table.number : order.tableNumber ?? "?" })}
 {table && table.name ? <span className="text-muted-foreground font-normal"> · {table.name}</span> : null}
 </h2>
 <div className="text-xs text-muted-foreground mt-1">
 {t("startedAt", { time: formatTimeShort(order.createdAt), minutes: minutesSince(order.createdAt) })}
 </div>
 </div>

 {order.items.length === 0 ? (
 <div className="text-center py-8 bg-card border border-border rounded-xl mb-3">
 <p className="text-sm text-muted-foreground">{t("noItems")}</p>
 </div>
 ) : (
 <div className="space-y-2 mb-3">
 {order.items.map((item) => (
 <OrderItemCard
 key={item.id}
 item={item}
 defaultLang={defaultLang}
 currencySymbol={currencySymbol}
 onStatusChange={(status) => onItemStatusChange(item.id, status)}
 onRemove={() => onRemoveItem(item.id)}
 />
 ))}
 </div>
 )}

 <button
 type="button"
 onClick={onAddItem}
 className="w-full h-11 text-sm font-medium text-muted-foreground border border-dashed border-input rounded-xl flex items-center justify-center gap-2 transition-colors"
 >
 <PlusIcon size={14} />
 {t("addItem")}
 </button>

 {order.items.length > 0 ? (
 <div className="mt-5 pt-4 border-t border-border flex items-center justify-between">
 <div className="text-sm font-medium text-foreground">{t("total")}</div>
 <div className="text-lg font-medium text-foreground tabular-nums">
 {formatPrice(total, currencySymbol)}
 </div>
 </div>
 ) : null}

 {allServed ? (
 <p className="text-xs text-emerald-700 text-center mt-4">{t("allServed")}</p>
 ) : null}

 <div className="mt-6 flex justify-center">
 <button
 type="button"
 onClick={() => setConfirmDelete(true)}
 className="inline-flex items-center gap-1.5 h-9 px-3 text-xs font-medium text-red-600 rounded-lg transition-colors"
 >
 <TrashIcon size={13} />
 {t("deleteOrder")}
 </button>
 </div>
 </div>
 </div>
 );
}

function OrderItemCard({
 item,
 defaultLang,
 currencySymbol,
 onStatusChange,
 onRemove,
}: {
 item: OrderItem;
 defaultLang: string;
 currencySymbol: string;
 onStatusChange: (status: OrderItemStatus) => void;
 onRemove: () => void;
}) {
 const t = useTranslations("dashboard.orders");
 const statusKey = ITEM_STATUS_KEYS[item.status] || ITEM_STATUS_KEYS.pending;
 const statusCls = ITEM_STATUS_CLS[item.status] || ITEM_STATUS_CLS.pending;
 const price = calcItemPrice(item);
 const nextStatus: Record<OrderItemStatus, OrderItemStatus> = {
 pending: "cooking",
 cooking: "ready",
 ready: "served",
 served: "pending",
 };

 return (
 <div className="bg-card border border-border rounded-xl p-3.5">
 <div className="flex items-start justify-between gap-3 mb-1.5">
 <div className="min-w-0 flex-1">
 <div className="text-sm font-medium text-foreground">
 {getMlWithFallback(item.dishNameSnapshot, defaultLang, defaultLang)}
 </div>
 {item.options.length > 0 ? (
 <div className="text-xs text-muted-foreground mt-0.5">
 {item.options.map((o, i) => (
 <span key={i}>
 {i > 0 ? " · " : ""}
 {getMlWithFallback(o.variantName, defaultLang, defaultLang)}
 {(o.quantity ?? 1) > 1 ? ` × ${o.quantity}` : ""}
 </span>
 ))}
 </div>
 ) : null}
 </div>
 <div className="text-sm text-foreground tabular-nums shrink-0">
 {formatPrice(price, currencySymbol)}
 </div>
 </div>

 {item.notes ? (
 <div className="inline-flex items-start gap-1 text-xs text-muted-foreground mt-1 px-2 py-1 bg-secondary rounded-md">
 <MessageIcon size={11} className="mt-0.5 shrink-0" />
 <span>{item.notes}</span>
 </div>
 ) : null}

 <div className="flex items-center gap-2 mt-3 pt-3 border-t border-border">
 <button
 type="button"
 onClick={() => { track("dash_orders_order_status_click"); onStatusChange(nextStatus[item.status]); }}
 className={
 "inline-flex items-center h-7 px-2.5 text-[11px] font-medium border rounded-full transition-opacity " +
 statusCls
 }
 title={t("tapToChangeStatus")}
 >
 {t(statusKey)}
 </button>
 <div className="flex-1" />
 <button
 type="button"
 onClick={onRemove}
 className="w-7 h-7 flex items-center justify-center rounded-md text-muted-foreground transition-colors"
 aria-label={t("removeItem")}
 title={t("removeItem")}
 >
 <TrashIcon size={13} />
 </button>
 </div>
 </div>
 );
}

// ── Add-item drilldown: category → dish → configure ──

function AddItemFlow({
 order,
 tables,
 categories,
 defaultLang,
 currencySymbol,
 view,
 setView,
 onAdd,
 onCancel,
}: {
 order: Order;
 tables: TableEntity[];
 categories: Category[];
 defaultLang: string;
 currencySymbol: string;
 view: Extract<OrdersView, { name: "addItem" }>;
 setView: React.Dispatch<React.SetStateAction<OrdersView>>;
 onAdd: (item: OrderItem) => void;
 onCancel: () => void;
}) {
 const t = useTranslations("dashboard.orders");
 const tc = useTranslations("dashboard.common");
 const table = tables.find((tbl) => tbl.id === order.tableId);
 const tableLabel = t("tableLabel", { number: table ? table.number : order.tableNumber ?? "?" });

 function goCategory() {
 setView({ name: "addItem", orderId: order.id, step: "category" });
 }
 function goDish(categoryId: string) {
 setView({ name: "addItem", orderId: order.id, step: "dish", categoryId });
 }
 function goConfigure(categoryId: string, dishId: string) {
 setView({ name: "addItem", orderId: order.id, step: "configure", categoryId, dishId });
 }

 if (view.step === "configure") {
 const cat = categories.find((c) => c.id === view.categoryId);
 const dish = cat?.dishes.find((d) => d.id === view.dishId);
 if (!dish) {
 goCategory();
 return null;
 }
 return (
 <DishWizard
 dish={dish}
 baseBreadcrumb={tableLabel + " / " + t("addItemBreadcrumb")}
 defaultLang={defaultLang}
 currencySymbol={currencySymbol}
 onBack={() => goDish(view.categoryId)}
 onAdd={(itemData) => {
 onAdd({
 id: newId(),
 dishId: dish.id,
 dishNameSnapshot: dish.name,
 basePriceSnapshot: dish.price,
 options: itemData.options,
 notes: itemData.notes,
 status: "pending",
 createdAt: new Date().toISOString(),
 });
 }}
 />
 );
 }

 if (view.step === "dish") {
 const cat = categories.find((c) => c.id === view.categoryId);
 if (!cat) {
 goCategory();
 return null;
 }
 const visibleDishes = cat.dishes.filter((d) => d.visible !== false);
 return (
 <PickerStep
 title={getMlWithFallback(cat.name, defaultLang, defaultLang)}
 breadcrumb={tableLabel + " / " + t("addItemBreadcrumb") + " / " + getMlWithFallback(cat.name, defaultLang, defaultLang)}
 onBack={goCategory}
 onCancel={onCancel}
 >
 {visibleDishes.length === 0 ? (
 <p className="text-sm text-muted-foreground text-center py-6">{t("noDishesInCategory")}</p>
 ) : (
 <div className="space-y-1">
 {visibleDishes.map((d) => (
 <button
 key={d.id}
 type="button"
 onClick={() => { track("dash_orders_order_select_item"); goConfigure(cat.id, d.id); }}
 className="w-full text-left flex items-center justify-between gap-3 p-3 rounded-lg transition-colors"
 >
 <span className="text-sm text-foreground truncate">
 {getMlWithFallback(d.name, defaultLang, defaultLang)}
 </span>
 <span className="text-sm text-muted-foreground tabular-nums shrink-0">
 {currencySymbol + d.price}
 </span>
 </button>
 ))}
 </div>
 )}
 </PickerStep>
 );
 }

 return (
 <PickerStep
 title={t("addItem")}
 breadcrumb={tableLabel}
 onBack={onCancel}
 onCancel={onCancel}
 hideCancel
 >
 <div className="space-y-1">
 {categories.map((c) => (
 <button
 key={c.id}
 type="button"
 onClick={() => { track("dash_orders_order_select_category"); goDish(c.id); }}
 className="w-full text-left flex items-center justify-between gap-3 p-3 rounded-lg transition-colors"
 >
 <span className="text-sm font-medium text-foreground truncate">
 {getMlWithFallback(c.name, defaultLang, defaultLang)}
 </span>
 <span className="text-xs text-muted-foreground tabular-nums shrink-0">{c.dishes.length}</span>
 </button>
 ))}
 </div>
 </PickerStep>
 );
}

function PickerStep({
 title,
 breadcrumb,
 onBack,
 onCancel,
 hideCancel,
 children,
}: {
 title: string;
 breadcrumb?: string;
 onBack: () => void;
 onCancel: () => void;
 hideCancel?: boolean;
 children: React.ReactNode;
}) {
 const tc = useTranslations("dashboard.common");
 useEffect(() => {
 window.scrollTo({ top: 0, behavior: "auto" });
 }, [title]);
 return (
 <div>
 <div
 className="sticky z-10 -mx-4 md:-mx-6 -mt-5 md:-mt-4 px-4 md:px-6 py-2 bg-[hsl(0_0%_6.5%/0.9)] backdrop-blur-md border-b border-border/60"
 style={{ top: "var(--topbar-h, 0px)" }}
 >
 <div className="max-w-2xl mx-auto flex items-center justify-between gap-3">
 <button
 type="button"
 onClick={onBack}
 className="inline-flex items-center gap-1 h-8 -ml-1 pl-1 pr-2 text-xs font-medium text-muted-foreground rounded-md transition-colors"
 >
 <ChevronLeftIcon size={14} />
 {tc("back")}
 </button>
 </div>
 </div>

 <div className="max-w-2xl mx-auto pt-7 md:pt-6">
 <div className="mb-5">
 {breadcrumb ? <div className="text-xs text-muted-foreground">{breadcrumb}</div> : null}
 <h2 className="text-xl font-medium text-foreground mt-1">{title}</h2>
 </div>
 <div className="bg-card border border-border rounded-xl p-2">{children}</div>
 </div>
 </div>
 );
}

type WizardSubstep = { kind: "required"; index: number } | { kind: "final" };

function DishWizard({
 dish,
 baseBreadcrumb,
 defaultLang,
 currencySymbol,
 onBack,
 onAdd,
}: {
 dish: Dish;
 baseBreadcrumb: string;
 defaultLang: string;
 currencySymbol: string;
 onBack: () => void;
 onAdd: (data: { options: OrderItemOptionSnapshot[]; notes: string }) => void;
}) {
 const t = useTranslations("dashboard.orders");
 const tc = useTranslations("dashboard.common");
 const requiredOpts = (dish.options || []).filter((o) => o.required);
 const extraOpts = (dish.options || []).filter((o) => !o.required);

 const [substep, setSubstep] = useState<WizardSubstep>(
 requiredOpts.length > 0 ? { kind: "required", index: 0 } : { kind: "final" },
 );

 useEffect(() => {
 }, []);

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

 useEffect(() => {
 window.scrollTo({ top: 0, behavior: "auto" });
 }, [substep]);

 function setQty(variantId: string, qty: number) {
 setExtraQty((s) => {
 const next = { ...s };
 if (qty <= 0) delete next[variantId];
 else next[variantId] = qty;
 return next;
 });
 }

 // Build snapshots for current state (used for totals and final add).
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

 // Breadcrumb: dish name + selections from all required options chosen so far.
 const dishName = getMlWithFallback(dish.name, defaultLang, defaultLang);
 const chosenReqLabels: string[] = [];
 const completedReqCount =
 substep.kind === "final" ? requiredOpts.length : substep.index;
 for (let i = 0; i < completedReqCount; i++) {
 const opt = requiredOpts[i];
 const sel = reqSelections[opt.id];
 if (opt.type === "single" && typeof sel === "string") {
 const v = opt.variants.find((vv) => vv.id === sel);
 if (v) chosenReqLabels.push(getMlWithFallback(v.name, defaultLang, defaultLang));
 } else if (opt.type === "multi" && Array.isArray(sel)) {
 const names = sel
 .map((vid) => opt.variants.find((vv) => vv.id === vid))
 .filter((v): v is OptionVariant => !!v)
 .map((v) => getMlWithFallback(v.name, defaultLang, defaultLang));
 if (names.length > 0) chosenReqLabels.push(names.join("+"));
 }
 }
 const breadcrumb = [baseBreadcrumb, dishName, ...chosenReqLabels].join(" / ");

 // Navigation.
 function handleBack() {
 if (substep.kind === "required") {
 if (substep.index === 0) onBack();
 else setSubstep({ kind: "required", index: substep.index - 1 });
 } else {
 if (requiredOpts.length > 0) setSubstep({ kind: "required", index: requiredOpts.length - 1 });
 else onBack();
 }
 }

 function advanceFromRequired(idx: number) {
 if (idx + 1 < requiredOpts.length) setSubstep({ kind: "required", index: idx + 1 });
 else setSubstep({ kind: "final" });
 }

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
 track("dash_orders_order_save_item");
 onAdd({ options: snapshots, notes: notes.trim() });
 }

 // Render.
 const currentOpt = substep.kind === "required" ? requiredOpts[substep.index] : null;

 return (
 <div>
 <div
 className="sticky z-10 -mx-4 md:-mx-6 -mt-5 md:-mt-4 px-4 md:px-6 py-2 bg-[hsl(0_0%_6.5%/0.9)] backdrop-blur-md border-b border-border/60"
 style={{ top: "var(--topbar-h, 0px)" }}
 >
 <div className="max-w-2xl mx-auto flex items-center justify-between gap-3">
 <button
 type="button"
 onClick={handleBack}
 className="inline-flex items-center gap-1 h-8 -ml-1 pl-1 pr-2 text-xs font-medium text-muted-foreground rounded-md transition-colors"
 >
 <ChevronLeftIcon size={14} />
 {tc("back")}
 </button>
 {substep.kind === "required" && currentOpt && currentOpt.type === "multi" ? (
 <button
 type="button"
 onClick={() => handleMultiContinue(currentOpt, substep.index)}
 disabled={
 !Array.isArray(reqSelections[currentOpt.id]) ||
 (reqSelections[currentOpt.id] as string[]).length === 0
 }
 className="h-8 px-3 text-xs font-medium text-primary-foreground bg-primary rounded-lg transition-colors"
 >
 {t("continue")}
 </button>
 ) : null}
 {substep.kind === "final" ? (
 <button
 type="button"
 onClick={handleAdd}
 className="h-8 px-3 text-xs font-medium text-primary-foreground bg-primary rounded-lg transition-colors"
 >
 {t("addPrice", { price: formatPrice(totalPrice, currencySymbol) })}
 </button>
 ) : null}
 </div>
 </div>

 <div className="max-w-2xl mx-auto pt-7 md:pt-6">
 <div className="mb-5">
 <div className="text-xs text-muted-foreground">{breadcrumb}</div>
 <h2 className="text-xl font-medium text-foreground mt-1">
 {substep.kind === "required" && currentOpt
 ? getMlWithFallback(currentOpt.name, defaultLang, defaultLang)
 : t("addExtras")}
 </h2>
 {substep.kind === "required" && currentOpt && currentOpt.type === "multi" ? (
 <p className="text-xs text-muted-foreground mt-1">{t("multiPickHint")}</p>
 ) : null}
 </div>

 {substep.kind === "required" && currentOpt ? (
 <div className="bg-card border border-border rounded-xl p-2">
 <div className="space-y-1">
 {currentOpt.variants.map((v) => {
 const sel = reqSelections[currentOpt.id];
 const isSelected =
 currentOpt.type === "single"
 ? sel === v.id
 : Array.isArray(sel) && sel.includes(v.id);
 const delta = parseDecimal(v.priceDelta) || 0;
 return (
 <button
 key={v.id}
 type="button"
 onClick={() => pickRequiredVariant(currentOpt, substep.index, v.id)}
 className={
 "w-full flex items-center justify-between gap-3 p-3 rounded-lg transition-colors " +
 (isSelected ? "bg-foreground text-background" : "text-foreground")
 }
 >
 <span className="text-sm truncate">
 {getMlWithFallback(v.name, defaultLang, defaultLang)}
 </span>
 <span
 className={
 "text-sm tabular-nums shrink-0 " +
 (isSelected ? "text-white/80" : "text-muted-foreground")
 }
 >
 {delta > 0 ? `+${delta.toFixed(2)}` : ""}
 </span>
 </button>
 );
 })}
 </div>
 </div>
 ) : null}

 {substep.kind === "final" ? (
 <div className="space-y-3">
 {extraOpts.length > 0 ? (
 <div className="bg-card border border-border rounded-2xl p-5 md:p-6">
 {extraOpts.map((opt, idx) => (
 <div key={opt.id} className={idx > 0 ? "border-t border-border mt-5 pt-5" : ""}>
 <div className="text-sm font-medium text-foreground mb-2.5">
 {getMlWithFallback(opt.name, defaultLang, defaultLang)}
 </div>
 <div className="space-y-1.5">
 {opt.variants.map((v) => {
 const qty = extraQty[v.id] ?? 0;
 const delta = parseDecimal(v.priceDelta) || 0;
 return (
 <div
 key={v.id}
 className="w-full flex items-center justify-between gap-3 px-3 h-12 rounded-lg border border-border bg-card"
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
 </div>
 ))}
 </div>
 ) : null}

 <div className="bg-card border border-border rounded-2xl p-5 md:p-6">
 <label htmlFor="item-notes" className="block text-sm font-medium text-foreground mb-2.5">{t("notesLabel")}</label>
 <textarea
 id="item-notes"
 rows={2}
 value={notes}
 onChange={(e) => setNotes(e.target.value)}
 onFocus={() => track("dash_orders_order_focus_note")}
 placeholder={t("notesPlaceholder")}
 className={inputClass + " h-auto py-2 resize-none"}
 />
 </div>
 </div>
 ) : null}
 </div>
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
 className="sticky z-10 -mx-4 md:-mx-6 -mt-5 md:-mt-4 bg-[hsl(0_0%_6.5%/0.9)] backdrop-blur-md border-b border-border/60"
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
