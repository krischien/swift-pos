# Mobile App - Remote Server Connection

## Emulator → localhost (adb reverse) — reusable pattern

**Problem:** Android emulator can't reach your PC's localhost API (Postman works, emulator gets "Failed to fetch").

**Solution:** `adb reverse` forwards the emulator's localhost to your PC. Works on Windows, Mac, Linux.

### Generic steps (any app)

1. **Start your API** on your PC (e.g. `localhost:4001`).
2. **Start the Android emulator** (Android Studio or CLI).
3. **Run adb reverse** (once per emulator session):
   ```sh
   adb reverse tcp:4001 tcp:4001
   ```
   Replace `4001` with your API port.
4. **Configure the app** to use `http://localhost:4001` (or whatever port).
5. **Build and run** the app on the emulator.

### Why it works

- `10.0.2.2` and LAN IPs often fail on Windows emulators.
- `adb reverse tcp:LOCAL tcp:REMOTE` makes the emulator's port `LOCAL` connect to the host's port `REMOTE`.
- So when the app calls `http://localhost:4001`, it hits the emulator's localhost, which adb forwards to your PC's `localhost:4001`.

### Other ports

```sh
adb reverse tcp:3000 tcp:3000   # Next.js, Vite dev
adb reverse tcp:8080 tcp:8080   # Spring Boot, etc.
adb reverse tcp:5000 tcp:5000   # Flask
```

### Check active reversals

```sh
adb reverse --list
```

---

## Local emulator checklist (this project)

Before testing on the Android emulator:

- [ ] **1. API server running** – `npm run dev:saas` (or `npm run dev`)
- [ ] **2. Emulator running** – Start Android emulator first
- [ ] **3. adb reverse** – `npm run mobile:emulator:tunnel` (forwards emulator localhost → your PC)
- [ ] **4. CORS set** – `.env` has `SAAS_CORS_ORIGINS=capacitor://localhost` or `*`
- [ ] **5. Build** – `npm run build:mobile:saas:adb` then `npx cap open android`

---

## Current setup

The mobile app connects to: **http://57.129.115.42:4001**

Configured in `.env.saas` → `VITE_SAAS_API_URL`

## Build commands

```sh
# Build for remote server (57.129.115.42:4001)
npm run build:mobile:saas

# Build for emulator (localhost via adb reverse – recommended)
npm run build:mobile:saas:adb

# Build for local dev (192.168.1.7:4001 – physical device on same LAN)
npm run build:mobile:saas:local

# Forward emulator localhost → your PC (run once per emulator session)
npm run mobile:emulator:tunnel

# Sync and open Android Studio
npm run cap:open
```

## "Can't fetch" troubleshooting

### 1. Verify the server is reachable

From your phone's browser or a computer on the same network, open:
```
http://57.129.115.42:4001/api/health
```
Expected: `{"status":"ok","mode":"saas"}`

If this fails: server is down, firewall is blocking port 4001, or the IP is wrong.

### 2. Server CORS (required for Capacitor)

The server at 57.129.115.42 must allow the Android app origin. Set this env var on the server:

```
SAAS_CORS_ORIGINS=capacitor://localhost
```

If the server uses `cors()` with no options, it allows all origins and CORS is fine.

### 3. Clean rebuild

```sh
# Clean and rebuild
rm -rf dist android/app/src/main/assets/public
npm run build:mobile:saas
npx cap sync android
```

### 4. Check the error message

After the latest changes, login errors show the actual API URL. If you see:
- `Cannot reach API at http://57.129.115.42:4001/api/auth/login` → network/CORS issue
- `Cannot reach API at http://10.0.2.2:4001/...` → wrong build (using emulator fallback)
- `Cannot reach API at /api/auth/login` → empty URL, env not embedded in build

### 5. Change the remote server URL

Edit `.env.saas`:
```
VITE_SAAS_API_URL=http://YOUR_SERVER_IP:4001
```

**No spaces** – Avoid trailing spaces (causes "Failed to parse URL"). The code now trims whitespace.

Then rebuild: `npm run build:mobile:saas`

### 6. Android emulator "Failed to fetch" (Windows)

If the emulator can't reach `10.0.2.2:4001`:

**Option A – Allow port 4001 in Windows Firewall (run as Administrator):**
```powershell
New-NetFirewallRule -DisplayName "Swift POS API" -Direction Inbound -LocalPort 4001 -Protocol TCP -Action Allow
```

**Option B – Use your PC's LAN IP instead of 10.0.2.2:**
```sh
npm run build:mobile:saas:local
npx cap sync android
```
This uses `http://192.168.1.7:4001` (adjust IP if different). The emulator may reach the host's LAN IP when 10.0.2.2 fails.

**Option C – Use adb reverse (recommended, see top of this doc):**
Forces the emulator’s `localhost:4001` to reach your PC’s API. Run once per emulator session:

```sh
# 1. Start API: npm run dev:saas
# 2. Start emulator, then run:
npm run mobile:emulator:tunnel

# 3. Build app to use localhost:4001 (works because of adb reverse):
npm run build:mobile:saas:adb

# 4. Open in Android Studio and run
npx cap open android
```

**Option D – Use the remote server (bypasses local network):**
If local keeps failing, use the deployed API. Edit `.env.saas`:
```
VITE_SAAS_API_URL=http://57.129.115.42:4001
```
Ensure the remote server has `SAAS_CORS_ORIGINS=capacitor://localhost`. Then:
```sh
npm run build:mobile:saas
npx cap sync android
```
