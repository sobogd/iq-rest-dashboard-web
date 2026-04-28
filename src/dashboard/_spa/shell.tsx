"use client";

import { useCallback, useEffect, useState } from "react";
import { useDashboardRouter } from "./router";
import type { View } from "./types";

import { MenuList } from "../_v2/menu-list";
import { OrdersPage, KitchenPage } from "../_v2/orders";
import { ReservationsPage } from "../_v2/reservations";
import { TablesPage } from "../_v2/tables";
import { CategoryForm, DishForm, OptionForm } from "../_v2/forms";
import { useRestaurant, useRestaurantOrNull } from "../_v2/restaurant-context";
import { fetchCategories, fetchItems, fetchOrders, fetchReservations } from "../_v2/api";
import {
  apiOrderToOrder,
  apiReservationToBooking,
  buildCategories,
} from "../_v2/mappers";
import { getMlWithFallback } from "../_v2/i18n";
import type { ApiCategory, ApiItem } from "../_v2/api";
import {
  AboutSettingsPage,
  ContactsSettingsPage,
  BrandingSettingsPage,
  GeneralSettingsPage,
  OrderSettingsPage,
  BookingSettingsPage,
  LanguagesSettingsPage,
  BillingSettingsPage,
  SupportPage,
} from "../_v2/settings";
import { AnalyticsClient } from "../analytics/analytics-client";
import { SettingsHubView } from "./views/settings-hub";
import { AdminPage } from "../_pages/admin";
import { AdminCompanyPage } from "../_pages/admin-company";
import { SessionsPage } from "../_pages/sessions";
import { SessionDetailPage } from "../_pages/session-detail";
import { AuthPage } from "../../auth/auth-page";
import { OnboardingClient } from "../../onboarding/onboarding-client";

import type { Booking, Category, Dish, DishOption, Order, Restaurant, TableEntity } from "../_v2/types";

export interface ShellInitialData {
  initialCategories: Category[];
  initialOrders: Order[];
  initialBookings: Booking[];
  initialTables: TableEntity[];
  initialSub: { plan: string | null; subscriptionStatus: string | null; trialEndsAt: string | null } | null;
  isAdmin: boolean;
}

export function Shell(props: ShellInitialData) {
  return <ShellBody {...props} />;
}

function ShellBody(props: ShellInitialData) {
  const router = useDashboardRouter();
  const { view } = router;
  const restaurant = useRestaurantOrNull();
  const isAuthView = view.name.startsWith("auth.") || view.name === "onboarding";

  const backToSettings = useCallback(() => router.push({ name: "settings" }), [router]);
  const backToMenu = useCallback(() => router.resetTo({ name: "menu" }), [router]);

  // Persistent stateful data — survives navigation between views.
  const [categories, setCategories] = useState<Category[]>(props.initialCategories);
  const [orders, setOrders] = useState<Order[]>(props.initialOrders);
  const [bookings, setBookings] = useState<Booking[]>(props.initialBookings);
  const [tables, setTables] = useState<TableEntity[]>(props.initialTables);

  const defaultLang = restaurant?.defaultLang || "en";
  const refreshMenu = useCallback(async () => {
    try {
      const [cats, its] = await Promise.all([fetchCategories(), fetchItems()]);
      const built = buildCategories(cats as unknown as ApiCategory[], its as unknown as ApiItem[], defaultLang);
      setCategories(built);
    } catch {
      // ignore
    }
  }, [defaultLang]);

  // Live polling — orders + reservations refresh every 30s.
  useEffect(() => {
    const id = setInterval(async () => {
      try {
        const tableMap = new Map(tables.map((t) => [t.number, t.id]));
        const [os, rs] = await Promise.all([fetchOrders(), fetchReservations()]);
        setOrders(os.map((o) => apiOrderToOrder(o, tableMap)));
        setBookings(rs.map(apiReservationToBooking));
      } catch {
        // ignore transient failures
      }
    }, 30000);
    return () => clearInterval(id);
  }, [tables]);

  if (isAuthView) {
    return view.name === "onboarding" ? <OnboardingClient /> : <AuthPage />;
  }
  if (!restaurant) return null;

  return (
    <ViewSwitch
      view={view}
      restaurant={restaurant}
      categories={categories}
      orders={orders}
      setOrders={setOrders}
      bookings={bookings}
      setBookings={setBookings}
      tables={tables}
      setTables={setTables}
      sub={props.initialSub}
      isAdmin={props.isAdmin}
      backToSettings={backToSettings}
      backToMenu={backToMenu}
      refreshMenu={refreshMenu}
    />
  );
}

