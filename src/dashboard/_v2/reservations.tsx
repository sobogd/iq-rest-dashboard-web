"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { MapPinIcon, UsersIcon } from "./icons";
import { ConfirmDialog, EmptyState, PageHeader } from "./ui";
import { formatDayLabel, formatTime, isSameDay } from "./helpers";
import { patchReservation } from "./api";
import type { Booking, TableEntity } from "./types";
import { DashboardEvent, track } from "@/lib/dashboard-events";

const BOOKING_STATUS_KEYS: Record<Booking["status"], "statusPending" | "statusConfirmed" | "statusCancelled" | "statusCompleted" | "statusNoShow"> = {
 pending: "statusPending",
 confirmed: "statusConfirmed",
 cancelled: "statusCancelled",
 completed: "statusCompleted",
 "no-show": "statusNoShow",
};

const BOOKING_STATUS_CLS: Record<Booking["status"], string> = {
 pending: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-900/50",
 confirmed: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-900/50",
 cancelled: "bg-secondary text-muted-foreground border-border",
 completed: "bg-secondary text-muted-foreground border-border",
 "no-show": "bg-red-50 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-400 dark:border-red-900/50",
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
 const [confirmState, setConfirmState] = useState<{
 open: boolean;
 title?: string;
 message?: string;
 onConfirm?: () => void;
 }>({ open: false });

 const grouped = (() => {
 const today = new Date();
 today.setHours(0, 0, 0, 0);
 const map = new Map<string, { date: Date; items: Booking[] }>();
 bookings.forEach((b) => {
 if (b.status === "cancelled") return;
 const d = new Date(b.datetime);
 d.setHours(0, 0, 0, 0);
 if (d < today) return;
 const key = d.toISOString().slice(0, 10);
 if (!map.has(key)) map.set(key, { date: d, items: [] });
 map.get(key)!.items.push(b);
 });
 const days = [...map.values()].sort((a, b) => a.date.getTime() - b.date.getTime());
 days.forEach((d) =>
 d.items.sort((a, b) => new Date(a.datetime).getTime() - new Date(b.datetime).getTime()),
 );
 return days;
 })();

 const today = new Date();
 today.setHours(0, 0, 0, 0);
 const todayGroup = grouped.find((g) => isSameDay(g.date, today));
 const upcomingGroups = grouped.filter((g) => !isSameDay(g.date, today));

 useEffect(() => {
 track(DashboardEvent.SHOWED_RESERVATIONS);
 }, []);

 async function setBookingStatus(id: string, status: Booking["status"]) {
 if (status === "confirmed") track(DashboardEvent.CLICKED_CONFIRM_RESERVATION);
 else if (status === "cancelled") track(DashboardEvent.CLICKED_REJECT_RESERVATION);
 const before = bookings;
 setBookings((bks) => bks.map((b) => (b.id === id ? { ...b, status } : b)));
 try {
 await patchReservation(id, { status });
 } catch {
 track(DashboardEvent.ERROR_SAVE);
 setBookings(before);
 }
 }

 // Count must match the grouped list — only today and future, non-cancelled.
 // Otherwise the subtitle ("Tiene 2 reservas próximas") can disagree with
 // the empty-state body when all reservations are in the past.
 const upcomingCount = grouped.reduce((sum, g) => sum + g.items.length, 0);

 return (
 <>
 <div className="max-w-2xl mx-auto">
 <PageHeader
 title={t("title")}
 subtitle={upcomingCount === 1 ? t("subtitleOne", { count: upcomingCount }) : t("subtitleOther", { count: upcomingCount })}
 />

 {grouped.length === 0 ? (
 <EmptyState
 title={t("noBookings")}
 subtitle={t("noBookingsSub")}
 />
 ) : (
 <div className="space-y-6">
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
 </div>
 )}
 </div>

 <ConfirmDialog
 open={confirmState.open}
 title={confirmState.title}
 message={confirmState.message}
 onConfirm={confirmState.onConfirm}
 onCancel={() => setConfirmState({ open: false })}
 />
 </>
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
 <div className="text-xs text-muted-foreground truncate">{booking.guestEmail}</div>
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
 ) : null}
 </div>
 );
}
