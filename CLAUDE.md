# iq-rest-dashboard-web

Vite + React 19 SPA. **Two products in one bundle:**

1. **Admin dashboard** (`dashboard.iq-rest.com`) — where the restaurant owner manages menu, orders, reservations, tables, devices, settings, billing.
2. **In-restaurant tablet apps** — Kitchen Display System, Waiter terminal, Reservation kiosk. Served from device kiosk hosts (`device.iq-rest.com`, legacy `k.*` / `w.*` / `r.*`) and from any host via `?demo=<board>` for the marketing landing's iframe demo.

The choice between the two is made at boot in `src/main.tsx` and produces separate Vite chunks — a paired tablet doesn't download admin/route code it never uses.

Backend: `iq-rest-dashboard-api` (port 8130).

> **Schema cleanup 2026-05-28 (Stage C).** The `Company` entity is gone. Each `Restaurant` carries its own plan/subscription/trial. Admin UI uses `admin-restaurant.tsx` (per-restaurant modal) instead of the old `admin-company.tsx`; the `RestaurantAccess`/"grants" page is deleted; SPA routes use `settings.admin` + `settings.admin.restaurant` (the `settings.admin.companies/grants/company` triplet was retired). `accountCreatedAt` replaces `companyCreatedAt` in the analytics payload. See `/home/deploy/dev/AUDIT_2026-05-29.md` for the full audit + open follow-ups (notably dead `lib/auth.ts`, dead `RevenueByHourChart`/`TopItemsList`/`OrderSizes` components, swallowed save errors in `_v2/settings.tsx`, stale `owned`/`canManageBilling` types, stale `dashboard.auth`/`settingsHub.rows.companies`/`admin.companiesTitle` i18n keys across 35 locales).

## Build rule on this server (read first)

This server has ~3.7 GB RAM. **DO NOT run production builds here**:

- Forbidden: `npm run build` (which runs `tsr generate && tsc -b && vite build`) and `npm run preview`.
- Allowed for type checks: `npm run typecheck` (`tsr generate && tsc -b`) or `npx tsc --noEmit`.
- Allowed: `npm run dev` (Vite on `:8129`), `npm run lint`, `npm run format`.
- All production builds happen in GitHub Actions on push.

## Where it fits in IQ Rest

```
owner browser                                           tablet (KDS / waiter / reservation)
        |                                                       |
        v                                                       v
dashboard.iq-rest.com   <----- this bundle (admin) -----        device.iq-rest.com (or k/w/r.*)
        |                                                       |
        |  cookie session (iqr_session)                         |  Bearer device JWT (iqr_device_token)
        v                                                       v
                          [iq-rest-dashboard-api] (Nest, :8130, SSE)
                                       |
                          [iq-rest-public-menu-api] -- pg NOTIFY ----^
                                       ^
                          [iq-rest-public-menu] (guest QR menu)
```

## Tech stack

- **Vite 6** + React 19 + TypeScript 5.7
- **@tanstack/react-router 1.95** for the top-level route tree (`/`, `/$locale`, `/$locale/dashboard*`, `/$locale/login`, `/$locale/logout`). File-based — `tsr generate` writes `src/routeTree.gen.ts`.
- **Internal SPA router** (`src/dashboard/_spa/router.tsx`) layered inside the dashboard host — manages a `View` back-stack and writes `history.pushState`. The codec (`_spa/url.ts`) is the source of truth for `/dashboard/...` URLs.
- **@tanstack/react-query 5** (single client; `staleTime: 30s`, `retry: 1`, no refetch on window focus).
- **Zustand 5** for client-side stores (orders-stream connection state, etc.).
- **i18next 24** + `react-i18next 15` — 35 locales, **per-locale lazy chunks** (Vite glob without `eager`).
- **Tailwind CSS 3.4** + tailwindcss-animate + autoprefixer + postcss.
- **sonner** (toasts), **lucide-react** (icons), **qrcode.react** (table/menu QR), **heic2any** (iOS HEIC photo upload), **@react-google-maps/api** (contacts map picker).
- **Migration shims** from a previous Next.js codebase: `next-intl`, `next-intl/server`, `next/link`, `next/navigation`, `@/i18n/routing` are aliased in `vite.config.ts` to local compat modules. Lots of dashboard components still import from `next-intl` (`useTranslations`, `useLocale`) — that goes through `src/lib/i18n-compat.ts`.

