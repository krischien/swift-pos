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

function isLocalDevApiUrl(url: string): boolean {
  if (!url) return true;
  return (
    url.includes("localhost") ||
    url.includes("127.0.0.1") ||
    url.includes("::1") ||
    url.includes("10.0.2.2")
  );
}

/** Dev server loads the app over http(s) — relative /api uses Vite's proxy (browser or Capacitor -l). */
function canUseSameOriginDevProxy(): boolean {
  if (!import.meta.env.DEV || typeof window === "undefined") return false;
  if (!Capacitor.isNativePlatform()) return true;
  const { protocol } = window.location;
  return protocol === "http:" || protocol === "https:";
}

/** Android emulator / device: localhost in the WebView is the phone, not your PC. */
function remapLocalhostForNativePlatform(base: string): string {
  if (!base || !Capacitor.isNativePlatform()) return base;
  if (Capacitor.getPlatform() !== "android") return base;
  return base
    .replace(/\/\/localhost\b/i, "//10.0.2.2")
    .replace(/\/\/127\.0\.0\.1\b/, "//10.0.2.2")
    .replace(/\/\/\[::1\]/, "//10.0.2.2");
}

function getBaseFromEnv(): string {
  const envUrl = (import.meta.env.VITE_SAAS_API_URL || "").trim();
  if (import.meta.env.DEV && import.meta.env.VITE_APP_MODE === "saas") {
    // Same-origin `/api/...` → Vite proxy → 127.0.0.1:4001 (see vite.config). Avoids calling
    // http://localhost:4001 from Capacitor WebView (wrong host) and browser CORS/firewall issues.
    if (canUseSameOriginDevProxy() && isLocalDevApiUrl(envUrl)) {
      return "";
    }
    // Web dev: when VITE_SAAS_API_URL points at HTTPS production (Vercel / domain), use the
    // local Node API so you don't hit prod DB by mistake. Explicit http:// hosts (LAN IP, VPS)
    // are left unchanged so dev can target a remote HTTP API.
    if (
      envUrl &&
      !envUrl.includes("localhost") &&
      !envUrl.includes("127.0.0.1") &&
      envUrl.startsWith("https://")
    ) {
      return `http://localhost:${DEFAULT_SAAS_PORT}`;
    }
    return envUrl || `http://localhost:${DEFAULT_SAAS_PORT}`;
  }
  return envUrl;
}

export function getSaasApiBase(): string {
  // Vercel / production web: SPA and API share one origin — always use relative /api/*
  // (VITE_SAAS_API_URL is only for Capacitor/mobile builds, not browser deploys.)
  if (!import.meta.env.DEV && !Capacitor.isNativePlatform()) {
    return "";
  }

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
  return remapLocalhostForNativePlatform(base.trim());
}
