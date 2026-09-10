import { API_BASE_URL } from "../fixtures/config.js";

export interface LoginResponse {
  token: string;
  user: { id: string; email: string; role: string; name?: string };
  organization: { id: string; name: string; plan?: string; trialEndsAt?: string } | null;
  stores: Array<{ id: string; name: string; businessMode?: string }>;
}

export interface SignupResponse {
  token: string;
  user: { id: string; email: string; role: string };
  organization: { id: string; name: string };
  stores: Array<{ id: string; name: string }>;
}

export interface RawRequestResult {
  status: number;
  data: unknown;
}

export class ApiClient {
  token?: string;
  storeId?: string;
  stores: LoginResponse["stores"] = [];

  constructor(public readonly baseUrl: string = API_BASE_URL) {}

  async resetDemoPasswords(): Promise<void> {
    const res = await fetch(`${this.baseUrl}/api/demo/reset-passwords`, { method: "POST" });
    if (!res.ok && res.status !== 404) {
      const body = await res.text();
      throw new Error(`reset-demo-passwords failed (${res.status}): ${body}`);
    }
  }

  async login(email: string, password: string): Promise<LoginResponse> {
    const data = await this.request<LoginResponse>("POST", "/api/auth/login", {
      body: { email, password },
      auth: false,
    });
    this.token = data.token;
    this.stores = data.stores;
    this.storeId = data.stores[0]?.id;
    return data;
  }

  async signup(input: {
    organizationName: string;
    storeName: string;
    adminEmail: string;
    adminPassword: string;
    adminName?: string;
  }): Promise<SignupResponse> {
    const data = await this.request<SignupResponse>("POST", "/api/auth/signup", {
      body: input,
      auth: false,
      expectStatus: 201,
    });
    this.token = data.token;
    this.stores = data.stores;
    this.storeId = data.stores[0]?.id;
    return data;
  }

  async seedDemo(): Promise<{ message: string; orgId?: string }> {
    return this.request("POST", "/api/demo/seed", { storeId: null });
  }

  async getStores(): Promise<Array<{ id: string; name: string; businessMode?: string }>> {
    return this.request("GET", "/api/stores", { storeId: null });
  }

  getStoreByMode(mode: "fnb" | "retail"): { id: string; name: string; businessMode?: string } {
    const store = this.stores.find((s) =>
      mode === "fnb"
        ? s.businessMode === "fnb" || s.name.toLowerCase().includes("f&b")
        : s.businessMode !== "fnb" && !s.name.toLowerCase().includes("f&b"),
    );
    if (!store) {
      throw new Error(`No ${mode} store found in session stores: ${JSON.stringify(this.stores)}`);
    }
    return store;
  }

  async request<T = unknown>(
    method: string,
    path: string,
    options: {
      body?: unknown;
      storeId?: string | null;
      auth?: boolean;
      expectStatus?: number;
      raw?: boolean;
    } = {},
  ): Promise<T> {
    const result = await this.rawRequest(method, path, options);
    const { status, data } = result;
    const { expectStatus } = options;

    if (expectStatus !== undefined && status !== expectStatus) {
      throw new Error(
        `${method} ${path} expected ${expectStatus}, got ${status}: ${JSON.stringify(data)}`,
      );
    }

    if (expectStatus === undefined && status >= 400) {
      throw new Error(`${method} ${path} failed (${status}): ${JSON.stringify(data)}`);
    }

    return data as T;
  }

  async rawRequest(
    method: string,
    path: string,
    options: {
      body?: unknown;
      storeId?: string | null;
      auth?: boolean;
      token?: string;
    } = {},
  ): Promise<RawRequestResult> {
    const { body, auth = true, token } = options;
    const storeId = options.storeId === null ? undefined : (options.storeId ?? this.storeId);

    const url = new URL(path, this.baseUrl);
    if (storeId) url.searchParams.set("storeId", storeId);

    const headers: Record<string, string> = { Accept: "application/json" };
    if (body !== undefined) headers["Content-Type"] = "application/json";
    const bearer = token ?? this.token;
    if (auth !== false && bearer) headers.Authorization = `Bearer ${bearer}`;

    const res = await fetch(url, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });

    const text = await res.text();
    let data: unknown = null;
    if (text) {
      try {
        data = JSON.parse(text);
      } catch {
        data = text;
      }
    }

    return { status: res.status, data };
  }

  withStore(storeId: string): ApiClient {
    const copy = new ApiClient(this.baseUrl);
    copy.token = this.token;
    copy.storeId = storeId;
    copy.stores = this.stores;
    return copy;
  }
}

export async function waitForHealth(baseUrl: string, timeoutMs = 60_000): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(`${baseUrl}/api/health`);
      if (res.ok) return;
    } catch {
      // retry
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`API health check timed out after ${timeoutMs}ms (${baseUrl})`);
}

export function saleTotal(subtotal: number, taxRate = 0.1, discountPercent = 0): number {
  const discountAmount = subtotal * Math.max(0, Math.min(100, discountPercent)) / 100;
  const netSubtotal = Math.max(0, subtotal - discountAmount);
  return netSubtotal + netSubtotal * taxRate;
}
