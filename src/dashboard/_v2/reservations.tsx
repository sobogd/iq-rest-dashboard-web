"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { MapPinIcon, UsersIcon } from "./icons";
import { EmptyState, PageHeader } from "./ui";
import { formatDayLabel, formatTime, isSameDay } from "./helpers";
import { patchReservation } from "./api";
import type { Booking, TableEntity } from "./types";
import { track } from "@/lib/dashboard-events";

const BOOKING_STATUS_KEYS: Record<Booking["status"], "statusPending" | "statusConfirmed" | "statusCancelled" | "statusCompleted"> = {
 pending: "statusPending",
 confirmed: "statusConfirmed",
 cancelled: "statusCancelled",
 completed: "statusCompleted",
};

const BOOKING_STATUS_CLS: Record<Booking["status"], string> = {
 pending: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-900/50",
 confirmed: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-900/50",
 cancelled: "bg-secondary text-muted-foreground border-border",
 completed: "bg-secondary text-muted-foreground border-border",
};

export function ReservationsPage({
 bookings,
 setBookings,
 tables,
}: {
 bookings: Booking[];
 setBookings: React.Dispatch<React.SetStateAction<Booking[]>>;
 tables: TableEntity[];
}) {
 const t = useTranslations("dashboard.reservations");

 const [showPast, setShowPast] = useState(false);

 const { upcoming, past } = (() => {
 const today = new Date();
 today.setHours(0, 0, 0, 0);
 const upcomingMap = new Map<string, { date: Date; items: Booking[] }>();
 const pastMap = new Map<string, { date: Date; items: Booking[] }>();
 bookings.forEach((b) => {
 if (b.status === "cancelled") return;
 const d = new Date(b.datetime);
 d.setHours(0, 0, 0, 0);
 const key = d.toISOString().slice(0, 10);
 const targetMap = d < today ? pastMap : upcomingMap;
 if (!targetMap.has(key)) targetMap.set(key, { date: d, items: [] });
 targetMap.get(key)!.items.push(b);
 });
 const upcomingDays = [...upcomingMap.values()].sort((a, b) => a.date.getTime() - b.date.getTime());
 const pastDays = [...pastMap.values()].sort((a, b) => b.date.getTime() - a.date.getTime());
 const sortItems = (d: { items: Booking[] }) =>
 d.items.sort((a, b) => new Date(a.datetime).getTime() - new Date(b.datetime).getTime());
 upcomingDays.forEach(sortItems);
 pastDays.forEach(sortItems);
 return { upcoming: upcomingDays, past: pastDays };
 })();

 const today = new Date();
 today.setHours(0, 0, 0, 0);
 const todayGroup = upcoming.find((g) => isSameDay(g.date, today));
 const upcomingGroups = upcoming.filter((g) => !isSameDay(g.date, today));

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

 // Count must match the grouped list — only today and future, non-cancelled.
 // Otherwise the subtitle ("Tiene 2 reservas próximas") can disagree with
 // the empty-state body when all reservations are in the past.
 const upcomingCount = upcoming.reduce((sum, g) => sum + g.items.length, 0);
 const pastCount = past.reduce((sum, g) => sum + g.items.length, 0);

 return (
 <div className="max-w-2xl mx-auto">
 <PageHeader
 title={t("title")}
 subtitle={upcomingCount === 1 ? t("subtitleOne", { count: upcomingCount }) : t("subtitleOther", { count: upcomingCount })}
 />

 {upcoming.length === 0 && past.length === 0 ? (
 <EmptyState
 title={t("noBookings")}
 subtitle={t("noBookingsSub")}
 />
 ) : (
 <div className="space-y-6">
 {upcoming.length === 0 ? (
 <EmptyState
 title={t("noBookings")}
 subtitle={t("noBookingsSub")}
 />
 ) : (
 <>
 {todayGroup ? (
 <BookingGroup
 date={todayGroup.date}
 items={todayGroup.items}
 tables={tables}
 onStatusChange={setBookingStatus}
 isToday
 />
 ) : (
 <div>
 <div className="text-sm font-medium text-foreground mb-2">{t("today")}</div>
 <div className="text-xs text-muted-foreground text-center py-6 px-3 bg-card border border-border rounded-xl">
 {t("noToday")}
 </div>
 </div>
 )}

 {upcomingGroups.map((g) => (
 <BookingGroup
 key={g.date.toISOString()}
 date={g.date}
 items={g.items}
 tables={tables}
 onStatusChange={setBookingStatus}
 />
 ))}
 </>
 )}

 {past.length > 0 ? (
 <div className="pt-4 border-t border-border">
 <button
 type="button"
 onClick={() => setShowPast((v) => !v)}
 className="text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
 >
 {showPast ? t("hidePast") : t("showPast", { count: pastCount })}
 </button>
 {showPast ? (
 <div className="space-y-6 mt-4">
 {past.map((g) => (
 <BookingGroup
 key={g.date.toISOString()}
 date={g.date}
 items={g.items}
 tables={tables}
 onStatusChange={setBookingStatus}
 />
 ))}
 </div>
 ) : null}
 </div>
 ) : null}
 </div>
 )}
 </div>
 );
}

