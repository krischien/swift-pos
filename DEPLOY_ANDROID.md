# Android Deployment Guide

Checklist for building and deploying QuickScale POS to the Google Play Store.

## Prerequisites

- Node.js 18+
- Android Studio (for SDK, emulator, or manual builds)
- Production SaaS API deployed and reachable via HTTPS
- Google Play Developer account ($25 one-time)

---

## 1. Production API

Ensure your SaaS backend is deployed with PostgreSQL:

- API URL is HTTPS (e.g. `https://api.yourdomain.com`)
- `SAAS_CORS_ORIGINS` includes `capacitor://localhost`
- Database migrated and seeded if needed

---

## 2. Environment

Create `.env.saas-production` from the example:

```sh
cp .env.saas-production.example .env.saas-production
```

Edit and set your production API URL:

```
VITE_APP_MODE=saas
VITE_SAAS_API_URL=https://api.yourdomain.com
```

---

## 3. App Signing (Release Builds)

### Generate a keystore (one-time)

```sh
cd android
keytool -genkey -v -keystore release.keystore -keyalg RSA -keysize 2048 -validity 10000 -alias quickpos
```

Store the keystore and passwords securely. **Never commit them to git.**

### Configure signing

```sh
cp keystore.properties.example keystore.properties
```

Edit `keystore.properties`:

```
storePassword=your-keystore-password
keyPassword=your-key-password
keyAlias=quickpos
storeFile=release.keystore
```

---

## 4. Version

Update in `android/app/build.gradle`:

- `versionCode` — integer, increment for each Play Store upload (e.g. 1, 2, 3)
- `versionName` — user-visible version (e.g. "1.0", "1.1.0")

---

## 5. Build

### Production web assets + sync

```sh
npm run build:mobile:saas:prod
```

### Release APK (signed)

Open Android Studio:

```sh
npm run cap:open
```

Then: **Build → Generate Signed App Bundle / APK** → choose **Android App Bundle** (recommended for Play Store) or **APK**.

Or build from command line:

```sh
npm run android:release
```

Output: `android/app/build/outputs/apk/release/app-release.apk`

### Release AAB (for Play Store)

```sh
npm run android:bundle
```

Output: `android/app/build/outputs/bundle/release/app-release.aab`

---

## 6. Play Store Upload

1. Go to [Google Play Console](https://play.google.com/console)
2. Create app (or select existing)
3. **Production** → **Create new release**
4. Upload the `.aab` file
5. Add release notes
6. Review and rollout

---

## Quick Reference

| Step | Command |
|------|---------|
| Build web + sync | `npm run build:mobile:saas:prod` |
| Open Android Studio | `npm run cap:open` |
| Release APK | `npm run android:release` |
| Release AAB | `npm run android:bundle` |

---

## Troubleshooting

**"Invalid or expired token"** — User needs to log out and log in again; token may have expired.

**CORS errors on API** — Add `capacitor://localhost` to `SAAS_CORS_ORIGINS`.

**Build fails: keystore not found** — Ensure `keystore.properties` and `release.keystore` exist in `android/` and paths are correct.

**Unsigned release build** — Create and configure `keystore.properties`; release builds will be signed automatically when configured.
