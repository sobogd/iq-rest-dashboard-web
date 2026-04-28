// Dashboard analytics events — flat enum, no meta params unless explicit.
// Naming: showed_* (page view), clicked_* (button), focused_* (input),
// changed_* (select), toggled_* (switch), error_* (failure path).

export enum DashboardEvent {
  // ── Auth ──
  SHOWED_LOGIN = "showed_login",
  FOCUSED_LOGIN_EMAIL = "focused_login_email",
  CLICKED_LOGIN_CONTINUE = "clicked_login_continue",
  AUTH_SIGNUP = "auth_signup",
  AUTH_GOOGLE_LOGIN = "auth_google_login",
  SHOWED_OTP = "showed_otp",
  FOCUSED_OTP_INPUT = "focused_otp_input",
  CLICKED_VERIFY_OTP = "clicked_verify_otp",
  CLICKED_CHANGE_EMAIL = "clicked_change_email",

  // ── Onboarding (claim) ──
  SHOWED_SAVE_MENU = "showed_save_menu",
  CLICKED_SAVE_MENU = "clicked_save_menu",
  FOCUSED_CLAIM_EMAIL = "focused_claim_email",
  CLICKED_CLAIM_SEND_CODE = "clicked_claim_send_code",
  CLAIM_CODE_SENT = "claim_code_sent",
  CLICKED_CLAIM_CHANGE_EMAIL = "clicked_claim_change_email",
  CLAIM_VERIFY_SUCCESS = "claim_verify_success",

  // ── Top nav (only routes that exist in _v2) ──
  CLICKED_NAV_MENU = "clicked_nav_menu",
  CLICKED_NAV_RESERVATIONS = "clicked_nav_reservations",
  CLICKED_NAV_ORDERS = "clicked_nav_orders",
  CLICKED_NAV_KITCHEN = "clicked_nav_kitchen",
  CLICKED_NAV_ANALYTICS = "clicked_nav_analytics",
  CLICKED_NAV_SETTINGS = "clicked_nav_settings",

  // ── Menu (list) ──
  SHOWED_MENU = "showed_menu",
  CLICKED_PREVIEW_MENU = "clicked_preview_menu",
  CLICKED_SHARE_MENU = "clicked_share_menu",
  CLICKED_EXPAND_ALL = "clicked_expand_all",
  CLICKED_COLLAPSE_ALL = "clicked_collapse_all",
  CLICKED_CATEGORY_ROW = "clicked_category_row",
  CLICKED_ITEM_ROW = "clicked_item_row",
  CLICKED_ADD_CATEGORY = "clicked_add_category",
  CLICKED_ADD_ITEM = "clicked_add_item",
  SORTED_CATEGORY = "sorted_category",
  SORTED_ITEM = "sorted_item",
  TOGGLED_ITEM_VISIBLE = "toggled_item_visible",
  CLICKED_SUBSCRIPTION_CHIP = "clicked_subscription_chip",

  // ── Category Form ──
  SHOWED_CATEGORY_FORM = "showed_category_form",
  CLICKED_SAVE_CATEGORY = "clicked_save_category",
  CLICKED_DELETE_CATEGORY = "clicked_delete_category",

  // ── Item (Dish) Form ──
  SHOWED_ITEM_FORM = "showed_item_form",
  CLICKED_SAVE_ITEM = "clicked_save_item",
  CLICKED_DELETE_ITEM = "clicked_delete_item",
  TOGGLED_ITEM_ACTIVE = "toggled_item_active",
  CLICKED_UPLOAD_ITEM_IMAGE = "clicked_upload_item_image",
  CLICKED_GENERATE_ITEM_IMAGE = "clicked_generate_item_image",
  CLICKED_STYLIZE_ITEM_IMAGE = "clicked_stylize_item_image",
  SHOWED_GENERATE_LIMIT_MODAL = "showed_generate_limit_modal",
  SHOWED_TRANSLATE_LIMIT_MODAL = "showed_translate_limit_modal",
  CLICKED_AI_TRANSLATE = "clicked_ai_translate",

  // ── Option Form ──
  SHOWED_OPTION_FORM = "showed_option_form",
  CLICKED_SAVE_OPTION = "clicked_save_option",
  CLICKED_DELETE_OPTION = "clicked_delete_option",
  CLICKED_ADD_VARIANT = "clicked_add_variant",
  CLICKED_REMOVE_VARIANT = "clicked_remove_variant",
  TOGGLED_OPTION_REQUIRED = "toggled_option_required",
  TOGGLED_OPTION_MULTI = "toggled_option_multi",

