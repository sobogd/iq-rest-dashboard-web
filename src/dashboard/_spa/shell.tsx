"use client";

import { useCallback, useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useDashboardRouter } from "./router";
import type { View } from "./types";

import { MenuList } from "../_v2/menu-list";
import { OrdersPage, KitchenPage } from "../_v2/orders";
import { ReservationsPage } from "../_v2/reservations";
import { TablesPage, TableFormPage } from "../_v2/tables";
import { CategoryForm, DishForm, OptionForm } from "../_v2/forms";
import { useRestaurant, useRestaurantOrNull } from "../_v2/restaurant-context";
import { fetchCategories, fetchItems } from "../_v2/api";
import { buildCategories } from "../_v2/mappers";
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
import { UsagePage } from "../_pages/usage";
import { GoogleAdsPage } from "../_pages/google-ads";
import { AuthPage } from "../../auth/auth-page";

import type { Booking, Category, Dish, DishOption, Order, Restaurant, Restaurant as UIRestaurant, TableEntity } from "../_v2/types";

export interface ShellInitialData {
  initialCategories: Category[];
  initialOrders: Order[];
  initialBookings: Booking[];
  initialTables: TableEntity[];
  initialSub: { plan: string | null; subscriptionStatus: string | null; trialEndsAt: string | null } | null;
  isAdmin: boolean;
  impersonatedBy?: string | null;
  userEmail?: string;
  scanBannerDismissed?: boolean;
}

export function Shell(props: ShellInitialData) {
  return <ShellBody {...props} />;
}

