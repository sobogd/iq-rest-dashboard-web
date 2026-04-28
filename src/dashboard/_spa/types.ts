// Single-page dashboard view registry. Every navigable destination is a View
// variant. Variants carry their own state (ids, drafts) so the back-stack can
// restore them faithfully.

export type View =
  | { name: "auth.login" }
  | { name: "auth.otp" }
  | { name: "auth.logout" }
  | { name: "onboarding" }
  | { name: "menu" }
  | { name: "orders" }
  | { name: "orders.detail"; orderId: string }
  | { name: "reservations" }
  | { name: "kitchen" }
  | { name: "analytics" }
  | { name: "settings" }
  | { name: "settings.about" }
  | { name: "settings.contacts" }
  | { name: "settings.branding" }
  | { name: "settings.general" }
  | { name: "settings.tables" }
  | { name: "settings.orders" }
  | { name: "settings.bookings" }
  | { name: "settings.languages" }
  | { name: "settings.billing" }
  | { name: "settings.support" }
  | { name: "settings.admin.companies" }
  | { name: "settings.admin.company"; id: string }
  | { name: "settings.admin.sessions" }
  | { name: "settings.admin.session"; sessionId: string }
  | { name: "category.new" }
  | { name: "category.edit"; id: string }
  | { name: "item.new"; categoryId?: string }
  | { name: "item.edit"; id: string }
  | { name: "option.new"; itemId: string }
  | { name: "option.edit"; itemId: string; optionId: string };

export type ViewName = View["name"];
