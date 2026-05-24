// Hardcoded sample data for the public, no-auth kitchen-display demo
// embedded on the marketing landing (k.iq-rest.com/?demo=1). Mirrors the
// shape of the real `/devices/bootstrap` response so KitchenApp can render
// the genuine KitchenPage without ever touching the API. Visitors can tap
// items to advance their status (cooking → ready → served) — that runs on
// purely local optimistic state (see KitchenPage `demoMode`), so refreshing
// the iframe resets the board.

import type {
  Category,
  Order,
  OrderItem,
  OrderItemStatus,
  Restaurant,
  TableEntity,
} from "@/dashboard/_v2/types";

export interface KitchenDemoSnapshot {
  deviceType: "KITCHEN";
  restaurant: Restaurant;
  categories: Category[];
  tables: TableEntity[];
  orders: Order[];
  tablesByNumber: Map<number, string>;
}

// English-only dish names — the surrounding KDS chrome (buttons, status
// labels, headers) still localises via i18next from the `lang` query param;
// only the sample dish names stay fixed. Good enough for a feel-it demo.
function ml(name: string): Record<string, string> {
  return { en: name };
}

// Minutes-ago → ISO string, evaluated per call so the "time on the pass"
// badges look fresh every time the demo loads.
function minsAgo(min: number): string {
  return new Date(Date.now() - min * 60_000).toISOString();
}

let seq = 0;
function item(
  dishId: string,
  name: string,
  price: string,
  status: OrderItemStatus,
  ageMin: number,
  notes = "",
): OrderItem {
  seq += 1;
  return {
    id: `demo-item-${seq}`,
    dishId,
    dishNameSnapshot: ml(name),
    basePriceSnapshot: price,
    options: [],
    notes,
    status,
    createdAt: minsAgo(ageMin),
  };
}

const DISHES = {
  margherita: "demo-dish-margherita",
  carbonara: "demo-dish-carbonara",
  caesar: "demo-dish-caesar",
  bruschetta: "demo-dish-bruschetta",
  tiramisu: "demo-dish-tiramisu",
  espresso: "demo-dish-espresso",
  burger: "demo-dish-burger",
  fries: "demo-dish-fries",
} as const;

export function buildKitchenDemoSnapshot(lang: string): KitchenDemoSnapshot {
  seq = 0;

  const categories: Category[] = [
    {
      id: "demo-cat-starters",
      name: ml("Starters"),
      sortOrder: 0,
      isGroup: false,
      parentId: null,
      dishes: [
        dish(DISHES.bruschetta, "Bruschetta", "demo-cat-starters", 0),
        dish(DISHES.caesar, "Caesar Salad", "demo-cat-starters", 1),
      ],
    },
    {
      id: "demo-cat-mains",
      name: ml("Mains"),
      sortOrder: 1,
      isGroup: false,
      parentId: null,
      dishes: [
        dish(DISHES.margherita, "Pizza Margherita", "demo-cat-mains", 0),
        dish(DISHES.carbonara, "Spaghetti Carbonara", "demo-cat-mains", 1),
        dish(DISHES.burger, "Classic Burger", "demo-cat-mains", 2),
        dish(DISHES.fries, "French Fries", "demo-cat-mains", 3),
      ],
    },
    {
      id: "demo-cat-desserts",
      name: ml("Desserts & Coffee"),
      sortOrder: 2,
      isGroup: false,
      parentId: null,
      dishes: [
        dish(DISHES.tiramisu, "Tiramisu", "demo-cat-desserts", 0),
        dish(DISHES.espresso, "Espresso", "demo-cat-desserts", 1),
      ],
    },
  ];

  const tables: TableEntity[] = [
    table(1, "demo-table-1"),
    table(3, "demo-table-3"),
    table(5, "demo-table-5"),
    table(8, "demo-table-8"),
  ];
  const tablesByNumber = new Map(tables.map((t) => [t.number, t.id]));

  const orders: Order[] = [
    order("demo-order-1", "demo-table-1", 1, 1, "Guest", 11, [
      item(DISHES.bruschetta, "Bruschetta", "7.50", "ready", 11),
      item(DISHES.margherita, "Pizza Margherita", "12.00", "cooking", 11),
      item(DISHES.carbonara, "Spaghetti Carbonara", "13.50", "cooking", 11, "No bacon"),
    ]),
    order("demo-order-2", "demo-table-3", 3, 2, "Guest", 6, [
      item(DISHES.burger, "Classic Burger", "11.00", "cooking", 6),
      item(DISHES.fries, "French Fries", "4.50", "pending", 6),
      item(DISHES.caesar, "Caesar Salad", "8.50", "ready", 6),
    ]),
    order("demo-order-3", "demo-table-5", 5, 3, "Guest", 3, [
      item(DISHES.margherita, "Pizza Margherita", "12.00", "pending", 3),
      item(DISHES.margherita, "Pizza Margherita", "12.00", "pending", 3, "Extra cheese"),
    ]),
    order("demo-order-4", "demo-table-8", 8, 4, "Guest", 1, [
      item(DISHES.tiramisu, "Tiramisu", "6.00", "pending", 1),
      item(DISHES.espresso, "Espresso", "2.50", "pending", 1, "x2"),
    ]),
  ];

  return {
    deviceType: "KITCHEN",
    restaurant: buildDemoRestaurant(lang),
    categories,
    tables,
    orders,
    tablesByNumber,
  };
}

function dish(id: string, name: string, categoryId: string, sortOrder: number) {
  return {
    id,
    name: ml(name),
    description: ml(""),
    price: "0",
    visible: true,
    allergens: [],
    diets: [],
    options: [],
    photoUrl: null,
    sortOrder,
    categoryId,
  };
}

function table(number: number, id: string): TableEntity {
  return {
    id,
    number,
    name: `Table ${number}`,
    description: "",
    capacity: 4,
    x: null,
    y: null,
    photoUrl: null,
    color: null,
    sortOrder: number,
  };
}

function order(
  id: string,
  tableId: string,
  tableNumber: number,
  dailyNumber: number,
  guestName: string,
  ageMin: number,
  items: OrderItem[],
): Order {
  return {
    id,
    tableId,
    tableNumber,
    dailyNumber,
    guestName,
    createdAt: minsAgo(ageMin),
    status: "active",
    items,
    total: items.reduce((s, it) => s + Number(it.basePriceSnapshot), 0),
  };
}

// Dish names stay English; everything else (currency formatting, UI strings)
// follows `lang`. defaultLang is set to the requested language so the menu
// builder and any ml() lookups fall back cleanly to the English entry.
function buildDemoRestaurant(lang: string): Restaurant {
  return {
    id: "demo-restaurant",
    name: "Love Eatery",
    subtitle: "",
    showTitleOnHomepage: false,
    menuLayout: "flat",
    paymentMethods: [],
    slug: "love-eatery",
    currency: "EUR",
    backgroundUrl: null,
    backgroundType: null,
    accentColor: "#ff5a36",
    contacts: { phone: "", instagram: "", whatsapp: "" },
    location: { address: "", lat: null, lng: null, placeId: null },
    languages: [lang, "en"],
    defaultLang: lang || "en",
    menuUrl: "",
    published: true,
    bookingSettings: {
      enabled: false,
      approval: "manual",
      duration: 60,
      schedule: [],
      timezone: "UTC",
    },
    orderSettings: {
      acceptOrders: true,
      modes: { internal: true, whatsapp: false },
      requiredFields: { name: false, phone: false, address: false },
    },
    subscription: { plan: null, status: null, renewsAt: null },
  };
}
