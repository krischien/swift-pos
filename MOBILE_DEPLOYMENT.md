# Mobile Deployment Guide

This guide covers building and deploying Swift POS (Quick POS) as an Android app.

## Prerequisites

- Node.js 18+
- Android Studio (for building and signing)
- Java 17 (for Android build)
- Capacitor CLI: `npm install @capacitor/cli` (global or in project)

## Build Modes

### Solo mode (offline-first)

Single-store, offline-capable. Uses SQLite on device. No backend required.

```bash
# Build and sync to Android
npm run build:mobile:solo

# Or step by step
npm run build:solo
npx cap sync android
```

### SaaS mode (cloud-connected)

Multi-store, cloud-connected. Requires your SaaS API to be running and reachable.

**Important for mobile:** You must set `VITE_SAAS_API_URL` to an **absolute URL**. If it's empty or wrong, login will fail with "unexpected token <" (HTML returned instead of JSON).

```bash
# 1. Set your API URL (REQUIRED for mobile)
# Create or edit .env.saas:
VITE_APP_MODE=saas
# Local dev: use your machine's IP (phone and PC on same network)
VITE_SAAS_API_URL=http://192.168.1.100:4001
# Production: use HTTPS
# VITE_SAAS_API_URL=https://your-api.example.com

# 2. Build and sync
npm run build:mobile:saas

# Or step by step
npm run build:saas
npx cap sync android
```

**Important:** For Play Store release, use **HTTPS** for `VITE_SAAS_API_URL`. For local dev/testing (e.g. `http://192.168.1.x:4001`), the app includes a network security config that allows cleartext traffic.

### Running server + app together

**Mobile:** Start the API server first (keep it running), then use the app on your device:
```bash
# Terminal 1: Start the API server
npm run start:mobile

# Terminal 2: Build and open when needed
npm run build:mobile:saas
npm run cap:open
```

**Web:** Run both the server and frontend with one command:
```bash
npm run start:saas
```

## Open in Android Studio

```bash
npm run cap:open
```

## Build APK / AAB

1. Open Android Studio: `npm run cap:open`
2. **Build → Generate Signed Bundle / APK**
3. Create or select a keystore
4. Choose release build variant
5. Output: `android/app/build/outputs/`

## Versioning

Edit `android/app/build.gradle`:

```gradle
defaultConfig {
    versionCode 2        // Increment for each release
    versionName "1.1.0"  // User-visible version
}
```

## App Configuration

- **App ID:** `com.backbone.quickpos` (in `capacitor.config.ts` and `android/app/build.gradle`)
- **App name:** `android/app/src/main/res/values/strings.xml`
- **Icons:** `android/app/src/main/res/mipmap-*`

## Permissions

The app requests:

- **INTERNET** – API calls, SaaS mode
- **BLUETOOTH** / **BLUETOOTH_CONNECT** / **BLUETOOTH_SCAN** – Receipt printer
- **ACCESS_FINE_LOCATION** – Required for Bluetooth scanning on Android 12+

## Troubleshooting

### "Failed to fetch" on login (mobile)

The app cannot reach the API server. Check:

1. **Server running:** Run `npm run start:mobile` on your PC and keep it running.
2. **Same network:** Phone and PC must be on the same WiFi.
3. **Firewall (Windows):** Allow port 4001. In PowerShell (Admin):  
   `netsh advfirewall firewall add rule name="QuickScale API" dir=in action=allow protocol=TCP localport=4001`
4. **Emulator vs device:**  
   - Android emulator: Build with `VITE_SAAS_API_URL=` (empty) to use `10.0.2.2:4001`.  
   - Real device: Set `VITE_SAAS_API_URL=http://YOUR_PC_IP:4001` and rebuild.
5. **Test:** Use "Test API connection" on the login screen (mobile only).

### "unexpected token <" or "not a valid JSON" on login (mobile)

The API returned HTML instead of JSON. This happens when `VITE_SAAS_API_URL` is empty or wrong on mobile:

- **Empty:** Requests hit the app origin and return `index.html`.
- **localhost:** On a real device, `localhost` points to the device, not your dev machine.

**Fix:** Set `VITE_SAAS_API_URL` to your machine's IP when building for local dev, e.g. `http://192.168.1.100:4001`. Ensure the phone and PC are on the same network. Rebuild with `npm run build:mobile:saas`.

### "No sales / data not loading" on mobile

- **SaaS:** Ensure `VITE_SAAS_API_URL` is correct and the API is reachable from the device.
- **Solo:** Data is stored locally in SQLite; no network needed.

### API connection fails on device

- Use your machine's IP (e.g. `http://192.168.1.100:4001`) instead of `localhost`.
- Ensure the device and server are on the same network.
- For production, deploy the API with HTTPS.

### Build fails after `cap sync`

- Run `npx cap sync android` again.
- In Android Studio: **File → Invalidate Caches / Restart**.
- Clean: `cd android && ./gradlew clean` then rebuild.
