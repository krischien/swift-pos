/**
 * SaaS auth API - signup, login, token storage
 */
import { getSaasApiBase } from "./saasApiConfig";

export interface SaasLoginResponse {
  token: string;
  user: { id: string; name: string; email: string; role: string };
  organization: { id: string; name: string; plan: string; trialEndsAt?: string | null } | null;
  stores: Array<{ id: string; name: string }>;
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
    throw new Error(
      `Cannot reach API at ${url}. ${msg}. Check server is running and CORS allows capacitor://localhost.`
    );
  }
  const text = await res.text();
  if (text.trimStart().toLowerCase().startsWith("<!")) {
    throw new Error(
      `Received HTML instead of JSON from ${url}. API URL may be wrong. On mobile, set VITE_SAAS_API_URL when building.`
    );
  }
  if (!res.ok) {
    let message = text || "Login failed";
    try {
      const json = JSON.parse(text);
      if (json?.message) message = json.message;
    } catch {
      /* use raw text */
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

export async function fetchStores(): Promise<Array<{ id: string; name: string }>> {
  const token = getSaasToken();
  if (!token) return [];
  try {
    const base = getSaasApiBase();
    const url = base ? `${base.replace(/\/$/, "")}/api/stores` : "/api/stores";
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return [];
    const text = await res.text();
    if (text.trimStart().toLowerCase().startsWith("<!")) return [];
    return JSON.parse(text) as Array<{ id: string; name: string }>;
  } catch {
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
