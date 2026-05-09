// Shared types for the new dashboard.
// Multilingual fields are stored as { [lang]: string } objects.

export type Ml = Record<string, string>;

export interface OptionVariant {
 id: string;
 name: Ml;
 priceDelta: string;
}

export interface DishOption {
 id: string;
 name: Ml;
 type: "single" | "multi";
 required: boolean;
 variants: OptionVariant[];
}

export interface Dish {
 id: string;
 name: Ml;
 description: Ml;
 price: string;
 visible: boolean;
 allergens: string[];
 options: DishOption[];
 photoUrl: string | null;
 sortOrder: number;
 categoryId: string;
 isExample?: boolean;
}

export interface Category {
 id: string;
 name: Ml;
 sortOrder: number;
 dishes: Dish[];
}

export interface TableEntity {
 id: string;
 number: number;
 name: string;
 capacity: number;
 x: number | null;
 y: number | null;
 photoUrl: string | null;
 sortOrder: number;
}

export interface OrderItemOptionSnapshot {
 optionName: Ml;
 variantName: Ml;
 priceDelta: string;
 quantity?: number;
}

export type OrderItemStatus = "pending" | "cooking" | "ready" | "served";

export interface OrderItem {
 id: string;
 dishId: string;
 dishNameSnapshot: Ml;
 basePriceSnapshot: string;
 options: OrderItemOptionSnapshot[];
 notes: string;
 status: OrderItemStatus;
 createdAt: string;
}

export interface Order {
 id: string;
 tableId: string | null;
 tableNumber: number | null;
 guestName: string;
 createdAt: string;
 status: "active" | "completed" | "cancelled";
 items: OrderItem[];
 total: number;
}

export interface Booking {
 id: string;
 guestName: string;
 guestEmail: string;
 guestPhone: string | null;
 datetime: string;
 // Slot length in minutes. Inherited from restaurant.reservationSlotMinutes
 // when the booking was created.
 duration: number;
 guests: number;
 tableId: string | null;
 status: "pending" | "confirmed" | "cancelled" | "completed";
 notes: string;
}

export interface RestaurantContacts {
 phone: string;
 instagram: string;
 whatsapp: string;
}

export interface RestaurantLocation {
 address: string;
 lat: number | null;
 lng: number | null;
 // Google Places ID captured by the map picker. Null when user clicked the
 // map without picking a search result.
 placeId: string | null;
}

export interface ScheduleDay {
 closed: boolean;
 from: string;
 to: string;
 lunchFrom: string | null;
 lunchTo: string | null;
}

// Length 7. Index 0=Mon ... 6=Sun.
export type ReservationSchedule = ScheduleDay[];

export interface BookingSettings {
 enabled: boolean;
 approval: "manual" | "auto";
 duration: number;
 schedule: ReservationSchedule;
}

export interface OrderSettings {
 acceptOrders: boolean;
 modes: { internal: boolean; whatsapp: boolean };
 requiredFields: { name: boolean; phone: boolean; address: boolean };
}

export interface SubscriptionInfo {
 plan: "yearly" | "monthly" | null;
 status: "active" | "cancelled" | null;
 renewsAt: string | null;
}

export interface Restaurant {
 id: string;
 name: string;
 subtitle: string;
 showTitleOnHomepage: boolean;
 slug: string;
 currency: string;
 backgroundUrl: string | null;
 backgroundType: "image" | "video" | null;
 accentColor: string;
 contacts: RestaurantContacts;
 location: RestaurantLocation;
 languages: string[];
 defaultLang: string;
 menuUrl: string;
 published: boolean;
 bookingSettings: BookingSettings;
 orderSettings: OrderSettings;
 subscription: SubscriptionInfo;
}

export type TabId = "menu" | "reservations" | "orders" | "kitchen" | "analytics" | "settings";
