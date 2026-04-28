"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { TablesPage } from "../../_v2/tables";
import { useRestaurant } from "../../_v2/restaurant-context";
import type { Booking, Order, TableEntity } from "../../_v2/types";

export function TablesSettingsClient({
 initialTables,
 initialBookings,
 initialOrders,
}: {
 initialTables: TableEntity[];
 initialBookings: Booking[];
 initialOrders: Order[];
}) {
 const router = useRouter();
 const restaurant = useRestaurant();
 const [tables, setTables] = useState<TableEntity[]>(initialTables);

 return (
 <TablesPage
 tables={tables}
 setTables={setTables}
 orders={initialOrders}
 bookings={initialBookings}
 menuUrl={restaurant.menuUrl}
 onBack={() => {
 router.push("/dashboard/settings");
 router.refresh();
 }}
 />
 );
}
