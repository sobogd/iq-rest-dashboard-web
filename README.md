# IQ Rest Dashboard Web

Vite + React + TanStack Router/Query + Tailwind v4 + react-i18next.

## Stack

- **Vite + React 19** — SPA
- **TanStack Router** — file-based, type-safe routing (`src/routes/`)
- **TanStack Query** — server state, caching, mutations
- **Tailwind v4** — via `@tailwindcss/vite`
- **react-i18next** — i18n
- **Zustand** — client-side global state (cart, ui)

## Setup

```bash
npm install
cp .env.example .env
npm run dev
```

Opens at `http://localhost:5173`. API expected at `http://localhost:4000/api`.

## Routes (file-based)

```
src/routes/
  __root.tsx         shell + devtools
  index.tsx          → redirects to /dashboard
  login.tsx          /login
  dashboard.tsx      /dashboard layout
  dashboard.index.tsx /dashboard (home)
```

Add new pages under `src/routes/` and TanStack regenerates `routeTree.gen.ts`.
