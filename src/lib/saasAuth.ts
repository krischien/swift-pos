/**
 * SaaS auth API - signup, login, token storage
 */
import { getSaasApiBase } from "./saasApiConfig";

export interface SaasLoginResponse {
  token: string;
  user: { id: string; name: string; email: string; role: string };
  organization: { id: string; name: string; plan: string; trialEndsAt?: string | null } | null;
  stores: Array<{
    id: string;
    name: string;
    businessMode?: string;
    enableCylinderTracking?: boolean;
    collectCylinderDeposits?: boolean;
  }>;
}

export interface SaasSignupPayload {
  organizationName: string;
  storeName: string;
  adminEmail: string;
  adminPassword: string;
  adminName?: string;
  adminPhone?: string;
}

export async function saasLogin(email: string, password: string): Promise<SaasLoginResponse> {
  const base = getSaasApiBase();
  const url = base ? `${base.trim().replace(/\/$/, "")}/api/auth/login` : "/api/auth/login";
  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Network error";
    const isFailedFetch = /failed to fetch|networkerror|load failed/i.test(msg);
    const isRelative = url.startsWith("/");
    const hint = isFailedFetch
      ? isRelative
        ? " Run `npm run start:saas` (API on 4001 + Vite on 8080). The app uses the Vite /api proxy in dev."
        : /localhost|127\.0\.0\.1/i.test(url)
          ? " On a phone/emulator, localhost is the device — use `npm run build:mobile:saas:local` with your PC LAN IP, or `npm run mobile:emulator:tunnel` + rebuild with localhost for USB."
          : " Check Wi‑Fi, firewall port 4001, and SAAS_CORS_ORIGINS includes your app origin (capacitor://localhost for native builds)."
      : " Check that the SaaS API is running (npm run dev:saas).";
    throw new Error(`Cannot reach API at ${url}. ${msg}.${hint}`);
  }
  const text = await res.text();
  if (text.trimStart().toLowerCase().startsWith("<!")) {
    throw new Error(
      `Received HTML instead of JSON from ${url}. API URL may be wrong. On mobile, set VITE_SAAS_API_URL when building.`
    );
  }
  if (!res.ok) {
    const trimmed = text.trim();
    let message = "";
    if (trimmed) {
      try {
        const json = JSON.parse(trimmed) as { message?: unknown; error?: unknown };
        if (typeof json?.message === "string" && json.message) message = json.message;
        else if (typeof json?.error === "string" && json.error) message = json.error;
      } catch {
        message = trimmed.slice(0, 400);
      }
    }
    if (!message) {
      message = `Login failed (HTTP ${res.status}${res.statusText ? ` ${res.statusText}` : ""}). Is the SaaS API running (e.g. npm run dev:saas on port 4001)?`;
    }
    throw new Error(message);
  }
  return JSON.parse(text) as SaasLoginResponse;
}

export async function saasSignup(payload: SaasSignupPayload): Promise<SaasLoginResponse> {
  const base = getSaasApiBase();
  const url = base ? `${base.replace(/\/$/, "")}/api/auth/signup` : "/api/auth/signup";
  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Network error";
    throw new Error(`Cannot reach API at ${url}. ${msg}`);
  }
  const text = await res.text();
  if (text.trimStart().toLowerCase().startsWith("<!")) {
    throw new Error(`Received HTML instead of JSON from ${url}. API URL may be wrong.`);
  }
  if (!res.ok) throw new Error(text || "Signup failed");
  return JSON.parse(text) as SaasLoginResponse;
}

export function getSaasToken(): string | null {
  return typeof window !== "undefined" ? window.localStorage.getItem("saas_token") : null;
}

export function setSaasToken(token: string): void {
  if (typeof window !== "undefined") {
    window.localStorage.setItem("saas_token", token);
  }
}

export async function fetchStores(): Promise<Array<{
  id: string;
  name: string;
  businessMode?: string;
  enableCylinderTracking?: boolean;
  collectCylinderDeposits?: boolean;
}>> {
  const token = getSaasToken();
  if (!token) return [];
  try {
    const base = getSaasApiBase();
    const url = base ? `${base.replace(/\/$/, "")}/api/stores` : "/api/stores";
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const text = await res.text();
    if (!res.ok) {
      console.warn("[fetchStores] HTTP", res.status, text.slice(0, 300));
      return [];
    }
    if (text.trimStart().toLowerCase().startsWith("<!")) return [];
    return JSON.parse(text);
  } catch (e) {
    console.warn("[fetchStores]", e);
    return [];
  }
}

export function clearSaasToken(): void {
  if (typeof window !== "undefined") {
    window.localStorage.removeItem("saas_token");
    window.localStorage.removeItem("saas_active_store_id");
    window.localStorage.removeItem("saas_stores");
    import("@/lib/saasOffline").then(({ clearOfflineData }) =>
      clearOfflineData().catch(() => {})
    );
  }
}
