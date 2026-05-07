"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import {
 ChevronLeftIcon,
 ChevronRightIcon,
 MapPinIcon,
 UsersIcon,
} from "./icons";
import { Modal, PageHeader } from "./ui";
import { formatTime, isSameDay } from "./helpers";
import { patchReservation } from "./api";
import { useDashboardRouter } from "../_spa/router";
import type { Booking, Restaurant, TableEntity } from "./types";
import { track } from "@/lib/dashboard-events";

type ViewMode = "month" | "day";

const STATUS_KEY: Record<Booking["status"], "statusPending" | "statusConfirmed" | "statusCancelled" | "statusCompleted"> = {
 pending: "statusPending",
 confirmed: "statusConfirmed",
 cancelled: "statusCancelled",
 completed: "statusCompleted",
};

const STATUS_BAR: Record<Booking["status"], string> = {
 pending: "bg-amber-500/85 text-white border border-amber-600 hover:bg-amber-500",
 confirmed: "bg-emerald-500/85 text-white border border-emerald-600 hover:bg-emerald-500",
 completed: "bg-secondary text-foreground/70 border border-border hover:bg-muted",
 cancelled: "bg-secondary text-muted-foreground border border-border",
};

const STATUS_PILL: Record<Booking["status"], string> = {
 pending: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-900/50",
 confirmed: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-900/50",
 completed: "bg-secondary text-muted-foreground border-border",
 cancelled: "bg-secondary text-muted-foreground border-border",
};