## Repository layout

```
index.html
nginx.conf                         # reverse-proxy notes for prod
public/                            # static (manifest, k-manifest, k-sw.js, icons, OG images)
scripts/                           # one-off node scripts (cohort builders, asset generation, …)
src/
  main.tsx                         # boot — picks kiosk vs admin branch, sets up PWA + version observer
  admin-bootstrap.tsx              # admin SPA mount (QueryClientProvider + RouterProvider + Toaster + ThemeProvider)
  i18n.ts                          # lazy i18next bootstrap (35 locales, EN fallback, RTL handling)
  styles.css                       # Tailwind entry
  routes/                          # TanStack file-based routes (top level)
    __root.tsx                     # tracks ?from=<source> once per tab and cleans query
    index.tsx                      # / → geo-detected /$locale (Cloudflare cf-ipcountry via /api/geo/currency)
    $locale.tsx                    # validates locale; redirects unsupported variants to short code
    $locale.index.tsx
    $locale.dashboard.tsx
    $locale.dashboard.$.tsx        # catch-all under /dashboard — both mount LazyDashboardHost
    $locale.login.tsx              # redirects to landing (sign-in lives there now)
    $locale.logout.tsx
  routeTree.gen.ts                 # GENERATED by tsr — do not edit
  auth/
    landing-redirect.tsx           # imperative redirect to landing
  shared/
    logo-icon.tsx                  # IQ Rest brand SVG (gradient + Rest text)
    wizard.tsx                     # multi-step wizard primitives used by onboarding/onb. flows
  components/                      # cross-product UI
    full-page-loader.tsx           # spinner; also the route-pending fallback for TanStack Router
    legal-modal.tsx                # T&Cs / privacy
    map-picker.tsx                 # Google Maps picker (uses VITE_GOOGLE_MAPS_API_KEY)
    menu-preview-modal.tsx         # iframe to the public menu (read VITE_PUBLIC_MENU_URL)
    theme-provider.tsx
  dashboard/
    lazy-dashboard-host.tsx        # React.lazy() wrapper for DashboardHost — keeps admin out of the kiosk chunk
    dashboard-host.tsx             # /auth/check probe, redirect to landing if !authenticated, load restaurant/categories/items/tables, SubProvider, chrome
    _spa/
      router.tsx                   # in-dashboard SPA router (View stack, push/replace/back, history sync)
      url.ts                       # View ↔ path codec
      types.ts                     # discriminated View union (all dashboard screens)
      shell.tsx                    # renders the current View
      spa-wrapper.tsx
      views/settings-hub.tsx       # legacy settings hub view
    _v2/                           # the actual UI for each View
      chrome.tsx                   # top header + bottom-nav (Menu / Bookings / Orders / Kitchen / Analytics / Settings)
      restaurant-context.tsx       restaurants-context.tsx    # current + list contexts
      sub-context.tsx              # subscription/plan + AI-image quota context
      menu-list.tsx                # categories + dishes management surface
      menu-onboarding.tsx          # first-time menu setup (also surfaces scan banner)
      scan-modal.tsx               # paper-menu OCR flow (up to 5 photos/PDFs → /scan-menu/parse)
      tables.tsx                   # floor plan, per-table QR (qrcode.react), table editor
      orders.tsx orders-shared.ts  # orders board (split / discount / change table / complete)
      reservations.tsx             # booking board (month + day)
      kitchen-page.tsx             # KDS — also reused by the kitchen kiosk
      restaurants-page.tsx         # multi-restaurant switcher + create flow
      settings.tsx                 # the giant Settings page (website / contacts / region / orders / bookings / languages / billing / support)
      devices-settings.tsx devices-api.ts  # device pairing + revoke + force-reload
      discount-modal.tsx
      impersonation-banner.tsx     # banner shown when an admin is acting as another user
      use-orders-stream.ts         # admin SSE → React Query cache invalidations
      use-flip.ts use-scroll-lock.ts use-is-admin.ts
      api.ts                       # all admin endpoints (per-page API helpers)
      mappers.ts                   # ApiCategory/Item/Order/Reservation/Restaurant/Table → domain types
      types.ts                     # Restaurant / Category / Item / Order / Booking / TableEntity / View / TabId
      i18n.ts                      # AVAILABLE_LANGUAGES (per-restaurant menu locales) — distinct from app i18n
      icons.tsx                    # local icon set (some lucide overrides + custom SVGs)
      ui.tsx forms.tsx tokens.ts collapsible.tsx allergen-icon.tsx diet-icon.tsx  # shared primitives
      mappers.ts orders-sync-state.ts (zustand store) helpers.ts
    settings/                      # extra settings sub-views
      tables/                      # table editor flow
      logout-link.tsx
    _pages/
      admin.tsx admin-company.tsx admin-grants.tsx
      google-ads.tsx               # Google Ads management surface (admin only)
      usage.tsx usage-events-table.tsx
      _admin-helpers.ts
    _ui/
      dashboard-content.tsx page-header.tsx page-loader.tsx
    analytics/                     # /dashboard/analytics screen
  kitchen/                         # tablet kiosk runtime
    kitchen-app.tsx                # PairingScreen → BootstrapResponse → KitchenShell | OrdersPage | ReservationsPage (driven by device.type)
    pairing-screen.tsx             # 6-digit code entry
    kitchen-shell.tsx              # KDS chrome (zoom controls, sound, offline overlay)
    use-kitchen-stream.ts          # device SSE → KitchenOrderEvent + onRevoked + onForceReload callbacks
    sound.ts sound-prompt.tsx      # audio chime + wake-lock; iOS sound unlock prompt
    offline-overlay.tsx            # full-screen "No connection" with manual retry
    zoom-controls.tsx              # KDS root-em zoom
    demo-data.ts                   # hardcoded snapshots for ?demo=kitchen/orders/reservations
  lib/
    api.ts                         # fetch wrapper (cookies + active-restaurant header + X-App-Version observer + 401 → bounce to landing)
    auth.ts admin.ts               # session helpers + isAdminEmail (VITE_ADMIN_EMAIL_DOMAIN)
    active-restaurant.ts           # active-restaurant id (cookie iqr_active_restaurant_id + header for API)
    version-check.ts               # observeResponseVersion / reloadIfStale (X-App-Version → safe reload on route resolve)
    device-mode.ts                 # kiosk host detection, demo mode, persisted device token + type (localStorage iqr_device_token / iqr_device_type)
    dashboard-events.ts            # track() — sends /api/track/<event> via Beacon/fetch
    analytics.ts                   # trackEvent (used from __root)
    landing-url.ts menu-url.ts     # composition of public-menu URL + landing URL (VITE_PUBLIC_MENU_URL)
    show-api-error.ts              # ApiError → toast helper
    currencies.ts allergens.ts diets.ts legal-text.ts
    i18n-compat.ts                 # `next-intl` shim: useTranslations / useLocale / NextIntlClientProvider (alias targets)
    router-compat.tsx              # `next/link` / `next/navigation` / `@/i18n/routing` shims (alias targets)
  locales/<code>.json              # 35 i18n bundles: en es de fr it pt nl pl ru uk sv da no fi cs el tr ro hu bg hr sk sl et lv lt sr ca ga is fa ar ja ko zh
vite.config.ts                     # alias map + /api proxy + TanStack Router plugin
tailwind.config.ts  postcss.config.js
tsconfig.json  tsconfig.app.json  tsconfig.node.json
nginx.conf                         # prod reverse-proxy template (rewrites /api → dashboard-api)
README.md
```