  // ── Tables (settings/tables) ──
  SHOWED_TABLES = "showed_tables",
  CLICKED_ADD_TABLE = "clicked_add_table",
  CLICKED_TABLE_ROW = "clicked_table_row",
  SORTED_TABLE = "sorted_table",
  SHOWED_TABLE_FORM = "showed_table_form",
  CLICKED_SAVE_TABLE = "clicked_save_table",
  CLICKED_DELETE_TABLE = "clicked_delete_table",

  // ── Reservations ──
  SHOWED_RESERVATIONS = "showed_reservations",
  CLICKED_CONFIRM_RESERVATION = "clicked_confirm_reservation",
  CLICKED_REJECT_RESERVATION = "clicked_reject_reservation",
  SHOWED_RESERVATION_SETTINGS = "showed_reservation_settings",
  TOGGLED_RESERVATIONS_ENABLED = "toggled_reservations_enabled",
  CHANGED_RESERVATION_MODE = "changed_reservation_mode",
  CLICKED_SAVE_RESERVATION_SETTINGS = "clicked_save_reservation_settings",

  // ── Orders ──
  SHOWED_ORDERS = "showed_orders",
  CLICKED_TABLE_SELECT = "clicked_table_select",
  CLICKED_START_ORDER = "clicked_start_order",
  CLICKED_OPEN_ORDER = "clicked_open_order",
  CLICKED_COMPLETE_ORDER = "clicked_complete_order",
  CLICKED_DELETE_ORDER = "clicked_delete_order",
  CLICKED_REMOVE_ORDER_ITEM = "clicked_remove_order_item",
  CHANGED_ORDER_ITEM_STATUS = "changed_order_item_status",
  CLICKED_ADD_ORDER_ITEM = "clicked_add_order_item",
  SHOWED_DISH_WIZARD = "showed_dish_wizard",
  CLICKED_PICK_REQUIRED_VARIANT = "clicked_pick_required_variant",
  CLICKED_REQUIRED_CONTINUE = "clicked_required_continue",
  CLICKED_ADD_TO_ORDER = "clicked_add_to_order",
  SHOWED_ORDER_SETTINGS = "showed_order_settings",
  CLICKED_SAVE_ORDER_SETTINGS = "clicked_save_order_settings",
  TOGGLED_ORDERS_ENABLED = "toggled_orders_enabled",
  CHANGED_ORDER_MODE = "changed_order_mode",

  // ── Kitchen ──
  SHOWED_KITCHEN = "showed_kitchen",
  CHANGED_KITCHEN_ITEM_STATUS = "changed_kitchen_item_status",

  // ── Settings (root + subpages) ──
  SHOWED_SETTINGS = "showed_settings",
  CLICKED_SETTINGS_ROW = "clicked_settings_row",
  CLICKED_LOGOUT = "clicked_logout",
  // General
  SHOWED_GENERAL_SETTINGS = "showed_general_settings",
  CLICKED_SAVE_GENERAL_SETTINGS = "clicked_save_general_settings",
  CHANGED_CURRENCY = "changed_currency",
  TOGGLED_LANGUAGE = "toggled_language",
  CLICKED_SET_DEFAULT_LANGUAGE = "clicked_set_default_language",
  // Contacts
  SHOWED_CONTACTS = "showed_contacts",
  CLICKED_SAVE_CONTACTS = "clicked_save_contacts",
  // Branding/Design
  SHOWED_BRANDING = "showed_branding",
  CLICKED_SAVE_BRANDING = "clicked_save_branding",
  CLICKED_UPLOAD_BACKGROUND = "clicked_upload_background",
  CLICKED_GENERATE_BACKGROUND = "clicked_generate_background",
  CLICKED_REMOVE_BACKGROUND = "clicked_remove_background",
  CLICKED_PRESET_COLOR = "clicked_preset_color",
  TOGGLED_HIDE_TITLE = "toggled_hide_title",
  // About
  SHOWED_ABOUT = "showed_about",
  CLICKED_SAVE_ABOUT = "clicked_save_about",

  // ── Billing ──
  SHOWED_BILLING = "showed_billing",
  CLICKED_PLAN_UPGRADE = "clicked_plan_upgrade",
  CLICKED_MANAGE_SUBSCRIPTION = "clicked_manage_subscription",

