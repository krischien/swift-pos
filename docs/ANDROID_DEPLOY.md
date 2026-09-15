# Android deployment (SaaS → Vercel)

Production mobile builds talk to your **HTTPS Vercel API**. The API URL is **baked into the APK/AAB at build time** — it is not read from the server.

## Prerequisites

- Node.js 18+
- Android Studio (SDK + JDK 17)
- Vercel API live with demo/prod data seeded
- `.env.saas.local` with prod URL (see below)

## 1. Vercel API checklist

On **Vercel → Settings → Environment Variables** (Production):

| Variable | Value |
|----------|--------|
| `SAAS_DATABASE_URL` | Neon Postgres (Build + Runtime) |
| `JWT_SECRET` | ≥ 32 random chars |
| `SAAS_CORS_ORIGINS` | `https://swift-pos-pied.vercel.app,capacitor://localhost,ionic://localhost` |
| `VITE_APP_MODE` | `saas` |

`capacitor://localhost` and `ionic://localhost` are required for the Capacitor WebView. The API also accepts these by default, but listing them explicitly is recommended.

**Do not set** `VITE_SAAS_API_URL` on Vercel — web uses same-origin `/api`.

## 2. Mobile env file

```powershell
# Already created if you followed setup — gitignored
# .env.saas.local
VITE_APP_MODE=saas
VITE_SAAS_API_URL=https://swift-pos-pied.vercel.app
```

Change the URL when you move to a custom domain.

## 3. Build web assets + sync Capacitor

```powershell
npm run build:mobile:saas:prod
```

This validates HTTPS, builds the SPA with the prod API URL, and runs `cap sync android`.

## 4. Release signing (Play Store)

One-time keystore:

```powershell
keytool -genkey -v -keystore android/swiftpos-release.keystore -alias swiftpos -keyalg RSA -keysize 2048 -validity 10000
```

Copy the template and fill in passwords:

```powershell
copy android\keystore.properties.example android\keystore.properties
# Edit storeFile, storePassword, keyAlias, keyPassword
```

`keystore.properties` and `*.keystore` are gitignored.

## 5. Generate AAB (Play Store) or APK

**Option A — Android Studio (recommended first time)**

```powershell
npm run android:open
```

Then **Build → Generate Signed Bundle / APK** → choose release keystore → **Android App Bundle (.aab)**.

**Option B — CLI** (after `keystore.properties` exists)

```powershell
npm run android:bundle:release
# Output: android/app/build/outputs/bundle/release/app-release.aab
```

Debug install (unsigned release or debug):

```powershell
npm run android:apk:release
adb install android/app/build/outputs/apk/release/app-release.apk
```

## 6. Version bumps

Before each Play Store upload, edit `android/app/build.gradle`:

```gradle
versionCode 3        // must increase every upload
versionName "1.2.0"  // user-visible
```

## 7. Smoke test on device

1. Install the APK/AAB (internal testing track or sideload).
2. Open app → login screen → **Test API connection** (mobile only).
3. Log in: `owner@demo.com` / `password123`.
4. Confirm **3 stores** appear (Grocery, Café, Pet Shop).
5. On **Paws & Claws Pet Shop**: Settings → enable **Per-kilo / weight purchase** for KG demo.

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| Login: "unexpected token \<" | Rebuild with `VITE_SAAS_API_URL` set — empty URL loads HTML instead of JSON |
| Failed to fetch | Phone needs internet; API URL must be HTTPS for prod |
| CORS error in logcat | Add `capacitor://localhost` to `SAAS_CORS_ORIGINS` on Vercel, redeploy |
| Old API after deploy | Rebuild APK — URL is fixed at build time, not runtime |

## Command reference

| Command | Purpose |
|---------|---------|
| `npm run build:mobile:saas:prod` | Prod SPA + `cap sync android` |
| `npm run android:open` | Open project in Android Studio |
| `npm run android:bundle:release` | Signed AAB (needs keystore.properties) |
| `npm run build:mobile:saas:local` | LAN dev (`http://192.168.x.x:4001`) |
| `npm run build:mobile:saas:adb` | Emulator via `adb reverse` |

See also: [MOBILE_DEPLOYMENT.md](../MOBILE_DEPLOYMENT.md), [DEPLOY_VERCEL_NEON.md](./DEPLOY_VERCEL_NEON.md).
