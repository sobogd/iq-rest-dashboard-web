// Hardcoded sample data for the public, no-auth kitchen-display demo
// embedded on the marketing landing (k.iq-rest.com/?demo=1). Mirrors the
// shape of the real `/devices/bootstrap` response so KitchenApp can render
// the genuine KitchenPage without ever touching the API. Visitors can tap
// items to advance their status (cooking → ready → served) — that runs on
// purely local optimistic state (see KitchenPage `demoMode`), so refreshing
// the iframe resets the board.
//
// Dish names and item options are multilingual (Ml). The demo's defaultLang
// is the landing locale forwarded as `?lang=`, so a Spanish visitor sees the
// board in Spanish. getMlWithFallback resolves lang → defaultLang → first
// available, so the `en` entry (always first) covers any locale we didn't
// translate by hand. Internationally-identical food names (Pizza Margherita,
// Espresso, Tiramisù, Bruschetta) carry only en/es.

import type {
  Booking,
  Category,
  Ml,
  Order,
  OrderItem,
  OrderItemOptionSnapshot,
  OrderItemStatus,
  ReservationSchedule,
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

export interface ReservationsDemoSnapshot {
  restaurant: Restaurant;
  tables: TableEntity[];
  bookings: Booking[];
}

// Minutes-ago → ISO string, evaluated per call so the "time on the pass"
// badges look fresh every time the demo loads.
function minsAgo(min: number): string {
  return new Date(Date.now() - min * 60_000).toISOString();
}

// --- localized labels -------------------------------------------------------
// `en` first so it acts as the universal fallback for untranslated locales.

const NAMES = {
  // Internationally identical in Latin scripts — only non-Latin scripts and
  // es carry overrides; everything else falls back to `en`.
  bruschetta: {
    en: "Bruschetta", es: "Bruschetta",
    ar: "بروسكيتا", bg: "Брускета", el: "Μπρουσκέτα", fa: "بروسکتا",
    ja: "ブルスケッタ", ko: "브루스케타", ru: "Брускетта", sr: "Брускета",
    uk: "Брускета", zh: "普切塔",
  },
  caesar: {
    en: "Caesar Salad", es: "Ensalada César", ar: "سلطة سيزر", bg: "Цезар салата",
    ca: "Amanida Cèsar", cs: "Caesar salát", da: "Cæsarsalat", de: "Caesar Salat",
    el: "Σαλάτα Καίσαρα", et: "Caesari salat", fa: "سالاد سزار", fi: "Caesar-salaatti",
    fr: "Salade César", ga: "Sailéad Caesar", hr: "Cezar salata", hu: "Cézár saláta",
    is: "Caesar salat", it: "Insalata Caesar", ja: "シーザーサラダ", ko: "시저 샐러드",
    lt: "Cezario salotos", lv: "Cēzara salāti", nl: "Caesarsalade", no: "Cæsarsalat",
    pl: "Sałatka Cezar", pt: "Salada Caesar", ro: "Salată Caesar", ru: "Салат Цезарь",
    sk: "Caesar šalát", sl: "Cezarjeva solata", sr: "Цезар салата", sv: "Caesarsallad",
    tr: "Sezar Salatası", uk: "Салат Цезар", zh: "凯撒沙拉",
  },
  margherita: {
    en: "Pizza Margherita", es: "Pizza Margarita",
    ar: "بيتزا مارغريتا", bg: "Пица Маргарита", el: "Πίτσα Μαργαρίτα", fa: "پیتزا مارگاریتا",
    ja: "マルゲリータピザ", ko: "마르게리타 피자", ru: "Пицца Маргарита", sr: "Пица Маргарита",
    uk: "Піца Маргарита", zh: "玛格丽特披萨",
  },
  carbonara: {
    en: "Spaghetti Carbonara", es: "Espaguetis Carbonara", pt: "Espaguete Carbonara",
    ar: "سباغيتي كاربونارا", bg: "Спагети Карбонара", el: "Σπαγγέτι Καρμπονάρα",
    fa: "اسپاگتی کاربونارا", ja: "スパゲッティ・カルボナーラ", ko: "스파게티 카르보나라",
    ru: "Спагетти Карбонара", sr: "Шпагете Карбонара", uk: "Спагеті Карбонара",
    zh: "卡邦尼意面",
  },
  burger: {
    en: "Classic Burger", es: "Hamburguesa Clásica", ar: "برغر كلاسيكي", bg: "Класически бургер",
    ca: "Hamburguesa clàssica", cs: "Klasický burger", da: "Klassisk burger", de: "Klassischer Burger",
    el: "Κλασικό μπέργκερ", et: "Klassikaline burger", fa: "برگر کلاسیک", fi: "Klassinen burgeri",
    fr: "Burger Classique", ga: "Borgaire Clasaiceach", hr: "Klasični burger", hu: "Klasszikus burger",
    is: "Klassískur borgari", it: "Burger Classico", ja: "クラシックバーガー", ko: "클래식 버거",
    lt: "Klasikinis mėsainis", lv: "Klasiskais burgers", nl: "Klassieke burger", no: "Klassisk burger",
    pl: "Klasyczny burger", pt: "Hambúrguer Clássico", ro: "Burger clasic", ru: "Классический бургер",
    sk: "Klasický burger", sl: "Klasični burger", sr: "Класични бургер", sv: "Klassisk burgare",
    tr: "Klasik Burger", uk: "Класичний бургер", zh: "经典汉堡",
  },
  fries: {
    en: "French Fries", es: "Patatas Fritas", ar: "بطاطس مقلية", bg: "Пържени картофи",
    ca: "Patates fregides", cs: "Hranolky", da: "Pommes frites", de: "Pommes",
    el: "Τηγανητές πατάτες", et: "Friikartulid", fa: "سیب‌زمینی سرخ‌کرده", fi: "Ranskalaiset",
    fr: "Frites", ga: "Sceallóga", hr: "Pomfrit", hu: "Hasábburgonya",
    is: "Franskar kartöflur", it: "Patatine Fritte", ja: "フライドポテト", ko: "감자튀김",
    lt: "Gruzdintos bulvytės", lv: "Frī kartupeļi", nl: "Frietjes", no: "Pommes frites",
    pl: "Frytki", pt: "Batatas Fritas", ro: "Cartofi prăjiți", ru: "Картофель фри",
    sk: "Hranolky", sl: "Pomfri", sr: "Помфрит", sv: "Pommes frites",
    tr: "Patates Kızartması", uk: "Картопля фрі", zh: "薯条",
  },
  tiramisu: {
    en: "Tiramisù", es: "Tiramisú",
    ar: "تيراميسو", bg: "Тирамису", el: "Τιραμισού", fa: "تیرامیسو",
    ja: "ティラミス", ko: "티라미수", ru: "Тирамису", sr: "Тирамису",
    uk: "Тірамісу", zh: "提拉米苏",
  },
  espresso: {
    en: "Espresso", es: "Espresso",
    ar: "إسبريسو", bg: "Еспресо", el: "Εσπρέσο", fa: "اسپرسو",
    ja: "エスプレッソ", ko: "에스프레소", ru: "Эспрессо", sr: "Еспресо",
    uk: "Еспресо", zh: "浓缩咖啡",
  },
} satisfies Record<string, Ml>;

const CATEGORY_NAMES = {
  starters: {
    en: "Starters", es: "Entrantes", ar: "مقبلات", bg: "Предястия",
    ca: "Entrants", cs: "Předkrmy", da: "Forretter", de: "Vorspeisen",
    el: "Ορεκτικά", et: "Eelroad", fa: "پیش‌غذا", fi: "Alkuruoat",
    fr: "Entrées", ga: "Cúrsaí tosaigh", hr: "Predjela", hu: "Előételek",
    is: "Forréttir", it: "Antipasti", ja: "前菜", ko: "전채",
    lt: "Užkandžiai", lv: "Uzkodas", nl: "Voorgerechten", no: "Forretter",
    pl: "Przystawki", pt: "Entradas", ro: "Aperitive", ru: "Закуски",
    sk: "Predjedlá", sl: "Predjedi", sr: "Предјела", sv: "Förrätter",
    tr: "Başlangıçlar", uk: "Закуски", zh: "开胃菜",
  },
  mains: {
    en: "Mains", es: "Principales", ar: "الأطباق الرئيسية", bg: "Основни ястия",
    ca: "Plats principals", cs: "Hlavní jídla", da: "Hovedretter", de: "Hauptgerichte",
    el: "Κυρίως πιάτα", et: "Pearoad", fa: "غذای اصلی", fi: "Pääruoat",
    fr: "Plats", ga: "Príomhchúrsaí", hr: "Glavna jela", hu: "Főételek",
    is: "Aðalréttir", it: "Piatti principali", ja: "メイン", ko: "메인",
    lt: "Pagrindiniai patiekalai", lv: "Pamatēdieni", nl: "Hoofdgerechten", no: "Hovedretter",
    pl: "Dania główne", pt: "Pratos Principais", ro: "Feluri principale", ru: "Основные блюда",
    sk: "Hlavné jedlá", sl: "Glavne jedi", sr: "Главна јела", sv: "Huvudrätter",
    tr: "Ana Yemekler", uk: "Основні страви", zh: "主菜",
  },
  desserts: {
    en: "Desserts & Coffee", es: "Postres y Café", ar: "الحلويات والقهوة", bg: "Десерти и кафе",
    ca: "Postres i cafè", cs: "Dezerty a káva", da: "Desserter & kaffe", de: "Desserts & Kaffee",
    el: "Επιδόρπια & καφές", et: "Magustoidud ja kohv", fa: "دسر و قهوه", fi: "Jälkiruoat & kahvi",
    fr: "Desserts & café", ga: "Milseoga & caife", hr: "Deserti i kava", hu: "Desszertek és kávé",
    is: "Eftirréttir og kaffi", it: "Dolci & caffè", ja: "デザート＆コーヒー", ko: "디저트 & 커피",
    lt: "Desertai ir kava", lv: "Deserti un kafija", nl: "Desserts & koffie", no: "Desserter og kaffe",
    pl: "Desery i kawa", pt: "Sobremesas e Café", ro: "Deserturi & cafea", ru: "Десерты и кофе",
    sk: "Dezerty a káva", sl: "Sladice in kava", sr: "Десерти и кафа", sv: "Efterrätter & kaffe",
    tr: "Tatlılar & Kahve", uk: "Десерти та кава", zh: "甜点和咖啡",
  },
} satisfies Record<string, Ml>;

const VARIANTS = {
  mediumRare: {
    en: "Medium rare", es: "Al punto", ar: "نصف استواء", bg: "Средно изпечено",
    ca: "Al punt", cs: "Medium rare", da: "Medium rare", de: "Medium",
    el: "Medium rare", et: "Poolküps", fa: "نیم‌پز", fi: "Medium",
    fr: "Saignant", ga: "Leathbhruite", hr: "Srednje pečeno", hu: "Közepesen átsütve",
    is: "Miðlungssteikt", it: "Media cottura", ja: "ミディアムレア", ko: "미디엄 레어",
    lt: "Vidutiniškai iškepta", lv: "Vidēji izcepta", nl: "Medium rare", no: "Medium rare",
    pl: "Średnio wysmażony", pt: "Mal passado", ro: "În sânge", ru: "Средняя прожарка",
    sk: "Stredne prepečené", sl: "Srednje pečeno", sr: "Средње печено", sv: "Medium rare",
    tr: "Az pişmiş", uk: "Середня прожарка", zh: "三分熟",
  },
  extraCheese: {
    en: "Extra cheese", es: "Queso extra", ar: "جبن إضافي", bg: "Допълнително сирене",
    ca: "Formatge extra", cs: "Extra sýr", da: "Ekstra ost", de: "Extra Käse",
    el: "Επιπλέον τυρί", et: "Lisajuust", fa: "پنیر اضافه", fi: "Lisäjuusto",
    fr: "Fromage en plus", ga: "Cáis bhreise", hr: "Dodatni sir", hu: "Extra sajt",
    is: "Auka ostur", it: "Formaggio extra", ja: "チーズ増量", ko: "치즈 추가",
    lt: "Daugiau sūrio", lv: "Papildu siers", nl: "Extra kaas", no: "Ekstra ost",
    pl: "Dodatkowy ser", pt: "Queijo extra", ro: "Brânză în plus", ru: "Двойной сыр",
    sk: "Extra syr", sl: "Dodatni sir", sr: "Додатни сир", sv: "Extra ost",
    tr: "Ekstra peynir", uk: "Додатковий сир", zh: "加芝士",
  },
  thinCrust: {
    en: "Thin crust", es: "Masa fina", ar: "عجينة رقيقة", bg: "Тънка основа",
    ca: "Massa fina", cs: "Tenké těsto", da: "Tynd bund", de: "Dünner Boden",
    el: "Λεπτή ζύμη", et: "Õhuke põhi", fa: "خمیر نازک", fi: "Ohut pohja",
    fr: "Pâte fine", ga: "Crústa tanaí", hr: "Tanko tijesto", hu: "Vékony tészta",
    is: "Þunnur botn", it: "Impasto sottile", ja: "薄焼き生地", ko: "씬 크러스트",
    lt: "Plona tešla", lv: "Plāna mīkla", nl: "Dunne bodem", no: "Tynn bunn",
    pl: "Cienkie ciasto", pt: "Massa fina", ro: "Blat subțire", ru: "Тонкое тесто",
    sk: "Tenké cesto", sl: "Tanko testo", sr: "Танко тесто", sv: "Tunn botten",
    tr: "İnce hamur", uk: "Тонке тісто", zh: "薄底",
  },
  addChicken: {
    en: "Add chicken", es: "Con pollo", ar: "مع دجاج", bg: "С пиле",
    ca: "Amb pollastre", cs: "S kuřecím", da: "Med kylling", de: "Mit Hähnchen",
    el: "Με κοτόπουλο", et: "Kanaga", fa: "با مرغ", fi: "Kanalla",
    fr: "Avec poulet", ga: "Le sicín", hr: "S piletinom", hu: "Csirkével",
    is: "Með kjúklingi", it: "Con pollo", ja: "チキン追加", ko: "치킨 추가",
    lt: "Su vištiena", lv: "Ar vistu", nl: "Met kip", no: "Med kylling",
    pl: "Z kurczakiem", pt: "Com frango", ro: "Cu pui", ru: "С курицей",
    sk: "S kuracím", sl: "S piščancem", sr: "Са пилетином", sv: "Med kyckling",
    tr: "Tavuklu", uk: "З куркою", zh: "加鸡肉",
  },
  large: {
    en: "Large", es: "Grande", ar: "كبير", bg: "Голяма",
    ca: "Gran", cs: "Velké", da: "Stor", de: "Groß",
    el: "Μεγάλο", et: "Suur", fa: "بزرگ", fi: "Iso",
    fr: "Grande", ga: "Mór", hr: "Velika", hu: "Nagy",
    is: "Stór", it: "Grande", ja: "大盛り", ko: "라지",
    lt: "Didelė", lv: "Liela", nl: "Groot", no: "Stor",
    pl: "Duża", pt: "Grande", ro: "Mare", ru: "Большая",
    sk: "Veľké", sl: "Velika", sr: "Велика", sv: "Stor",
    tr: "Büyük", uk: "Велика", zh: "大份",
  },
  noPancetta: {
    en: "No pancetta", es: "Sin panceta", ar: "بدون بانشيتا", bg: "Без панчета",
    ca: "Sense pancetta", cs: "Bez pancetty", da: "Uden pancetta", de: "Ohne Pancetta",
    el: "Χωρίς πανσέτα", et: "Pancetta'ta", fa: "بدون پانچتا", fi: "Ilman pancettaa",
    fr: "Sans pancetta", ga: "Gan pancetta", hr: "Bez panchete", hu: "Pancetta nélkül",
    is: "Án pancetta", it: "Senza pancetta", ja: "パンチェッタ抜き", ko: "판체타 빼기",
    lt: "Be pančetos", lv: "Bez pančetas", nl: "Zonder pancetta", no: "Uten pancetta",
    pl: "Bez pancetty", pt: "Sem panceta", ro: "Fără pancetta", ru: "Без панчетты",
    sk: "Bez pancetty", sl: "Brez pancete", sr: "Без панчете", sv: "Utan pancetta",
    tr: "Pancetta yok", uk: "Без панчети", zh: "不要培根",
  },
  doubleShot: {
    en: "Double", es: "Doble", ar: "مزدوج", bg: "Двойно",
    ca: "Doble", cs: "Dvojité", da: "Dobbelt", de: "Doppelt",
    el: "Διπλό", et: "Topelt", fa: "دوبل", fi: "Tupla",
    fr: "Double", ga: "Dúbailte", hr: "Dvostruki", hu: "Dupla",
    is: "Tvöfaldur", it: "Doppio", ja: "ダブル", ko: "더블",
    lt: "Dvigubas", lv: "Dubults", nl: "Dubbel", no: "Dobbel",
    pl: "Podwójne", pt: "Duplo", ro: "Dublu", ru: "Двойной",
    sk: "Dvojité", sl: "Dvojni", sr: "Дупли", sv: "Dubbel",
    tr: "Duble", uk: "Подвійний", zh: "双份",
  },
} satisfies Record<string, Ml>;

// optionName isn't rendered on the card (only variantName is), but the type
// requires it — keep it light (en/es).
const OPTION_GROUP = {
  cooking: { en: "Cooking", es: "Punto" },
  extras: { en: "Extras", es: "Extras" },
  base: { en: "Base", es: "Base" },
  size: { en: "Size", es: "Tamaño" },
} satisfies Record<string, Ml>;

function opt(group: Ml, variant: Ml, quantity?: number): OrderItemOptionSnapshot {
  return { optionName: group, variantName: variant, priceDelta: "0", ...(quantity ? { quantity } : {}) };
}

let seq = 0;
function item(
  dishId: string,
  name: Ml,
  price: string,
  status: OrderItemStatus,
  ageMin: number,
  options: OrderItemOptionSnapshot[] = [],
): OrderItem {
  seq += 1;
  return {
    id: `demo-item-${seq}`,
    dishId,
    dishNameSnapshot: name,
    basePriceSnapshot: price,
    options,
    notes: "",
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
      name: CATEGORY_NAMES.starters,
      sortOrder: 0,
      isGroup: false,
      parentId: null,
      dishes: [
        dish(DISHES.bruschetta, NAMES.bruschetta, "demo-cat-starters", 0),
        dish(DISHES.caesar, NAMES.caesar, "demo-cat-starters", 1),
      ],
    },
    {
      id: "demo-cat-mains",
      name: CATEGORY_NAMES.mains,
      sortOrder: 1,
      isGroup: false,
      parentId: null,
      dishes: [
        dish(DISHES.margherita, NAMES.margherita, "demo-cat-mains", 0),
        dish(DISHES.carbonara, NAMES.carbonara, "demo-cat-mains", 1),
        dish(DISHES.burger, NAMES.burger, "demo-cat-mains", 2),
        dish(DISHES.fries, NAMES.fries, "demo-cat-mains", 3),
      ],
    },
    {
      id: "demo-cat-desserts",
      name: CATEGORY_NAMES.desserts,
      sortOrder: 2,
      isGroup: false,
      parentId: null,
      dishes: [
        dish(DISHES.tiramisu, NAMES.tiramisu, "demo-cat-desserts", 0),
        dish(DISHES.espresso, NAMES.espresso, "demo-cat-desserts", 1),
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
    order("demo-order-1", "demo-table-1", 1, 1, 11, [
      item(DISHES.bruschetta, NAMES.bruschetta, "7.50", "ready", 11),
      item(DISHES.margherita, NAMES.margherita, "12.00", "cooking", 11, [
        opt(OPTION_GROUP.base, VARIANTS.thinCrust),
        opt(OPTION_GROUP.extras, VARIANTS.extraCheese),
      ]),
      item(DISHES.carbonara, NAMES.carbonara, "13.50", "cooking", 11, [
        opt(OPTION_GROUP.extras, VARIANTS.noPancetta),
      ]),
    ]),
    order("demo-order-2", "demo-table-3", 3, 2, 6, [
      item(DISHES.burger, NAMES.burger, "11.00", "cooking", 6, [
        opt(OPTION_GROUP.cooking, VARIANTS.mediumRare),
        opt(OPTION_GROUP.extras, VARIANTS.extraCheese),
      ]),
      item(DISHES.fries, NAMES.fries, "4.50", "pending", 6, [
        opt(OPTION_GROUP.size, VARIANTS.large),
      ]),
      item(DISHES.caesar, NAMES.caesar, "8.50", "ready", 6, [
        opt(OPTION_GROUP.extras, VARIANTS.addChicken),
      ]),
    ]),
    order("demo-order-3", "demo-table-5", 5, 3, 3, [
      item(DISHES.margherita, NAMES.margherita, "12.00", "pending", 3),
      item(DISHES.margherita, NAMES.margherita, "12.00", "pending", 3, [
        opt(OPTION_GROUP.extras, VARIANTS.extraCheese),
      ]),
    ]),
    order("demo-order-4", "demo-table-8", 8, 4, 1, [
      item(DISHES.tiramisu, NAMES.tiramisu, "6.00", "pending", 1),
      item(DISHES.espresso, NAMES.espresso, "2.50", "pending", 1, [
        opt(OPTION_GROUP.size, VARIANTS.doubleShot, 2),
      ]),
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

function dish(id: string, name: Ml, categoryId: string, sortOrder: number) {
  return {
    id,
    name,
    description: { en: "" },
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

// x/y are percentages on the floor map (left/top). The demo spreads the four
// tables across the canvas instead of letting them stack at the default 50/50.
const TABLE_POS: Record<number, { x: number; y: number }> = {
  1: { x: 26, y: 30 },
  3: { x: 72, y: 28 },
  5: { x: 28, y: 72 },
  8: { x: 74, y: 70 },
};

function table(number: number, id: string): TableEntity {
  const pos = TABLE_POS[number] ?? { x: 50, y: 50 };
  return {
    id,
    number,
    name: `Table ${number}`,
    description: "",
    capacity: 4,
    x: pos.x,
    y: pos.y,
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
  ageMin: number,
  items: OrderItem[],
): Order {
  return {
    id,
    tableId,
    tableNumber,
    dailyNumber,
    guestName: "Guest",
    createdAt: minsAgo(ageMin),
    status: "active",
    items,
    total: items.reduce((s, it) => s + Number(it.basePriceSnapshot), 0),
  };
}

// Dish names follow the multilingual maps above; UI chrome follows `lang`.
// defaultLang is set to the requested language so the menu builder and ml()
// lookups resolve to that locale (falling back to the English entry).
function buildDemoRestaurant(lang: string): Restaurant {
  return {
    id: "demo-restaurant",
    name: "Love Eatery",
    subtitle: "",
    showTitleOnHomepage: false,
    menuLayout: "flat",
    titleScale: "large",
    languageSwitcher: "inline",
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

// --- reservations demo ------------------------------------------------------
// Public, no-auth reservations-board demo (?demo=reservations). Mirrors the
// shape ReservationsPage consumes: a restaurant with booking enabled + a
// week schedule, the same tables, and a spread of bookings. Accept/reject
// runs on local optimistic state only (ReservationsPage `demoMode`), so a
// reload resets the board.

// Open 10:00–23:00 every day so the day-view grid has a realistic range and
// no day is striped as closed.
const DEMO_SCHEDULE: ReservationSchedule = Array.from({ length: 7 }, () => ({
  closed: false,
  from: "10:00",
  to: "23:00",
  lunchFrom: null,
  lunchTo: null,
}));

// Guest names stay in the Latin alphabet — Booking.guestName is a plain
// string (not Ml), and these read naturally across every locale.
const GUESTS = [
  "Marco Rossi", "Sofia Garcia", "Liam O'Brien", "Emma Müller", "Noah Dubois",
  "Olivia Silva", "Lucas Bianchi", "Mia Fernández", "Hugo Martin", "Chloé Laurent",
] as const;

// Date today (or dayOffset days away) at HH:MM, local time → ISO.
function dayAt(hour: number, min: number, dayOffset: number): string {
  const d = new Date();
  d.setDate(d.getDate() + dayOffset);
  d.setHours(hour, min, 0, 0);
  return d.toISOString();
}

let bookingSeq = 0;
function booking(
  guest: string,
  datetime: string,
  guests: number,
  tableId: string | null,
  status: Booking["status"],
): Booking {
  bookingSeq += 1;
  return {
    id: `demo-booking-${bookingSeq}`,
    guestName: guest,
    guestEmail: `${guest.split(" ")[0]?.toLowerCase()}@example.com`,
    guestPhone: null,
    datetime,
    duration: 90,
    guests,
    tableId,
    status,
    notes: "",
  };
}

export function buildReservationsDemoSnapshot(lang: string): ReservationsDemoSnapshot {
  bookingSeq = 0;

  const tables: TableEntity[] = [
    table(1, "demo-table-1"),
    table(3, "demo-table-3"),
    table(5, "demo-table-5"),
    table(8, "demo-table-8"),
  ];

  const bookings: Booking[] = [
    // Today — a mix of pending (needs accept/reject) and already confirmed,
    // spread across lunch and dinner so both the day grid and the pending
    // list have content.
    booking(GUESTS[0], dayAt(13, 0, 0), 2, "demo-table-1", "confirmed"),
    booking(GUESTS[1], dayAt(13, 30, 0), 4, "demo-table-5", "pending"),
    booking(GUESTS[2], dayAt(14, 0, 0), 3, "demo-table-3", "confirmed"),
    booking(GUESTS[3], dayAt(19, 0, 0), 2, "demo-table-1", "pending"),
    booking(GUESTS[4], dayAt(19, 30, 0), 6, "demo-table-8", "confirmed"),
    booking(GUESTS[5], dayAt(20, 0, 0), 4, "demo-table-5", "pending"),
    booking(GUESTS[6], dayAt(21, 0, 0), 2, "demo-table-3", "confirmed"),
    // Other days this month → dots on the month calendar.
    booking(GUESTS[7], dayAt(20, 0, 2), 4, "demo-table-5", "confirmed"),
    booking(GUESTS[8], dayAt(13, 0, 3), 2, "demo-table-1", "pending"),
    booking(GUESTS[9], dayAt(19, 30, 5), 5, "demo-table-8", "confirmed"),
    booking(GUESTS[0], dayAt(21, 0, -2), 2, "demo-table-3", "completed"),
  ];

  const restaurant: Restaurant = {
    ...buildDemoRestaurant(lang),
    bookingSettings: {
      enabled: true,
      approval: "manual",
      duration: 90,
      schedule: DEMO_SCHEDULE,
      timezone: "UTC",
    },
  };

  return { restaurant, tables, bookings };
}