export function ReservationsPage({
 restaurant,
 bookings,
 setBookings,
 tables,
}: {
 restaurant: Restaurant;
 bookings: Booking[];
 setBookings: React.Dispatch<React.SetStateAction<Booking[]>>;
 tables: TableEntity[];
}) {
 const t = useTranslations("dashboard.reservations");
 const router = useDashboardRouter();

 const [view, setView] = useState<ViewMode>("month");
 const [focusDate, setFocusDate] = useState<Date>(() => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
 });
 const [selected, setSelected] = useState<Booking | null>(null);

 const monthBookings = useMemo(
  () =>
   bookings.filter((b) => {
    if (b.status === "cancelled") return false;
    const d = new Date(b.datetime);
    return d.getFullYear() === focusDate.getFullYear() && d.getMonth() === focusDate.getMonth();
   }),
  [bookings, focusDate],
 );

 const dayBookings = useMemo(
  () => bookings.filter((b) => b.status !== "cancelled" && isSameDay(new Date(b.datetime), focusDate)),
  [bookings, focusDate],
 );

 // Empty / disabled states — render late so all hooks above run unconditionally.
 if (!restaurant.bookingSettings.enabled) {
  return (
   <CtaWrapper title={t("title")}>
    <CtaState
     title={t("disabledTitle")}
     body={t("disabledBody")}
     cta={t("disabledCta")}
     onClick={() => router.push({ name: "settings.bookings" })}
    />
   </CtaWrapper>
  );
 }
 if (tables.length === 0) {
  return (
   <CtaWrapper title={t("title")}>
    <CtaState
     title={t("noTablesTitle")}
     body={t("noTablesBody")}
     cta={t("noTablesCta")}
     onClick={() => router.push({ name: "settings.tables" })}
    />
   </CtaWrapper>
  );
 }

 const title = view === "month"
  ? capitalize(focusDate.toLocaleDateString([], { month: "long", year: "numeric" }))
  : capitalize(focusDate.toLocaleDateString([], { weekday: "long", day: "numeric", month: "long", year: "numeric" }));

 const count = view === "month" ? monthBookings.length : dayBookings.length;
 const subtitle = count === 0
  ? t("noBookingsHere")
  : count === 1 ? t("subtitleOne", { count }) : t("subtitleOther", { count });

 function shift(delta: number) {
  setFocusDate((d) => {
   const next = new Date(d);
   if (view === "month") {
    next.setDate(1);
    next.setMonth(d.getMonth() + delta);
   } else {
    next.setDate(d.getDate() + delta);
   }
   return next;
  });
 }

 async function setBookingStatus(id: string, status: Booking["status"]) {
  if (status === "confirmed") track("dash_booking_accept");
  else if (status === "cancelled") track("dash_booking_reject");
  const before = bookings;
  setBookings((bks) => bks.map((b) => (b.id === id ? { ...b, status } : b)));
  try {
   await patchReservation(id, { status });
  } catch {
   setBookings(before);
   toast.error(t("error"));
  }
 }

 return (
  <>
   {/* Sticky sub-header — view toggle on the left, prev/next on the right. */}
   <div
    className="sticky z-10 -mx-4 md:-mx-6 -mt-5 md:-mt-4 px-4 md:px-6 h-14 flex items-center bg-[hsl(0_0%_6.5%/0.9)] backdrop-blur-md border-b border-border/60"
    style={{ top: "var(--topbar-h, 0px)" }}
   >
    <div className="max-w-5xl mx-auto px-4 md:px-6 w-full flex items-center justify-between gap-3">
     <div className="flex items-center rounded-lg border border-border bg-card overflow-hidden">
      <ViewBtn active={view === "month"} onClick={() => { track("dash_booking_view_month"); setView("month"); }}>
       {t("viewMonth")}
      </ViewBtn>
      <ViewBtn active={view === "day"} onClick={() => { track("dash_booking_view_day"); setView("day"); }}>
       {t("viewDay")}
      </ViewBtn>
     </div>
     <div className="flex items-center gap-1">
      <NavBtn onClick={() => shift(-1)} aria-label={t("prev")}>
       <ChevronLeftIcon size={16} />
      </NavBtn>
      <NavBtn onClick={() => shift(1)} aria-label={t("next")}>
       <ChevronRightIcon size={16} />
      </NavBtn>
     </div>
    </div>
   </div>

   <div className="max-w-5xl mx-auto px-4 md:px-6 pt-5 md:pt-4">
    {view === "month" ? (
     <div className="lg:flex lg:gap-8 lg:items-stretch">
      <div className="lg:flex-1 lg:min-w-0 lg:flex lg:flex-col lg:h-[calc(100dvh-var(--topbar-h,0px)-160px)]">
       <PageHeader title={title} subtitle={subtitle} />
       <div className="mt-6 hidden lg:flex lg:flex-1 lg:min-h-[200px] lg:overflow-y-auto pr-1">
        <div className="w-full">
         <PendingList
          bookings={bookings}
          tables={tables}
          onClickBooking={setSelected}
         />
        </div>
       </div>
      </div>
      <div className="mt-6 lg:mt-0 lg:shrink-0 lg:h-[calc(100dvh-var(--topbar-h,0px)-160px)] lg:aspect-[1.2/1] lg:max-h-[calc((100vw-360px)/1.2)]">
       <MonthView
        focusDate={focusDate}
        bookings={monthBookings}
        onClickDay={(d) => {
         track("dash_booking_drill_to_day");
         setFocusDate(d);
         setView("day");
        }}
       />
      </div>
      <div className="mt-6 lg:hidden">
       <PendingList
        bookings={bookings}
        tables={tables}
        onClickBooking={setSelected}
       />
      </div>
     </div>
    ) : (
     <>
      <PageHeader title={title} subtitle={subtitle} />
      <div className="mt-6">
       <DayView
        focusDate={focusDate}
        bookings={dayBookings}
        tables={tables}
        schedule={restaurant.bookingSettings.schedule}
        onClickBooking={setSelected}
       />
      </div>
     </>
    )}
   </div>

   {selected ? (
    <BookingDetailModal
     booking={selected}
     tables={tables}
     onClose={() => setSelected(null)}
     onStatusChange={async (status) => {
      const id = selected.id;
      setSelected(null);
      await setBookingStatus(id, status);
     }}
    />
   ) : null}
  </>
 );
}

// ---------- Sub-header buttons ----------

function ViewBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
 return (
  <button
   type="button"
   onClick={onClick}
   className={
    "h-8 px-3 text-xs font-medium transition-colors " +
    (active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")
   }
  >
   {children}
  </button>
 );
}

function NavBtn({ children, onClick, ...rest }: { children: React.ReactNode; onClick: () => void } & React.ButtonHTMLAttributes<HTMLButtonElement>) {
 return (
  <button
   type="button"
   onClick={onClick}
   className="h-8 w-8 rounded-md hover:bg-muted/50 inline-flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
   {...rest}
  >
   {children}
  </button>
 );
}

// ---------- Empty / disabled states ----------

function CtaWrapper({ title, children }: { title: string; children: React.ReactNode }) {
 return (
  <div className="max-w-5xl mx-auto px-4 md:px-6">
   <PageHeader title={title} />
   {children}
  </div>
 );
}

