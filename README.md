# QuickScale POS

A point-of-sale system with multi-store support, inventory management, and reporting. Built for retail, cafes, and small businesses—with offline-first solo mode and cloud-based SaaS mode.

## Overview

QuickScale POS runs in two modes:

- **Solo** — Single store, offline-first. Uses a local SQLite database and Express server. Ideal for standalone terminals or mobile devices.
- **SaaS** — Multi-store, cloud-based. Organizations can have multiple stores, users, and roles. Uses JWT auth and supports SQLite (dev) or PostgreSQL (prod).

### Features

| Feature | Description |
|--------|-------------|
| **POS** | Point-of-sale with cart, checkout, payment methods (cash, GCash), discounts, and receipt printing |
| **Inventory** | Products, categories, variants, stock levels, low-stock alerts, unit of measure, OCR barcode scanning |
| **Sales** | Transaction history, void sales, date filters |
| **Reports** | Revenue, net profit, void count, payment method breakdown, charts (bar, line, pie), date range presets |
| **Sticker Generator** | Barcode/QR labels for products (SKU, weight, price) |
| **Categories** | Product categorization per store |
| **Stores** | Multi-store management (SaaS) |
| **Users** | Role-based access: `super_admin`, `owner`, `admin`, `cashier` |
| **Settings** | Store info, receipt logo, currency, BIR compliance fields |
| **BIR Reports** | BIR Annex A inventory list export (PDF, XLSX) |

### Roles

- **super_admin** — Platform admin; manages organizations, sees Super Admin dashboard
- **owner** — Full access to POS, inventory, sales, reports, categories, stores, users, settings
- **admin** — POS, reports
- **cashier** — POS only

## Tech Stack

- **Frontend:** Vite, React, TypeScript, shadcn-ui, Tailwind CSS, React Query, Recharts
- **Backend:** Express, Prisma (SQLite / PostgreSQL)
- **Mobile:** Capacitor (Android), Bluetooth receipt printing
- **Other:** JWT auth, bcrypt, ExcelJS, Puppeteer (BIR PDF), Tesseract (OCR)

## Getting Started

### Prerequisites

- Node.js 18+ & npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating)

### Setup

```sh
# Clone the repository
git clone <YOUR_GIT_URL>
cd swift_pos

# Install dependencies
npm install

# Copy .env.example to .env and configure
cp .env.example .env

# Run database migrations (SaaS mode)
npm run prisma:migrate:saas

# Seed demo data (optional) — Cafe + Pet Store with 10 days of sales
npm run saas:seed-demo
```

### Demo Credentials (after seeding)

| Role | Email | Password |
|------|-------|----------|
| Owner | owner@demo.com | password123 |
| Admin (Cafe) | maria@demo.com | password123 |
| Cashier (Pet Store) | juan@demo.com | password123 |

### Development

```sh
# Start SaaS API + web dev server
npm run start:saas

# Or run separately:
# Terminal 1: npm run dev:saas   (API on port 4001)
# Terminal 2: npm run dev        (Vite on port 8080)
```

### Build

```sh
# SaaS mode
npm run build:saas

# Solo mode
npm run build:solo
```

### Mobile (Android)

```sh
npm run build:mobile:saas
npm run cap:open
```

Set `VITE_SAAS_API_URL` to your machine's IP when building for a physical device.

### Android production (SaaS + PostgreSQL)

To build the Android app so it uses your production server and PostgreSQL:

1. **Copy the production env template:**
   ```sh
   cp .env.saas-production.example .env.saas-production
   ```

2. **Edit `.env.saas-production`** and set `VITE_SAAS_API_URL` to your production API URL (e.g. `https://api.yourdomain.com`).

3. **Build the Android app:**
   ```sh
   npm run build:mobile:saas:prod
   ```

4. **Open Android Studio** and run on a device or emulator:
   ```sh
   npm run cap:open
   ```

5. **Server CORS:** Ensure your SaaS server's `SAAS_CORS_ORIGINS` includes `capacitor://localhost` so the Android app can reach the API.

For full deployment steps (signing, Play Store upload), see [DEPLOY_ANDROID.md](DEPLOY_ANDROID.md).

## Environment

| Variable | Description |
|----------|-------------|
| `VITE_APP_MODE` | `solo` or `saas` |
| `VITE_SAAS_API_URL` | SaaS API base URL (e.g. `http://localhost:4001`) |
| `SAAS_DATABASE_URL` | SQLite (`file:./prisma-saas/saas-dev.db`) or PostgreSQL |
| `JWT_SECRET` | Secret for JWT signing (required in production) |
| `SUPER_ADMIN_EMAILS` | Comma-separated emails with super_admin access |
| `SAAS_CORS_ORIGINS` | Allowed CORS origins (production) |
