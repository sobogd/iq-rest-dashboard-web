"use client";

import { Fragment, useEffect, useRef, useState } from "react";
import { RotateCw, MoveDiagonal2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useQueryClient } from "@tanstack/react-query";
import { MinusIcon, PlusIcon, QrIcon, TrashIcon, UsersIcon } from "./icons";
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
import { apiTableToTable } from "./mappers";
import type { Booking, Order, TableEntity } from "./types";
import { track } from "@/lib/dashboard-events";

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

// Little round dining-table glyph shown before the table number on the map.
function TableGlyph({ size }: { size: number }) {
 return (
 <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
 <ellipse cx="12" cy="7" rx="9" ry="2.6" />
 <path d="M12 9.6V19" />
 <path d="M8 19h8" />
 </svg>
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
 onMove,
 onRotate,
 onResize,
 occupiedIds,
 readyIds,
 badgeFor,
 wide,
 dimUnselected,
 ringAll,
}: {
 tables: TableEntity[];
 selectedId: string | null;
 onSelectTable: (id: string | null) => void;
 onPickPosition?: (x: number, y: number) => void;
 // When set, the selected table can be dragged with mouse/finger across the
 // floor map; fires live with the new percent coords. Used on the edit form.
 onMove?: (x: number, y: number) => void;
 // When set, a rotate handle appears above the selected table; fires live with
 // the new angle in degrees (0 = upright). Used on the edit form.
 onRotate?: (deg: number) => void;
 // When set, resize handles appear around the selected table; fires live with
 // the new width/height as a percent of the map. Used on the edit form.
 onResize?: (width: number, height: number) => void;
 occupiedIds?: Set<string>;
 readyIds?: Set<string>;
 badgeFor?: (tableId: string) => number | null | undefined;
 wide?: boolean;
 // When true, every table that isn't `selectedId` is rendered muted so
 // the form's chosen table stands out. Used on the table edit page —
 // the staff is editing one table, the rest are context.
 dimUnselected?: boolean;
 // When true, EVERY table gets the selection ring (used on the orders page so
 // all tables read as interactive); otherwise only the selected one does.
 ringAll?: boolean;
}) {
 const tt = useTranslations("dashboard.tables");
 const occupied = occupiedIds || new Set<string>();
 const ready = readyIds || new Set<string>();
 const mapRef = useRef<HTMLDivElement | null>(null);
 const draggingRef = useRef(false);
 const movedRef = useRef(false);
 const rotatingRef = useRef(false);
 const resizingRef = useRef(false);
 // Offset (percent) between the grab point and the table center, so dragging
 // from anywhere on the table doesn't snap its center to the cursor.
 const grabOffsetRef = useRef({ dx: 0, dy: 0 });
 const [mapSize, setMapSize] = useState({ w: 0, h: 0 });

 useEffect(() => {
   const el = mapRef.current;
   if (!el) return;
   const update = () => {
     const r = el.getBoundingClientRect();
     setMapSize({ w: r.width, h: r.height });
   };
   update();
   const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(update) : null;
   ro?.observe(el);
   return () => ro?.disconnect();
 }, []);

 // Invisible alignment grid: positions + sizes snap to GRID_STEP% cells and
 // rotation snaps to ROT_STEP° so tables line up evenly with little effort.
 const GRID_STEP = 4;
 const SIZE_STEP = 2; // finer step for resize so smaller tables are possible
 const ROT_STEP = 15;
 const clampPct = (v: number) => Math.max(0, Math.min(100, v));
 const snapPct = (v: number) => Math.round(v / GRID_STEP) * GRID_STEP;
 const posFromEvent = (e: { clientX: number; clientY: number }) => {
   const rect = mapRef.current?.getBoundingClientRect();
   if (!rect) return null;
   return {
     x: clampPct(((e.clientX - rect.left) / rect.width) * 100),
     y: clampPct(((e.clientY - rect.top) / rect.height) * 100),
   };
 };
 return (
 <>
 <style>{`
 .floor-map {
 position: relative;
 /* Own stacking context so the table markers + handles (high z-index) can't
    paint over the sticky page header when scrolled. */
 isolation: isolate;
 width: 100%;
 aspect-ratio: 1 / 1;
 background-color: hsl(var(--card));
 background-image: url(/floor.webp);
 background-size: cover;
 background-position: center;
 border: 1px solid hsl(var(--border));
 border-radius: 0.75rem;
 overflow: hidden;
 box-sizing: border-box;
 }
 ${wide ? "" : "@media (min-width: 768px) { .floor-map { width: 280px; height: 280px; aspect-ratio: auto; } }"}
 `}</style>
 <div
 ref={mapRef}
 className={"floor-map" + (onPickPosition ? " cursor-crosshair" : "")}
 onClick={(e) => {
 // A drag that moved the selected table must not also re-place it via the
 // map tap handler — swallow the click that follows a real drag.
 if (movedRef.current) { movedRef.current = false; return; }
 if (onPickPosition) {
 const p = posFromEvent(e);
 if (p) onPickPosition(p.x, p.y);
 } else {
 onSelectTable(null);
 }
 }}
 >
 {tables.map((t) => {
 const isSelected = selectedId === t.id;
 const isOccupied = occupied.has(t.id);
 const isReady = ready.has(t.id);
 const size = tableSize(t.capacity);
 const x = t.x ?? 50;
 const y = t.y ?? 50;
 // Rectangle markers are a touch wider than tall so they read as tables;
 // circles stay square. Sizing by capacity for now (resize comes later).
 const isRect = t.shape === "rect";
 // Capacity-derived fallback size in px; once the owner resizes, width/height
 // (percent of map) take over — converted to px via the measured map size.
 const baseWpx = isRect ? Math.round(size * 1.4) : size;
 const baseHpx = size;
 const w = typeof t.width === "number" && mapSize.w > 0 ? (t.width / 100) * mapSize.w : baseWpx;
 const h = typeof t.height === "number" && mapSize.h > 0 ? (t.height / 100) * mapSize.h : baseHpx;
 const radiusCls = isRect ? "rounded-md" : "rounded-full";
 // No border on any state — flat fill only. In-progress (occupied but
 // not all ready) takes the app's primary brand colour (same hue the
 // Save button uses); all-ready stays emerald; idle uses the regular
 // card background.
 const stateCls = isSelected
 ? "bg-foreground text-background z-10"
 : isReady
 ? "bg-emerald-500 text-white"
 : isOccupied
 ? "bg-primary-gradient text-primary-foreground"
 : "bg-card text-foreground";
 const ringCls = isSelected || ringAll ? " ring-4 ring-foreground/20" : "";
 const badge = badgeFor ? badgeFor(t.id) : null;
 const dimCls = dimUnselected && !isSelected ? " opacity-45" : "";
 const draggable = !!onMove && isSelected;
 // Font scales with the marker's smaller side so small tables get small text
 // and big tables larger — capacity line is a touch smaller than the number.
 const numFont = Math.max(9, Math.min(22, Math.round(Math.min(w, h) * 0.3)));
 const capFont = Math.max(8, Math.round(numFont * 0.62));
 return (
 <Fragment key={t.id}>
 {/* rotate connector — rendered BEFORE the table so it sits UNDER it. */}
 {draggable && onRotate ? (
 <div
 className="absolute pointer-events-none"
 style={{ left: x + "%", top: y + "%", width: 0, height: 0, transform: "rotate(" + t.rotation + "deg)" }}
 >
 <div
 className="absolute bg-foreground/50"
 style={{ left: 0, top: -(h / 2 + 26), width: 2, height: 26 + 8, transform: "translateX(-50%)" }}
 />
 </div>
 ) : null}
 <button
 type="button"
 onClick={(e) => { e.stopPropagation(); onSelectTable(t.id); }}
 onPointerDown={draggable ? (e) => {
 e.stopPropagation();
 draggingRef.current = true;
 movedRef.current = false;
 const p = posFromEvent(e);
 grabOffsetRef.current = p ? { dx: p.x - x, dy: p.y - y } : { dx: 0, dy: 0 };
 (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
 } : undefined}
 onPointerMove={draggable ? (e) => {
 if (!draggingRef.current) return;
 const p = posFromEvent(e);
 if (!p) return;
 movedRef.current = true;
 onMove!(clampPct(snapPct(p.x - grabOffsetRef.current.dx)), clampPct(snapPct(p.y - grabOffsetRef.current.dy)));
 } : undefined}
 onPointerUp={draggable ? (e) => {
 draggingRef.current = false;
 (e.currentTarget as HTMLElement).releasePointerCapture?.(e.pointerId);
 } : undefined}
 onPointerCancel={draggable ? () => { draggingRef.current = false; } : undefined}
 className={
 "absolute flex items-center justify-center font-medium tabular-nums transition-all " +
 radiusCls + " " +
 (draggable ? "cursor-grab active:cursor-grabbing " : "") +
 stateCls + ringCls + dimCls
 }
 style={{
 width: w + "px",
 height: h + "px",
 left: "calc(" + x + "% - " + w / 2 + "px)",
 top: "calc(" + y + "% - " + h / 2 + "px)",
 touchAction: draggable ? "none" : undefined,
 transform: t.rotation ? "rotate(" + t.rotation + "deg)" : undefined,
 // Draggable chip must track the pointer instantly — the transition-all
 // class otherwise animates left/top and the table lags behind the cursor.
 transition: draggable ? "none" : undefined,
 }}
 aria-label={tt("tableLabelAria", { number: t.number })}
 title={tt("tableLabelAria", { number: t.number }) + (t.name ? " · " + t.name : "")}
 >
 {t.color ? (
 <span className={"absolute inset-0 " + radiusCls} style={{ backgroundColor: t.color }} />
 ) : t.photoUrl ? (
 <span className={"absolute inset-0 overflow-hidden " + radiusCls}>
 <img src={t.photoUrl} alt="" className="absolute inset-0 w-full h-full object-cover" />
 </span>
 ) : (
 // No colour/photo → fill with the theme's opposite so the table still
 // reads as a solid marker (dark in light theme, light in dark theme).
 <span className={"absolute inset-0 bg-foreground " + radiusCls} />
 )}
 <span className={"relative z-10 flex flex-col items-center justify-center leading-none " + (t.color || t.photoUrl ? "text-white" : "text-background")}>
 <span className="font-semibold inline-flex items-center gap-0.5" style={{ fontSize: numFont }}>
 <TableGlyph size={Math.round(numFont * 0.9)} />
 {t.number}
 </span>
 <span className="inline-flex items-center gap-0.5 font-medium opacity-90" style={{ fontSize: capFont, marginTop: 1 }}>
 <UsersIcon size={capFont} />
 {t.capacity}
 </span>
 </span>
 {badge && badge > 0 ? (
 <span
 className={
 "absolute -top-2.5 -right-2.5 z-20 min-w-[18px] h-[18px] px-1 inline-flex items-center justify-center text-[10px] font-semibold rounded-full ring-4 ring-foreground/20 " +
 (isReady ? "bg-emerald-500 text-white" : "bg-primary-gradient text-primary-foreground")
 }
 >
 {badge}
 </span>
 ) : null}
 </button>
 {draggable && (onRotate || onResize) ? (
 <div
 className="absolute z-20 pointer-events-none"
 style={{ left: x + "%", top: y + "%", width: 0, height: 0, transform: "rotate(" + t.rotation + "deg)" }}
 >
 {/* outline of the selected table's box */}
 <div
 className="absolute border border-foreground/40 pointer-events-none"
 style={{ left: -w / 2, top: -h / 2, width: w, height: h, borderRadius: isRect ? 6 : "9999px" }}
 />

 {/* Single bottom-right corner handle — diagonal resize. */}
 {onResize ? [[1, 1]].map(([dx, dy]) => {
 const axisX = dx !== 0;
 const axisY = dy !== 0;
 const OFF = 16;
 const cornerX = (dx * w) / 2;
 const cornerY = (dy * h) / 2;
 const handleX = cornerX + dx * OFF;
 const handleY = cornerY + dy * OFF;
 // Connector starts at the box corner with a small inward continuation
 // (INSET) and runs out to the handle — reads cleaner than a center line.
 const INSET = 8;
 const ux = dx / Math.SQRT2;
 const uy = dy / Math.SQRT2;
 const lineStartX = cornerX - ux * INSET;
 const lineStartY = cornerY - uy * INSET;
 const lineLen = OFF + INSET;
 const lineAngle = (Math.atan2(dy, dx) * 180) / Math.PI;
 return (
 <Fragment key={dx + "," + dy}>
 {/* connector from the box corner (with a slight inward overlap) to the handle */}
 <div
 className="absolute bg-foreground/50 pointer-events-none"
 style={{ left: lineStartX, top: lineStartY, width: lineLen, height: 2, transformOrigin: "0 50%", transform: "rotate(" + lineAngle + "deg)" }}
 />
 <div
 className="absolute w-5 h-5 rounded-full bg-white border border-foreground/40 ring-4 ring-foreground/20 flex items-center justify-center text-neutral-700 pointer-events-auto"
 style={{ left: handleX, top: handleY, transform: "translate(-50%,-50%)", touchAction: "none", cursor: "nwse-resize" }}
 onClick={(e) => e.stopPropagation()}
 onPointerDown={(e) => {
 e.stopPropagation();
 resizingRef.current = true;
 (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
 }}
 onPointerMove={(e) => {
 if (!resizingRef.current) return;
 const rect = mapRef.current?.getBoundingClientRect();
 if (!rect) return;
 const MIN = 18;
 const r = (t.rotation * Math.PI) / 180;
 // Local axis unit vectors in world (screen) space.
 const ux = { x: Math.cos(r), y: Math.sin(r) };
 const uy = { x: -Math.sin(r), y: Math.cos(r) };
 const cx = rect.left + (x / 100) * rect.width;
 const cy = rect.top + (y / 100) * rect.height;
 const halfW = w / 2;
 const halfH = h / 2;
 // Anchor = the box corner/edge OPPOSITE the dragged handle. It stays put
 // while the dragged side follows the pointer (no re-centering jump).
 const ax = cx - dx * halfW * ux.x - dy * halfH * uy.x;
 const ay = cy - dx * halfW * ux.y - dy * halfH * uy.y;
 const vx = e.clientX - ax;
 const vy = e.clientY - ay;
 let newWpx = w;
 let newHpx = h;
 // Subtract the handle's diagonal offset from the corner so the box edge
 // tracks the corner (not the offset handle) — no jump on grab.
 if (axisX) newWpx = Math.max(MIN, dx * (vx * ux.x + vy * ux.y) - OFF);
 if (axisY) newHpx = Math.max(MIN, dy * (vx * uy.x + vy * uy.y) - OFF);
 newWpx = Math.min(newWpx, rect.width);
 newHpx = Math.min(newHpx, rect.height);
 // Snap size to the grid (one cell minimum) so tables match each other.
 const stepW = (SIZE_STEP / 100) * rect.width;
 const stepH = (SIZE_STEP / 100) * rect.height;
 if (axisX) newWpx = Math.min(rect.width, Math.max(stepW, Math.round(newWpx / stepW) * stepW));
 if (axisY) newHpx = Math.min(rect.height, Math.max(stepH, Math.round(newHpx / stepH) * stepH));
 // New center sits half a (new) extent away from the fixed anchor.
 const ncx = ax + dx * (newWpx / 2) * ux.x + dy * (newHpx / 2) * uy.x;
 const ncy = ay + dx * (newWpx / 2) * ux.y + dy * (newHpx / 2) * uy.y;
 onResize((newWpx / rect.width) * 100, (newHpx / rect.height) * 100);
 onMove?.(clampPct(((ncx - rect.left) / rect.width) * 100), clampPct(((ncy - rect.top) / rect.height) * 100));
 }}
 onPointerUp={(e) => {
 resizingRef.current = false;
 (e.currentTarget as HTMLElement).releasePointerCapture?.(e.pointerId);
 }}
 onPointerCancel={() => { resizingRef.current = false; }}
 >
 <MoveDiagonal2 size={12} />
 </div>
 </Fragment>
 );
 }) : null}

 {/* rotate handle above the box (connector line is rendered under the table) */}
 {onRotate ? (
 <>
 <div
 className="absolute w-5 h-5 rounded-full bg-white border border-foreground/40 ring-4 ring-foreground/20 flex items-center justify-center text-neutral-700 cursor-grab active:cursor-grabbing pointer-events-auto"
 style={{ left: 0, top: -(h / 2 + 26), transform: "translate(-50%,-50%)", touchAction: "none" }}
 onClick={(e) => e.stopPropagation()}
 onPointerDown={(e) => {
 e.stopPropagation();
 rotatingRef.current = true;
 (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
 }}
 onPointerMove={(e) => {
 if (!rotatingRef.current) return;
 const rect = mapRef.current?.getBoundingClientRect();
 if (!rect) return;
 const cx = rect.left + (x / 100) * rect.width;
 const cy = rect.top + (y / 100) * rect.height;
 let deg = (Math.atan2(e.clientY - cy, e.clientX - cx) * 180) / Math.PI + 90;
 deg = Math.round(deg / ROT_STEP) * ROT_STEP;
 deg = ((deg % 360) + 360) % 360;
 onRotate(deg);
 }}
 onPointerUp={(e) => {
 rotatingRef.current = false;
 (e.currentTarget as HTMLElement).releasePointerCapture?.(e.pointerId);
 }}
 onPointerCancel={() => { rotatingRef.current = false; }}
 >
 <RotateCw size={12} />
 </div>
 </>
 ) : null}
 </div>
 ) : null}
 </Fragment>
 );
 })}
 </div>
 </>
 );
}

// ── List page (map + grid of chips) ──

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
 const qc = useQueryClient();

 const [selectedId, setSelectedId] = useState<string | null>(null);
 const [qrOpen, setQrOpen] = useState(false);
 const [confirmState, setConfirmState] = useState<{
 open: boolean; title?: string; message?: string; singleButton?: boolean; onConfirm?: (() => void) | null;
 }>({ open: false });

 useEffect(() => { window.scrollTo({ top: 0, behavior: "auto" }); }, []);

 // Keep a valid selection — default to the lowest-numbered table.
 useEffect(() => {
 if (selectedId && tables.some((x) => x.id === selectedId)) return;
 const first = [...tables].sort((a, b) => a.number - b.number)[0];
 setSelectedId(first ? first.id : null);
 }, [tables, selectedId]);

 const selected = tables.find((x) => x.id === selectedId) || null;

 // Debounced per-table save: continuous edits (drag / steppers) coalesce into
 // one PATCH ~600ms after the last change. Flushed on back.
 const pendingRef = useRef<Map<string, TableEntity>>(new Map());
 const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
 const payloadOf = (tbl: TableEntity) => ({
 number: tbl.number, capacity: tbl.capacity, zone: tbl.name || null,
 imageUrl: tbl.photoUrl, color: tbl.color, x: tbl.x, y: tbl.y,
 shape: tbl.shape, rotation: tbl.rotation, width: tbl.width, height: tbl.height,
 });
 const flush = () => {
 if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
 const items = Array.from(pendingRef.current.values());
 pendingRef.current.clear();
 if (items.length === 0) return;
 Promise.all(items.map((tbl) => updateTable(tbl.id, payloadOf(tbl)).catch(() => undefined)))
 .then(() => qc.invalidateQueries({ queryKey: ["tables"] }).catch(() => undefined));
 };
 const scheduleSave = (tbl: TableEntity) => {
 pendingRef.current.set(tbl.id, tbl);
 if (timerRef.current) clearTimeout(timerRef.current);
 timerRef.current = setTimeout(flush, 600);
 };
 // Flush any pending save on unmount.
 useEffect(() => () => { flush(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

 function patchSelected(patch: Partial<TableEntity>) {
 // Functional update so back-to-back calls in one event (resize fires both
 // onResize + onMove) merge onto the latest state instead of clobbering it.
 setTables((prev) => prev.map((x) => {
 if (x.id !== selectedId) return x;
 const next = { ...x, ...patch };
 scheduleSave(next);
 return next;
 }));
 }

 async function addTable() {
 track("dash_settings_tables_click_add");
 const number = tables.reduce((m, tbl) => Math.max(m, tbl.number || 0), 0) + 1;
 // New table = a copy of the currently selected one (shape/size/color/seats),
 // nudged ~12% so it doesn't sit exactly on top of the original.
 const src = selected;
 const OFF = 5;
 const nudge = (v: number | null) => {
 const base = v ?? 50;
 const n = base + OFF;
 return Math.max(0, Math.min(100, n > 100 ? base - OFF : n));
 };
 try {
 const created = await createTable({
 number,
 capacity: src ? src.capacity : 2,
 zone: null,
 imageUrl: null,
 color: src ? src.color : null,
 x: src ? nudge(src.x) : 50,
 y: src ? nudge(src.y) : 50,
 shape: src ? src.shape : "circle",
 rotation: src ? src.rotation : 0,
 width: src ? src.width : null,
 height: src ? src.height : null,
 });
 const entity = apiTableToTable(created);
 setTables((prev) => [...prev, entity]);
 setSelectedId(entity.id);
 qc.invalidateQueries({ queryKey: ["tables"] }).catch(() => undefined);
 } catch { /* ignore */ }
 }

 const usedIds = new Set<string>([
 ...orders.filter((o) => o.status === "active").map((o) => o.tableId).filter((v): v is string => !!v),
 ...bookings.filter((b) => b.status === "pending" || b.status === "confirmed").map((b) => b.tableId).filter((v): v is string => !!v),
 ]);

 function handleDelete() {
 if (!selected) return;
 if (usedIds.has(selected.id)) {
 setConfirmState({ open: true, title: t("cantDeleteTitle"), message: t("cantDeleteMessage", { number: selected.number }), singleButton: true, onConfirm: null });
 return;
 }
 setConfirmState({
 open: true,
 title: t("deleteTitle"),
 message: t("deleteMessage", { number: selected.number, label: selected.name ? " · " + selected.name : "" }),
 onConfirm: async () => {
 setConfirmState({ open: false });
 const id = selected.id;
 try {
 await deleteTable(id);
 setTables((prev) => prev.filter((x) => x.id !== id));
 setSelectedId(null);
 await qc.invalidateQueries({ queryKey: ["tables"] });
 } catch { /* ignore */ }
 },
 });
 }

 const goBack = () => { flush(); track("dash_settings_tables_click_back"); onBack(); };

 return (
 <div>
 <SubpageStickyBar onBack={goBack} hideSave>
 {selected ? (
 <>
 <button
 type="button"
 onClick={handleDelete}
 aria-label={t("deleteTable")}
 className="h-8 w-8 inline-flex items-center justify-center text-red-600 bg-secondary rounded-md"
 >
 <TrashIcon size={15} />
 </button>
 <button
 type="button"
 onClick={() => setQrOpen(true)}
 aria-label={t("showQr")}
 className="h-8 w-8 inline-flex items-center justify-center text-muted-foreground bg-secondary rounded-md"
 >
 <QrIcon size={15} />
 </button>
 </>
 ) : null}
 <button
 type="button"
 onClick={addTable}
 className="inline-flex items-center gap-1 h-8 px-2.5 text-xs font-medium text-primary-foreground bg-primary-gradient rounded-md transition-colors"
 >
 <PlusIcon size={14} />
 {t("table")}
 </button>
 </SubpageStickyBar>

 <div className="max-w-5xl mx-auto md:px-6 pt-5 md:pt-4 min-w-0">
 {tables.length === 0 ? (
 <>
 <EmptyState title={t("emptyTitle")} subtitle={t("emptySubtitle")} />
 <button
 type="button"
 onClick={addTable}
 className="w-full mt-2.5 h-12 text-sm font-medium text-muted-foreground/60 border border-dashed border-input rounded-xl flex items-center justify-center gap-2 transition-colors"
 >
 <PlusIcon size={14} />
 {t("addFirstTable")}
 </button>
 </>
 ) : (
 <div className="grid grid-cols-1 md:grid-cols-[1.5fr_1fr] gap-5 md:gap-4">
 <div className="min-w-0">
 <FloorMap
 tables={tables}
 selectedId={selectedId}
 onSelectTable={(id) => { if (id) { track("dash_settings_tables_click_table"); setSelectedId(id); } }}
 onMove={(x, y) => patchSelected({ x, y })}
 onRotate={(deg) => patchSelected({ rotation: deg })}
 onResize={(width, height) => patchSelected({ width, height })}
 wide
 dimUnselected
 />
 </div>

 <div className="min-w-0">
 {selected ? <TableSettings table={selected} onChange={patchSelected} /> : null}
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

 {selected ? (
 <TableQrModal
 open={qrOpen}
 onClose={() => setQrOpen(false)}
 tableNumber={selected.number}
 tableLabel={selected.name}
 menuUrl={menuUrl}
 />
 ) : null}
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
 const qc = useQueryClient();

 const initial: TableEntity =
 mode === "edit" && tableId
 ? tables.find((x) => x.id === tableId) || null!
 : (() => {
 const [x, y] = pickInitialTablePosition(tables);
 return {
 id: newId(),
 number: tables.reduce((max, tbl) => Math.max(max, tbl.number || 0), 0) + 1,
 name: "",
 description: "",
 capacity: 2,
 x,
 y,
 shape: "circle",
 rotation: 0,
 width: null,
 height: null,
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

 // A table can't be deleted while it has a live order or a still-active booking
 // (pending or confirmed). Completed and cancelled/rejected bookings don't block.
 const usedIds = new Set<string>([
 ...orders.filter((o) => o.status === "active").map((o) => o.tableId).filter((x): x is string => !!x),
 ...bookings
  .filter((b) => b.status === "pending" || b.status === "confirmed")
  .map((b) => b.tableId)
  .filter((x): x is string => !!x),
 ]);

 if (mode === "edit" && !tables.find((x) => x.id === tableId)) {
 return (
 <div className="max-w-5xl mx-auto md:px-6 py-10 text-center text-sm text-muted-foreground">
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
 description: draft.description || null,
 imageUrl: draft.photoUrl,
 color: draft.color,
 x: draft.x,
 y: draft.y,
 shape: draft.shape,
 rotation: draft.rotation,
 width: draft.width,
 height: draft.height,
 });
 const entity: TableEntity = {
 id: (created as { id: string }).id,
 number: draft.number,
 name: draft.name,
 description: draft.description,
 capacity: draft.capacity,
 x: draft.x,
 y: draft.y,
 shape: draft.shape,
 rotation: draft.rotation,
 width: draft.width,
 height: draft.height,
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
 description: draft.description || null,
 imageUrl: draft.photoUrl,
 color: draft.color,
 x: draft.x,
 y: draft.y,
 shape: draft.shape,
 rotation: draft.rotation,
 width: draft.width,
 height: draft.height,
 });
 setTables((prev) => prev.map((x) => (x.id === draft.id ? { ...x, ...draft } : x)));
 }
 // Refresh the shared TanStack cache so the host's tablesQ.data + every
 // other consumer reflects the new/updated row. Without this the
 // shell's props-sync useEffect would wipe local-only inserts on the
 // next host re-render.
 await qc.invalidateQueries({ queryKey: ["tables"] });
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
 await qc.invalidateQueries({ queryKey: ["tables"] });
 onBack();
 } catch {
 }
 },
 });
 }

 return (
 <div>
 <SubpageStickyBar onBack={() => { track("dash_settings_table_click_back"); onBack(); }} onSave={save} canSave={!saving} />

 <div className="max-w-2xl md:max-w-5xl mx-auto md:px-6 pt-5 md:pt-4 min-w-0">
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


 <div className="grid grid-cols-1 md:grid-cols-[1.5fr_1fr] gap-6 md:gap-8">
 <div className="min-w-0">
 <FloorMap
 tables={mode === "edit"
 ? tables.map((x) => (x.id === draft.id ? draft : x))
 : [...tables, draft]}
 selectedId={draft.id}
 onSelectTable={() => {}}
 onPickPosition={(x, y) => { track("dash_settings_table_click_map"); setDraft((d) => ({ ...d, x, y })); }}
 onMove={(x, y) => setDraft((d) => ({ ...d, x, y }))}
 onRotate={(deg) => setDraft((d) => ({ ...d, rotation: deg }))}
 onResize={(width, height) => setDraft((d) => ({ ...d, width, height }))}
 wide
 dimUnselected
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
 <label className="block text-sm font-medium text-foreground mb-2.5">{t("shapeLabel")}</label>
 <div className="inline-flex w-full items-center rounded-lg border border-border bg-card overflow-hidden">
 <ShapeBtn active={table.shape === "circle"} onClick={() => onChange({ shape: "circle" })}>
 {t("shapeCircle")}
 </ShapeBtn>
 <ShapeBtn active={table.shape === "rect"} onClick={() => onChange({ shape: "rect" })}>
 {t("shapeRect")}
 </ShapeBtn>
 </div>
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

 <div>
 <label className="block text-sm font-medium text-foreground mb-2.5">{t("photo")}</label>
 <PhotoPicker
 url={table.photoUrl}
 onChange={(url) => onChange({ photoUrl: url })}
 onAddClick={() => track("dash_settings_table_add_photo")}
 onRemoveClick={() => track("dash_settings_table_delete_photo")}
 inputId={"table-photo-" + table.id}
 width="w-full"
 height="h-32"
 />
 </div>
 </div>
 );
}

function ShapeBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
 return (
 <button
 type="button"
 onClick={onClick}
 className={
 "flex-1 h-9 px-3 text-xs font-medium transition-colors " +
 (active ? "bg-primary-gradient text-primary-foreground" : "text-muted-foreground hover:text-foreground")
 }
 >
 {children}
 </button>
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
 <div className="grid grid-cols-7 gap-2 relative">
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