interface SwitchProps {
  view: View;
  restaurant: Restaurant;
  categories: Category[];
  orders: Order[];
  setOrders: React.Dispatch<React.SetStateAction<Order[]>>;
  bookings: Booking[];
  setBookings: React.Dispatch<React.SetStateAction<Booking[]>>;
  tables: TableEntity[];
  setTables: React.Dispatch<React.SetStateAction<TableEntity[]>>;
  sub: ShellInitialData["initialSub"];
  isAdmin: boolean;
  backToSettings: () => void;
  backToMenu: () => void;
  refreshMenu: () => Promise<void>;
}

function ViewSwitch(p: SwitchProps) {
  const { view, restaurant, categories, orders, setOrders, bookings, setBookings, tables, setTables, sub, isAdmin, backToSettings, backToMenu, refreshMenu } = p;
  const router = useDashboardRouter();

  const onSavedMenu = async () => {
    await refreshMenu();
    backToMenu();
  };

  switch (view.name) {
    case "auth.login":
    case "auth.otp":
    case "auth.logout":
      return <AuthPage />;
    case "onboarding":
      return <OnboardingClient />;
    case "menu":
      return <MenuList initialCategories={categories} initialSub={sub} />;
    case "orders":
    case "orders.detail":
    case "orders.addItem" as never: // legacy; orders page handles its own internal nav
      return (
        <OrdersPage
          orders={orders}
          setOrders={setOrders}
          tables={tables}
          categories={categories}
          defaultLang={restaurant.defaultLang}
          currency={restaurant.currency}
        />
      );
    case "reservations":
      return <ReservationsPage bookings={bookings} setBookings={setBookings} tables={tables} />;
    case "kitchen":
      return (
        <KitchenPage
          orders={orders}
          setOrders={setOrders}
          tables={tables}
          categories={categories}
          defaultLang={restaurant.defaultLang}
        />
      );
    case "analytics":
      return <AnalyticsClient />;

    case "settings":
      return <SettingsHubView isAdmin={isAdmin} />;
    case "settings.about":
      return <SettingsAboutWrapper onBack={backToSettings} />;
    case "settings.contacts":
      return <SettingsContactsWrapper onBack={backToSettings} />;
    case "settings.branding":
      return <SettingsBrandingWrapper onBack={backToSettings} />;
    case "settings.general":
      return <SettingsGeneralWrapper onBack={backToSettings} />;
    case "settings.tables":
      return (
        <TablesPage
          tables={tables}
          setTables={setTables}
          orders={orders}
          bookings={bookings}
          menuUrl={restaurant.menuUrl}
          onBack={backToSettings}
        />
      );
    case "settings.orders":
      return <SettingsOrdersWrapper onBack={backToSettings} />;
    case "settings.bookings":
      return <SettingsBookingsWrapper onBack={backToSettings} />;
    case "settings.languages":
      return <SettingsLanguagesWrapper onBack={backToSettings} />;
    case "settings.billing":
      return <SettingsBillingWrapper onBack={backToSettings} />;
    case "settings.support":
      return <SettingsSupportWrapper onBack={backToSettings} />;

    case "settings.admin.companies":
      return <AdminPage />;
    case "settings.admin.company":
      return <AdminCompanyPage companyId={view.id} />;
    case "settings.admin.sessions":
      return <SessionsPage />;
    case "settings.admin.session":
      return <SessionDetailPage sessionId={view.sessionId} />;

    case "category.new":
      return (
        <CategoryForm
          category={null}
          onBack={backToMenu}
          onSavedRedirect={onSavedMenu}
          onDeletedRedirect={onSavedMenu}
        />
      );
    case "category.edit": {
      const cat = categories.find((c) => c.id === view.id);
      if (!cat) return <NotMigrated label="Category not found" />;
      return (
        <CategoryForm
          category={cat}
          onBack={backToMenu}
          onSavedRedirect={onSavedMenu}
          onDeletedRedirect={onSavedMenu}
        />
      );
    }
    case "item.new": {
      const cat = categories.find((c) => c.id === view.categoryId);
      if (!cat || !view.categoryId) return <NotMigrated label="Category id required" />;
      const categoryName = getMlWithFallback(cat.name, restaurant.defaultLang, restaurant.defaultLang);
      return (
        <DishForm
          dish={null}
          categoryId={view.categoryId}
          categoryName={categoryName}
          onBack={backToMenu}
          onSavedRedirect={onSavedMenu}
          onDeletedRedirect={onSavedMenu}
          onOpenOption={(itemId, optionId) =>
            router.push(optionId ? { name: "option.edit", itemId, optionId } : { name: "option.new", itemId })
          }
        />
      );
    }
    case "item.edit": {
      let dish: Dish | undefined;
      let cat: Category | undefined;
      for (const c of categories) {
        const d = c.dishes.find((dd) => dd.id === view.id);
        if (d) {
          dish = d;
          cat = c;
          break;
        }
      }
      if (!dish || !cat) return <NotMigrated label="Dish not found" />;
      const categoryName = getMlWithFallback(cat.name, restaurant.defaultLang, restaurant.defaultLang);
      return (
        <DishForm
          dish={dish}
          categoryId={dish.categoryId}
          categoryName={categoryName}
          onBack={backToMenu}
          onSavedRedirect={onSavedMenu}
          onDeletedRedirect={onSavedMenu}
          onOpenOption={(itemId, optionId) =>
            router.push(optionId ? { name: "option.edit", itemId, optionId } : { name: "option.new", itemId })
          }
        />
      );
    }
    case "option.new":
    case "option.edit": {
      let dish: Dish | undefined;
      for (const c of categories) {
        const d = c.dishes.find((dd) => dd.id === view.itemId);
        if (d) {
          dish = d;
          break;
        }
      }
      if (!dish) return <NotMigrated label="Dish not found" />;
      const option = view.name === "option.edit" ? dish.options.find((o: DishOption) => o.id === view.optionId) : null;
      if (view.name === "option.edit" && !option) return <NotMigrated label="Option not found" />;
      const backToItem = () => {
        // We don't have the item.edit view stack; just go back.
        backToMenu();
      };
      const onSavedItem = async () => {
        await refreshMenu();
        backToItem();
      };
      return (
        <OptionForm
          dish={dish}
          option={option || null}
          onBack={backToItem}
          onSavedRedirect={onSavedItem}
          onDeletedRedirect={onSavedItem}
        />
      );
    }

    default: {
      const _exhaustive: never = view;
      return <NotMigrated label={`Unknown view: ${(_exhaustive as { name: string }).name}`} />;
    }
  }
}

