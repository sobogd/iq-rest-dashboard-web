// Single-page dashboard view registry. Every navigable destination is a View
// variant. Variants carry their own state (ids, drafts) so the back-stack can
// restore them faithfully.

export type View =
  | { name: "auth.login" }
  | { name: "auth.otp" }
  | { name: "auth.logout" }
  | { name: "menu"; group?: string }
  | { name: "orders" }
  | { name: "orders.detail"; orderId: string }
  | { name: "reservations" }
  | { name: "kitchen" }
  | { name: "analytics" }
  | { name: "settings" }
  | { name: "settings.contacts" }
  | { name: "settings.branding" }
  | { name: "settings.general" }
  | { name: "settings.tables" }
  | { name: "settings.tables.new" }
  | { name: "settings.tables.edit"; id: string }
  | { name: "settings.orders" }
  | { name: "settings.bookings" }
  | { name: "settings.languages" }
  | { name: "settings.billing"; from?: "menu" }
  | { name: "settings.support" }
  | { name: "settings.devices" }
  | { name: "settings.restaurants" }
  | { name: "settings.restaurants.new" }
  | { name: "settings.admin.restaurants" }
  | { name: "settings.admin.users" }
  | { name: "settings.admin.restaurant"; id: string }
  | { name: "settings.admin.usage" }
  | { name: "settings.admin.usageSession"; id: string }
  | { name: "settings.admin.capiSend"; fbclid: string; clickTs?: number }
  | { name: "settings.admin.messages" }
  | { name: "settings.admin.messageThread"; id: string }
  | { name: "category.new"; group?: string }
  | { name: "category.edit"; id: string }
  | { name: "group.new" }
  | { name: "group.edit"; id: string }
  | { name: "item.new"; categoryId?: string }
  | { name: "item.edit"; id: string }
  | { name: "option.new"; itemId: string }
  | { name: "option.edit"; itemId: string; optionId: string };

export type ViewName = View["name"];