## Commands

```bash
npm run dev         # vite --host on :8129  (proxies /api → VITE_DEV_API_PROXY, default localhost:8130)
npm run typecheck   # tsr generate && tsc -b
npm run lint        # eslint --fix
npm run format      # prettier --write src/**/*.{ts,tsx,css}
```

**FORBIDDEN on this server:** `npm run build`, `npm run preview`. GitHub Actions handles all builds.

## Environment variables

All client-exposed (`VITE_*`). Read in `lib/api.ts`, `lib/admin.ts`, `lib/landing-url.ts`, `lib/menu-url.ts`, `components/map-picker.tsx`, `vite.config.ts`.

| Var | Purpose | Default |
|---|---|---|
| `VITE_API_URL` | Absolute API base URL. Leave empty in dev to use the Vite proxy at `/api`. | `/api` (proxy) |
| `VITE_DEV_API_PROXY` | Dev-only — target the Vite proxy forwards `/api` to. | `http://localhost:8130` |
| `VITE_APP_URL` | This SPA's public origin (for outbound links back to itself). | `window.location.origin` |
| `VITE_PUBLIC_MENU_URL` | Public-menu origin (used for QR codes, share links, preview iframe). | `https://iq-rest.com` |
| `VITE_ADMIN_EMAIL_DOMAIN` | Email domain that unlocks the admin section. | `iq-rest.com` |
| `VITE_GOOGLE_MAPS_API_KEY` | Google Maps key for the contacts location picker. | empty (picker disabled) |