function CtaState({ title, body, cta, onClick }: { title: string; body: string; cta: string; onClick: () => void }) {
 return (
  <div className="bg-card border border-border rounded-2xl px-6 py-12 flex flex-col items-center text-center">
   <div className="text-sm font-semibold text-foreground mb-2">{title}</div>
   <p className="text-sm text-muted-foreground mb-6 max-w-md leading-relaxed">{body}</p>
   <button
    type="button"
    onClick={onClick}
    className="inline-flex items-center h-10 px-5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 active:scale-[0.99] transition"
   >
    {cta}
   </button>
  </div>
 );
}

// ---------- Pending list ----------

function PendingList({
 bookings,
 tables,
 onClickBooking,
}: {
 bookings: Booking[];
 tables: TableEntity[];
 onClickBooking: (b: Booking) => void;
}) {
 const t = useTranslations("dashboard.reservations");
 const items = useMemo(() => {
  return bookings
   .filter((b) => b.status === "pending")
   .sort((a, b) => new Date(a.datetime).getTime() - new Date(b.datetime).getTime());
 }, [bookings]);

 if (items.length === 0) {
  return (
   <div className="w-full h-full min-h-[200px] flex items-center justify-center bg-card border border-border rounded-xl px-6 py-10 text-center">
    <div>
     <div className="text-sm font-medium text-foreground mb-1">{t("pendingEmptyTitle")}</div>
     <div className="text-xs text-muted-foreground">{t("pendingEmptyBody")}</div>
    </div>
   </div>
  );
 }

 return (
  <div className="w-full">
   <div className="text-xs uppercase tracking-wider text-muted-foreground mb-2">
    {t("pendingHeader", { count: items.length })}
   </div>
   <div className="space-y-2">
    {items.map((b) => {
     const dt = new Date(b.datetime);
     const tbl = tables.find((tt) => tt.id === b.tableId);
     return (
      <button
       key={b.id}
       type="button"
       onClick={() => onClickBooking(b)}
       className="w-full bg-card border border-border rounded-xl p-3 text-left hover:border-primary/40 hover:bg-muted/30 transition-colors"
      >
       <div className="flex items-center gap-2 flex-wrap">
        <div className="text-sm font-medium tabular-nums">{formatTime(dt)}</div>
        <div className="text-xs text-muted-foreground tabular-nums">
         {dt.toLocaleDateString([], { day: "numeric", month: "short" })}
        </div>
        <span className={"ml-auto inline-flex items-center h-5 px-2 text-[10px] font-medium border rounded-full " + STATUS_PILL.pending}>
         {t("statusPending")}
        </span>
       </div>
       <div className="text-sm text-foreground mt-1 truncate">{b.guestName}</div>
       <div className="text-xs text-muted-foreground truncate">
        {tbl ? t("tableLabel", { number: tbl.number }) : t("notAssigned")}
        {" · "}
        {b.guests === 1 ? t("guestOne", { count: b.guests }) : t("guestOther", { count: b.guests })}
       </div>
      </button>
     );
    })}
   </div>
  </div>
 );
}

// ---------- Month view ----------

