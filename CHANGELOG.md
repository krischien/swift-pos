# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- **Inventory — OCR scan:** Remove individual extracted menu lines before import (per-row delete).
- **Sales (history):** Search (transaction id, cashier), filters for payment method (Cash / GCash) and void status (all / non-voided / voided), and paginated table (desktop and mobile). SaaS API supports `voidFilter` on `GET /api/sales` (`active` | `voided` | `all`); the page loads with `all` so voided rows can appear. Dashboard metrics and charts exclude voided sales.
- **Categories, Stores, Users:** Paginated tables with centered controls (prev / page numbers / next), aligned with Inventory styling.
- **Product type:** Optional `storeId` for client-side tagging when merging multi-store catalogs in reports.

### Changed

- **Reports — stock alerts:** Out-of-stock and low-stock lists use the same rules as Inventory (including `stock <= 0`, empty `variants` edge case). When “All stores” is selected and multiple stores exist, low/out-of-stock cards use the **current catalog** (`activeStoreId`) so they match the Inventory screen. Card descriptions note this when multi-store.
- **Checkout:** “Complete Sale” enables when the received amount covers the total using **centavo** comparison (avoids floating-point mismatches). **Server:** `POST /api/sales` and solo `createSale` validate payment the same way and store a normalized `change` value.

### Fixed

- **GCash / exact payment:** “Amount received is less than total due” could appear even when the UI showed an exact match; fixed on client (`CheckoutModal`) and server (`server/utils/money.ts`, SaaS and solo sale services).
