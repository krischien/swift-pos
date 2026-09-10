import { Capacitor } from "@capacitor/core";
import { mobileServices } from "./mobileServices";
import { initDatabase } from "./mobileDb";

// Initialize database on native platforms (called on app startup, but ensure it's ready)
let dbInitialized = false;
const ensureDbInitialized = async () => {
  if (Capacitor.isNativePlatform() && !dbInitialized) {
    try {
      await initDatabase();
      dbInitialized = true;
      console.log("Database ready for API calls");
    } catch (error) {
      console.error("Failed to initialize database:", error);
      // Don't throw here, let individual calls handle it
    }
  }
};

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
  login: async (payload: { email: string; password: string }) => {
    console.log("api.login called. Native?", Capacitor.isNativePlatform());
    await ensureDbInitialized();
    if (Capacitor.isNativePlatform()) {
      return mobileServices.login(payload);
    }
    return request("/login", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  // Categories
  getCategories: async () => {
    await ensureDbInitialized();
    if (Capacitor.isNativePlatform()) {
      return mobileServices.getCategories();
    }
    return request("/categories");
  },

  createCategory: async (payload: { name: string }) => {
    await ensureDbInitialized();
    if (Capacitor.isNativePlatform()) {
      return mobileServices.createCategory(payload);
    }
    return request("/categories", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  updateCategory: async (id: string, payload: { name: string }) => {
    await ensureDbInitialized();
    if (Capacitor.isNativePlatform()) {
      return mobileServices.updateCategory(id, payload);
    }
    return request(`/categories/${id}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    });
  },

  deleteCategory: async (id: string) => {
    await ensureDbInitialized();
    if (Capacitor.isNativePlatform()) {
      return mobileServices.deleteCategory(id);
    }
    return request(`/categories/${id}`, {
      method: "DELETE",
    });
  },

  // Products
  getProducts: async (params?: { categoryId?: string | null; search?: string }) => {
    await ensureDbInitialized();
    if (Capacitor.isNativePlatform()) {
      return mobileServices.getProducts(params);
    }
    const searchParams = new URLSearchParams();
    if (params?.categoryId) searchParams.set("categoryId", params.categoryId);
    if (params?.search) searchParams.set("search", params.search);

    const qs = searchParams.toString();
    return request(`/products${qs ? `?${qs}` : ""}`);
  },

  createProduct: async (payload: {
    name: string;
    categoryId: string;
    itemCode: string;
    sku?: string;
    hasVariants: boolean;
    basePrice?: number;
    price?: number;
    stock?: number;
    lowStockThreshold?: number;
    marginPercentage?: number;
    status?: "active" | "inactive";
    image?: string;
    barcode?: string;
    qrCode?: string;
    unitOfMeasure?: string;
  }) => {
    await ensureDbInitialized();
    if (Capacitor.isNativePlatform()) {
      return mobileServices.createProduct(payload);
    }
    return request("/products", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  updateProduct: async (
    id: string,
    payload: Partial<{
      name: string;
      categoryId: string;
      itemCode: string;
      sku?: string;
      hasVariants: boolean;
      basePrice?: number;
      price?: number;
      stock?: number;
      lowStockThreshold: number;
      marginPercentage?: number;
      status: "active" | "inactive";
      image?: string;
      barcode?: string;
      qrCode?: string;
      unitOfMeasure?: string;
    }>,
  ) => {
    await ensureDbInitialized();
    if (Capacitor.isNativePlatform()) {
      return mobileServices.updateProduct(id, payload);
    }
    return request(`/products/${id}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    });
  },

  deleteProduct: async (id: string) => {
    await ensureDbInitialized();
    if (Capacitor.isNativePlatform()) {
      return mobileServices.deleteProduct(id);
    }
    return request(`/products/${id}`, {
      method: "DELETE",
    });
  },

  // Variants
  getVariants: async (productId: string) => {
    await ensureDbInitialized();
    if (Capacitor.isNativePlatform()) {
      return mobileServices.getVariants(productId);
    }
    return request(`/products/${productId}/variants`);
  },

  createVariant: async (
    productId: string,
    payload: { name: string; price: number; stock: number },
  ) => {
    await ensureDbInitialized();
    if (Capacitor.isNativePlatform()) {
      return mobileServices.createVariant(productId, payload);
    }
    return request(`/products/${productId}/variants`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  updateVariant: async (
    id: string,
    payload: Partial<{ name: string; price: number; stock: number }>,
  ) => {
    await ensureDbInitialized();
    if (Capacitor.isNativePlatform()) {
      return mobileServices.updateVariant(id, payload);
    }
    return request(`/variants/${id}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    });
  },

  deleteVariant: async (id: string) => {
    await ensureDbInitialized();
    if (Capacitor.isNativePlatform()) {
      return mobileServices.deleteVariant(id);
    }
    return request(`/variants/${id}`, {
      method: "DELETE",
    });
  },

  // Sales
  getSales: async (params?: { from?: string; to?: string; voidFilter?: "active" | "voided" | "all" }) => {
    await ensureDbInitialized();
    if (Capacitor.isNativePlatform()) {
      return mobileServices.getSales(params);
    }
    const searchParams = new URLSearchParams();
    if (params?.from) searchParams.set("from", params.from);
    if (params?.to) searchParams.set("to", params.to);
    if (params?.voidFilter) searchParams.set("voidFilter", params.voidFilter);
    const qs = searchParams.toString();
    return request(`/sales${qs ? `?${qs}` : ""}`);
  },

  createSale: async (payload: any) => {
    await ensureDbInitialized();
    if (Capacitor.isNativePlatform()) {
      return mobileServices.createSale(payload);
    }
    return request("/sales", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  // Users
  getUsers: async () => {
    await ensureDbInitialized();
    if (Capacitor.isNativePlatform()) {
      return mobileServices.getUsers();
    }
    return request("/users");
  },

  createUser: async (payload: {
    name: string;
    email: string;
    password: string;
    role: "admin" | "cashier";
  }) => {
    await ensureDbInitialized();
    if (Capacitor.isNativePlatform()) {
      return mobileServices.createUser(payload);
    }
    return request("/users", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  updateUser: async (
    id: string,
    payload: Partial<{
      name: string;
      email: string;
      password: string;
      role: "admin" | "cashier";
    }>,
  ) => {
    await ensureDbInitialized();
    if (Capacitor.isNativePlatform()) {
      return mobileServices.updateUser(id, payload);
    }
    return request(`/users/${id}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    });
  },

  deleteUser: async (id: string) => {
    await ensureDbInitialized();
    if (Capacitor.isNativePlatform()) {
      return mobileServices.deleteUser(id);
    }
    return request(`/users/${id}`, {
      method: "DELETE",
    });
  },

  // Backups (server only, not available on mobile)
  getBackups: async () => {
    if (Capacitor.isNativePlatform()) {
      throw new Error("Backup management is only available on the server");
    }
    return request<Array<{ filename: string; path: string; size: number; date: string }>>("/backups");
  },

  restoreBackup: async (backupFilename?: string) => {
    if (Capacitor.isNativePlatform()) {
      throw new Error("Backup restore is only available on the server");
    }
    return request<{ message: string; restoredFrom: string }>("/backups/restore", {
      method: "POST",
      body: JSON.stringify({ backupFilename }),
    });
  },

  createBackup: async () => {
    if (Capacitor.isNativePlatform()) {
      throw new Error("Backup creation is only available on the server");
    }
    return request<{ message: string; path: string }>("/backups/create", {
      method: "POST",
    });
  },

  // BIR Annex A Inventory Report (server only - returns blob for download)
  getBirInventoryReport: async (params: {
    companyName: string;
    tin?: string;
    address: string;
    inventoryDate?: string;
    format?: "xlsx" | "pdf";
  }): Promise<Blob> => {
    const res = await fetch(`${API_BASE_URL}/reports/bir-inventory`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        companyName: params.companyName,
        tin: params.tin ?? "",
        address: params.address,
        inventoryDate: params.inventoryDate ?? `${new Date().getFullYear()}-12-31`,
        format: params.format ?? "xlsx",
      }),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(text || res.statusText);
    }
    return res.blob();
  },
};


