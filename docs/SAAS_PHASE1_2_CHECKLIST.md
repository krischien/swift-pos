# SaaS Phase 1–2 Technical Checklist

**Goal:** Full cloud SaaS for **small multi-store** businesses (sales + inventory monitoring).  
**Not in scope:** Enterprise HA, audit-certified ledgers, full accounting.

**Base branch:** `kristian/quick-scale` (SaaS). Current solo app lives on `kristian/quick-brew`.  
**Production target:** Vercel (API) + Neon PostgreSQL.

Use this as an implementation checklist. Mark items `[x]` as you complete them.

---

## Prerequisites

- [ ] **Merge or rebase** `kristian/quick-scale` into your main working branch (or develop directly on `quick-scale`).
- [ ] **Rotate secrets** if `.env` / `.env.saas` with `JWT_SECRET` or Neon URLs were ever committed.
- [ ] **Vercel env:** `SAAS_DATABASE_URL` (Neon pooled), `JWT_SECRET`, `SUPER_ADMIN_EMAILS=admin@demo.com`, `VITE_APP_MODE=saas`, `SAAS_CORS_ORIGINS` (your domain + Capacitor origins).
- [ ] **Neon:** run migrations — `npx prisma migrate deploy --schema=prisma-saas/schema.pg.prisma` (or `db push` for greenfield).
- [ ] **Deploy:** `npm run vercel:build` after API changes so `api/index.js` is current.

---

## Phase 1 — SaaS foundation

### 1.1 Database & environment (Postgres-only in prod)

| Status | Task | Notes |
|--------|------|-------|
| [ ] | **Prod uses `schema.pg.prisma` only** | Dev may use SQLite via `prisma-saas/schema.prisma`; prod must not. |
| [ ] | **Remove Postgres URL from local `.env` committed to git** | Use Vercel dashboard + local `.env.local` (gitignored). |
| [ ] | **Enable Neon backups / PITR** | In Neon console — you don’t build this; document that ops relies on Neon. |
| [ ] | **Add migration for any new Phase 2 tables** | See §2.1 `ActivityLog`, void columns. |

**Existing on `quick-scale`:** `validateDatabaseEnv.ts` blocks Postgres URL in SQLite dev server — good pattern.

### 1.2 API auth & tenant isolation

| Status | Task | File(s) |
|--------|------|---------|
| [x] | JWT login (`POST /api/auth/login`) | `server/saas/index.ts`, `middleware/auth.ts` |
| [x] | `authMiddleware` on `protectedRouter` + `ownerRouter` | `server/saas/index.ts` |
| [x] | `tenantMiddleware` — `storeId` required, org/store access check | `server/saas/middleware/tenant.ts` |
| [x] | Owner bypass for stores in org; cashier via `UserStore` DB | `tenant.ts` |
| [ ] | **Audit all routes** — nothing tenant-scoped outside `protectedRouter` / `ownerRouter` / `adminRoutes` except `health`, `login`, `signup` | `server/saas/index.ts` |
| [x] | **Move product write routes to `ownerRouter` only** | `POST/PUT/DELETE /api/products` and variant writes on `ownerRouter`; cashiers read-only via `protectedRouter` |

### 1.3 Lock down production-only dangers

| Status | Task | File(s) |
|--------|------|---------|
| [x] | **Gate `POST /api/demo/reset-passwords`** | Returns 404 when `NODE_ENV=production` or `VERCEL=1`; still works on local `npm run dev:saas` |
| [x] | **Tighten CORS in prod** | `*` and empty `SAAS_CORS_ORIGINS` are permissive in dev only; production uses explicit origins + Capacitor WebView origins |
| [x] | **CORS startup enforcement on Vercel** | `validateSecurityEnv.ts` exits if `SAAS_CORS_ORIGINS` is empty or `*` when `VERCEL=1` |
| [ ] | **Do not ship solo backup endpoints** | `server/index.ts` `/api/backups/*` — remove with solo stack (Phase 1.5) |

### 1.4 Security hardening (Phase 1.4)