function NotMigrated({ label }: { label: string }) {
  return (
    <div className="max-w-2xl mx-auto py-10 text-center text-sm text-muted-foreground">{label}</div>
  );
}

// ── Settings sub-view wrappers ──
// Each sub-page needs local restaurant draft state. onBack is supplied by Shell.

interface BackProp { onBack: () => void }

function SettingsAboutWrapper({ onBack }: BackProp) {
  const restaurant = useRestaurant();
  const [r, setR] = useState(restaurant);
  return <AboutSettingsPage restaurant={r} setRestaurant={setR} onBack={onBack} />;
}
function SettingsContactsWrapper({ onBack }: BackProp) {
  const restaurant = useRestaurant();
  const [r, setR] = useState(restaurant);
  return <ContactsSettingsPage restaurant={r} setRestaurant={setR} onBack={onBack} />;
}
function SettingsBrandingWrapper({ onBack }: BackProp) {
  const restaurant = useRestaurant();
  const [r, setR] = useState(restaurant);
  return <BrandingSettingsPage restaurant={r} setRestaurant={setR} onBack={onBack} />;
}
function SettingsGeneralWrapper({ onBack }: BackProp) {
  const restaurant = useRestaurant();
  const [r, setR] = useState(restaurant);
  return <GeneralSettingsPage restaurant={r} setRestaurant={setR} onBack={onBack} />;
}
function SettingsOrdersWrapper({ onBack }: BackProp) {
  const restaurant = useRestaurant();
  const [r, setR] = useState(restaurant);
  return <OrderSettingsPage restaurant={r} setRestaurant={setR} onBack={onBack} />;
}
function SettingsBookingsWrapper({ onBack }: BackProp) {
  const restaurant = useRestaurant();
  const [r, setR] = useState(restaurant);
  return <BookingSettingsPage restaurant={r} setRestaurant={setR} onBack={onBack} />;
}
function SettingsLanguagesWrapper({ onBack }: BackProp) {
  const restaurant = useRestaurant();
  const [r, setR] = useState(restaurant);
  return <LanguagesSettingsPage restaurant={r} setRestaurant={setR} onBack={onBack} />;
}
function SettingsBillingWrapper({ onBack }: BackProp) {
  return <BillingSettingsPage onBack={onBack} />;
}
function SettingsSupportWrapper({ onBack }: BackProp) {
  return <SupportPage onBack={onBack} />;
}
