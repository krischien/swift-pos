const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:4000/api";

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    headers: {
      "Content-Type": "application/json",
    },
    ...options,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || res.statusText);
  }

  // Handle empty responses (e.g. 204 No Content for DELETE)
  if (res.status === 204 || res.headers.get("content-length") === "0") {
    return undefined as T;
  }

  const contentType = res.headers.get("content-type") || "";
  if (!contentType.includes("application/json")) {
    return undefined as T;
  }

  return res.json();
}

export const api = {
  // Auth
  login: (payload: { email: string; name?: string }) =>
    request("/login", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  // Categories
  getCategories: () => request("/categories"),

  // Products
  getProducts: (params?: { categoryId?: string | null; search?: string }) => {
    const searchParams = new URLSearchParams();
    if (params?.categoryId) searchParams.set("categoryId", params.categoryId);
    if (params?.search) searchParams.set("search", params.search);

    const qs = searchParams.toString();
    return request(`/products${qs ? `?${qs}` : ""}`);
  },

  createProduct: (payload: {
    name: string;
    categoryId: string;
    itemCode: string;
    hasVariants: boolean;
    price?: number;
    stock?: number;
    lowStockThreshold?: number;
    status?: "active" | "inactive";
    image?: string;
  }) =>
    request("/products", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  updateProduct: (
    id: string,
    payload: Partial<{
      name: string;
      categoryId: string;
      itemCode: string;
      hasVariants: boolean;
      price?: number;
      stock?: number;
      lowStockThreshold: number;
      status: "active" | "inactive";
      image?: string;
    }>,
  ) =>
    request(`/products/${id}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    }),

  deleteProduct: (id: string) =>
    request(`/products/${id}`, {
      method: "DELETE",
    }),

  // Variants
  getVariants: (productId: string) =>
    request(`/products/${productId}/variants`),

  createVariant: (
    productId: string,
    payload: { name: string; price: number; stock: number },
  ) =>
    request(`/products/${productId}/variants`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  updateVariant: (
    id: string,
    payload: Partial<{ name: string; price: number; stock: number }>,
  ) =>
    request(`/variants/${id}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    }),

  deleteVariant: (id: string) =>
    request(`/variants/${id}`, {
      method: "DELETE",
    }),

  // Sales
  getSales: (params?: { from?: string; to?: string }) => {
    const searchParams = new URLSearchParams();
    if (params?.from) searchParams.set("from", params.from);
    if (params?.to) searchParams.set("to", params.to);
    const qs = searchParams.toString();
    return request(`/sales${qs ? `?${qs}` : ""}`);
  },

  createSale: (payload: any) =>
    request("/sales", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
};


