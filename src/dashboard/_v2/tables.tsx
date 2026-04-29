"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { MinusIcon, PlusIcon, QrIcon, TrashIcon } from "./icons";
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
import { useDashboardRouter } from "../_spa/router";

function Stepper({
 value,
 min,
 max,
 onChange,
}: {
 value: number;
 min?: number;
 max?: number;
 onChange: (n: number) => void;
}) {
 const lo = min ?? -Infinity;
 const hi = max ?? Infinity;
 const dec = () => onChange(Math.max(lo, value - 1));
 const inc = () => onChange(Math.min(hi, value + 1));
 const btn = "w-10 h-10 flex items-center justify-center text-foreground transition-colors disabled:opacity-40";
 return (
 <div className="flex items-center w-full h-10 bg-card border border-input rounded-lg overflow-hidden">
 <button type="button" onClick={dec} disabled={value <= lo} className={btn + " border-r border-input"} aria-label="−">
 <MinusIcon size={14} />
 </button>
 <div className="flex-1 min-w-0 h-full flex items-center justify-center text-sm font-medium tabular-nums text-foreground">
 {value}
 </div>
 <button type="button" onClick={inc} disabled={value >= hi} className={btn + " border-l border-input"} aria-label="+">
 <PlusIcon size={14} />
 </button>
 </div>
 );
}

function tableSize(capacity: number): number {
 const c = Math.max(1, Math.min(12, capacity || 2));
 return Math.round(28 + (c - 1) * 3);
}

export function FloorMap({
 tables,
 selectedId,
 onSelectTable,
 onPickPosition,
 occupiedIds,
}: {
 tables: TableEntity[];
 selectedId: string | null;
 onSelectTable: (id: string | null) => void;
 onPickPosition?: (x: number, y: number) => void;
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
 <div
 className={"floor-map" + (onPickPosition ? " cursor-crosshair" : "")}
 onClick={(e) => {
 if (onPickPosition) {
 const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
 const x = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));
 const y = Math.max(0, Math.min(100, ((e.clientY - rect.top) / rect.height) * 100));
 onPickPosition(x, y);
 } else {
 onSelectTable(null);
 }
 }}
 >
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

// ── List page (map + grid of chips) ──

