"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { PlusIcon, QrIcon, TrashIcon } from "./icons";
import {
 ConfirmDialog,
 EmptyState,
 PhotoPicker,
 SubpageStickyBar,
 TableQrModal,
} from "./ui";
import { inputClass } from "./tokens";
import { newId } from "./helpers";
import { createTable, deleteTable, updateTable } from "./api";
import type { Booking, Order, TableEntity } from "./types";
import { DashboardEvent, track } from "@/lib/dashboard-events";

function tableSize(capacity: number): number {
 const c = Math.max(1, Math.min(12, capacity || 2));
 return Math.round(28 + (c - 1) * 3);
}

export function FloorMap({
 tables,
 selectedId,
 onSelectTable,
 occupiedIds,
}: {
 tables: TableEntity[];
 selectedId: string | null;
 onSelectTable: (id: string | null) => void;
 occupiedIds?: Set<string>;
}) {
 const tt = useTranslations("dashboard.tables");
 const occupied = occupiedIds || new Set<string>();
 return (
 <>
 <style>{`
 .floor-map {
 position: relative;
 width: 100%;
 aspect-ratio: 1 / 1;
 background-color: hsl(var(--card));
 border: 1px solid hsl(var(--border));
 border-radius: 0.75rem;
 overflow: hidden;
 }
 @media (min-width: 768px) {
 .floor-map { width: 280px; height: 280px; aspect-ratio: auto; }
 }
 `}</style>
 <div className="floor-map" onClick={() => onSelectTable(null)}>
 <div
 className="absolute inset-0"
 style={{
 backgroundImage:
 "linear-gradient(to right, hsl(var(--foreground) / 0.08) 1px, transparent 1px)," +
 "linear-gradient(to bottom, hsl(var(--foreground) / 0.08) 1px, transparent 1px)",
 backgroundSize: "10% 10%",
 }}
 />
 {tables.map((t) => {
 const isSelected = selectedId === t.id;
 const isOccupied = occupied.has(t.id);
 const size = tableSize(t.capacity);
 const x = t.x ?? 50;
 const y = t.y ?? 50;
 const stateCls = isSelected
 ? "bg-foreground text-background ring-4 ring-foreground/20 z-10"
 : isOccupied
 ? "bg-amber-100 text-amber-900 border border-amber-400"
 : "bg-card text-foreground border border-input";
 return (
 <button
 key={t.id}
 type="button"
 onClick={(e) => { e.stopPropagation(); onSelectTable(t.id); }}
 className={
 "absolute flex items-center justify-center rounded-full font-medium tabular-nums transition-all overflow-hidden " +
 stateCls
 }
 style={{
 width: size + "px",
 height: size + "px",
 left: "calc(" + x + "% - " + size / 2 + "px)",
 top: "calc(" + y + "% - " + size / 2 + "px)",
 fontSize: size > 44 ? "14px" : "12px",
 }}
 aria-label={tt("tableLabelAria", { number: t.number })}
 title={tt("tableLabelAria", { number: t.number }) + (t.name ? " · " + t.name : "")}
 >
 {t.photoUrl ? (
 <img src={t.photoUrl} alt="" className="absolute inset-0 w-full h-full object-cover" />
 ) : null}
 <span className={t.photoUrl ? "relative z-10 px-1 rounded bg-black/40 text-white" : ""}>
 {t.number}
 </span>
 </button>
 );
 })}
 </div>
 </>
 );
}

