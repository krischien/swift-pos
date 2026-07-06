export const API_BASE = process.env.SECURITY_API_URL ?? "http://localhost:4001";

export const DEMO_USERS = {
  admin: { email: "admin@demo.com", password: "password123" },
  owner: { email: "owner@demo.com", password: "password123" },
  cashier: { email: "maria@demo.com", password: "password123" },
};

export async function login(email, password) {
  const res = await fetch(`${API_BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const body = await res.json().catch(() => ({}));
  return { res, body };
}

export async function apiFetch(path, { token, method = "GET", body, storeId } = {}) {
  const url = new URL(path, API_BASE);
  if (storeId) url.searchParams.set("storeId", storeId);

  const headers = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(url, {
    method,
    headers,
    body: body != null ? JSON.stringify(body) : undefined,
  });

  const json = await res.json().catch(() => null);
  return { res, body: json, status: res.status };
}

export async function loginAs(role) {
  const creds = DEMO_USERS[role];
  const { res, body } = await login(creds.email, creds.password);
  if (!res.ok) {
    throw new Error(`Login failed for ${role}: ${res.status} ${body?.message ?? ""}`);
  }
  const storeId = body.stores?.[0]?.id;
  return { token: body.token, user: body.user, stores: body.stores ?? [], storeId };
}

export async function checkHealth() {
  const res = await fetch(`${API_BASE}/api/health`);
  return res.ok;
}
