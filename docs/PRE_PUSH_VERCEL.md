# Pre-push checklist — Vercel (SaaS + canister features)

Use this before pushing `dev` / `main` (whichever branch Vercel deploys).

## 1. Local verify (developer machine)

```bash
# Stop npm run dev:saas / start:saas first if prisma generate hits EPERM on Windows.
npm run verify:vercel
```

Equivalent to Vercel’s `npm run vercel:build` (SPA + Prisma pg client + `lib/saas-api.cjs`).

## 2. Do not commit

| Path | Why |
|------|-----|
| `.env`, `.env.local`, `.env.vps` | Secrets |
| `prisma-saas/**/saas-dev.db`, `*.db` | Local SQLite |
| `lib/saas-api.cjs` | Built on Vercel during deploy (gitignored) |

Stage app/API code, schemas, migrations, and tests — not the local DB.

## 3. Vercel project env (Production + Preview)

Copy from [`.env.vercel.example`](../.env.vercel.example). **Required:**

| Variable | Notes |
|----------|--------|
| `SAAS_DATABASE_URL` | Neon **pooled** Postgres URL; enable for **Build** and **Runtime** |
| `JWT_SECRET` | ≥ 32 random chars |
| `SAAS_CORS_ORIGINS` | Explicit origins — e.g. `https://swift-pos-pied.vercel.app,capacitor://localhost,ionic://localhost` — **never `*`** |
| `SUPER_ADMIN_EMAILS` | Real admin email(s) |
| `VITE_APP_MODE` | `saas` |

**Do not set** `VITE_SAAS_API_URL` on Vercel (web uses same-origin `/api`).

## 4. Database after deploy

SQLite migrations in `prisma-saas/migrations/` are **not** applied with `migrate deploy` on Neon (SQLite lock file).

**Option A (recommended once per release):** from your machine:

```powershell
$env:SAAS_DATABASE_URL = "postgresql://...@...-pooler.../neondb?sslmode=require"
npm run prisma:push:saas:prod
```

**Option B:** First API cold start runs `ensurePostgresSchema()` (Customer, CylinderReturn, store flags, `businessMode=canister` backfill, etc.). Option A is still safer for a full schema match.

Demo seed on Vercel: `POST /api/demo/seed` returns **404** in production.

## 5. Post-deploy smoke test

```bash
curl https://YOUR-PROJECT.vercel.app/api/health
# → {"status":"ok","mode":"saas","database":"postgres"}
```

1. Super admin login → `/admin` → org store: type **Retail / F&B / Canister**
2. Owner → **Stores** → create/view **Canister** store; **Settings** → collect deposits
3. Inventory prices render (no `formatCurrency` crash)

## 6. Mobile (not Vercel)

```bash
cp .env.saas-production .env.saas.local
# VITE_SAAS_API_URL=https://YOUR-PROJECT.vercel.app
npm run build:mobile:saas:prod
```

## 7. Git push

Uncommitted work must be committed first (exclude `*.db`). Then:

```bash
git push -u origin HEAD
```

Merge to the branch Vercel uses as **Production** (often `main` or `dev`).

Full runbook: [DEPLOY_VERCEL_NEON.md](./DEPLOY_VERCEL_NEON.md).
