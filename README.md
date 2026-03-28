# QuickScale

## Contents

- [Overview](#overview)
- [Features](#features)
- [Tech stack](#tech-stack)
- [Prerequisites](#prerequisites)
- [Run commands](#run-commands)
- [Changelog](#changelog)
- [Project layout](#project-layout-high-level)
- [License](#license)

---

## Overview

A modern web and mobile point-of-sale (POS) platform built for retail operations, covering everything from checkout to inventory and reporting in one cohesive system.

The application operates in two distinct modes, controlled via `VITE_APP_MODE`, allowing it to scale from a single device to a full multi-tenant SaaS platform:

### 🧾 Modes of Operation

#### Solo (default)

An offline-first, single-store experience designed for reliability and speed. Data is stored locally using browser storage or on-device SQLite, ensuring the app continues to function even without internet connectivity. An optional lightweight Express API can be used during development.

#### SaaS

A fully cloud-enabled, multi-tenant architecture supporting organization onboarding, secure JWT-based authentication, and subscription or trial management. Each organization can manage multiple stores, while a centralized Super Admin console provides platform-wide oversight and control.

### 📦 Deployment Flexibility

Whether running as a standalone offline POS or a scalable SaaS platform, the app adapts to your needs with minimal configuration. From a single cashier terminal to a multi-branch retail ecosystem, it’s built to grow without friction.

**Where to read more:** [Features](#features) (checkout, inventory, reporting, multi-store, roles) · [Tech stack](#tech-stack) (Vite/React, Prisma, Capacitor, exports, etc.) · [Run commands](#run-commands)

---

## Features

### Point of sale

- Product grid with category tabs, search, and product variants (size, color, etc.).
- Cart with quantity, discounts (when enabled), tax (configurable rate), and optional per-kilo pricing.
- Checkout with **cash** (change calculation) and **GCash** (transaction ID).
- Ticket numbers, receipt settings (auto-print, logo, Bluetooth printer integration on native).

### Catalog & inventory (owner)

- Categories, products, variants, stock levels, barcodes, and margin/profit context.
- Paginated lists and search on inventory and related screens.

### Sales & reports

- Sales history with date filters, search, payment filter, void (when supported), print list, and Excel-oriented export flows.
- Dashboard-style reports: trends, comparisons, top sellers, and operational reports including **cash count** (expected vs actual, bill breakdown, GCash totals) where implemented.

### Organization (SaaS)

- Sign up flow for new organizations; login with store switcher for users with multiple stores.
- **Stores** management (SaaS): create/edit/delete stores and sync context with the app shell.
- **Users** with roles (e.g. owner, cashier) and store scoping.

### Super Admin (SaaS, `super_admin` role)

- Platform dashboard, organizations list/detail, notifications, org users and stores, and **product ranking** reports across stores.

### Other

- **Sticker generator** (owner): label/sticker tooling for products.
- **Settings**: store profile, receipt and printer options, tax/discount toggles, demo seed (SaaS) where available.
- Role-based routes: cashiers focus on POS; owners get inventory, sales, users, categories, stores, stickers; reports for owner/admin tiers.

---

## Tech stack

| Area | Technology |
| --- | --- |
| App shell | Vite, React 18, React Router |
| UI | Tailwind CSS, shadcn/ui, Radix |
| Data (web) | Context + data layer abstraction |
| SaaS API | Node (Express), Prisma, JWT |
| Mobile | Capacitor Android, community SQLite |
| Charts | Recharts |
| Exports | xlsx / ExcelJS as used in app |

---

## Prerequisites

- **Node.js** (LTS recommended) and **npm**
- **SaaS backend:** PostgreSQL or SQLite per your Prisma schema; run migrations and generate clients (see [Run commands](#run-commands) → Database)
- **Android:** Android Studio and SDK; Capacitor CLI via project devDependencies

---

## Run commands

Commands are defined in `package.json`. Common ones:

| Command | What it does |
| ------- | ------------- |
| `npm install` | Install dependencies. Run once after clone. |
| `npm run dev` | Start the **Vite dev server** (frontend only). Solo mode unless `VITE_APP_MODE=saas` is set. Hot reload for UI work. |
| `npm run dev:server` | Start the **solo/local Express API** (`server/index.ts`) if you use the bundled server for solo development. |
| `npm run dev:saas` | Start the **SaaS API** (`server/saas/index.ts`) — JWT, orgs, stores, etc. Requires DB and Prisma client for SaaS schema. |
| `npm run dev:saas:sqlite` | Generate Prisma client for SaaS dev SQLite schema, then run `dev:saas`. Handy for local SaaS without Postgres. |
| `npm run start:saas` | Runs **`dev:saas` and `dev` together** (API + web) via `concurrently` for full-stack SaaS local development. |
| `npm run start:mobile` | Alias for **`dev:saas`** — use when the mobile app points at this machine’s API (pair with `VITE_SAAS_API_URL` in builds). |
| `npm run build` | Production build of the SPA (default Vite mode). |
| `npm run build:solo` | Same as default build; explicit solo naming. |
| `npm run build:saas` | Build with **`--mode saas`** so SaaS env vars and API URLs apply. |
| `npm run preview` | Serve the built app locally to test production output. |
| `npm run lint` | Run ESLint on the project. |

### Database (Prisma)

| Command | What it does |
| ------- | ------------- |
| `npm run prisma:generate` | Generate client for default Prisma schema. |
| `npm run prisma:migrate` | Run migrations (default schema). |
| `npm run prisma:generate:saas` / `prisma:migrate:saas` | SaaS **Postgres** schema under `prisma-saas/`. |
| `npm run prisma:generate:saas:dev` / `prisma:migrate:saas:dev` / `prisma:push:saas:dev` | SaaS **SQLite dev** schema variants. |

### Seeds

| Command | What it does |
| ------- | ------------- |
| `npm run prisma:seed` | Seed solo/local DB via `server/seed.ts`. |
| `npm run saas:seed` | Seed SaaS database. |
| `npm run saas:seed-demo` | Seed SaaS demo data (e.g. demo org/users). |

### Mobile (Capacitor / Android)

| Command | What it does |
| ------- | ------------- |
| `npm run build:mobile:solo` | `build:solo` then `cap sync android`. |
| `npm run build:mobile:saas` | `build:saas` then `cap sync android`. |
| `npm run build:mobile:saas:emulator` | SaaS build with API URL `http://10.0.2.2:4001` (Android emulator → host). |
| `npm run build:mobile:saas:local` / `:remote` / `:adb` | Preset `VITE_SAAS_API_URL` for LAN, remote server, or adb reverse scenarios. |
| `npm run mobile:emulator:tunnel` | `adb reverse` to forward port 4001 for device ↔ host API. |
| `npm run cap:open` | Open the Android project in Android Studio. |
| `npm run cap:sync` / `cap:sync:solo` / `cap:sync:saas` | Build + sync web assets into native projects. |

### Deploy / CI

| Command | What it does |
| ------- | ------------- |
| `npm run build:api` | Bundle SaaS API with esbuild to `api/index.js` for serverless or Node hosting. |
| `npm run vercel:build` | SaaS frontend build + Prisma generate step + API bundle for Vercel-style pipelines. |

**Environment**

- **`VITE_APP_MODE`**: `solo` or `saas` — switches data layer and features.
- **`VITE_SAAS_API_URL`**: Base URL of the SaaS API for web and Capacitor builds (e.g. `http://localhost:4001` or your deployed API).

---

## Changelog

### Unreleased

- Paginated list views on Categories, Stores, Users (and related list pages) for large datasets.
- Reports: cash count section with bill/cash breakdown and Excel export alignment.
- Login: demo “Admin” quick-login button removed (admin still works via manual email/password).

### Earlier

- SaaS mode: signup, orgs, multi-store, JWT, super-admin area (organizations, product ranking).
- Solo/offline path with local storage and Capacitor SQLite.
- POS checkout (cash/GCash), receipts, Bluetooth printing hooks.
- Inventory variants, sales history, void, exports, and role-based navigation.

Update this section when tagging releases or merging significant changes.

---

## Project layout (high level)

- `src/` — React app: `pages/`, `components/`, `contexts/`, `lib/`, `config/`
- `server/` — Solo API and SaaS API entrypoints
- `prisma/` — Solo Prisma schema
- `prisma-saas/` — SaaS Prisma schemas (Postgres, SQLite dev, etc.)
- `android/` — Capacitor Android project

---

## License

Private / unlicensed unless you add a `LICENSE` file.