export function TablesPage({
 tables,
 setTables,
 orders,
 bookings,
 menuUrl,
 onBack,
}: {
 tables: TableEntity[];
 setTables: React.Dispatch<React.SetStateAction<TableEntity[]>>;
 orders: Order[];
 bookings: Booking[];
 menuUrl: string;
 onBack: () => void;
}) {
 const t = useTranslations("dashboard.tables");
 const [draft, setDraft] = useState<TableEntity[]>(tables);
 const [selectedId, setSelectedId] = useState<string | null>(tables[0]?.id ?? null);
 const [confirmState, setConfirmState] = useState<{
 open: boolean;
 title?: string;
 message?: string;
 singleButton?: boolean;
 onConfirm?: (() => void) | null;
 }>({ open: false });
 const [qrTable, setQrTable] = useState<TableEntity | null>(null);

 useEffect(() => {
 track(DashboardEvent.SHOWED_TABLES);
 window.scrollTo({ top: 0, behavior: "auto" });
 }, []);

 const selected = draft.find((tbl) => tbl.id === selectedId) || null;

 const usedIds = new Set<string>([
 ...orders.filter((o) => o.status === "active").map((o) => o.tableId).filter((x): x is string => !!x),
 ...bookings.filter((b) => b.status !== "cancelled").map((b) => b.tableId).filter((x): x is string => !!x),
 ]);

 async function save() {
 track(DashboardEvent.CLICKED_SAVE_TABLE);
 const before = new Map(tables.map((tbl) => [tbl.id, tbl]));
 const ops: Promise<unknown>[] = [];
 for (const tbl of draft) {
 const prev = before.get(tbl.id);
 const isNew = !prev;
 const changed =
 !prev ||
 prev.number !== tbl.number ||
 prev.capacity !== tbl.capacity ||
 prev.name !== tbl.name ||
 prev.x !== tbl.x ||
 prev.y !== tbl.y ||
 prev.photoUrl !== tbl.photoUrl;
 if (isNew) {
 ops.push(
 createTable({
 number: tbl.number,
 capacity: tbl.capacity,
 zone: tbl.name || null,
 imageUrl: tbl.photoUrl,
 x: tbl.x,
 y: tbl.y,
 }),
 );
 } else if (changed) {
 ops.push(
 updateTable(tbl.id, {
 number: tbl.number,
 capacity: tbl.capacity,
 zone: tbl.name || null,
 imageUrl: tbl.photoUrl,
 x: tbl.x,
 y: tbl.y,
 }),
 );
 }
 }
 const draftIds = new Set(draft.map((tbl) => tbl.id));
 for (const tbl of tables) {
 if (!draftIds.has(tbl.id)) ops.push(deleteTable(tbl.id));
 }
 try {
 await Promise.all(ops);
 } catch {
 track(DashboardEvent.ERROR_SAVE);
 }
 setTables(draft);
 onBack();
 }

 function updateTableLocal(id: string, patch: Partial<TableEntity>) {
 setDraft((d) => d.map((tbl) => (tbl.id === id ? { ...tbl, ...patch } : tbl)));
 }

 function addTable() {
 track(DashboardEvent.CLICKED_ADD_TABLE);
 const nextNum = draft.reduce((max, tbl) => Math.max(max, tbl.number || 0), 0) + 1;
 const newTable: TableEntity = {
 id: newId(),
 number: nextNum,
 name: "",
 capacity: 2,
 x: 50,
 y: 50,
 photoUrl: null,
 sortOrder: nextNum,
 };
 setDraft((d) => [...d, newTable]);
 setSelectedId(newTable.id);
 }

 function removeTable(id: string) {
 track(DashboardEvent.CLICKED_DELETE_TABLE);
 const tbl = draft.find((x) => x.id === id);
 if (!tbl) return;
 if (usedIds.has(id)) {
 setConfirmState({
 open: true,
 title: t("cantDeleteTitle"),
 message: t("cantDeleteMessage", { number: tbl.number }),
 singleButton: true,
 onConfirm: null,
 });
 return;
 }
 setConfirmState({
 open: true,
 title: t("deleteTitle"),
 message: t("deleteMessage", { number: tbl.number, label: tbl.name ? " · " + tbl.name : "" }),
 onConfirm: async () => {
 setConfirmState({ open: false });
 const wasPersisted = tables.some((x) => x.id === id);
 setDraft((d) => d.filter((x) => x.id !== id));
 if (selectedId === id) setSelectedId(null);
 if (wasPersisted) {
 try {
 await deleteTable(id);
 setTables((prev) => prev.filter((x) => x.id !== id));
 } catch {
 track(DashboardEvent.ERROR_SAVE);
 }
 }
 },
 });
 }

 return (
 <div>
 <SubpageStickyBar onBack={onBack} onSave={save} canSave>
 <button
 type="button"
 onClick={addTable}
 className="inline-flex items-center gap-1 h-8 px-2.5 text-xs font-medium text-muted-foreground rounded-md transition-colors"
 >
 <PlusIcon size={13} />
 {t("table")}
 </button>
 </SubpageStickyBar>

 <div className="max-w-2xl mx-auto pt-5 md:pt-4">
 <div className="mb-5">
 <div className="text-xs text-muted-foreground">{t("settingsBreadcrumb")}</div>
 <h2 className="text-xl font-medium text-foreground mt-1">{t("title")}</h2>
 </div>

 <style>{`
 .tables-layout { display: flex; flex-direction: column; gap: 1rem; align-items: flex-start; }
 .tables-col-left { width: 100%; }
 .tables-col-right { width: 100%; min-width: 0; }
 @media (min-width: 768px) {
 .tables-layout { flex-direction: row; }
 .tables-col-left { flex: 0 0 280px; width: 280px; }
 .tables-col-right { flex: 1 1 0%; min-width: 0; width: auto; }
 }
 `}</style>
 {draft.length === 0 ? (
 <EmptyState
 title={t("emptyTitle")}
 subtitle={t("emptySubtitle")}
 action={
 <button
 type="button"
 onClick={addTable}
 className="inline-flex items-center gap-1.5 h-9 px-4 text-sm font-medium text-background bg-foreground rounded-lg transition-colors"
 >
 <PlusIcon size={14} />
 {t("addFirstTable")}
 </button>
 }
 />
 ) : (
 <div className="tables-layout">
 <div className="tables-col-left">
 <FloorMap tables={draft} selectedId={selectedId} onSelectTable={setSelectedId} />
 </div>

 <div className="tables-col-right">
 {selected ? (
 <>
 <TableSettings
 table={selected}
 onChange={(patch) => updateTableLocal(selected.id, patch)}
 />
 <div className="mt-6 flex flex-col items-center gap-1">
 <button
 type="button"
 onClick={() => setQrTable(selected)}
 className="inline-flex items-center gap-1.5 h-9 px-3 text-xs font-medium text-muted-foreground rounded-lg transition-colors"
 >
 <QrIcon size={13} />
 {t("showQr")}
 </button>
 <button
 type="button"
 onClick={() => removeTable(selected.id)}
 className="inline-flex items-center gap-1.5 h-9 px-3 text-xs font-medium text-red-600 rounded-lg transition-colors"
 >
 <TrashIcon size={13} />
 {t("deleteTable")}
 </button>
 </div>
 </>
 ) : (
 <p className="text-xs text-muted-foreground text-center py-4">{t("tapTable")}</p>
 )}
 </div>
 </div>
 )}
 </div>

 <ConfirmDialog
 open={confirmState.open}
 title={confirmState.title}
 message={confirmState.message}
 singleButton={confirmState.singleButton}
 onConfirm={confirmState.onConfirm ?? undefined}
 onCancel={() => setConfirmState({ open: false })}
 />

 <TableQrModal
 open={!!qrTable}
 onClose={() => setQrTable(null)}
 tableNumber={qrTable?.number ?? null}
 tableLabel={qrTable?.name ?? ""}
 menuUrl={menuUrl}
 />
 </div>
 );
}