| Status | Task | File(s) |
|--------|------|---------|
| [x] | **JWT_SECRET validation in production** | `server/saas/validateSecurityEnv.ts` — exit if missing, default, or &lt; 32 chars |
| [x] | **Gate `POST /api/demo/seed` in production** | Returns 404 when `NODE_ENV=production` or `VERCEL=1` (matches reset-passwords) |
| [x] | **Rate limits on login, signup, demo routes** | `server/saas/middleware/rateLimit.ts`; `RATE_LIMIT_DISABLED=1` for local testing |
| [x] | **JSON body size limit (1mb)** | `express.json({ limit: "1mb" })` in `server/saas/index.ts` |
| [x] | **Signup password policy (min 8 chars) + field length bounds** | `server/saas/utils/validateSignup.ts` |
| [x] | **API security headers (`helmet`)** | `server/saas/index.ts` (CSP disabled for JSON API) |
| [x] | **SPA security headers on Vercel** | `vercel.json` — X-Frame-Options, nosniff, Referrer-Policy, Permissions-Policy |
| [x] | **Input sanitization on write paths** | `server/saas/utils/sanitizeInput.ts` — categories, products, users, stores, org |
| [x] | **Second-org dev seed for cross-tenant QA** | `npm run saas:seed-second-org` → `owner@orgb.demo.com` |
| [x] | **Dependency audit script** | `npm run security:audit` |

#### Tenant route audit (ID-based access)

| Route group | Scope enforced by | Notes |
|-------------|-------------------|-------|
| `protectedRouter` / `ownerRouter` | `tenantMiddleware` → `storeId` + org/`UserStore` | Cashier/owner store access |
| `categoryService` / `productService` / `saleService` | `where: { id, storeId }` on mutations | No cross-store ID access |
| `orgRouter` | `req.auth.organizationId` on all org/store queries | Owner-only writes |
| `adminRoutes` | `superAdminMiddleware` | Platform-only; org users get 403 |
| Public | `/api/health`, `/api/auth/login`, `/api/auth/signup` only | Demo routes 404 in prod |

**CSRF posture:** Bearer JWT in `Authorization` header (not cookies) — classic cross-site form CSRF is low risk. Primary token theft vector is **XSS** → protect inputs and avoid rendering unsanitized HTML. No CSRF tokens in this phase.

**Next (after hardening):** extend `security/tests.mjs` for CORS, rate limits, two-org isolation, prod demo gates.


### 1.4 Frontend — cloud-only data path

| Status | Task | File(s) |
|--------|------|---------|
| [x] | `isSaaS()` + `DataLayerProvider` → `offlineSaasDataService` | `src/contexts/DataLayerContext.tsx` |
| [x] | `saasDataService` — Bearer token + `storeId` query | `src/lib/dataLayer/saasDataService.ts` |
| [x] | `saasAuth.ts` — login, token in `localStorage` | `src/lib/saasAuth.ts` |
| [x] | `StoreContext` — multi-store switcher | `src/contexts/StoreContext.tsx` (on `quick-scale`) |
| [ ] | **Default customer builds:** `VITE_APP_MODE=saas`, `VITE_SAAS_API_URL` = production URL | `package.json` `build:mobile:saas`, Vercel |
| [ ] | **Phase 1 mobile:** online-first — document that SQLite on device is cache/queue only, not source of truth | `src/lib/dataLayer/offlineSaasDataService.ts` |

### 1.5 Deprecate solo / local stack (remove after SaaS path verified)

Delete or archive once SaaS is the only customer path:

| Path | Purpose (solo) | Action |
|------|----------------|--------|
| `server/index.ts` | Solo Express API | **Remove** |
| `server/services/*` (solo) | Solo services | **Remove** (keep `server/saas/services/*`) |
| `server/utils/backupService.ts` | SQLite file copy + cron | **Remove** |
| `prisma/schema.prisma`, `prisma/dev.db` | Solo DB | **Remove** or move to `legacy/` |
| `server/seed.ts` | Solo seed | **Remove** |
| `src/lib/dataLayer/soloDataService.ts` | Solo data layer | **Remove** after `isSaaS()` always true |
| `src/lib/mobileDb.ts`, `mobileServices.ts` | Device-as-DB for solo | **Remove** from SaaS mobile path |
| `src/lib/mobileBackup.ts` | Solo device backup UI | **Remove** from Settings (SaaS) |
| `src/lib/api.ts` | Solo `localhost:4000` client | **Remove** or gate behind `!isSaaS()` then delete |

