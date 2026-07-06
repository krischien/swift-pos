# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Security (Phase 1.4)

- **Production startup checks** (`server/saas/validateSecurityEnv.ts`): fail fast on weak/missing `JWT_SECRET` in production; exit on Vercel when `SAAS_CORS_ORIGINS` is empty or `*`.
- **Demo endpoints:** `POST /api/demo/seed` returns 404 in production (same as reset-passwords).
- **Rate limiting:** `express-rate-limit` on login (10/15min), signup (5/hour), demo routes (3/hour); disable locally with `RATE_LIMIT_DISABLED=1`.
- **Request bounds:** JSON body limit 1mb; signup min password 8 chars + email/name length validation.
- **Headers:** `helmet` on API; security headers on Vercel SPA (`vercel.json`).
- **Input sanitization:** `trimString` / `requireTrimString` on category, product, user, store, and org write paths.
- **Dev QA:** `npm run saas:seed-second-org` creates Org B (`owner@orgb.demo.com`) for cross-tenant manual testing.
- **Scripts:** `npm run security:audit` for dependency scanning.

### Application features (reference)

Capabilities present in **SwiftPOS** today (see also [`README.md`](README.md)); not every item below is new in this release—this section documents the product surface for readers of the changelog.

- **Inventory — OCR menu import:** Photo of a menu → Tesseract.js (`src/lib/ocrService.ts`) extracts text → `parseMenuItems` maps lines to name/price → `OCRScanDialog` lets you review rows and import into the catalog.
- **Inventory — exports:** BIR inventory report (XLSX/PDF), barcode list (Word/docx with embedded barcodes), low-stock list, and spreadsheet-oriented exports where implemented.
- **Sticker generator (owner):** QR/barcode stickers for SKU/price; supports per-kilo mode when enabled in settings.
- **POS:** Category tabs, search, variants, cart, discounts/tax, cash + GCash, tickets/receipts, native Bluetooth printing where available.
- **Sales & reports:** History, voids, prints/exports, dashboard metrics, cash count (bills/GCash), multi-store views in SaaS, **daily operational insights** on Sales (today), **store performance leaderboard** on Reports (all-stores).
- **SaaS platform:** Org signup, JWT auth, multi-store switcher, owner/cashier roles, Super Admin (orgs, users, stores, product ranking, payment monitoring, monthly billing payment ledger), trial/suspension flows.
- **Solo mode:** Offline-first single-store data layer (local API optional); distinct from SaaS.
- **Mobile (Capacitor):** Android builds; SaaS paths use configurable API URL; offline cache/sync patterns as implemented in `offlineSaasDataService` / SQLite plugins.

### Added

- **Sales (daily summary):** Owner-focused operational insight cards for today: **Items Sold Today**, **Top Payment Method** (with amount), **Top Cashier Today** (with revenue), and **Peak Hour Today** (with transaction count). Derived from same-day non-void sales already loaded on the page.

- **Reports (historical, multi-store):** **Store Performance Leaderboard** in all-stores view — ranks branches by **sales**, **transactions**, **average sale**, and **sales share %** for the selected date range.

- **Super Admin — Billing ledger (org detail):** Prisma model `OrganizationBillingPayment` (migration `20260401000000_add_organization_billing_payments`); `GET/POST /api/admin/organizations/:orgId/billing-payments`. Record payment for a calendar month (`YYYY-MM`); **advances `billingDueDate`** to the last day of the month after the paid month (12:00 UTC, via `server/saas/utils/billingPayment.ts`); **expires** billing-related org notifications (all `warning`/`urgent`, plus `info` messages matching payment/billing keywords). One payment row per org per month (`@@unique([organizationId, period])`). Optional amount (cents), method, note; optional `recordedBy` from JWT. Org detail UI: payment history table and **Record billing payment** dialog.

- **Super Admin — Payment monitoring:** Page `/admin/payment-monitoring`, nav entry, and `GET /api/admin/payment-monitoring` — orgs with **billing due date** within 90 days or overdue (status: overdue / due within 7 / 30 / 90 days), recent in-app **organization notifications** per org (batched per org for SQLite), and a **Paid plans without billing due date** list. Dashboard **Billing due soon** and **Overdue billing** cards link here.