function MonthView({
 focusDate,
 bookings,
 onClickDay,
}: {
 focusDate: Date;
 bookings: Booking[];
 onClickDay: (d: Date) => void;
}) {
 const t = useTranslations("dashboard.reservations");
 const today = todayMidnight();

 // Build day cells for the visible month only. Leading empty slots are
 // inserted so weekdays line up; trailing empty cells are not needed —
 // weekday alignment is what matters visually.
 const cells = useMemo(() => {
  const year = focusDate.getFullYear();
  const month = focusDate.getMonth();
  const firstOfMonth = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const leadingEmpty = (firstOfMonth.getDay() + 6) % 7; // ISO weekday: Mon=0
  type Cell = { kind: "empty" } | { kind: "day"; date: Date; items: Booking[] };
  const list: Cell[] = [];
  for (let i = 0; i < leadingEmpty; i++) list.push({ kind: "empty" });
  for (let d = 1; d <= daysInMonth; d++) {
   const date = new Date(year, month, d);
   const items = bookings
    .filter((b) => isSameDay(new Date(b.datetime), date))
    .sort((a, b) => new Date(a.datetime).getTime() - new Date(b.datetime).getTime());
   list.push({ kind: "day", date, items });
  }
  // Pad to whole weeks — trailing empties for clean grid.
  while (list.length % 7 !== 0) list.push({ kind: "empty" });
  return list;
 }, [focusDate, bookings]);

 const weekdayLabels = useMemo(() => {
  // ISO week starting Mon. Use a known Monday and step.
  const start = new Date(2024, 0, 1); // 2024-01-01 is Monday.
  return Array.from({ length: 7 }, (_, i) => {
   const d = new Date(start);
   d.setDate(start.getDate() + i);
   return d.toLocaleDateString([], { weekday: "short" });
  });
 }, []);

 const weeks = Math.max(1, cells.length / 7);

 return (
  <div className="flex flex-col lg:h-full lg:min-h-[420px]">
   <div className="grid grid-cols-7 gap-1 mb-2 text-center text-[11px] font-medium text-muted-foreground/50 uppercase tracking-wider">
    {weekdayLabels.map((w, i) => (
     <div key={i}>{w}</div>
    ))}
   </div>
   <div
    className="grid grid-cols-7 gap-1 flex-1 min-h-0"
    style={{ gridTemplateRows: `repeat(${weeks}, minmax(0, 1fr))` }}
   >
    {cells.map((cell, i) => {
     if (cell.kind === "empty") {
      return <div key={i} className="aspect-square sm:aspect-auto" />;
     }
     const isToday = isSameDay(cell.date, today);
     const cellDate = cell.date;
     const cellItems = cell.items;
     return (
      <button
       key={i}
       type="button"
       onClick={() => onClickDay(cellDate)}
       className={
        "aspect-square sm:aspect-[5/4] lg:aspect-auto lg:h-full rounded-lg border bg-card p-1.5 flex flex-col gap-0.5 overflow-hidden text-left transition-colors hover:border-primary/60 hover:bg-muted/40 " +
        (isToday ? "border-primary/60" : "border-border")
       }
      >
       <div className={"text-xs tabular-nums " + (isToday ? "font-bold text-primary" : "text-foreground")}>
        {cellDate.getDate()}
       </div>
       {/* Mobile: a single dot if any bookings — keeps the cell compact. */}
       {cellItems.length > 0 ? (
        <div className="sm:hidden flex-1 flex items-center justify-center">
         <span className="block w-1.5 h-1.5 rounded-full bg-primary" />
        </div>
       ) : null}
       {/* Desktop: list up to 3 booking pills + overflow counter. */}
       <div className="hidden sm:flex flex-col gap-0.5 min-h-0 overflow-hidden">
        {cellItems.slice(0, 3).map((b) => (
         <span
          key={b.id}
          className={
           "rounded px-1.5 py-0.5 text-[10px] font-medium leading-tight truncate transition-colors pointer-events-none " +
           STATUS_BAR[b.status]
          }
         >
          <span className="tabular-nums">{formatTime(new Date(b.datetime))}</span>
          {" "}
          <span>{b.guestName}</span>
         </span>
        ))}
        {cellItems.length > 3 ? (
         <div className="text-[10px] text-muted-foreground/80">
          {t("plusMore", { count: cellItems.length - 3 })}
         </div>
        ) : null}
       </div>
      </button>
     );
    })}
   </div>
  </div>
 );
}

// ---------- Day view ----------

const TABLE_ROW_PX = 44;
const TABLE_COL_PX_RESPONSIVE = 36;

