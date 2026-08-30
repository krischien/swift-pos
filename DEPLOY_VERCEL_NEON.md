# Deploy SwiftPOS (Demo) to Vercel + Neon

This guide covers deploying the **SaaS API** to Vercel with Neon PostgreSQL, so the Android app can connect.

## 1. Create Neon Database

1. Go to [neon.tech](https://neon.tech) and sign up
2. Create a new project (e.g. `swift-pos-demo`)
3. Copy the **connection string** (use the **pooled** one for serverless)
   - Format: `postgresql://user:password@ep-xxx-pooler.region.aws.neon.tech/neondb?sslmode=require`

## 2. Prepare Neon Database

Before deploying, apply the schema to your Neon database (run locally with `SAAS_DATABASE_URL` set):

```bash
# Set your Neon URL (or copy from .env.saas)
$env:SAAS_DATABASE_URL = "postgresql://..."   # PowerShell
# export SAAS_DATABASE_URL="postgresql://..."  # Bash

npm run prisma:push:saas:pg
```

`vercel:build` also runs `prisma db push` during deploy so schema stays in sync — redeploy after the first manual push if bootstrap still fails.

## 3. Deploy to Vercel

1. Go to [vercel.com](https://vercel.com) and sign in (GitHub recommended)
2. **Add New** → **Project** → Import your repo
3. Select your branch
4. **Configure Project** (vercel.json already sets these):
   - **Build Command**: `npm run vercel:build`
   - **Output Directory**: `dist`

## 4. Environment Variables

In Vercel: **Settings** → **Environment Variables** → add each variable.  
See `.env.vercel.example` for a full template.

| Variable | Value | Notes |
|----------|-------|-------|
| `SAAS_DATABASE_URL` | `postgresql://...` | Neon pooled connection string |
| `JWT_SECRET` | Long random string | e.g. `openssl rand -hex 32` |
| `SUPER_ADMIN_EMAILS` | `admin@demo.com` | Comma-separated super admin emails |
| `SAAS_CORS_ORIGINS` | `https://your-app.vercel.app,capacitor://localhost,ionic://localhost` | Web + Android Capacitor origins (comma-separated) |
| `VITE_APP_MODE` | `saas` | **Required** for frontend build |
| `VITE_SAAS_API_URL` | *(leave empty)* | Same-origin; web uses relative `/api` |

**Quick setup:** Run `vercel env pull .env.local` after linking, or add variables manually in the dashboard.

## 5. Deploy

Click **Deploy**. After deploy, your API URL will be:

```
https://your-project.vercel.app
```

Test: `https://your-project.vercel.app/api/health` → `{"status":"ok","mode":"saas"}`

## 6. Android App

When building the Android app, set the API URL:

```bash
VITE_SAAS_API_URL=https://your-project.vercel.app npm run build:mobile:saas
```

Or add to `.env`:

```
VITE_SAAS_API_URL=https://your-project.vercel.app
```

Then build and run:

```bash
npm run build:mobile:saas
npm run cap:open
```

## 7. First Login

After first deploy, the bootstrap creates default accounts on the first request:

- **owner@demo.com** / `password123`
- **admin@demo.com** (super_admin) / `password123`
- **cashier@demo.com** / `password123`

Log in via the web app or Android app. For full demo data (Cafe + Pet Store), log in as owner and use the seed option in the app, or call `POST /api/demo/seed` with a valid JWT.

## Troubleshooting

- **CORS errors**: Add your origins to `SAAS_CORS_ORIGINS`
- **DB connection**: Use Neon's **pooled** connection string for serverless
- **Prisma errors**: Ensure `SAAS_DATABASE_URL` is set in Vercel env vars
