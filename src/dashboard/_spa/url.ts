import type { View } from "./types";

// Bidirectional codec View ↔ URL path (without locale prefix).
//
// Keep paths stable across releases — they are bookmarkable.
// Any new View variant must add a case in BOTH functions.

export function viewToPath(view: View): string {
  switch (view.name) {
    case "auth.login":
      return "/dashboard/login";
    case "auth.otp":
      return "/dashboard/otp";
    case "auth.logout":
      return "/dashboard/logout";
    case "menu":
      return "/dashboard";
    case "orders":
      return "/dashboard/orders";
    case "orders.detail":
      return `/dashboard/orders/${view.orderId}`;
    case "reservations":
      return "/dashboard/reservations";
    case "kitchen":
      return "/dashboard/kitchen";
    case "analytics":
      return "/dashboard/analytics";
    case "settings":
      return "/dashboard/settings";
    case "settings.about":
      return "/dashboard/settings/about";
    case "settings.contacts":
      return "/dashboard/settings/contacts";
    case "settings.branding":
      return "/dashboard/settings/branding";
    case "settings.general":
      return "/dashboard/settings/general";
    case "settings.tables":
      return "/dashboard/settings/tables";
    case "settings.tables.new":
      return "/dashboard/settings/tables/new";
    case "settings.tables.edit":
      return `/dashboard/settings/tables/${view.id}/edit`;
    case "settings.orders":
      return "/dashboard/settings/orders";
    case "settings.bookings":
      return "/dashboard/settings/bookings";
    case "settings.languages":
      return "/dashboard/settings/languages";
    case "settings.billing":
      return "/dashboard/settings/billing";
    case "settings.support":
      return "/dashboard/settings/support";
    case "settings.admin.companies":
      return "/dashboard/settings/admin/companies";
    case "settings.admin.company":
      return `/dashboard/settings/admin/companies/${view.id}`;
    case "settings.admin.sessions":
      return view.period ? `/dashboard/sessions?period=${view.period}` : "/dashboard/sessions";
    case "settings.admin.session":
      return `/dashboard/sessions/${view.sessionId}`;
    case "settings.admin.pulse":
      return "/dashboard/settings/admin/pulse";
    case "settings.admin.usage":
      return "/dashboard/settings/admin/usage";
    case "category.new":
      return "/dashboard/categories/new";
    case "category.edit":
      return `/dashboard/categories/${view.id}/edit`;
    case "item.new":
      return view.categoryId ? `/dashboard/items/new?cat=${view.categoryId}` : "/dashboard/items/new";
    case "item.edit":
      return `/dashboard/items/${view.id}/edit`;
    case "option.new":
      return `/dashboard/items/${view.itemId}/options/new`;
    case "option.edit":
      return `/dashboard/items/${view.itemId}/options/${view.optionId}/edit`;
  }
}

const LOCALE_RE = /^\/[a-z]{2}(\/|$)/;

export function pathToView(path: string): View {
  // Strip leading locale: "/en/dashboard/foo" → "/dashboard/foo"
  const noLocale = path.replace(LOCALE_RE, "/");
  // Drop query
  const [pathOnly, query = ""] = noLocale.split("?", 2);
  const params = new URLSearchParams(query);

  const stripped = pathOnly.replace(/\/$/, ""); // remove trailing slash

  if (stripped === "/dashboard/login" || stripped === "/login") return { name: "auth.login" };
  if (stripped === "/dashboard/otp" || stripped === "/otp") return { name: "auth.otp" };
  if (stripped === "/dashboard/logout" || stripped === "/logout") return { name: "auth.logout" };
  if (stripped === "" || stripped === "/dashboard") return { name: "menu" };

  // Settings family
  if (stripped === "/dashboard/settings") return { name: "settings" };
  if (stripped === "/dashboard/settings/about") return { name: "settings.about" };
  if (stripped === "/dashboard/settings/contacts") return { name: "settings.contacts" };
  if (stripped === "/dashboard/settings/branding") return { name: "settings.branding" };
  if (stripped === "/dashboard/settings/general") return { name: "settings.general" };
  if (stripped === "/dashboard/settings/tables") return { name: "settings.tables" };
  if (stripped === "/dashboard/settings/tables/new") return { name: "settings.tables.new" };
  const tableEdit = stripped.match(/^\/dashboard\/settings\/tables\/([^/]+)\/edit$/);
  if (tableEdit) return { name: "settings.tables.edit", id: tableEdit[1] };
  if (stripped === "/dashboard/settings/orders") return { name: "settings.orders" };
  if (stripped === "/dashboard/settings/bookings") return { name: "settings.bookings" };
  if (stripped === "/dashboard/settings/languages") return { name: "settings.languages" };
  if (stripped === "/dashboard/settings/billing") return { name: "settings.billing" };
  if (stripped === "/dashboard/settings/support") return { name: "settings.support" };
  if (stripped === "/dashboard/settings/admin/companies")
    return { name: "settings.admin.companies" };
  const companyMatch = stripped.match(/^\/dashboard\/settings\/admin\/companies\/([^/]+)$/);
  if (companyMatch) return { name: "settings.admin.company", id: companyMatch[1] };

  // Sessions admin (both /dashboard/sessions and /dashboard/settings/admin/sessions paths point at the same view)
  if (stripped === "/dashboard/sessions" || stripped === "/dashboard/settings/admin/sessions") {
    const p = params.get("period");
    const period = p === "yesterday" || p === "today" ? p : undefined;
    return { name: "settings.admin.sessions", ...(period ? { period } : {}) };
  }
  const sessionMatch = stripped.match(/^\/dashboard\/(?:settings\/admin\/)?sessions\/([^/]+)$/);
  if (sessionMatch) return { name: "settings.admin.session", sessionId: sessionMatch[1] };
  if (stripped === "/dashboard/settings/admin/pulse") return { name: "settings.admin.pulse" };
  if (stripped === "/dashboard/settings/admin/usage") return { name: "settings.admin.usage" };

  // Top-level tabs
  if (stripped === "/dashboard/orders") return { name: "orders" };
  const orderMatch = stripped.match(/^\/dashboard\/orders\/([^/]+)$/);
  if (orderMatch) return { name: "orders.detail", orderId: orderMatch[1] };
  if (stripped === "/dashboard/reservations") return { name: "reservations" };
  if (stripped === "/dashboard/kitchen") return { name: "kitchen" };
  if (stripped === "/dashboard/analytics") return { name: "analytics" };

  // Categories
  if (stripped === "/dashboard/categories/new") return { name: "category.new" };
  const catEdit = stripped.match(/^\/dashboard\/categories\/([^/]+)\/edit$/);
  if (catEdit) return { name: "category.edit", id: catEdit[1] };

  // Items
  if (stripped === "/dashboard/items/new")
    return { name: "item.new", categoryId: params.get("cat") || undefined };
  const itemEdit = stripped.match(/^\/dashboard\/items\/([^/]+)\/edit$/);
  if (itemEdit) return { name: "item.edit", id: itemEdit[1] };

  // Options
  const optionNew = stripped.match(/^\/dashboard\/items\/([^/]+)\/options\/new$/);
  if (optionNew) return { name: "option.new", itemId: optionNew[1] };
  const optionEdit = stripped.match(
    /^\/dashboard\/items\/([^/]+)\/options\/([^/]+)\/edit$/,
  );
  if (optionEdit) return { name: "option.edit", itemId: optionEdit[1], optionId: optionEdit[2] };

  // Fallback
  return { name: "menu" };
}
