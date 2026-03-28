import type { DataService } from "./types";
import { clearSaasToken } from "@/lib/saasAuth";
import { getSaasApiBase } from "@/lib/saasApiConfig";

const getAuthToken = (): string | null => {
  return window.localStorage.getItem("saas_token");
};

const getActiveStoreId = (): string | null => {
  return window.localStorage.getItem("saas_active_store_id");
};

async function saasRequest<T>(
  path: string,
  options?: RequestInit & { storeId?: string }
): Promise<T> {
  const token = getAuthToken();
  if (!token) {
    throw new Error("Not authenticated. Please log in.");
  }

  const storeId = options?.storeId ?? getActiveStoreId();
  const { storeId: _storeId, ...fetchOptions } = options || {};
  const base = getSaasApiBase();
  const url = new URL(path, base || window.location.origin);
  if (storeId) {
    url.searchParams.set("storeId", storeId);
  }

  const res = await fetch(url.toString(), {
    ...fetchOptions,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(fetchOptions.headers as Record<string, string>),
    },
  });

  const text = await res.text();
  if (text.trimStart().toLowerCase().startsWith("<!")) {
    throw new Error(
      "Received HTML instead of JSON. The API URL may be wrong. On mobile, set VITE_SAAS_API_URL when building (e.g. http://YOUR_IP:4001 for local dev)."
    );
  }
  if (!res.ok) {
    let message = text || res.statusText;
    try {
      const json = JSON.parse(text);
      if (json?.message) message = json.message;
    } catch {
      /* use raw text */
    }
    // On 403 suspension/expiry, clear token and redirect to login
    if (res.status === 403 && (message.includes("suspended") || message.includes("Trial expired"))) {
      clearSaasToken();
      window.location.href = "/login?reason=suspended";
    }
    throw new Error(message);
  }

  if (res.status === 204 || res.headers.get("content-length") === "0") {
    return undefined as T;
  }

  const contentType = res.headers.get("content-type") || "";
  if (!contentType.includes("application/json")) {
    return undefined as T;
  }

  return JSON.parse(text) as T;
}

/**
 * SaaS mode data service. Calls cloud API with JWT and storeId.
 * Implemented when SaaS backend is ready (Phase 3).
 */
export const createSaasDataService = (): DataService => {
  const storeId = () => getActiveStoreId() ?? undefined;

  return {
    login: async () => {
      throw new Error("SaaS login: use signup/login flow. Not yet implemented.");
    },

    getCategories: (sid) =>
      saasRequest(`/api/categories`, { storeId: sid ?? storeId() }) as Promise<any>,
    createCategory: (payload, sid) =>
      saasRequest("/api/categories", {
        method: "POST",
        body: JSON.stringify(payload),
        storeId: sid ?? storeId(),
      }) as Promise<any>,
    updateCategory: (id, payload, sid) =>
      saasRequest(`/api/categories/${id}`, {
        method: "PUT",
        body: JSON.stringify(payload),
        storeId: sid ?? storeId(),
      }) as Promise<any>,
    deleteCategory: (id, sid) =>
      saasRequest(`/api/categories/${id}`, {
        method: "DELETE",
        storeId: sid ?? storeId(),
      }) as Promise<any>,

    getProducts: (params, sid) => {
      const url = new URL("/api/products", getSaasApiBase() || window.location.origin);
      if (params?.categoryId) url.searchParams.set("categoryId", params.categoryId);
      if (params?.search) url.searchParams.set("search", params.search);
      const effectiveStoreId = sid ?? storeId();
      if (effectiveStoreId) url.searchParams.set("storeId", effectiveStoreId);
      return saasRequest(url.toString(), effectiveStoreId ? { storeId: effectiveStoreId } : undefined) as Promise<any>;
    },
    createProduct: (payload, sid) =>
      saasRequest("/api/products", {
        method: "POST",
        body: JSON.stringify(payload),
        storeId: sid ?? storeId(),
      }) as Promise<any>,
    updateProduct: (id, payload, sid) =>
      saasRequest(`/api/products/${id}`, {
        method: "PUT",
        body: JSON.stringify(payload),
        storeId: sid ?? storeId(),
      }) as Promise<any>,
    deleteProduct: (id, sid) =>
      saasRequest(`/api/products/${id}`, {
        method: "DELETE",
        storeId: sid ?? storeId(),
      }) as Promise<any>,

    getVariants: (productId, sid) =>
      saasRequest(`/api/products/${productId}/variants`, {
        storeId: sid ?? storeId(),
      }) as Promise<any>,
    createVariant: (productId, payload, sid) =>
      saasRequest(`/api/products/${productId}/variants`, {
        method: "POST",
        body: JSON.stringify(payload),
        storeId: sid ?? storeId(),
      }) as Promise<any>,
    updateVariant: (id, payload, sid) =>
      saasRequest(`/api/variants/${id}`, {
        method: "PUT",
        body: JSON.stringify(payload),
        storeId: sid ?? storeId(),
      }) as Promise<any>,
    deleteVariant: (id, sid) =>
      saasRequest(`/api/variants/${id}`, {
        method: "DELETE",
        storeId: sid ?? storeId(),
      }) as Promise<any>,

    getSales: (params, sid) => {
      const url = new URL("/api/sales", getSaasApiBase() || window.location.origin);
      if (params?.from) url.searchParams.set("from", params.from);
      if (params?.to) url.searchParams.set("to", params.to);
      if (params?.voidFilter) url.searchParams.set("voidFilter", params.voidFilter);
      const effectiveStoreId = sid ?? storeId();
      if (effectiveStoreId) url.searchParams.set("storeId", effectiveStoreId);
      return saasRequest(url.toString(), effectiveStoreId ? { storeId: effectiveStoreId } : undefined) as Promise<any>;
    },
    getVoidCount: async (params, sid) => {
      const url = new URL("/api/sales/void-count", getSaasApiBase() || window.location.origin);
      if (params?.from) url.searchParams.set("from", params.from);
      if (params?.to) url.searchParams.set("to", params.to);
      const effectiveStoreId = sid ?? storeId();
      if (effectiveStoreId) url.searchParams.set("storeId", effectiveStoreId);
      const res = await saasRequest<{ count: number }>(url.toString(), effectiveStoreId ? { storeId: effectiveStoreId } : undefined);
      return res?.count ?? 0;
    },
    createSale: (payload, sid) =>
      saasRequest("/api/sales", {
        method: "POST",
        body: JSON.stringify(payload),
        storeId: sid ?? storeId(),
      }) as Promise<any>,
    voidSale: (id, sid) =>
      saasRequest(`/api/sales/${id}/void`, {
        method: "POST",
        storeId: sid ?? storeId(),
      }) as Promise<any>,

    getUsers: () =>
      saasRequest("/api/org/users") as Promise<any>,
    createUser: (payload, sid) =>
      saasRequest("/api/users", {
        method: "POST",
        body: JSON.stringify(payload),
        storeId: sid ?? storeId(),
      }) as Promise<any>,
    updateUser: (id, payload, sid) =>
      saasRequest(`/api/users/${id}`, {
        method: "PUT",
        body: JSON.stringify(payload),
        storeId: sid ?? storeId(),
      }) as Promise<any>,
    deleteUser: (id, sid) =>
      saasRequest(`/api/users/${id}`, {
        method: "DELETE",
        storeId: sid ?? storeId(),
      }) as Promise<any>,
  };
};