function ShellBody(props: ShellInitialData) {
  const router = useDashboardRouter();
  const { view } = router;
  const restaurant = useRestaurantOrNull();
  const isAuthView = view.name.startsWith("auth.");

  const backToSettings = useCallback(() => router.push({ name: "settings" }), [router]);
  const backToMenu = useCallback(() => router.resetTo({ name: "menu" }), [router]);

  // Persistent stateful data — survives navigation between views.
  const [categories, setCategories] = useState<Category[]>(props.initialCategories);
  const [orders, setOrders] = useState<Order[]>(props.initialOrders);
  const [bookings, setBookings] = useState<Booking[]>(props.initialBookings);
  const [tables, setTables] = useState<TableEntity[]>(props.initialTables);

  // Sync polled data from TanStack Query (dashboard-host refetchInterval: 30s).
  // Merge keeps locally-created records not yet returned by the server.
  useEffect(() => {
    setOrders((prev) => {
      const serverIds = new Set(props.initialOrders.map((o) => o.id));
      const localOnly = prev.filter((o) => !serverIds.has(o.id));
      return [...props.initialOrders, ...localOnly];
    });
  }, [props.initialOrders]);

  useEffect(() => {
    setBookings((prev) => {
      const serverIds = new Set(props.initialBookings.map((b) => b.id));
      const localOnly = prev.filter((b) => !serverIds.has(b.id));
      return [...props.initialBookings, ...localOnly];
    });
  }, [props.initialBookings]);

  const defaultLang = restaurant?.defaultLang || "en";
  const refreshMenu = useCallback(async () => {
    try {
      const [cats, its] = await Promise.all([fetchCategories(), fetchItems()]);
      const items = ((its as unknown) as (Omit<ApiItem, "price"> & { price: number | string })[]).map(
        (it) => ({ ...it, price: Number(it.price) }) as ApiItem,
      );
      const built = buildCategories(cats as unknown as ApiCategory[], items, defaultLang);
      setCategories(built);
    } catch {
      // ignore
    }
  }, [defaultLang]);

  // Orders + reservations are polled by TanStack queries in dashboard-host.
  // Local setInterval was duplicating that polling — removed.

  if (isAuthView) {
    return <AuthPage />;
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
      impersonatedBy={props.impersonatedBy ?? null}
      scanBannerDismissed={!!props.scanBannerDismissed}
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
  impersonatedBy: string | null;
  scanBannerDismissed: boolean;
  backToSettings: () => void;
  backToMenu: () => void;
  refreshMenu: () => Promise<void>;
}

function ViewSwitch(p: SwitchProps) {
  const { view, restaurant, categories, orders, setOrders, bookings, setBookings, tables, setTables, sub, isAdmin, impersonatedBy, scanBannerDismissed, backToSettings, backToMenu, refreshMenu } = p;
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
    case "menu":
      return (
        <MenuList
          initialCategories={categories}
          initialSub={sub}
          onPersisted={refreshMenu}
          scanBannerDismissed={scanBannerDismissed}
        />
      );
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
      return <ReservationsPage restaurant={restaurant} bookings={bookings} setBookings={setBookings} tables={tables} />;
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
      return <SettingsHubView isAdmin={isAdmin} impersonatedBy={impersonatedBy} />;
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
    case "settings.tables.new":
      return (
        <TableFormPage
          mode="new"
          tables={tables}
          setTables={setTables}
          orders={orders}
          bookings={bookings}
          menuUrl={restaurant.menuUrl}
          onBack={() => router.push({ name: "settings.tables" })}
        />
      );
    case "settings.tables.edit":
      return (
        <TableFormPage
          mode="edit"
          tableId={view.id}
          tables={tables}
          setTables={setTables}
          orders={orders}
          bookings={bookings}
          menuUrl={restaurant.menuUrl}
          onBack={() => router.push({ name: "settings.tables" })}
        />
      );
    case "settings.orders":
      return <SettingsOrdersWrapper onBack={backToSettings} />;
    case "settings.bookings":
      return <SettingsBookingsWrapper onBack={backToSettings} />;
    case "settings.languages":
      return <SettingsLanguagesWrapper onBack={backToSettings} />;
    case "settings.billing":
      return <SettingsBillingWrapper onBack={view.from === "menu" ? backToMenu : backToSettings} />;
    case "settings.support":
      return <SettingsSupportWrapper onBack={backToSettings} />;

    case "settings.admin.companies":
      return <AdminPage />;
    case "settings.admin.company":
      return <AdminCompanyPage companyId={view.id} />;
    case "settings.admin.usage":
      return <UsagePage />;
    case "settings.admin.googleAds":
      return <GoogleAdsPage />;

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
          onPersisted={(id) => router.push({ name: "item.edit", id })}
          onOptionsRefresh={refreshMenu}
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
          onOptionsRefresh={refreshMenu}
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

interface BackProp { onBack: () => void }

/** Wraps Restaurant draft state and invalidates ["restaurant"] cache on every
 *  setRestaurant call so Shell's RestaurantProvider re-renders with fresh
 *  server data after any settings save. */
function useRestaurantDraft(): [UIRestaurant, React.Dispatch<React.SetStateAction<UIRestaurant>>] {
  const restaurant = useRestaurant();
  const qc = useQueryClient();
  const [r, setR] = useState<UIRestaurant>(restaurant);
  const setAndInvalidate: React.Dispatch<React.SetStateAction<UIRestaurant>> = (updater) => {
    setR(updater);
    void qc.invalidateQueries({ queryKey: ["restaurant"] });
  };
  return [r, setAndInvalidate];
}

function SettingsAboutWrapper({ onBack }: BackProp) {
  const [r, setR] = useRestaurantDraft();
  return <AboutSettingsPage restaurant={r} setRestaurant={setR} onBack={onBack} />;
}
function SettingsContactsWrapper({ onBack }: BackProp) {
  const [r, setR] = useRestaurantDraft();
  return <ContactsSettingsPage restaurant={r} setRestaurant={setR} onBack={onBack} />;
}
function SettingsBrandingWrapper({ onBack }: BackProp) {
  const [r, setR] = useRestaurantDraft();
  return <BrandingSettingsPage restaurant={r} setRestaurant={setR} onBack={onBack} />;
}
function SettingsGeneralWrapper({ onBack }: BackProp) {
  const [r, setR] = useRestaurantDraft();
  return <GeneralSettingsPage restaurant={r} setRestaurant={setR} onBack={onBack} />;
}
function SettingsOrdersWrapper({ onBack }: BackProp) {
  const [r, setR] = useRestaurantDraft();
  return <OrderSettingsPage restaurant={r} setRestaurant={setR} onBack={onBack} />;
}
function SettingsBookingsWrapper({ onBack }: BackProp) {
  const [r, setR] = useRestaurantDraft();
  return <BookingSettingsPage restaurant={r} setRestaurant={setR} onBack={onBack} />;
}
function SettingsLanguagesWrapper({ onBack }: BackProp) {
  const [r, setR] = useRestaurantDraft();
  return <LanguagesSettingsPage restaurant={r} setRestaurant={setR} onBack={onBack} />;
}
function SettingsBillingWrapper({ onBack }: BackProp) {
  return <BillingSettingsPage onBack={onBack} />;
}
function SettingsSupportWrapper({ onBack }: BackProp) {
  return <SupportPage onBack={onBack} />;
}