  // ── Support ──
  SHOWED_SUPPORT = "showed_support",
  CLICKED_SEND_SUPPORT_MESSAGE = "clicked_send_support_message",

  // ── Analytics ──
  SHOWED_ANALYTICS = "showed_analytics",
  CHANGED_ANALYTICS_PERIOD = "changed_analytics_period",

  // ── Landing — Pricing (kept for marketing) ──
  PRICING_SWIPE_FREE = "pricing_swipe_free",
  PRICING_SWIPE_BASIC = "pricing_swipe_basic",
  PRICING_SWIPE_PRO = "pricing_swipe_pro",

  // ── Errors ──
  ERROR_VALIDATION = "error_validation",
  ERROR_SAVE = "error_save",
  ERROR_DELETE = "error_delete",
  ERROR_FETCH = "error_fetch",
  ERROR_SORT = "error_sort",
  ERROR_TOGGLE = "error_toggle",
  ERROR_CHECKOUT = "error_checkout",
  ERROR_PORTAL = "error_portal",
  ERROR_UPLOAD = "error_upload",
  ERROR_OTP_SEND = "error_otp_send",
  ERROR_OTP_VERIFY = "error_otp_verify",
  ERROR_CLAIM_EMAIL_TAKEN = "error_claim_email_taken",
  ERROR_CLAIM_SEND = "error_claim_send",
  ERROR_CLAIM_VERIFY = "error_claim_verify",
}

