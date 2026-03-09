/**
 * SaaS API base URL configuration.
 * On mobile (Capacitor), we must use an absolute URL - relative URLs resolve to the app origin
 * and return HTML (index.html) instead of API JSON, causing "unexpected token <" errors.
 *
 * Demo mode (SQLite): When VITE_SAAS_API_URL is not set on mobile, we use sensible defaults
 * for emulator/simulator: Android emulator uses 10.0.2.2 (host), iOS simulator uses localhost.
 * For a real device, set VITE_SAAS_API_URL to your machine's IP (e.g. http://192.168.1.100:4001).
 */
import { Capacitor } from "@capacitor/core";

const DEFAULT_SAAS_PORT = 4001;

function getBaseFromEnv(): string {
  if (import.meta.env.DEV && import.meta.env.VITE_APP_MODE === "saas") {
    return ""; // Web dev: use same origin, Vite proxy forwards to SaaS server
  }
  return (import.meta.env.VITE_SAAS_API_URL || "").trim();
}

export function getSaasApiBase(): string {
  let base = getBaseFromEnv();
  if (Capacitor.isNativePlatform() && !base) {
    // Demo fallback (SQLite): use host URL for emulator/simulator
    // Android: 10.0.2.2 = host from emulator. Real device: set VITE_SAAS_API_URL to your IP.
    // iOS: localhost works from simulator.
    const platform = Capacitor.getPlatform();
    base =
      platform === "android"
        ? `http://10.0.2.2:${DEFAULT_SAAS_PORT}`
        : `http://localhost:${DEFAULT_SAAS_PORT}`;
  }
  return base.trim();
}