function DayView({
 focusDate,
 bookings,
 tables,
 schedule,
 onClickBooking,
}: {
 focusDate: Date;
 bookings: Booking[];
 tables: TableEntity[];
 schedule: import("./types").ReservationSchedule;
 onClickBooking: (b: Booking) => void;
}) {
 const t = useTranslations("dashboard.reservations");

 const sortedTables = useMemo(
  () => [...tables].sort((a, b) => a.number - b.number),
  [tables],
 );

 // Pick today's schedule slot. Mon=0...Sun=6 (matches save format).
 const weekdayIdx = (focusDate.getDay() + 6) % 7;
 const day = schedule[weekdayIdx];
 // For closed days the grid still renders — using the nearest open day's
 // working hours as the visible range — and the whole day is striped so the
 // user sees the day is off but in the same context as open days.
 const isClosed = !!day?.closed;
 const baseDay = day && !day.closed
  ? day
  : findNearestOpenDay(schedule, weekdayIdx) || day;

 const dayStart = baseDay ? parseHour(baseDay.from) : 9;
 const dayEnd = baseDay ? Math.max(parseHourCeil(baseDay.to), dayStart + 1) : 24;
 const lunchStart = !isClosed && day?.lunchFrom ? parseHour(day.lunchFrom) : null;
 const lunchEnd = !isClosed && day?.lunchTo ? parseHourCeil(day.lunchTo) : null;

 const hours: number[] = [];
 for (let h = dayStart; h < dayEnd; h++) hours.push(h);

 const DAY_START_HOUR = dayStart;
 const DAY_END_HOUR = dayEnd;

 // Build map tableId → bookings sorted by start time.
 const byTable = new Map<string, Booking[]>();
 for (const b of bookings) {
  if (!b.tableId) continue;
  const list = byTable.get(b.tableId) || [];
  list.push(b);
  byTable.set(b.tableId, list);
 }

 const totalMinutes = (DAY_END_HOUR - DAY_START_HOUR) * 60;
 const pct = (min: number) => ((min - DAY_START_HOUR * 60) / totalMinutes) * 100;

 const stripesBg =
  "repeating-linear-gradient(45deg, rgba(148,163,184,0.2) 0 4px, transparent 4px 10px)";

 return (
  <div className="space-y-2">
   {/* Hour strip — boundary labels straddling the grid lines. Day open
       from 9 reads 9, 10, … 22 along the scale. */}
   <div className="flex pb-1">
    {hours.map((h, i) => (
     <div
      key={h}
      className="flex-1 h-12 relative text-[10px] sm:text-xs text-muted-foreground/50 tabular-nums min-w-0"
     >
      {i === 0 ? (
       <span
        className="absolute bottom-0 left-0"
        style={{ writingMode: "vertical-rl", transform: "translateX(-50%) rotate(180deg)" }}
       >
        {String(h).padStart(2, "0")}:00
       </span>
      ) : null}
      <span
       className="absolute bottom-0 right-0"
       style={{ writingMode: "vertical-rl", transform: "translateX(50%) rotate(180deg)" }}
      >
       {String(h + 1).padStart(2, "0")}:00
      </span>
     </div>
    ))}
   </div>

   {/* One card per table. */}
   {sortedTables.map((tbl) => {
    const items = byTable.get(tbl.id) || [];
    return (
     <div key={tbl.id} className="relative bg-card border border-border rounded-xl overflow-hidden" style={{ height: TABLE_ROW_PX }}>
       {/* Hour grid lines */}
       {hours.map((h, i) => (
        <div
         key={h}
         className="absolute top-0 bottom-0 border-l border-border/40 first:border-l-0"
         style={{ left: `${(i / (DAY_END_HOUR - DAY_START_HOUR)) * 100}%` }}
        />
       ))}
       {/* Closed day — stripes over the entire row. */}
       {isClosed ? (
        <div
         className="absolute inset-0 pointer-events-none"
         style={{
          backgroundImage:
           stripesBg,
         }}
        />
       ) : null}
       {/* Lunch break — diagonal stripes (visible on dark theme). */}
       {!isClosed && lunchStart !== null && lunchEnd !== null && day?.lunchFrom && day?.lunchTo ? (() => {
        const lLeft = pct(parseLooseMinutes(day.lunchFrom));
        const lWidth = pct(parseLooseMinutes(day.lunchTo)) - lLeft;
        return (
         <div
          className="absolute top-0 bottom-0 pointer-events-none"
          style={{
           left: `${Math.max(0, lLeft)}%`,
           width: `${Math.max(0, lWidth)}%`,
           backgroundImage:
            stripesBg,
          }}
         />
        );
       })() : null}
       {/* Table label — at the start of the row, muted, behind bookings. */}
       <div className="absolute inset-y-0 left-0 flex items-center pl-2 pointer-events-none text-[11px] sm:text-xs font-medium text-muted-foreground/50 tabular-nums">
        {t("tableLabel", { number: tbl.number })}
       </div>
       {items.map((b) => {
         const dt = new Date(b.datetime);
         const startMin = dt.getHours() * 60 + dt.getMinutes();
         const left = pct(startMin);
         const width = (b.duration / totalMinutes) * 100;
         if (left + width <= 0 || left >= 100) return null;
         return (
          <button
           key={b.id}
           type="button"
           onClick={() => onClickBooking(b)}
           className={
            "absolute top-1 bottom-1 rounded-md px-1.5 text-[10px] sm:text-[11px] font-medium text-left truncate transition-colors " +
            STATUS_BAR[b.status]
           }
           style={{ left: `${Math.max(0, left)}%`, width: `${Math.min(100 - Math.max(0, left), width)}%` }}
          >
           <span className="tabular-nums">{formatTime(dt)}</span>
           {" "}
           <span>{b.guestName}</span>
          </button>
         );
        })}
      </div>
     );
    })}
  </div>
 );
}