export const EVENT_LABELS: Record<string, string> = {
  // Auth
  [DashboardEvent.SHOWED_LOGIN]: "Showed Login",
  [DashboardEvent.FOCUSED_LOGIN_EMAIL]: "Focused Email Input",
  [DashboardEvent.CLICKED_LOGIN_CONTINUE]: "Clicked Continue",
  [DashboardEvent.AUTH_SIGNUP]: "New Signup",
  [DashboardEvent.AUTH_GOOGLE_LOGIN]: "Google Login",
  [DashboardEvent.SHOWED_OTP]: "Showed OTP",
  [DashboardEvent.FOCUSED_OTP_INPUT]: "Focused OTP Input",
  [DashboardEvent.CLICKED_VERIFY_OTP]: "Clicked Verify OTP",
  [DashboardEvent.CLICKED_CHANGE_EMAIL]: "Clicked Change Email",

  // Onboarding
  [DashboardEvent.SHOWED_SAVE_MENU]: "Showed Save Menu",
  [DashboardEvent.CLICKED_SAVE_MENU]: "Clicked Save Menu",
  [DashboardEvent.FOCUSED_CLAIM_EMAIL]: "Focused Claim Email",
  [DashboardEvent.CLICKED_CLAIM_SEND_CODE]: "Clicked Claim Send Code",
  [DashboardEvent.CLAIM_CODE_SENT]: "Claim Code Sent",
  [DashboardEvent.CLICKED_CLAIM_CHANGE_EMAIL]: "Clicked Claim Change Email",
  [DashboardEvent.CLAIM_VERIFY_SUCCESS]: "Claim Verify Success",

  // Nav
  [DashboardEvent.CLICKED_NAV_MENU]: "Nav: Menu",
  [DashboardEvent.CLICKED_NAV_RESERVATIONS]: "Nav: Reservations",
  [DashboardEvent.CLICKED_NAV_ORDERS]: "Nav: Orders",
  [DashboardEvent.CLICKED_NAV_KITCHEN]: "Nav: Kitchen",
  [DashboardEvent.CLICKED_NAV_ANALYTICS]: "Nav: Analytics",
  [DashboardEvent.CLICKED_NAV_SETTINGS]: "Nav: Settings",

  // Menu list
  [DashboardEvent.SHOWED_MENU]: "Showed Menu",
  [DashboardEvent.CLICKED_PREVIEW_MENU]: "Clicked Preview Menu",
  [DashboardEvent.CLICKED_SHARE_MENU]: "Clicked Share Menu",
  [DashboardEvent.CLICKED_EXPAND_ALL]: "Clicked Expand All",
  [DashboardEvent.CLICKED_COLLAPSE_ALL]: "Clicked Collapse All",
  [DashboardEvent.CLICKED_CATEGORY_ROW]: "Clicked Category Row",
  [DashboardEvent.CLICKED_ITEM_ROW]: "Clicked Item Row",
  [DashboardEvent.CLICKED_ADD_CATEGORY]: "Clicked Add Category",
  [DashboardEvent.CLICKED_ADD_ITEM]: "Clicked Add Item",
  [DashboardEvent.SORTED_CATEGORY]: "Sorted Category",
  [DashboardEvent.SORTED_ITEM]: "Sorted Item",
  [DashboardEvent.TOGGLED_ITEM_VISIBLE]: "Toggled Item Visible",
  [DashboardEvent.CLICKED_SUBSCRIPTION_CHIP]: "Clicked Subscription Chip",

  // Category form
  [DashboardEvent.SHOWED_CATEGORY_FORM]: "Showed Category Form",
  [DashboardEvent.CLICKED_SAVE_CATEGORY]: "Clicked Save Category",
  [DashboardEvent.CLICKED_DELETE_CATEGORY]: "Clicked Delete Category",

  // Item form
  [DashboardEvent.SHOWED_ITEM_FORM]: "Showed Item Form",
  [DashboardEvent.CLICKED_SAVE_ITEM]: "Clicked Save Item",
  [DashboardEvent.CLICKED_DELETE_ITEM]: "Clicked Delete Item",
  [DashboardEvent.TOGGLED_ITEM_ACTIVE]: "Toggled Item Active",
  [DashboardEvent.CLICKED_UPLOAD_ITEM_IMAGE]: "Clicked Upload Item Image",
  [DashboardEvent.CLICKED_GENERATE_ITEM_IMAGE]: "Clicked Generate Item Image",
  [DashboardEvent.CLICKED_STYLIZE_ITEM_IMAGE]: "Clicked Stylize Item Image",
  [DashboardEvent.SHOWED_GENERATE_LIMIT_MODAL]: "Showed Generate Limit Modal",
  [DashboardEvent.SHOWED_TRANSLATE_LIMIT_MODAL]: "Showed Translate Limit Modal",
  [DashboardEvent.CLICKED_AI_TRANSLATE]: "Clicked AI Translate",

  // Option form
  [DashboardEvent.SHOWED_OPTION_FORM]: "Showed Option Form",
  [DashboardEvent.CLICKED_SAVE_OPTION]: "Clicked Save Option",
  [DashboardEvent.CLICKED_DELETE_OPTION]: "Clicked Delete Option",
  [DashboardEvent.CLICKED_ADD_VARIANT]: "Clicked Add Variant",
  [DashboardEvent.CLICKED_REMOVE_VARIANT]: "Clicked Remove Variant",
  [DashboardEvent.TOGGLED_OPTION_REQUIRED]: "Toggled Option Required",
  [DashboardEvent.TOGGLED_OPTION_MULTI]: "Toggled Option Multi",

  // Tables
  [DashboardEvent.SHOWED_TABLES]: "Showed Tables",
  [DashboardEvent.CLICKED_ADD_TABLE]: "Clicked Add Table",
  [DashboardEvent.CLICKED_TABLE_ROW]: "Clicked Table Row",
  [DashboardEvent.SORTED_TABLE]: "Sorted Table",
  [DashboardEvent.SHOWED_TABLE_FORM]: "Showed Table Form",
  [DashboardEvent.CLICKED_SAVE_TABLE]: "Clicked Save Table",
  [DashboardEvent.CLICKED_DELETE_TABLE]: "Clicked Delete Table",

  // Reservations
  [DashboardEvent.SHOWED_RESERVATIONS]: "Showed Reservations",
  [DashboardEvent.CLICKED_CONFIRM_RESERVATION]: "Clicked Confirm Reservation",
  [DashboardEvent.CLICKED_REJECT_RESERVATION]: "Clicked Reject Reservation",
  [DashboardEvent.SHOWED_RESERVATION_SETTINGS]: "Showed Reservation Settings",
  [DashboardEvent.TOGGLED_RESERVATIONS_ENABLED]: "Toggled Reservations Enabled",
  [DashboardEvent.CHANGED_RESERVATION_MODE]: "Changed Reservation Mode",
  [DashboardEvent.CLICKED_SAVE_RESERVATION_SETTINGS]: "Clicked Save Reservation Settings",

  // Orders
  [DashboardEvent.SHOWED_ORDERS]: "Showed Orders",
  [DashboardEvent.CLICKED_TABLE_SELECT]: "Clicked Table Select",
  [DashboardEvent.CLICKED_START_ORDER]: "Clicked Start Order",
  [DashboardEvent.CLICKED_OPEN_ORDER]: "Clicked Open Order",
  [DashboardEvent.CLICKED_COMPLETE_ORDER]: "Clicked Complete Order",
  [DashboardEvent.CLICKED_DELETE_ORDER]: "Clicked Delete Order",
  [DashboardEvent.CLICKED_REMOVE_ORDER_ITEM]: "Clicked Remove Order Item",
  [DashboardEvent.CHANGED_ORDER_ITEM_STATUS]: "Changed Order Item Status",
  [DashboardEvent.CLICKED_ADD_ORDER_ITEM]: "Clicked Add Order Item",
  [DashboardEvent.SHOWED_DISH_WIZARD]: "Showed Dish Wizard",
  [DashboardEvent.CLICKED_PICK_REQUIRED_VARIANT]: "Picked Required Variant",
  [DashboardEvent.CLICKED_REQUIRED_CONTINUE]: "Clicked Required Continue",
  [DashboardEvent.CLICKED_ADD_TO_ORDER]: "Clicked Add To Order",
  [DashboardEvent.SHOWED_ORDER_SETTINGS]: "Showed Order Settings",
  [DashboardEvent.CLICKED_SAVE_ORDER_SETTINGS]: "Clicked Save Order Settings",
  [DashboardEvent.TOGGLED_ORDERS_ENABLED]: "Toggled Orders Enabled",
  [DashboardEvent.CHANGED_ORDER_MODE]: "Changed Order Mode",

  // Kitchen
  [DashboardEvent.SHOWED_KITCHEN]: "Showed Kitchen",
  [DashboardEvent.CHANGED_KITCHEN_ITEM_STATUS]: "Changed Kitchen Item Status",

  // Settings
  [DashboardEvent.SHOWED_SETTINGS]: "Showed Settings",
  [DashboardEvent.CLICKED_SETTINGS_ROW]: "Clicked Settings Row",
  [DashboardEvent.CLICKED_LOGOUT]: "Clicked Logout",
  [DashboardEvent.SHOWED_GENERAL_SETTINGS]: "Showed General Settings",
  [DashboardEvent.CLICKED_SAVE_GENERAL_SETTINGS]: "Clicked Save General Settings",
  [DashboardEvent.CHANGED_CURRENCY]: "Changed Currency",
  [DashboardEvent.TOGGLED_LANGUAGE]: "Toggled Language",
  [DashboardEvent.CLICKED_SET_DEFAULT_LANGUAGE]: "Set Default Language",
  [DashboardEvent.SHOWED_CONTACTS]: "Showed Contacts",
  [DashboardEvent.CLICKED_SAVE_CONTACTS]: "Clicked Save Contacts",
  [DashboardEvent.SHOWED_BRANDING]: "Showed Branding",
  [DashboardEvent.CLICKED_SAVE_BRANDING]: "Clicked Save Branding",
  [DashboardEvent.CLICKED_UPLOAD_BACKGROUND]: "Clicked Upload Background",
  [DashboardEvent.CLICKED_GENERATE_BACKGROUND]: "Clicked Generate Background",
  [DashboardEvent.CLICKED_REMOVE_BACKGROUND]: "Clicked Remove Background",
  [DashboardEvent.CLICKED_PRESET_COLOR]: "Clicked Preset Color",
  [DashboardEvent.TOGGLED_HIDE_TITLE]: "Toggled Hide Title",
  [DashboardEvent.SHOWED_ABOUT]: "Showed About",
  [DashboardEvent.CLICKED_SAVE_ABOUT]: "Clicked Save About",

  // Billing
  [DashboardEvent.SHOWED_BILLING]: "Showed Billing",
  [DashboardEvent.CLICKED_PLAN_UPGRADE]: "Clicked Plan Upgrade",
  [DashboardEvent.CLICKED_MANAGE_SUBSCRIPTION]: "Clicked Manage Subscription",

  // Support
  [DashboardEvent.SHOWED_SUPPORT]: "Showed Support",
  [DashboardEvent.CLICKED_SEND_SUPPORT_MESSAGE]: "Clicked Send Support Message",

  // Analytics
  [DashboardEvent.SHOWED_ANALYTICS]: "Showed Analytics",
  [DashboardEvent.CHANGED_ANALYTICS_PERIOD]: "Changed Analytics Period",

  // Marketing pricing
  [DashboardEvent.PRICING_SWIPE_FREE]: "Pricing Swipe: Free",
  [DashboardEvent.PRICING_SWIPE_BASIC]: "Pricing Swipe: Growth",
  [DashboardEvent.PRICING_SWIPE_PRO]: "Pricing Swipe: Pro",

  // Errors
  [DashboardEvent.ERROR_VALIDATION]: "Error: Validation",
  [DashboardEvent.ERROR_SAVE]: "Error: Save",
  [DashboardEvent.ERROR_DELETE]: "Error: Delete",
  [DashboardEvent.ERROR_FETCH]: "Error: Fetch",
  [DashboardEvent.ERROR_SORT]: "Error: Sort",
  [DashboardEvent.ERROR_TOGGLE]: "Error: Toggle",
  [DashboardEvent.ERROR_CHECKOUT]: "Error: Checkout",
  [DashboardEvent.ERROR_PORTAL]: "Error: Portal",
  [DashboardEvent.ERROR_UPLOAD]: "Error: Upload",
  [DashboardEvent.ERROR_OTP_SEND]: "Error: OTP Send",
  [DashboardEvent.ERROR_OTP_VERIFY]: "Error: OTP Verify",
  [DashboardEvent.ERROR_CLAIM_EMAIL_TAKEN]: "Error: Claim Email Taken",
  [DashboardEvent.ERROR_CLAIM_SEND]: "Error: Claim Send",
  [DashboardEvent.ERROR_CLAIM_VERIFY]: "Error: Claim Verify",
};

