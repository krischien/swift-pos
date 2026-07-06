# E2E tests (TestCafe)

End-to-end tests for the local SaaS stack: Vite on port **8080**, API on **4001**, SQLite at `prisma-saas/saas-dev.db`.

TestCafe is configured via `e2e/.testcaferc.cjs` (passed with `--config-file` in npm scripts).

## Prerequisites

1. **Environment** — `.env` should include:
   ```
   SAAS_DATABASE_URL=file:./prisma-saas/saas-dev.db
   ```

2. **Demo users** — created on first API bootstrap (or via `npm run saas:seed-demo`):
   | Role | Email | Password | Lands on |
   |------|-------|----------|----------|
   | Super admin | `admin@demo.com` | `password123` | `/admin` |
   | Owner | `owner@demo.com` | `password123` | `/pos` |
   | Cashier | `cashier@demo.com` | `password123` | `/pos` |

3. **Demo catalog** — POS tests expect sellable products. The demo seed (`runSeedDemoIfEmptyDev` on API start) creates categories and products. If the DB is empty, start the API once and wait for bootstrap, or run `npm run saas:seed-demo`.

4. **Chrome** — TestCafe drives locally installed Chrome.

5. **Rate limits** — `start:saas:e2e` sets `RATE_LIMIT_DISABLED=1` on the API so the suite can log in many times (each test fixture calls `loginAs`). Without this, login is capped at **10 per 15 minutes** and later tests fail with `expected '/login' to include '/pos'`.

## Running tests

### Two terminals (manual)

```powershell
# Terminal 1 — start SaaS with splash screen skipped for E2E
npm run start:saas:e2e

# Terminal 2 — run tests (headed Chrome)
npm run e2e
```

Headless:

```powershell
npm run e2e:headless
```

After the TestCafe report, a colored summary is printed:

- **Green** `✓ ALL TESTS PASSED (N tests)` when every test passes
- **Red** `✗ TESTS FAILED` with fixture name, error message, and file location for each failure

### One command (CI-style)

Starts the server, waits for health checks, runs headless tests, then stops the server:

```powershell
npm run e2e:ci
```

## What is covered

- **Login** — admin, owner, cashier success; invalid password; empty form; cashier blocked from `/admin`
- **Signup** — new account creation lands on POS
- **POS** — cash and GCash checkout; verification on Sales page; cashier cash smoke
- **Sales void** — owner voids a transaction from Sales page
- **CRUD (owner)** — categories, inventory, stores, users (unique `e2e-*` names)
- **Access control** — cashier redirected from `/categories`; owner nav hidden
- **Reports & Settings** — owner can open pages
- **Store switching** — owner switches between stores (multi-store demo)
- **F&B** — Menu and Ingredients pages (when F&B store selected)
- **Admin** — organizations, product ranking, payment monitoring, org detail

## Out of scope

- Mobile Capacitor / Bluetooth printer
- Remote Vercel/Neon targets

See also [API_TESTING.md](./API_TESTING.md) for HTTP-level test suites.

## Project layout

```
e2e/
  .testcaferc.cjs      # baseUrl, timeouts, reporter
  fixtures/            # demo credentials, unique name helpers
  helpers/             # login, navigation, setup
  page-objects/        # selectors per page
  tests/               # *.test.ts
```

## Troubleshooting

| Issue | Fix |
|-------|-----|
| `ECONNREFUSED` on login | Run `npm run start:saas:e2e` (not `npm run dev` alone) |
| Tests hang on splash | Use `start:saas:e2e` so `VITE_E2E=true` skips the splash |
| Stuck on `/login` mid-suite (Users CRUD, Login tests) | Login rate limit (10/15min). Use `npm run e2e:ci` or `start:saas:e2e` (sets `RATE_LIMIT_DISABLED=1`), or run `cross-env RATE_LIMIT_DISABLED=1 npm run dev:saas` manually |
| No products on POS | Run `npm run saas:seed-demo` or let API bootstrap seed |
| SQLite locked / slow first run | Increase wait in `e2e:ci` or retry after migrations finish |