**npm scripts to drop** (from `package.json` on `quick-scale`):

- `dev:server`, `build:solo`, `build:mobile:solo`, `cap:sync:solo`, `prisma:seed` (solo)

**Keep:**

- `dev:saas`, `start:saas`, `build:saas`, `build:api`, `vercel:build`, `saas:seed`, `saas:seed-demo`, `build:mobile:saas`

### 1.6 Super Admin / platform ops (you only)

| Status | Task |
|--------|------|
| [x] | `/admin/*` routes + `superAdminMiddleware` |
| [x] | Org billing ledger, payment monitoring (`quick-scale`) |
| [ ] | Verify `SUPER_ADMIN_EMAILS` on Vercel includes `admin@demo.com` |
| [ ] | Document internal ops runbook in `DEPLOY_VERCEL_NEON.md` |

### Phase 1 verification

- [ ] `GET /api/health` → `{ status: "ok", mode: "saas" }`
- [ ] Login as owner → JWT returned; `Authorization: Bearer` required for `/api/products`
- [ ] Cashier cannot access another org’s `storeId` (403)
- [x] `POST /api/demo/reset-passwords` returns 404 on Vercel/production (`VERCEL=1` or `NODE_ENV=production`)
- [ ] Web + Android builds hit production API only (no `localhost:4000`)

---

## Phase 2 — Trust the numbers (SMB integrity)

**Positioning:** Append-only sales with controlled voids + light activity log. Not audit certification.

### 2.1 Schema changes (`prisma-saas/schema.pg.prisma` + `schema.prisma` + `schema.dev.prisma`)

#### Sale void metadata (partially exists)

**Already on `quick-scale`:** `Sale.status` (`completed` | `void`), `voidSale()` restores stock.

**Add:**

```prisma
model Sale {
  // ... existing fields ...
  status       String    @default("completed") // "completed" | "void"
  voidedAt     DateTime?
  voidedById   String?
  voidReason   String?

  voidedBy     User?     @relation("SaleVoidedBy", fields: [voidedById], references: [id], onDelete: SetNull)
}

model User {
  // ... existing ...
  salesVoided  Sale[]    @relation("SaleVoidedBy")
}
```

Migration name suggestion: `YYYYMMDDHHMMSS_sale_void_metadata`.

#### Activity log (new)

```prisma
model ActivityLog {
  id             String   @id @default(cuid())
  organizationId String
  storeId        String?
  userId         String?
  action         String   // e.g. "sale.created", "sale.voided", "product.updated", "stock.adjusted"
  entityType     String?  // "sale", "product", "menuItem", "ingredient"
  entityId       String?
  metadata       String?  // JSON string — keep simple for SQLite/PG parity
  createdAt      DateTime @default(now())

  organization Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  user         User?        @relation(fields: [userId], references: [id], onDelete: SetNull)

  @@index([organizationId, createdAt])
  @@index([storeId, createdAt])
}
```

Add `activityLogs ActivityLog[]` on `Organization` and `User`.

**Scope (Phase 2 only — don’t over-log):**

| Action | `action` value |
|--------|----------------|
| Sale completed | `sale.created` |
| Sale voided | `sale.voided` |
| Product create/update/delete | `product.*` |
| Manual stock adjustment (if you add it) | `stock.adjusted` |

### 2.2 API changes

| Status | Task | File(s) |
|--------|------|---------|
| [x] | `POST /api/sales` — create sale + stock decrement in transaction | `saleService.createSale` |
| [x] | `POST /api/sales/:id/void` — void + stock restore | `saleService.voidSale`, `index.ts` |
| [x] | `GET /api/sales?voidFilter=active\|voided\|all` | `saleService.listSales` |
| [ ] | **Restrict void to owner** | Move route to `ownerRouter` OR check `req.auth.role === 'owner'` in handler |
| [ ] | **Accept `reason` in void body** | Pass to `voidSale(id, storeId, { voidedById, reason })` |
| [ ] | **Persist `voidedAt`, `voidedById`, `voidReason`** | `saleService.voidSale` update payload |
| [ ] | **Write `ActivityLog` rows** in `createSale` and `voidSale` | New `server/saas/services/activityLogService.ts` |
| [ ] | **`GET /api/activity-log`** (owner only, paginated, `storeId` filter) | `ownerRouter` — optional UI in Phase 2 or 3 |
| [ ] | **No `DELETE /api/sales`** | Confirm absent — never add hard delete |

