## Quick POS – Backbone Demo

Modern, responsive POS demo app built with React, Vite, Prisma + SQLite, and an Express API.

### Stack

- **Frontend**: React, TypeScript, Vite, shadcn-ui, Tailwind CSS, React Router
- **Backend**: Node.js, Express, Prisma ORM, SQLite
- **Other**: `xlsx` for exports, `date-fns` for date ranges

---

## Running the project locally

### 1. Install dependencies

```bash
npm install
```

### 2. Run Prisma migrations and seed data

This creates the SQLite database (`prisma/dev.db`) and seeds users, categories, products, and variants.

```bash
npx prisma migrate dev --name init
npm run prisma:seed
```

> If migrations are already applied, you can just run `npm run prisma:seed` to refresh seed data.

### 3. Start the API server

```bash
npm run dev:server
```

The API will run on `http://localhost:4000/api`.

### 4. Start the frontend

In a separate terminal:

```bash
npm run dev
```

The app will be available at `http://localhost:8080` (or the port Vite prints).

---

## User accounts and roles

The login screen no longer asks for a role. The role is determined from the database user record.

- **Admin**
  - **Email**: `john@example.com`
  - **Role**: `admin`
- **Cashier**
  - **Email**: `cashier@example.com`
  - **Role**: `cashier`

> Passwords are not enforced in this demo; any password will work as long as the email exists in the database.

**Access rules**:

- **Cashier**: POS page only.
- **Admin**: POS, Inventory, Sales, Settings.

---

## Features

### POS

- **Product browsing**
  - Category tabs and search.
  - Supports product variants (e.g., sizes).
  - Optional product images.
- **Cart and checkout**
  - Add products/variants to cart, adjust quantities, remove items.
  - Discount support (percentage-based, controlled by Settings).
  - Configurable tax rate (defaults to **12%**).
  - Ticket number generated for each sale and shown on the checkout modal.
- **Receipt printing**
  - After successful checkout, a printable receipt window is generated.
  - Store name, address, and logo visibility come from Settings.
- **Mobile-friendly layout**
  - Optimized UI below 720px width.
  - Items/search are prioritized; cart opens in a bottom sheet with a floating checkout button.

### Inventory

- **Product list**
  - Shows item code, name, category, price/stock, status, and actions.
- **Add / Edit product**
  - Auto-generated **item code** (read-only) for new products.
  - Optional image upload field used on the POS page.
  - Supports products with or without variants.
- **Delete product**
  - Delete with confirmation; list updates immediately.
- **Variants management**
  - Per-product “Variants” dialog to add/edit/delete variants.
  - Inline editing for name, price, stock.
- **Export to Excel**
  - Exports full inventory list with key fields using `xlsx`.

### Sales

- **Sales history table**
  - Lists completed sales with ticket number, totals, payment method, and timestamps.
- **Filter by date**
  - Dialog to select custom date range (from / to).
- **Print**
  - Prints the currently visible sales table (respects active filters).
- **Export comparison reports**
  - Export dropdown: Today, This Week, This Month, This Quarter, This Year.
  - Compares inventory in/out vs sales for the selected period in an Excel file.

### Settings

- **Store identity**
  - Store name and address (used on receipts; falls back to defaults if empty).
- **Receipt options**
  - Auto-print on successful sale.
  - Toggle to show/hide logo on receipt.
- **POS options**
  - Enable/disable discounts.
  - Enable/disable barcode scanning (flag wired; scanner handling can be implemented later).
- **Tax**
  - Configurable tax rate (percentage), default **12%**.

---

## Notes

- The database is SQLite and lives in `prisma/dev.db`.
- Seeding (`npm run prisma:seed`) **clears and recreates** data (users, categories, products, variants, sales). Only run it when you’re okay losing current data.
- API base URL can be overridden with `VITE_API_URL`; by default the frontend uses `http://localhost:4000/api`.