function BookingGroup({
 date,
 items,
 tables,
 onStatusChange,
 isToday,
}: {
 date: Date;
 items: Booking[];
 tables: TableEntity[];
 onStatusChange: (id: string, status: Booking["status"]) => void;
 isToday?: boolean;
}) {
 const t = useTranslations("dashboard.reservations");
 return (
 <div>
 <div className="flex items-baseline gap-2 mb-2">
 <div className="text-sm font-medium text-foreground">{formatDayLabel(date)}</div>
 {!isToday ? (
 <div className="text-xs text-muted-foreground">
 {date.toLocaleDateString([], { day: "numeric", month: "short" })}
 </div>
 ) : null}
 <div className="ml-auto text-xs text-muted-foreground tabular-nums">
 {items.length === 1 ? t("bookingOne", { count: items.length }) : t("bookingOther", { count: items.length })}
 </div>
 </div>
 <div className="space-y-2">
 {items.map((b) => (
 <BookingCard key={b.id} booking={b} tables={tables} onStatusChange={onStatusChange} />
 ))}
 </div>
 </div>
 );
}

function BookingCard({
 booking,
 tables,
 onStatusChange,
}: {
 booking: Booking;
 tables: TableEntity[];
 onStatusChange: (id: string, status: Booking["status"]) => void;
}) {
 const t = useTranslations("dashboard.reservations");
 const statusKey = BOOKING_STATUS_KEYS[booking.status] || BOOKING_STATUS_KEYS.pending;
 const statusCls = BOOKING_STATUS_CLS[booking.status] || BOOKING_STATUS_CLS.pending;
 const time = formatTime(new Date(booking.datetime));
 const table = tables.find((tbl) => tbl.id === booking.tableId);

 return (
 <div className="bg-card border border-border rounded-xl p-3.5">
 <div className="mb-2">
 <div className="flex items-center gap-2 flex-wrap">
 <div className="text-sm font-medium text-foreground tabular-nums">{time}</div>
 <span
 className={
 "inline-flex items-center h-5 px-2 text-[10px] font-medium border rounded-full " +
 statusCls
 }
 >
 {t(statusKey)}
 </span>
 </div>
 <div className="text-sm text-foreground mt-1 truncate">{booking.guestName}</div>
 <div className="text-xs text-muted-foreground truncate">
 {booking.guestEmail}
 {booking.guestPhone ? ` · ${booking.guestPhone}` : ""}
 </div>
 </div>

 <div className="flex items-center gap-3 text-xs text-muted-foreground">
 <div className="inline-flex items-center gap-1">
 <UsersIcon size={12} />
 <span>
 {booking.guests === 1 ? t("guestOne", { count: booking.guests }) : t("guestOther", { count: booking.guests })}
 </span>
 </div>
 <div className="inline-flex items-center gap-1">
 <MapPinIcon size={12} />
 <span>
 {table ? t("tableLabel", { number: table.number }) + (table.name ? " · " + table.name : "") : t("notAssigned")}
 </span>
 </div>
 </div>

 {booking.notes ? (
 <div className="text-xs text-muted-foreground mt-2 px-2 py-1.5 bg-secondary rounded-md">
 {booking.notes}
 </div>
 ) : null}

 {booking.status === "pending" ? (
 <div className="flex items-center gap-1.5 mt-3 pt-3 border-t border-border">
 <button
 type="button"
 onClick={() => onStatusChange(booking.id, "cancelled")}
 className="flex-1 h-8 text-xs font-medium text-red-700 bg-red-50 rounded-md transition-colors dark:bg-red-950/40 dark:text-red-400"
 >
 {t("reject")}
 </button>
 <button
 type="button"
 onClick={() => onStatusChange(booking.id, "confirmed")}
 className="flex-1 h-8 text-xs font-medium text-emerald-700 bg-emerald-50 rounded-md transition-colors dark:bg-emerald-950/40 dark:text-emerald-400"
 >
 {t("confirm")}
 </button>
 </div>
 ) : booking.status === "confirmed" ? (
 <div className="flex items-center gap-1.5 mt-3 pt-3 border-t border-border">
 <button
 type="button"
 onClick={() => onStatusChange(booking.id, "completed")}
 className="flex-1 h-8 text-xs font-medium text-foreground bg-secondary rounded-md transition-colors hover:bg-muted"
 >
 {t("markComplete")}
 </button>
 </div>
 ) : null}
 </div>
 );
}