**Suggested `activityLogService.ts`:**

```ts
export async function logActivity(input: {
  organizationId: string;
  storeId?: string;
  userId?: string;
  action: string;
  entityType?: string;
  entityId?: string;
  metadata?: Record<string, unknown>;
}): Promise<void>
```

Call from sale service inside the same `$transaction` as the sale/void when possible.

### 2.3 Reporting — exclude voided sales by default

| Status | Task | File(s) |
|--------|------|---------|
| [x] | Sales list defaults to non-voided | `voidFilter` default `active` |
| [ ] | **Reports / dashboard aggregations** use `status !== 'void'` | `src/pages/Sales.tsx`, `Reports.tsx` |
| [ ] | **Rename “Profit” → “Estimated margin”** where `marginPercentage` is used | `Sales.tsx` stats |
| [ ] | **Export footer** — “Operational report; not a financial statement” | XLSX export helpers |
| [ ] | **Multi-store reports** include `storeName` column | `Reports.tsx` leaderboard (exists on `quick-scale`) |

### 2.4 Frontend — void UX

| Status | Task | File(s) |
|--------|------|---------|
| [ ] | Owner-only **Void sale** on Sales detail | `src/pages/Sales.tsx` |
| [ ] | Confirm dialog + optional reason field | |
| [ ] | Call `POST /api/sales/:id/void` via `saasDataService` | `src/lib/dataLayer/saasDataService.ts` |
| [ ] | Show voided badge / filter (Active / Voided / All) | `Sales.tsx` |
| [ ] | Hide void button for `cashier` role | `useAuth().user.role` |

### Phase 2 verification

- [ ] Complete sale → stock decreases; `ActivityLog` has `sale.created`
- [ ] Owner voids sale → `status=void`, stock restored, `voidedBy` set; cashier gets 403
- [ ] Reports totals exclude voided sales
- [ ] F&B void restores ingredient stock (recipe lines) — already in `voidSale` on `quick-scale`
- [ ] No API path hard-deletes sales

---

## What’s already done on `kristian/quick-scale` (don’t re-build)

- Multi-tenant schema: `Organization`, `Store`, `User`, `UserStore`
- Retail + F&B (`businessMode`, menu items, ingredients, recipes)
- JWT auth, suspended org check, trial expiry
- Store-scoped catalog, sales, users
- GCash fields on sale (`paymentMethod`, `gcashTransactionId`)
- Void sale **service** + routes (needs owner gate + metadata + activity log)
- Super Admin: orgs, billing payments, payment monitoring, product ranking
- Demo seed, bootstrap, `ensureDemoQuickLoginUsers`
- Offline cache layer: `offlineSaasDataService` + sync queue
- Vercel bundle: `api/index.js`, `vercel:build`

---

## Suggested implementation order

1. Merge `quick-scale` → working branch  
2. Phase 1.3 — lock down `reset-passwords`, CORS, product writes to owner  
3. Phase 1.5 — remove solo server paths; single `build:saas` customer path  
4. Phase 2.1 — migration void metadata + `ActivityLog`  
5. Phase 2.2 — owner-only void + logging  
6. Phase 2.3–2.4 — reports + Sales UI  
7. Deploy + run migration on Neon + `vercel:build`

---

## Questionnaire positioning (after Phase 1–2)

| Area | Honest answer |
|------|----------------|
| **Data integrity** | Sales are retained; voids are controlled and logged; not immutable audit ledger. |
| **Resiliency** | Neon Postgres + Vercel; Neon backups; no self-hosted SQLite for customers. |
| **Security** | JWT, tenant isolation, role-based access, HTTPS; SMB-grade not enterprise SOC2. |
| **Reporting** | Operationally accurate sales/inventory exports for owner monitoring; supplementary to accounting, not a replacement. |

---

## Related docs

- `DEPLOY_VERCEL_NEON.md` (on `quick-scale`) — deploy steps  
- `CREDENTIALS.md` — demo logins  
- `CHANGELOG.md` — release notes  

---

*Last updated: 2026-05-19 — targets `kristian/quick-scale` SaaS branch.*