- **Super Admin — Dashboard:** `overdueBillingCount` on `GET /api/admin/overview` (orgs with `billingDueDate` before today); highlighted overdue KPI card; color-accent stat cards for org/user/store/plan counts.
- `server/saas/constants/demo.ts` — shared `DEMO_TRIAL_DAYS` (15) and `addDays()` for demo org trial windows.
- Dev-only auto full demo seed (`runSeedDemoIfEmptyDev`) when **Demo Organization** has no products in its stores (or DB has no products and no demo org). Set `SAAS_AUTO_SEED_DEMO=false` to disable. Skipped when `NODE_ENV=production`.
- `saas:seed-demo` CLI (`server/saas/seed-demo.ts`) now delegates to `runSeedDemo()` instead of duplicating logic.
- `ensureDemoQuickLoginUsers()` — ensures `admin@demo.com`, `owner@demo.com`, and `cashier@demo.com` exist when bootstrap was skipped (e.g. users signed up first).
- `GET /api/stores` — **super_admin** (no org) receives Demo Organization stores so POS can resolve a `storeId`.
- Tenant `userStore` DB check in `tenant.ts` — cashiers and other assigned users can access stores when JWT `storeIds` are stale (e.g. after reseed); `GET /api/stores` for org users lists stores from `UserStore` + `Store` instead of JWT only.

### Changed

- **`saasLogin` (`src/lib/saasAuth.ts`):** Clearer login failures — parses JSON `message`/`error`, falls back to response body text, and hints when the SaaS API is unreachable (e.g. `npm run dev:saas` on port 4001).

- Local dev defaults: `.env` / `.env.saas` use `VITE_SAAS_API_URL=http://localhost:4001` for the SPA; mobile release builds still override via `package.json` scripts where applicable.
- Demo trial length set to **15 days** in bootstrap seed, full demo seed, `unsuspendDemoOrg`, and related flows (was 7 days in full seed, fixed date in some paths).
- SaaS API startup order (non-production): `runSeedDemoIfEmptyDev` → `ensureDemoQuickLoginUsers` → `resetDemoPasswords` → `unsuspendDemoOrg` so full seed runs before quick-login user repair.
- **`StoreContext` (SaaS):** Always refetches `/api/stores` when a token exists; initial `storesLoading` when logged in; clears offline IndexedDB when `activeStoreId` is no longer in the fetched store list.
- **`AuthContext`:** SaaS login maps `user.role` with `UserRole` (includes `owner`, `super_admin`).
- **`fetchStores`:** Logs HTTP failures to the console instead of failing silently.
- **`POS`:** Waits for `storesLoading` before loading catalog so stale `storeId` is not used.

### Fixed

- **Super Admin — Payment monitoring:** notification grouping used an undefined org id when building the per-org “recent notifications” map, which could break `GET /api/admin/payment-monitoring` once any org fell in the billing window.
- **Super Admin — Product ranking (`/admin/product-ranking`):** “All stores” could return no rows, hang, or **500** on SQLite because Prisma generated a very slow/ stuck plan for `SaleItem` → `Sale` with `storeId: { in: [many ids] }`. Ranking now runs **one `saleItem` query per store** (same fast shape as a single-store filter) and merges results. **All stores** also omits the `storeId` query param in the client so it is not mistaken for a real store id; the server normalizes `storeId` and parses `from` / `to` so invalid/empty strings do not produce `Invalid Date` errors.
- **Super Admin — Product ranking:** Aggregates both **retail** (`productId`) and **F&B** (`menuItemId`) lines; store drilldown supports **menu** rows via `menuItemId`.
- Quick login “invalid credentials” when bootstrap did not run because the DB already had users.
- Empty POS / reports after seed or reseed: stale `saas_stores` / `saas_active_store_id` in `localStorage` pointing at deleted store IDs; **403 “Access denied to this store”** on categories/products for cashiers when JWT `storeIds` did not match current `UserStore` rows in the database.

### Deployment / ops (SaaS)

- Apply SaaS DB migration for `OrganizationBillingPayment` (Postgres: `prisma migrate deploy` with `schema.pg.prisma`; dev SQLite: migration folder under `prisma-saas/migrations/`).
- Vercel/production serves the bundled `api/index.js` — run `npm run build:api` (or `npm run vercel:build`) after pulling so billing-payment and payment-monitoring routes are included.

### Added (Admin — product ranking)

- Date presets: **This year** (year-to-date, UTC) and clearer label **Last 12 months** (replaces the older “last year” wording for the rolling window).
- Empty-state copy when there are no lines in range (suggests widening the range and checking Sales).
