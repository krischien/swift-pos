# Deploy SwiftPOS Production on Vercel + Neon

Use this runbook when creating a **new production** Vercel project. Keep your existing **demo** Vercel site and Neon database separate.

## Architecture

| Client | Purpose | How it connects |
|--------|---------|-----------------|
| **Web browser** | Super admin (`/admin`) | `https://your-prod-domain.com` — same-origin `/api/*` |
| **Android app** | Owners & cashiers (POS, Sales) | `VITE_SAAS_API_URL=https://your-prod-domain.com` baked into APK |
| **Vercel** | SPA (`dist/`) + API (`api/index.js` serverless) | `vercel.json` rewrites |
| **Neon** | PostgreSQL | `SAAS_DATABASE_URL` |

Demo seed/reset endpoints return **404** on Vercel (`VERCEL=1`).

**Before you push:** [PRE_PUSH_VERCEL.md](./PRE_PUSH_VERCEL.md) (`npm run verify:vercel`).

---

## 1. Neon (production database)

1. Create a **new** Neon project (or prod branch) — do not reuse demo DB.
2. Copy the **pooled** connection string (`?sslmode=require`).
3. From your machine, apply migrations:

`prisma-saas/migrations` are **SQLite** history (`migration_lock.toml` → `sqlite`).
`npm run prisma:migrate:saas:prod` will fail on Neon with **P3019**. Use **db push** instead:

**PowerShell (Windows):**
```powershell
$env:SAAS_DATABASE_URL = "postgresql://USER:PASS@HOST-pooler.../neondb?sslmode=require"
npm run prisma:push:saas:prod
```

**Bash / Git Bash / WSL:**
```bash
SAAS_DATABASE_URL="postgresql://..." npm run prisma:push:saas:prod
```

Do not use placeholder hosts like `...` — that causes **P1001** (can't reach `...:5432`).
Keep local `.env` on SQLite (`file:./prisma-saas/saas-dev.db`) for `npm run dev:saas`.

---

## 2. Vercel project (production)

1. **Vercel → Add New… → Project** → import the same GitHub repo.
2. Name it distinctly (e.g. `swiftpos-prod` vs existing demo project).
3. **Production branch:** e.g. `main` or a dedicated `production` branch.
4. Build settings (already in `vercel.json`):
   - **Build command:** `npm run vercel:build`
   - **Output directory:** `dist`
5. **Environment variables** (Production + Preview) — see [`.env.vercel.example`](../.env.vercel.example):

| Variable | Example / notes |
|----------|-----------------|
| `SAAS_DATABASE_URL` | Neon pooled Postgres URL |
| `JWT_SECRET` | Random, ≥ 32 chars |
| `SAAS_CORS_ORIGINS` | `https://app.yourdomain.com,capacitor://localhost,ionic://localhost` |
| `SUPER_ADMIN_EMAILS` | Your real admin email |
| `VITE_APP_MODE` | `saas` |

**Do not set** `SAAS_CORS_ORIGINS=*` on Vercel — the API will refuse to start.

Optional: connect Neon via Vercel Storage integration (auto-injects `SAAS_DATABASE_URL`).

6. **Custom domain** → e.g. `app.yourdomain.com`.
7. Deploy. Vercel runs `vercel:build` (SaaS SPA + Prisma pg client + API bundle).

---

## 3. Smoke test (after deploy)

```bash
curl https://app.yourdomain.com/api/health
# → {"status":"ok","mode":"saas","database":"postgres"}
```

1. Open `https://app.yourdomain.com` in a browser.
2. Log in as super admin (`SUPER_ADMIN_EMAILS`) → should land on `/admin`.
3. Sign up a test org (or use admin to create one) and confirm owner login works.

---

## 4. Mobile app (production APK/AAB)

Mobile **must** use an absolute HTTPS API URL.

1. Copy the production mobile env template:

```bash
cp .env.saas-production .env.saas.local
```

2. Edit `.env.saas.local`:

```env
VITE_APP_MODE=saas
VITE_SAAS_API_URL=https://app.yourdomain.com
```

3. Build and sync Android:

```bash
npm run build:mobile:saas:prod
npm run cap:open
```

4. Generate signed AAB/APK in Android Studio for Play Store.

---

## 5. Demo vs prod checklist

| | Demo Vercel | Prod Vercel |
|---|-------------|-------------|
| Vercel project | Existing | **New project** |
| Neon DB | Demo DB | **New DB** |
| Domain | Demo URL | Production domain |
| `JWT_SECRET` | Demo secret | **New secret** |
| `SUPER_ADMIN_EMAILS` | `admin@demo.com` OK | **Your real email** |
| Mobile build | Demo / dev URL | `VITE_SAAS_API_URL` = prod HTTPS |

---

## 6. Local commands reference

| Command | Purpose |
|---------|---------|
| `npm run vercel:build` | Same build Vercel runs (SPA + API bundle) |
| `npm run prisma:migrate:saas:prod` | Apply Postgres migrations to prod Neon |
| `npm run build:mobile:saas:prod` | Android build using `.env.saas.local` |

---

## 7. Troubleshooting

**Build fails: CORS / JWT**

- Set `JWT_SECRET` (≥ 32 chars) and explicit `SAAS_CORS_ORIGINS` in Vercel env.

**`/api/health` returns HTML**

- API function failed to boot — check Vercel function logs.
- Confirm `SAAS_DATABASE_URL` is set and Neon allows connections.

**Mobile login: "unexpected token \<"**

- `VITE_SAAS_API_URL` was empty or wrong at build time. Rebuild with `.env.saas.local`.

**Prisma engine errors on Vercel**

- `schema.pg.prisma` includes `binaryTargets = ["native", "rhel-openssl-3.0.x"]`.
- `vercel.json` includes `node_modules/.prisma/saas-client/**` in the function bundle.

**Cold starts**

- First request after idle may be slower (serverless). Neon pooled URL helps connection reuse.

---

## Related docs

- [`.env.vercel.example`](../.env.vercel.example) — env template
- [`.env.vps.example`](../.env.vps.example) — alternative private-server deploy
- [`MOBILE_DEPLOYMENT.md`](../MOBILE_DEPLOYMENT.md) — Capacitor build details
- [`docs/SAAS_PHASE1_2_CHECKLIST.md`](SAAS_PHASE1_2_CHECKLIST.md) — SaaS hardening checklist
