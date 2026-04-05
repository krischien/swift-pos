# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Application features (reference)

Capabilities present in **QuickScale** today (see also [`README.md`](README.md)); not every item below is new in this release—this section documents the product surface for readers of the changelog.

- **Inventory — OCR menu import:** Photo of a menu → Tesseract.js (`src/lib/ocrService.ts`) extracts text → `parseMenuItems` maps lines to name/price → `OCRScanDialog` lets you review rows and import into the catalog.
- **Inventory — exports:** BIR inventory report (XLSX/PDF), barcode list (Word/docx with embedded barcodes), low-stock list, and spreadsheet-oriented exports where implemented.
- **Sticker generator (owner):** QR/barcode stickers for SKU/price; supports per-kilo mode when enabled in settings.
- **POS:** Category tabs, search, variants, cart, discounts/tax, cash + GCash, tickets/receipts, native Bluetooth printing where available.
- **Sales & reports:** History, voids, prints/exports, dashboard metrics, cash count (bills/GCash), multi-store views in SaaS.
- **SaaS platform:** Org signup, JWT auth, multi-store switcher, owner/cashier roles, Super Admin (orgs, users, stores, product ranking), trial/suspension flows.
- **Solo mode:** Offline-first single-store data layer (local API optional); distinct from SaaS.
- **Mobile (Capacitor):** Android builds; SaaS paths use configurable API URL; offline cache/sync patterns as implemented in `offlineSaasDataService` / SQLite plugins.

### Added

- `server/saas/constants/demo.ts` — shared `DEMO_TRIAL_DAYS` (15) and `addDays()` for demo org trial windows.
- Dev-only auto full demo seed (`runSeedDemoIfEmptyDev`) when **Demo Organization** has no products in its stores (or DB has no products and no demo org). Set `SAAS_AUTO_SEED_DEMO=false` to disable. Skipped when `NODE_ENV=production`.
- `saas:seed-demo` CLI (`server/saas/seed-demo.ts`) now delegates to `runSeedDemo()` instead of duplicating logic.
- `ensureDemoQuickLoginUsers()` — ensures `admin@demo.com`, `owner@demo.com`, and `cashier@demo.com` exist when bootstrap was skipped (e.g. users signed up first).
- `GET /api/stores` — **super_admin** (no org) receives Demo Organization stores so POS can resolve a `storeId`.
- Tenant `userStore` DB check in `tenant.ts` — cashiers and other assigned users can access stores when JWT `storeIds` are stale (e.g. after reseed); `GET /api/stores` for org users lists stores from `UserStore` + `Store` instead of JWT only.

### Changed

- Local dev defaults: `.env` / `.env.saas` use `VITE_SAAS_API_URL=http://localhost:4001` for the SPA; mobile release builds still override via `package.json` scripts where applicable.
- Demo trial length set to **15 days** in bootstrap seed, full demo seed, `unsuspendDemoOrg`, and related flows (was 7 days in full seed, fixed date in some paths).
- SaaS API startup order (non-production): `runSeedDemoIfEmptyDev` → `ensureDemoQuickLoginUsers` → `resetDemoPasswords` → `unsuspendDemoOrg` so full seed runs before quick-login user repair.
- **`StoreContext` (SaaS):** Always refetches `/api/stores` when a token exists; initial `storesLoading` when logged in; clears offline IndexedDB when `activeStoreId` is no longer in the fetched store list.
- **`AuthContext`:** SaaS login maps `user.role` with `UserRole` (includes `owner`, `super_admin`).
- **`fetchStores`:** Logs HTTP failures to the console instead of failing silently.
- **`POS`:** Waits for `storesLoading` before loading catalog so stale `storeId` is not used.

### Fixed

- Quick login “invalid credentials” when bootstrap did not run because the DB already had users.
- Empty POS / reports after seed or reseed: stale `saas_stores` / `saas_active_store_id` in `localStorage` pointing at deleted store IDs; **403 “Access denied to this store”** on categories/products for cashiers when JWT `storeIds` did not match current `UserStore` rows in the database.
