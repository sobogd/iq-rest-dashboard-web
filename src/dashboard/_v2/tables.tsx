"use client";

import { useEffect, useRef, useState } from "react";
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
import { track } from "@/lib/dashboard-events";
import { useDashboardRouter } from "../_spa/router";

function Stepper({
 value,
 min,
 max,
 onChange,
 onPlus,
 onMinus,
}: {
 value: number;
 min?: number;
 max?: number;
 onChange: (n: number) => void;
 onPlus?: () => void;
 onMinus?: () => void;
}) {
 const lo = min ?? -Infinity;
 const hi = max ?? Infinity;
 const dec = () => { onMinus?.(); onChange(Math.max(lo, value - 1)); };
 const inc = () => { onPlus?.(); onChange(Math.min(hi, value + 1)); };
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

// Find a spot on the floor map (0-100 percent coords) that doesn't overlap
// any existing table. Scans a coarse grid and accepts the first cell at
// least MIN_GAP away from every other placed table; falls back to the
// best (most-isolated) cell we did find, then to the center if there are
// no tables yet. Unplaced tables (x/y null) are ignored.
function pickInitialTablePosition(tables: TableEntity[]): [number, number] {
 const placed = tables.filter(
 (t): t is TableEntity & { x: number; y: number } =>
 typeof t.x === "number" && typeof t.y === "number",
 );
 if (placed.length === 0) return [50, 50];

 const MIN_GAP = 14; // ~table pin diameter in % of map width
 const STEP = 7;
 const MARGIN = 8;
 let bestSpot: [number, number] = [50, 50];
 let bestMinDist = -1;
 for (let y = MARGIN; y <= 100 - MARGIN; y += STEP) {
 for (let x = MARGIN; x <= 100 - MARGIN; x += STEP) {
 let minDist = Infinity;
 for (const t of placed) {
 const dx = t.x - x;
 const dy = t.y - y;
 const d = Math.sqrt(dx * dx + dy * dy);
 if (d < minDist) minDist = d;
 }
 if (minDist >= MIN_GAP) return [x, y];
 if (minDist > bestMinDist) {
 bestMinDist = minDist;
 bestSpot = [x, y];
 }
 }
 }
 return bestSpot;
}

export function FloorMap({
 tables,
 selectedId,
 onSelectTable,
 onPickPosition,
 occupiedIds,
 readyIds,
 badgeFor,
 wide,
}: {
 tables: TableEntity[];
 selectedId: string | null;
 onSelectTable: (id: string | null) => void;
 onPickPosition?: (x: number, y: number) => void;
 occupiedIds?: Set<string>;
 readyIds?: Set<string>;
 badgeFor?: (tableId: string) => number | null | undefined;
 wide?: boolean;
}) {
 const tt = useTranslations("dashboard.tables");
 const occupied = occupiedIds || new Set<string>();
 const ready = readyIds || new Set<string>();
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
 box-sizing: border-box;
 }
 ${wide ? ".floor-map { width: 100%; height: 100%; aspect-ratio: auto; }" : "@media (min-width: 768px) { .floor-map { width: 280px; height: 280px; aspect-ratio: auto; } }"}
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
 clipPath: "inset(1px)",
 }}
 />
 {tables.map((t) => {
 const isSelected = selectedId === t.id;
 const isOccupied = occupied.has(t.id);
 const isReady = ready.has(t.id);
 const size = tableSize(t.capacity);
 const x = t.x ?? 50;
 const y = t.y ?? 50;
 const stateCls = isSelected
 ? "bg-foreground text-background ring-4 ring-foreground/20 z-10"
 : isReady
 ? "bg-emerald-100 dark:bg-emerald-950/60 text-emerald-900 dark:text-emerald-200 border border-emerald-400 dark:border-emerald-700"
 : isOccupied
 ? "bg-amber-100 dark:bg-amber-950/60 text-amber-900 dark:text-amber-200 border border-amber-400 dark:border-amber-700"
 : "bg-card text-foreground border border-input";
 const badge = badgeFor ? badgeFor(t.id) : null;
 return (
 <button
 key={t.id}
 type="button"
 onClick={(e) => { e.stopPropagation(); onSelectTable(t.id); }}
 className={
 "absolute flex items-center justify-center rounded-full font-medium tabular-nums transition-all " +
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
 {t.color ? (
 <span className="absolute inset-0 rounded-full" style={{ backgroundColor: t.color }} />
 ) : null}
 <span className={t.color ? "relative z-10 text-white" : ""}>
 {t.number}
 </span>
 {badge && badge > 0 ? (
 <span
 className={
 "absolute -top-1 -right-1 z-20 min-w-[18px] h-[18px] px-1 inline-flex items-center justify-center text-[10px] font-semibold rounded-full border-2 border-card " +
 (isReady ? "bg-emerald-600 text-white" : "bg-red-600 text-white")
 }
 >
 {badge}
 </span>
 ) : null}
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
 window.scrollTo({ top: 0, behavior: "auto" });
 }, []);

 function openNew() {
 track("dash_settings_tables_click_add");
 router.push({ name: "settings.tables.new" });
 }

 function openEdit(id: string) {
 track("dash_settings_tables_click_table");
 router.push({ name: "settings.tables.edit", id });
 }

 return (
 <div>
 <SubpageStickyBar onBack={() => { track("dash_settings_tables_click_back"); onBack(); }} hideSave />

 <div className="max-w-2xl mx-auto pt-5 md:pt-4">
 <div className="mb-5">
 <div className="text-xs text-muted-foreground">{t("settingsBreadcrumb")}</div>
 <h2 className="text-xl font-medium text-foreground mt-1">{t("title")}</h2>
 </div>

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
 <div>
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
 : (() => {
 const [x, y] = pickInitialTablePosition(tables);
 return {
 id: newId(),
 number: tables.reduce((max, tbl) => Math.max(max, tbl.number || 0), 0) + 1,
 name: "",
 capacity: 2,
 x,
 y,
 photoUrl: null,
 color: null,
 sortOrder: tables.length,
 } as TableEntity;
 })();

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
 track("dash_settings_table_click_save");
 if (saving) return;
 setSaving(true);
 try {
 if (mode === "new") {
 const created = await createTable({
 number: draft.number,
 capacity: draft.capacity,
 zone: draft.name || null,
 imageUrl: draft.photoUrl,
 color: draft.color,
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
 color: draft.color,
 sortOrder: draft.sortOrder,
 };
 setTables((prev) => [...prev, entity]);
 } else {
 await updateTable(draft.id, {
 number: draft.number,
 capacity: draft.capacity,
 zone: draft.name || null,
 imageUrl: draft.photoUrl,
 color: draft.color,
 x: draft.x,
 y: draft.y,
 });
 setTables((prev) => prev.map((x) => (x.id === draft.id ? { ...x, ...draft } : x)));
 }
 onBack();
 } catch {
 setSaving(false);
 }
 }

 function handleDelete() {
 if (mode !== "edit") return;
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
 }
 },
 });
 }

 return (
 <div>
 <SubpageStickyBar onBack={() => { track("dash_settings_table_click_back"); onBack(); }} onSave={save} canSave={!saving} />

 <div className="max-w-2xl md:max-w-5xl mx-auto pt-5 md:pt-4">
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


 <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8">
 <div className="min-w-0">
 <FloorMap
 tables={mode === "edit"
 ? tables.map((x) => (x.id === draft.id ? draft : x))
 : [...tables, draft]}
 selectedId={draft.id}
 onSelectTable={() => {}}
 onPickPosition={(x, y) => { track("dash_settings_table_click_map"); setDraft((d) => ({ ...d, x, y })); }}
 />
 </div>
 <div className="min-w-0">
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
 onFocus={() => track("dash_settings_table_focus_name")}
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
 onPlus={() => track("dash_settings_table_number_plus")}
 onMinus={() => track("dash_settings_table_number_minus")}
 />
 </div>
 <div className="flex-1 min-w-0">
 <label className="block text-sm font-medium text-foreground mb-2.5">{t("seats")}</label>
 <Stepper
 value={table.capacity}
 min={1}
 max={20}
 onChange={(n) => onChange({ capacity: n })}
 onPlus={() => track("dash_settings_table_seats_plus")}
 onMinus={() => track("dash_settings_table_seats_minus")}
 />
 </div>
 </div>

 <TableColorPicker
 value={table.color}
 onChange={(color) => onChange({ color })}
 />

 <div>
 <label className="block text-sm font-medium text-foreground mb-2.5">{t("photo")}</label>
 <PhotoPicker
 url={table.photoUrl}
 onChange={(url) => onChange({ photoUrl: url })}
 onAddClick={() => track("dash_settings_table_add_photo")}
 onRemoveClick={() => track("dash_settings_table_delete_photo")}
 inputId={"table-photo-" + table.id}
 width="w-full"
 />
 </div>
 </div>
 );
}