// ---------- Detail modal ----------

function BookingDetailModal({
 booking,
 tables,
 onClose,
 onStatusChange,
}: {
 booking: Booking;
 tables: TableEntity[];
 onClose: () => void;
 onStatusChange: (status: Booking["status"]) => void;
}) {
 const t = useTranslations("dashboard.reservations");
 const dt = new Date(booking.datetime);
 const table = tables.find((tb) => tb.id === booking.tableId);
 const statusKey = STATUS_KEY[booking.status];
 const statusCls = STATUS_PILL[booking.status];

 const footer = booking.status === "pending" ? (
  <div className="flex items-center gap-2">
   <button
    type="button"
    onClick={() => onStatusChange("cancelled")}
    className="flex-1 h-10 text-sm font-medium text-red-700 bg-red-50 rounded-md transition-colors dark:bg-red-950/40 dark:text-red-400"
   >
    {t("reject")}
   </button>
   <button
    type="button"
    onClick={() => onStatusChange("confirmed")}
    className="flex-1 h-10 text-sm font-medium text-emerald-700 bg-emerald-50 rounded-md transition-colors dark:bg-emerald-950/40 dark:text-emerald-400"
   >
    {t("confirm")}
   </button>
  </div>
 ) : booking.status === "confirmed" ? (
  <button
   type="button"
   onClick={() => onStatusChange("completed")}
   className="w-full h-10 text-sm font-medium text-foreground bg-secondary rounded-md transition-colors hover:bg-muted"
  >
   {t("markComplete")}
  </button>
 ) : null;

 return (
  <Modal open={true} onClose={onClose} title={t("bookingDetailsTitle")} size="md" footer={footer}>
   <div className="space-y-4">
    <div className="flex items-center gap-2 flex-wrap">
     <div className="text-base font-semibold tabular-nums">
      {capitalize(dt.toLocaleDateString([], { weekday: "long", day: "numeric", month: "long" }))} · {formatTime(dt)}
     </div>
     <span className={"inline-flex items-center h-5 px-2 text-[10px] font-medium border rounded-full " + statusCls}>
      {t(statusKey)}
     </span>
    </div>

    <div>
     <div className="text-sm font-medium text-foreground">{booking.guestName}</div>
     <div className="text-xs text-muted-foreground">
      {booking.guestEmail}
      {booking.guestPhone ? ` · ${booking.guestPhone}` : ""}
     </div>
    </div>

    <div className="flex items-center gap-4 text-xs text-muted-foreground">
     <div className="inline-flex items-center gap-1.5">
      <UsersIcon size={14} />
      <span>
       {booking.guests === 1 ? t("guestOne", { count: booking.guests }) : t("guestOther", { count: booking.guests })}
      </span>
     </div>
     <div className="inline-flex items-center gap-1.5">
      <MapPinIcon size={14} />
      <span>
       {table ? t("tableLabel", { number: table.number }) + (table.name ? " · " + table.name : "") : t("notAssigned")}
      </span>
     </div>
    </div>

    {booking.notes ? (
     <div className="text-sm text-muted-foreground px-3 py-2 bg-secondary rounded-md leading-relaxed">
      {booking.notes}
     </div>
    ) : null}
   </div>
  </Modal>
 );
}

// ---------- Helpers ----------

function findNearestOpenDay(
 schedule: import("./types").ReservationSchedule,
 fromIdx: number,
): import("./types").ScheduleDay | null {
 // Walk forwards through the week starting from fromIdx+1 (skip current day).
 for (let step = 1; step <= 7; step++) {
  const idx = (fromIdx + step) % 7;
  const d = schedule[idx];
  if (d && !d.closed) return d;
 }
 return null;
}

function parseLooseMinutes(hhmm: string): number {
 const [h, m] = hhmm.split(":").map(Number);
 return h * 60 + (m || 0);
}

function parseHour(hhmm: string): number {
 const [h] = hhmm.split(":").map(Number);
 return Math.max(0, Math.min(24, h));
}

function parseHourCeil(hhmm: string): number {
 const [h, m] = hhmm.split(":").map(Number);
 return Math.max(0, Math.min(24, h + (m > 0 ? 1 : 0)));
}

function todayMidnight() {
 const d = new Date();
 d.setHours(0, 0, 0, 0);
 return d;
}

function capitalize(s: string) {
 return s.charAt(0).toUpperCase() + s.slice(1);
}