## Bootstrapping (`src/main.tsx`)

1. **Patches `window.fetch`** to call `observeResponseVersion(res)` on every response. The dashboard reloads at the next safe moment (route resolve) when `X-App-Version` changes.
2. **Picks a branch**:
   - `?demo=<board>` (`kitchen|orders|reservations|1`) → renders the real board with hardcoded `demo-data.ts`. No PWA registration, no API. Used by the landing's iframe demo.
   - `isKioskHost()` (`device.*` or legacy `k.*/w.*/r.*`) → registers the kitchen PWA (manifest swap to `/k-manifest.webmanifest`, service worker `/k-sw.js` for storage persistence to survive iOS Safari's 7-day ITP eviction) and renders `<KitchenApp />`.
   - Otherwise → dynamic-imports `admin-bootstrap.tsx` and calls `mountAdmin(rootEl, FullPageLoader)`.
3. Awaits `bootstrapI18n()` (loads initial locale chunk + EN fallback) before mounting.

The two branches are dynamic imports → Vite emits separate chunks; kiosk tablets never download admin code.

## Routing

### Top-level (TanStack file routes)

| Path | File | Behaviour |
|---|---|---|
| `/` | `routes/index.tsx` | `beforeLoad`: calls `/api/geo/currency` for Cloudflare country → maps via `COUNTRY_TO_LOCALE` (full table inline) → falls back to `navigator.language` → `en`. Redirects to `/$locale`. |
| `/$locale` | `routes/$locale.tsx` | `beforeLoad`: validates locale against `SUPPORTED_LOCALES` (35 codes), strips region (`en-US → en`), redirects to canonical short code. Body switches `i18n.changeLanguage(locale)` and renders `<Outlet />`. |
| `/$locale/` | `routes/$locale.index.tsx` | Locale landing |
| `/$locale/dashboard` and `/$locale/dashboard/$` | `routes/$locale.dashboard.tsx`, `$locale.dashboard.$.tsx` | Both mount `LazyDashboardHost` (React.lazy → `dashboard-host.tsx`). Catch-all so the inner SPA router controls everything under `/dashboard/...`. |
| `/$locale/login` | `routes/$locale.login.tsx` | Redirects to `landingUrl(locale)`. Sign-in is on the landing. |
| `/$locale/logout` | `routes/$locale.logout.tsx` | Logout flow |

### Internal dashboard SPA router (`src/dashboard/_spa/`)

A second router runs *inside* `DashboardHost`. It keeps a stack of `View` discriminated-union values and syncs to `history.pushState`. The codec is in `_spa/url.ts` (every `View` ↔ path round-trip — kept stable because these URLs are bookmarkable).

`View` variants (current set):

| Family | Variants | Path |
|---|---|---|
| Auth | `auth.login`, `auth.otp`, `auth.logout` | `/dashboard/login`, `/dashboard/otp`, `/dashboard/logout` |
| Menu | `menu` (optional `?group=`) | `/dashboard` |
| Orders | `orders`, `orders.detail{orderId}` | `/dashboard/orders`, `/dashboard/orders/:id` |
| Reservations | `reservations` | `/dashboard/reservations` |
| Kitchen | `kitchen` | `/dashboard/kitchen` |
| Analytics | `analytics` | `/dashboard/analytics` |
| Settings root | `settings` | `/dashboard/settings` |
| Settings sub | `settings.contacts`, `settings.branding`, `settings.general`, `settings.tables`, `settings.tables.new`, `settings.tables.edit{id}`, `settings.orders`, `settings.bookings`, `settings.languages`, `settings.billing` (optional `?from=`), `settings.support`, `settings.devices`, `settings.restaurants`, `settings.restaurants.new` | `/dashboard/settings/...` |
| Admin (settings.admin.*) | `companies`, `company{id}`, `usage`, `googleAds`, `grants` | `/dashboard/settings/admin/...` |
| Category | `category.new` (optional `?group=`), `category.edit{id}` | `/dashboard/categories/new`, `/dashboard/categories/:id/edit` |
| Group | `group.new`, `group.edit{id}` | `/dashboard/groups/...` |
| Item | `item.new` (optional `?cat=`), `item.edit{id}` | `/dashboard/items/new`, `/dashboard/items/:id/edit` |
| Option | `option.new{itemId}`, `option.edit{itemId, optionId}` | `/dashboard/items/:id/options/...` |

Anything unrecognised falls back to `{ name: "menu" }`. Adding a new screen requires adding a case in **both** `viewToPath` and `pathToView`.

Bottom-nav tabs (6): **Menu / Reservations / Orders / Kitchen / Analytics / Settings**. Maps in `chrome.tsx`; tracked via `track("dash_header_nav_*" / "dash_bottom_bar_nav_*")`.

`router.subscribe("onResolved", reloadIfStale)` triggers `window.location.reload()` when the server's `X-App-Version` header on a recent response differs from the version the bundle booted with — the dashboard quietly upgrades on the next navigation.

## Kiosk app (`src/kitchen/`)

Lives in the same repo because the boards reuse most of the dashboard components (`KitchenPage`, `OrdersPage`, `ReservationsPage` from `_v2`), `RestaurantProvider`, mappers, and tokens.

Flow:

1. `KitchenApp` checks for a stored device JWT in `localStorage.iqr_device_token`. If missing → `<PairingScreen />` (6-digit code input → `POST /api/devices/pair`).
2. Stores the token + `device.type` (`KITCHEN | WAITER | RESERVATION`) and calls `GET /api/devices/bootstrap` (the one-shot snapshot — restaurant, categories, items, tables, orders, reservations). Persists via React Query.
3. Renders by device type:
   - `KITCHEN` → `<KitchenShell><KitchenPage /></KitchenShell>` — KDS with sound chime + wake-lock + zoom controls.
   - `WAITER` → `<OrdersPage />` — same as dashboard's orders board, but scoped to the device.
   - `RESERVATION` → `<ReservationsPage />` — same as dashboard's reservation board.
4. `useKitchenStream(token, onOrder, onRevoked, onForceReload)` opens `EventSource("/api/devices/stream?token=...")` (EventSource can't set headers — token rides as query). Watchdog: 3s tick, 20s without `ping`/event triggers reconnect with exponential backoff. `device-revoked` → `clearDeviceToken()` + back to pairing screen. `force-reload` → `location.reload()` (admin push after bundle hotfix).

PWA: `setupKitchenPwa()` in `main.tsx` swaps the manifest to `/k-manifest.webmanifest` and registers `/k-sw.js`. The SW's primary purpose is **storage persistence** — once installed via Add-to-Home-Screen on iPad, the device escapes Safari ITP's 7-day eviction so the paired tablet survives long idle stretches without re-pairing. Offline functionality is a side effect.

Sound: `playOrderChime()` plays on every new order; `unlockSound()` is gated behind a first-tap prompt (`<SoundPrompt />`) because iOS Safari blocks programmatic audio until user gesture. `requestWakeLock()` keeps the screen on (`navigator.wakeLock` where available).

`?demo=<board>` boots the same code with hardcoded `demo-data.ts` snapshots — no API, no pairing — used by the marketing landing's device-frame iframes (`?demo=kitchen|orders|reservations`, optional `?lang=` and `?zoom=N`).

## Auth flow

There is **no sign-in form in this app**. `/login` redirects to the marketing landing. The dashboard:

1. `DashboardHost` first runs `useQuery(["auth"], () => api("/auth/check"))`.
2. If `!authenticated` → `window.location.assign(landingUrl(locale))`.
3. Otherwise loads `/restaurant`, `/categories`, `/items`, `/tables` in parallel via `useQueries`. While loading, the route's `defaultPendingComponent` (FullPageLoader) shows.

Session cookies are managed entirely by `dashboard-api` (`iqr_session`, `iqr_email`, legacy mirrors). The SPA never reads them; it only reads `/auth/check` and acts on the result.

**Active restaurant**: `iqr_active_restaurant_id` cookie. `lib/active-restaurant.ts` exposes the header (`activeRestaurantHeader()`) that `api()` injects into every request so the API picks the right context.

**Admin gating**: `useIsAdmin()` checks the auth email against `VITE_ADMIN_EMAIL_DOMAIN` (default `iq-rest.com`). Admin section opens in `/dashboard/settings/admin/*`.

**Impersonation**: `<ImpersonationBanner />` shows when `authData.impersonatedBy` is set — sticky banner with an "Exit" button hitting `/api/admin/impersonate/exit`.

## Real-time (admin tab)

`useOrdersStream(restaurantId)` opens `EventSource("/api/orders/stream?restaurantId=...")`. Surfaces:
- `order: created|updated|deleted|split` → invalidates `["orders"]` query (so the visible list refreshes from the server).
- `booking-created|booking-updated|booking-deleted` → invalidates `["reservations"]`.
- Sets a global Zustand flag (`useOrdersStreamStateStore`) so the UI can show a "reconnecting" pip in the header.

Watchdog: 5s tick, 45s without `ping`/event → forced reconnect with exponential backoff (1s → 30s). `visibilitychange`/`online`/`focus` listeners proactively re-verify on tab wake.

A 30s React-Query poll on `["orders"]` is kept as a safety net (and `refetchIntervalInBackground: true` so a KDS-on-monitor with the window in the background stays current).

## API client (`src/lib/api.ts`)

- `BASE`: `"/api"` in dev (Vite proxy), `VITE_API_URL` (absolute) in prod. Kiosk hosts force `/api` regardless because they have their own nginx proxy → avoids CORS + `withCredentials` on EventSource.
- `api<T>(path, init)` — always `credentials: "include"`, adds `Content-Type: application/json` and `activeRestaurantHeader()`.
- On any 401 outside the `AUTH_PROBE_PATHS` set (`/auth/check`, `/auth/google`, `/auth/verify-otp`, `/auth/send-otp`), fires `POST /api/auth/logout` and bounces to the landing — one-shot guard via `isLoggingOut`.
- `ApiError` carries `status` + `data` + `message`. `show-api-error.ts` turns it into a sonner toast.
- `apiUrl(path)` builds a full URL when raw `fetch()` is needed (e.g. file uploads with `FormData`).

## i18n (`src/i18n.ts`)

35 locales. **Lazy** — `import.meta.glob("./locales/*.json")` (no `eager: true`) → Vite emits one chunk per locale. At boot, `bootstrapI18n()`:

1. Picks initial locale: URL path segment → `navigator.language` → `en`.
2. Loads that chunk + the EN fallback chunk. Calls `i18n.init({ resources, fallbackLng: "en", supportedLngs: SUPPORTED_LOCALES, nonExplicitSupportedLngs: true, load: "languageOnly", interpolation: { prefix: "{", suffix: "}" } })`.
3. On `languageChanged` → loads + registers the new bundle on demand; sets `<html lang>` and `<html dir>` (`rtl` for `ar`, `fa`).

`{var}` curly-brace interpolation (matching the legacy next-intl format) — not the i18next default `{{var}}`.

### `next-intl` migration shim

Many dashboard components were ported from a Next.js + `next-intl` codebase and still use `useTranslations("namespace")` and `useLocale()`. `vite.config.ts` aliases:

- `next-intl` and `next-intl/server` → `src/lib/i18n-compat.ts` — exposes `useTranslations`, `useLocale`, `useFormatter`, `NextIntlClientProvider`, `getTranslations`, etc. on top of `react-i18next`.
- `next/link`, `next/navigation`, `@/i18n/routing` → `src/lib/router-compat.tsx` — exposes `Link`, `useRouter`, `usePathname`, `useSearchParams`, `redirect` adapters on top of TanStack Router + the dashboard internal SPA router.

When adding new code, prefer importing `react-i18next` and TanStack Router directly. Keep the shims out of fresh modules.

## State management

- **TanStack Query** for server state (restaurant, categories, items, tables, orders, reservations, subscription, support messages, devices, admin panels). One client in `admin-bootstrap.tsx`; a second identical client in `kitchen-app.tsx` for the kiosk branch.
- **Context providers** in `_v2/`:
  - `RestaurantProvider` — current restaurant (the active one). `useRestaurant()`.
  - `RestaurantsProvider` — list of restaurants the user owns or has been granted access to + switcher action. `useRestaurants()`.
  - `SubProvider` — subscription + plan + trial + AI image quota.
- **Zustand stores** (`_v2/orders-sync-state.ts`) — orders-stream connection status; small purely-client flags.
- **localStorage**:
  - `iqr_device_token` / `iqr_device_type` — kiosk persistence (`lib/device-mode.ts`).
  - `dash_from_fired` (sessionStorage) — one-shot guard for `?from=<source>` analytics on root mount.

## Theming

Tailwind 3 + tailwindcss-animate. CSS variables for accent + neutrals live in `styles.css`. `ThemeProvider` wraps both apps. Dark/light mode follows system unless overridden.

## Deployment

GitHub Actions builds on push → uploads bundle → nginx serves under `dashboard.iq-rest.com` and the kiosk hosts. `nginx.conf` in the repo is the prod template (rewrites `/api/*` to `dashboard-api:8130`; SPA fallback for everything else).

## Conventions

- **Page-shape**: every screen mounts inside `DashboardChrome` (top header + bottom nav). Auth views skip chrome.
- **Always use `api()` for fetches**, not raw `fetch()` — otherwise you skip cookies, the active-restaurant header, version observation, and 401 handling.
- **Track navigation** with `track("dash_<area>_nav_<tab>")` — events feed `iq-rest-dashboard-api`'s `/track/:event` usage stream.
- **Lazy-load device-only code**: kiosk components live under `src/kitchen/` and are imported only inside the `isKioskHost() || demoBoard` branch in `main.tsx`. Don't drag them into admin imports.
- **Per-locale chunks**: a new locale = add a `<code>.json` to `src/locales/` and add the code to `SUPPORTED_LOCALES` in `i18n.ts`. Vite picks it up automatically.
- **View additions**: a new dashboard screen needs (a) a `View` variant in `_spa/types.ts`, (b) both directions in `_spa/url.ts`, (c) wiring in `chrome.tsx` if it gets a tab, (d) a renderer in `_spa/shell.tsx` or the relevant `_v2` component.
- **No emojis** anywhere (UI strings live in the locale JSONs).
- **PWA persistence** is the only purpose of the service worker — don't add request interception unless you have a plan for cache invalidation.

## Related repositories

- `iq-rest-dashboard-api` — backend (NestJS) that owns the Postgres schema, auth, SSE fan-out, and all `/api/*` endpoints this SPA hits
- `iq-rest-public-menu-api` — backend for the guest menu; cross-publishes to the same Postgres `orders_events` channel that powers dashboard SSE
- `iq-rest-public-menu` — guest-facing PWA opened by the menu-preview modal here
- `iq-rest-landing` — marketing landing (legacy; **not maintained**) — hosts sign-in/sign-up and the iframe demos that boot this bundle with `?demo=kitchen|orders|reservations`