const TABLE_COLORS = [
 "#A8174E", "#C8102E", "#D55427", "#92684C", "#A8531A", "#D4A017", "#D9C29A", "#6F8246", "#3D7259", "#1F5959",
 "#1F3B57", "#314D8C", "#5B6E80", "#7E5F87", "#5E4734", "#9E866B", "#E8541C", "#3B3B3B", "#000000",
];

function TableColorPicker({
 value,
 onChange,
}: {
 value: string | null;
 onChange: (color: string | null) => void;
}) {
 const t = useTranslations("dashboard.tables");
 const colorPickerRef = useRef<HTMLInputElement>(null);
 const normalized = (value || "").toLowerCase();
 const hasPreset = TABLE_COLORS.some((c) => c.toLowerCase() === normalized);
 return (
 <div>
 <div className="flex items-center justify-between mb-2.5">
 <label className="block text-sm font-medium text-foreground">{t("colorLabel")}</label>
 {value ? (
 <button
 type="button"
 onClick={() => { track("dash_settings_table_color_clear"); onChange(null); }}
 className="text-xs text-muted-foreground hover:text-foreground transition-colors"
 >
 {t("colorClear")}
 </button>
 ) : null}
 </div>
 <p className="text-xs text-muted-foreground mb-3 leading-snug">{t("colorTip")}</p>
 <div className="grid grid-cols-8 gap-2 relative">
 {TABLE_COLORS.map((c) => {
 const selected = c.toLowerCase() === normalized;
 return (
 <button
 key={c}
 type="button"
 onClick={() => { track("dash_settings_table_color_pick"); onChange(c); }}
 className={
 "w-full aspect-square rounded-full transition-all " +
 (selected ? "ring-2 ring-offset-2 ring-foreground" : "")
 }
 style={{ backgroundColor: c }}
 aria-label={c}
 />
 );
 })}
 <button
 type="button"
 onClick={() => colorPickerRef.current?.click()}
 className={
 "w-full aspect-square rounded-full transition-all " +
 (value && !hasPreset ? "ring-2 ring-offset-2 ring-foreground" : "")
 }
 style={{
 background:
 "conic-gradient(from 0deg, #ff0000, #ffff00, #00ff00, #00ffff, #0000ff, #ff00ff, #ff0000)",
 }}
 aria-label={t("colorCustom")}
 />
 <input
 ref={colorPickerRef}
 type="color"
 value={value || "#000000"}
 onChange={(e) => { track("dash_settings_table_color_pick"); onChange(e.target.value); }}
 className="absolute opacity-0 pointer-events-none w-0 h-0"
 aria-hidden="true"
 />
 </div>
 </div>
 );
}
