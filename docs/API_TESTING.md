# API testing

HTTP test suites for the local SaaS API (`http://localhost:4001` by default).

## Prerequisites

1. **Environment** — `.env` with `SAAS_DATABASE_URL=file:./prisma-saas/saas-dev.db`
2. **Demo data** — F&B, admin, and integration tests expect the full demo catalog:
   ```powershell
   npm run saas:seed-demo
   ```
   Or let tests call `POST /api/demo/seed` (owner/super_admin).
3. **API running** — `npm run dev:saas` (or use `:ci` scripts below).

## Test types

| Type | Tag / command | What it covers |
|------|---------------|----------------|
| **Smoke** | `npm run api-test:smoke` | Health, logins, basic reads, one sale |
| **Functional** | `npm run api-test:functional` | All endpoints: auth, users, stores, products, sales, org, F&B, admin |
| **Integration** | `npm run api-test:integration` | Multi-step flows (onboarding, cashier lifecycle, multi-store, F&B) |
| **Regression** | `npm run api-test:regression` | Full stable suite + response-shape contracts |
| **Fuzz** | `npm run api-test:fuzz` | Malformed payloads — must never return 500 |
| **Security** | `npm run api-test:security` | Delegates to `npm run security` (auth, RBAC, injection, JWT) |
| **Load** | `npm run api-test:load` | Sustained concurrent read/login load (pure Node, no extra deps) |
| **Stress** | `npm run api-test:stress` | Burst concurrent sales + ramp reads |

## Commands

```powershell
# All API tests (no filter)
npm run api-test

# CI: start server + run all
npm run api-test:ci

# By suite
npm run api-test:smoke
npm run api-test:functional
npm run api-test:integration
npm run api-test:regression
npm run api-test:fuzz

# Security (separate runner)
npm run api-test:security

# Load / stress (manual — not in default CI)
npm run api-test:load
npm run api-test:stress

# Everything: API regression + security + E2E
npm run test:all
```

Override base URL:

```powershell
$env:API_TEST_BASE_URL = "http://localhost:4001"
npm run api-test:smoke
```

## Project layout

```
api-tests/
  fixtures/          config, demo credentials, unique name helpers
  helpers/
    client.ts        ApiClient (auth, storeId, signup, seedDemo)
    runner.ts        test()/describe() with tags
    setup.ts         ensureDemoData, ownerClient, adminClient
    suite.ts         --suite / --tags parsing
  tests/
    smoke.test.ts
    auth.test.ts, catalog.test.ts, sales.test.ts, access-control.test.ts
    functional/      auth, users, stores, products, sales, org, fnb, admin
    integration/     onboarding, cashier-lifecycle, multi-store, fnb-flow
    regression/      contracts.test.ts
    fuzz.test.ts
  load/run.mjs       sustained concurrent load tests (pure Node)
  stress/run.mjs     burst + ramp stress tests
  index.ts           entry point
security/            security test suite (wired via api-test:security)
e2e/                 UI tests (TestCafe — see docs/E2E.md)
```

## Load / stress notes

- **SQLite** local dev may lock under heavy concurrent writes; stress tests allow up to 50% 5xx on burst sales.
- Set `STRESS_SKIP_WRITES=1` to skip write burst.
- Tune thresholds: `LOAD_CONCURRENCY`, `LOAD_DURATION`, `LOAD_P95_MS`, `STRESS_BURST_SIZE`.

## Out of scope

- Mobile Capacitor / Bluetooth printer
- Remote Vercel / Neon deployment targets