const lastFired = new Map<string, number>();

let _userId: string | null = null;

export function setDashboardUserId(userId: string) {
  _userId = userId;
}

const SESSION_ID_KEY = "analytics_session_id";

function getSessionId(): string {
  let sessionId =
    localStorage.getItem(SESSION_ID_KEY) || sessionStorage.getItem(SESSION_ID_KEY);
  if (!sessionId) {
    sessionId =
      typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : Array.from(crypto.getRandomValues(new Uint8Array(16)))
            .map((b) => b.toString(16).padStart(2, "0"))
            .join("")
            .replace(/(.{8})(.{4})(.{4})(.{4})(.{12})/, "$1-$2-$3-$4-$5");
    sessionStorage.setItem(SESSION_ID_KEY, sessionId);
  }
  return sessionId;
}

function getCookie(name: string): string | null {
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

function deleteCookie(name: string) {
  document.cookie = `${name}=; path=/; max-age=0`;
}

function trackReferral() {
  if (typeof window === "undefined") return;
  if (sessionStorage.getItem("referral_sent")) return;

  const from = getCookie("ref_from");
  if (!from) return;

  sessionStorage.setItem("referral_sent", "1");

  const sessionId = getSessionId();
  const refMeta: Record<string, string> = { from };
  const slug = getCookie("ref_slug");
  if (slug) {
    refMeta.slug = slug;
    deleteCookie("ref_slug");
  }
  deleteCookie("ref_from");

  fetch("/api/analytics/event", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ event: `referral_${from}`, sessionId, meta: refMeta }),
    keepalive: true,
  }).catch(() => {});
}

export function track(event: DashboardEvent, meta?: Record<string, string>) {
  if (typeof window === "undefined") return;
  if (typeof localStorage !== "undefined" && localStorage.getItem("analytics_disabled") === "true")
    return;

  const now = Date.now();
  const dedupKey = meta ? event + JSON.stringify(meta) : event;
  const last = lastFired.get(dedupKey);
  if (last && now - last < 1000) return;
  lastFired.set(dedupKey, now);

  const sessionId = getSessionId();

  fetch("/api/analytics/event", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ event, sessionId, ...(meta ? { meta } : {}) }),
    keepalive: true,
  }).catch(() => {});

  if (event.startsWith("showed_")) {
    trackReferral();
  }

  if (_userId && event.startsWith("showed_")) {
    fetch("/api/analytics/link-session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId, userId: _userId }),
      keepalive: true,
    })
      .then((res) => res.json())
      .then((data) => {
        const finalId = data.sessionId || sessionId;
        localStorage.setItem(SESSION_ID_KEY, finalId);
        sessionStorage.removeItem(SESSION_ID_KEY);
      })
      .catch(() => {});
  }
}