function TableSettings({
 table,
 onChange,
}: {
 table: TableEntity;
 onChange: (patch: Partial<TableEntity>) => void;
}) {
 const t = useTranslations("dashboard.tables");
 return (
 <div className="bg-card border border-border rounded-xl p-4 space-y-3">
 <div>
 <div className="flex items-center justify-between gap-2 mb-1.5">
 <label className="block text-sm font-medium text-foreground">{t("positionX")}</label>
 <span className="text-[11px] text-muted-foreground tabular-nums">{Math.round(table.x ?? 50)}%</span>
 </div>
 <input
 type="range"
 min="0"
 max="100"
 step="1"
 value={table.x ?? 50}
 onChange={(e) => onChange({ x: parseFloat(e.target.value) })}
 className="w-full accent-neutral-900 dark:accent-white"
 />
 </div>
 <div>
 <div className="flex items-center justify-between gap-2 mb-1.5">
 <label className="block text-sm font-medium text-foreground">{t("positionY")}</label>
 <span className="text-[11px] text-muted-foreground tabular-nums">{Math.round(table.y ?? 50)}%</span>
 </div>
 <input
 type="range"
 min="0"
 max="100"
 step="1"
 value={table.y ?? 50}
 onChange={(e) => onChange({ y: parseFloat(e.target.value) })}
 className="w-full accent-neutral-900 dark:accent-white"
 />
 </div>

 <div>
 <label className="block text-sm font-medium text-foreground mb-1.5">{t("name")}</label>
 <input
 type="text"
 value={table.name}
 onChange={(e) => onChange({ name: e.target.value })}
 placeholder={t("namePlaceholder")}
 className={inputClass}
 />
 </div>

 <div className="flex gap-3">
 <div className="flex-1 min-w-0">
 <label className="block text-sm font-medium text-foreground mb-1.5">{t("number")}</label>
 <input
 type="number"
 min="1"
 value={table.number}
 onChange={(e) => onChange({ number: parseInt(e.target.value, 10) || 1 })}
 className={inputClass + " text-center tabular-nums"}
 />
 </div>
 <div className="flex-1 min-w-0">
 <label className="block text-sm font-medium text-foreground mb-1.5">{t("seats")}</label>
 <input
 type="number"
 min="1"
 max="20"
 value={table.capacity}
 onChange={(e) => onChange({ capacity: parseInt(e.target.value, 10) || 1 })}
 className={inputClass + " text-center tabular-nums"}
 />
 </div>
 </div>

 <div>
 <label className="block text-sm font-medium text-foreground mb-1.5">{t("photo")}</label>
 <PhotoPicker
 url={table.photoUrl}
 onChange={(url) => onChange({ photoUrl: url })}
 inputId={"table-photo-" + table.id}
 width="w-full"
 />
 </div>
 </div>
 );
}