export function TablesPage({
 tables,
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
 const router = useDashboardRouter();

 useEffect(() => {
 track(DashboardEvent.SHOWED_TABLES);
 window.scrollTo({ top: 0, behavior: "auto" });
 }, []);

 function openNew() {
 track(DashboardEvent.CLICKED_ADD_TABLE);
 router.push({ name: "settings.tables.new" });
 }

 function openEdit(id: string) {
 router.push({ name: "settings.tables.edit", id });
 }

 return (
 <div>
 <SubpageStickyBar onBack={onBack} hideSave />

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
 {tables.length === 0 ? (
      <>
       <EmptyState title={t("emptyTitle")} subtitle={t("emptySubtitle")} />
       <button
        type="button"
        onClick={openNew}
        className="w-full mt-2.5 h-12 text-sm font-medium text-muted-foreground/60 border border-dashed border-input rounded-xl flex items-center justify-center gap-2 transition-colors"
       >
        <PlusIcon size={14} />
        {t("addFirstTable")}
       </button>
      </>
     ) : (
 <div className="tables-layout">
 <div className="tables-col-left">
 <FloorMap
 tables={tables}
 selectedId={null}
 onSelectTable={(id) => id && openEdit(id)}
 />
 </div>
 <div className="tables-col-right">
 <div className="bg-card border border-border rounded-xl overflow-hidden divide-y divide-border">
 {tables
 .slice()
 .sort((a, b) => a.number - b.number)
 .map((tbl) => (
 <button
 key={tbl.id}
 type="button"
 onClick={() => openEdit(tbl.id)}
 className="w-full flex items-center justify-between gap-3 px-4 h-12 text-left"
 >
 <span className="text-sm font-medium text-foreground shrink-0">
 {t("number")} {tbl.number}
 </span>
 <span className="text-xs text-muted-foreground truncate text-right">
 {t("seatsShort", { n: tbl.capacity })}
 </span>
 </button>
 ))}
 </div>
 <button
 type="button"
 onClick={openNew}
 className="w-full mt-2.5 h-11 text-sm font-medium text-muted-foreground/60 border border-dashed border-input rounded-xl flex items-center justify-center gap-2 transition-colors"
 >
 <PlusIcon size={14} />
 {t("table")}
 </button>
 </div>
 </div>
 )}
 </div>
 </div>
 );
}

// ── Form (new + edit) ──

export function TableFormPage({
 mode,
 tables,
 setTables,
 orders,
 bookings,
 menuUrl,
 tableId,
 onBack,
}: {
 mode: "new" | "edit";
 tables: TableEntity[];
 setTables: React.Dispatch<React.SetStateAction<TableEntity[]>>;
 orders: Order[];
 bookings: Booking[];
 menuUrl: string;
 tableId?: string;
 onBack: () => void;
}) {
 const t = useTranslations("dashboard.tables");

 const initial: TableEntity =
 mode === "edit" && tableId
 ? tables.find((x) => x.id === tableId) || null!
 : ({
 id: newId(),
 number: tables.reduce((max, tbl) => Math.max(max, tbl.number || 0), 0) + 1,
 name: "",
 capacity: 2,
 x: 50,
 y: 50,
 photoUrl: null,
 sortOrder: tables.length,
 } as TableEntity);

 const [draft, setDraft] = useState<TableEntity>(initial);
 const [saving, setSaving] = useState(false);
 const [confirmState, setConfirmState] = useState<{
 open: boolean;
 title?: string;
 message?: string;
 singleButton?: boolean;
 onConfirm?: (() => void) | null;
 }>({ open: false });
 const [qrOpen, setQrOpen] = useState(false);

 useEffect(() => {
 window.scrollTo({ top: 0, behavior: "auto" });
 }, []);

 const usedIds = new Set<string>([
 ...orders.filter((o) => o.status === "active").map((o) => o.tableId).filter((x): x is string => !!x),
 ...bookings.filter((b) => b.status !== "cancelled").map((b) => b.tableId).filter((x): x is string => !!x),
 ]);

 if (mode === "edit" && !tables.find((x) => x.id === tableId)) {
 return (
 <div className="max-w-2xl mx-auto py-10 text-center text-sm text-muted-foreground">
 {t("emptyTitle")}
 </div>
 );
 }

 async function save() {
 track(DashboardEvent.CLICKED_SAVE_TABLE);
 if (saving) return;
 setSaving(true);
 try {
 if (mode === "new") {
 const created = await createTable({
 number: draft.number,
 capacity: draft.capacity,
 zone: draft.name || null,
 imageUrl: draft.photoUrl,
 x: draft.x,
 y: draft.y,
 });
 const entity: TableEntity = {
 id: (created as { id: string }).id,
 number: draft.number,
 name: draft.name,
 capacity: draft.capacity,
 x: draft.x,
 y: draft.y,
 photoUrl: draft.photoUrl,
 sortOrder: draft.sortOrder,
 };
 setTables((prev) => [...prev, entity]);
 } else {
 await updateTable(draft.id, {
 number: draft.number,
 capacity: draft.capacity,
 zone: draft.name || null,
 imageUrl: draft.photoUrl,
 x: draft.x,
 y: draft.y,
 });
 setTables((prev) => prev.map((x) => (x.id === draft.id ? { ...x, ...draft } : x)));
 }
 onBack();
 } catch {
 track(DashboardEvent.ERROR_SAVE);
 setSaving(false);
 }
 }

 function handleDelete() {
 if (mode !== "edit") return;
 track(DashboardEvent.CLICKED_DELETE_TABLE);
 if (usedIds.has(draft.id)) {
 setConfirmState({
 open: true,
 title: t("cantDeleteTitle"),
 message: t("cantDeleteMessage", { number: draft.number }),
 singleButton: true,
 onConfirm: null,
 });
 return;
 }
 setConfirmState({
 open: true,
 title: t("deleteTitle"),
 message: t("deleteMessage", { number: draft.number, label: draft.name ? " · " + draft.name : "" }),
 onConfirm: async () => {
 setConfirmState({ open: false });
 try {
 await deleteTable(draft.id);
 setTables((prev) => prev.filter((x) => x.id !== draft.id));
 onBack();
 } catch {
 track(DashboardEvent.ERROR_SAVE);
 }
 },
 });
 }

 return (
 <div>
 <SubpageStickyBar onBack={onBack} onSave={save} canSave={!saving} />

 <div className="max-w-2xl mx-auto pt-5 md:pt-4">
 <div className="mb-5">
 <div className="text-xs text-muted-foreground">
 {t("settingsBreadcrumb")} / {t("title")}
 </div>
 <h2 className="text-xl font-medium text-foreground mt-1">
 {mode === "new" ? t("addFirstTable") : t("tableLabelAria", { number: draft.number })}
 </h2>
 <p className="text-xs text-muted-foreground mt-1.5 leading-snug">
 {t("formTip")}
 </p>
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

 <div className="tables-layout">
 <div className="tables-col-left">
 <FloorMap
 tables={mode === "edit"
 ? tables.map((x) => (x.id === draft.id ? draft : x))
 : [...tables, draft]}
 selectedId={draft.id}
 onSelectTable={() => {}}
 onPickPosition={(x, y) => setDraft((d) => ({ ...d, x, y }))}
 />
 </div>
 <div className="tables-col-right">
 <TableSettings
 table={draft}
 onChange={(patch) => setDraft((d) => ({ ...d, ...patch }))}
 />
 {mode === "edit" ? (
 <div className="mt-6 flex flex-col items-center gap-1">
 <button
 type="button"
 onClick={() => setQrOpen(true)}
 className="inline-flex items-center gap-1.5 h-9 px-3 text-xs font-medium text-muted-foreground rounded-lg transition-colors"
 >
 <QrIcon size={13} />
 {t("showQr")}
 </button>
 <button
 type="button"
 onClick={handleDelete}
 className="inline-flex items-center gap-1.5 h-9 px-3 text-xs font-medium text-red-600 rounded-lg transition-colors"
 >
 <TrashIcon size={13} />
 {t("deleteTable")}
 </button>
 </div>
 ) : null}
 </div>
 </div>
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
 open={qrOpen}
 onClose={() => setQrOpen(false)}
 tableNumber={draft.number}
 tableLabel={draft.name}
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
 <label className="block text-sm font-medium text-foreground mb-2.5">{t("name")}</label>
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
 <label className="block text-sm font-medium text-foreground mb-2.5">{t("number")}</label>
 <Stepper
 value={table.number}
 min={1}
 onChange={(n) => onChange({ number: n })}
 />
 </div>
 <div className="flex-1 min-w-0">
 <label className="block text-sm font-medium text-foreground mb-2.5">{t("seats")}</label>
 <Stepper
 value={table.capacity}
 min={1}
 max={20}
 onChange={(n) => onChange({ capacity: n })}
 />
 </div>
 </div>

 <div>
 <label className="block text-sm font-medium text-foreground mb-2.5">{t("photo")}</label>
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
