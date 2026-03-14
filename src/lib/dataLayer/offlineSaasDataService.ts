import type { DataService } from "./types";
import type { Category, Product, Variant, User, Sale } from "@/types/pos";
import { createSaasDataService } from "./saasDataService";
import { cache } from "@/lib/saasOffline/cache";
import { syncQueue } from "@/lib/saasOffline/syncQueue";

const getActiveStoreId = (): string | null =>
  window.localStorage.getItem("saas_active_store_id");

const isOnline = (): boolean =>
  typeof navigator !== "undefined" && navigator.onLine;

const storeId = (sid?: string) => sid ?? getActiveStoreId() ?? undefined;

const generateId = () =>
  `${Date.now().toString(36)}${Math.random().toString(36).substr(2, 9)}`;

function processSyncQueue(real: DataService): () => void {
  let processing = false;

  const process = async () => {
    if (!isOnline() || processing) return;
    processing = true;

    try {
      const items = await syncQueue.getAll();
      for (const item of items) {
        if (!isOnline()) break;
        try {
          const sid = item.storeId ?? undefined;
          switch (item.op) {
            case "createSale":
              await real.createSale(item.payload as any, sid);
              break;
            case "createCategory":
              await real.createCategory(item.payload as { name: string }, sid);
              break;
            case "updateCategory": {
              const p = item.payload as { id: string; payload: { name: string } };
              await real.updateCategory(p.id, p.payload, sid);
              break;
            }
            case "deleteCategory":
              await real.deleteCategory((item.payload as { id: string }).id, sid);
              break;
            case "createProduct":
              await real.createProduct(item.payload as any, sid);
              break;
            case "updateProduct": {
              const p = item.payload as { id: string; payload: any };
              await real.updateProduct(p.id, p.payload, sid);
              break;
            }
            case "deleteProduct":
              await real.deleteProduct((item.payload as { id: string }).id, sid);
              break;
            case "createVariant": {
              const p = item.payload as { productId: string; payload: any };
              await real.createVariant(p.productId, p.payload, sid);
              break;
            }
            case "updateVariant": {
              const p = item.payload as { id: string; payload: any };
              await real.updateVariant(p.id, p.payload, sid);
              break;
            }
            case "deleteVariant":
              await real.deleteVariant((item.payload as { id: string }).id, sid);
              break;
            case "createUser":
              await real.createUser(item.payload as any, sid);
              break;
            case "updateUser": {
              const p = item.payload as { id: string; payload: any };
              await real.updateUser(p.id, p.payload, sid);
              break;
            }
            case "deleteUser":
              await real.deleteUser((item.payload as { id: string }).id, sid);
              break;
          }
          await syncQueue.remove(item.id);
        } catch (err) {
          console.warn("Sync failed for", item.op, item.id, err);
          break;
        }
      }
      const remaining = await syncQueue.count();
      if (remaining === 0) {
        const sid = getActiveStoreId();
        if (sid) {
          try {
            const [categories, products] = await Promise.all([
              real.getCategories(sid),
              real.getProducts(undefined, sid),
            ]);
            await cache.setCategories(sid, categories);
            await cache.setProducts(sid, products);
          } catch {
            /* ignore refresh errors */
          }
        }
      }
    } finally {
      processing = false;
    }
  };

  const handler = () => {
    process();
  };

  if (typeof window !== "undefined") {
    window.addEventListener("online", handler);
  }

  return () => {
    if (typeof window !== "undefined") {
      window.removeEventListener("online", handler);
    }
  };
}

export function createOfflineSaasDataService(): DataService {
  const real = createSaasDataService();
  processSyncQueue(real);

  return {
    login: real.login,

    getCategories: async (sid) => {
      const effectiveStoreId = sid ?? storeId();
      if (!effectiveStoreId) return real.getCategories(sid);
      if (isOnline()) {
        const data = await real.getCategories(sid);
        await cache.setCategories(effectiveStoreId, data);
        return data;
      }
      const cached = await cache.getCategories(effectiveStoreId);
      if (cached) return cached;
      throw new Error("No cached data. Connect to load.");
    },

    createCategory: async (payload, sid) => {
      const effectiveStoreId = sid ?? storeId();
      if (isOnline()) {
        const data = await real.createCategory(payload, sid);
        const categories = await real.getCategories(sid);
        if (effectiveStoreId) await cache.setCategories(effectiveStoreId, categories);
        return data;
      }
      await syncQueue.add("createCategory", payload, effectiveStoreId ?? null);
      return { id: generateId(), name: payload.name };
    },

    updateCategory: async (id, payload, sid) => {
      const effectiveStoreId = sid ?? storeId();
      if (isOnline()) {
        const data = await real.updateCategory(id, payload, sid);
        const categories = await real.getCategories(sid);
        if (effectiveStoreId) await cache.setCategories(effectiveStoreId, categories);
        return data;
      }
      await syncQueue.add("updateCategory", { id, payload }, effectiveStoreId ?? null);
      return { id, name: payload.name };
    },

    deleteCategory: async (id, sid) => {
      const effectiveStoreId = sid ?? storeId();
      if (isOnline()) {
        await real.deleteCategory(id, sid);
        const categories = await real.getCategories(sid);
        if (effectiveStoreId) await cache.setCategories(effectiveStoreId, categories);
        return;
      }
      await syncQueue.add("deleteCategory", { id }, effectiveStoreId ?? null);
    },

    getProducts: async (params, sid) => {
      const effectiveStoreId = sid ?? storeId();
      if (!effectiveStoreId) return real.getProducts(params, sid);
      if (isOnline()) {
        const data = await real.getProducts(params, sid);
        if (!params?.categoryId && !params?.search) {
          await cache.setProducts(effectiveStoreId, data);
        }
        return data;
      }
      const cached = await cache.getProducts(effectiveStoreId);
      if (cached) {
        let filtered = cached;
        if (params?.categoryId) {
          filtered = filtered.filter((p) => p.categoryId === params.categoryId);
        }
        if (params?.search) {
          const q = (params.search || "").toLowerCase();
          filtered = filtered.filter((p) =>
            p.name.toLowerCase().includes(q)
          );
        }
        return filtered;
      }
      throw new Error("No cached data. Connect to load.");
    },

    createProduct: async (payload, sid) => {
      if (!isOnline()) {
        throw new Error("Go online to add products.");
      }
      const data = await real.createProduct(payload, sid);
      const effectiveStoreId = sid ?? storeId();
      if (effectiveStoreId) {
        const products = await real.getProducts(undefined, sid);
        await cache.setProducts(effectiveStoreId, products);
      }
      return data;
    },

    updateProduct: async (id, payload, sid) => {
      const effectiveStoreId = sid ?? storeId();
      if (isOnline()) {
        const data = await real.updateProduct(id, payload, sid);
        const products = await real.getProducts(undefined, sid);
        if (effectiveStoreId) await cache.setProducts(effectiveStoreId, products);
        return data;
      }
      await syncQueue.add("updateProduct", { id, payload }, effectiveStoreId ?? null);
      const cached = await cache.getProducts(effectiveStoreId!);
      if (cached) {
        const updated = cached.map((p) =>
          p.id === id ? { ...p, ...payload } : p
        );
        await cache.setProducts(effectiveStoreId!, updated);
      }
      return { ...payload, id } as Product;
    },

    deleteProduct: async (id, sid) => {
      const effectiveStoreId = sid ?? storeId();
      if (isOnline()) {
        await real.deleteProduct(id, sid);
        const products = await real.getProducts(undefined, sid);
        if (effectiveStoreId) await cache.setProducts(effectiveStoreId, products);
        return;
      }
      await syncQueue.add("deleteProduct", { id }, effectiveStoreId ?? null);
      const cached = await cache.getProducts(effectiveStoreId!);
      if (cached) {
        await cache.setProducts(
          effectiveStoreId!,
          cached.filter((p) => p.id !== id)
        );
      }
    },

    getVariants: async (productId, sid) => {
      const effectiveStoreId = sid ?? storeId();
      if (isOnline()) {
        return real.getVariants(productId, sid);
      }
      const products = await cache.getProducts(effectiveStoreId!);
      if (products) {
        const product = products.find((p) => p.id === productId);
        if (product?.variants) return product.variants;
      }
      throw new Error("No cached data. Connect to load.");
    },

    createVariant: async (productId, payload, sid) => {
      if (!isOnline()) {
        throw new Error("Go online to add variants.");
      }
      return real.createVariant(productId, payload, sid);
    },

    updateVariant: async (id, payload, sid) => {
      const effectiveStoreId = sid ?? storeId();
      if (isOnline()) {
        const data = await real.updateVariant(id, payload, sid);
        const products = await real.getProducts(undefined, sid);
        if (effectiveStoreId) await cache.setProducts(effectiveStoreId, products);
        return data;
      }
      await syncQueue.add("updateVariant", { id, payload }, effectiveStoreId ?? null);
      const products = await cache.getProducts(effectiveStoreId!);
      if (products) {
        const updated = products.map((p) => {
          if (!p.variants) return p;
          return {
            ...p,
            variants: p.variants.map((v) =>
              v.id === id ? { ...v, ...payload } : v
            ),
          };
        });
        await cache.setProducts(effectiveStoreId!, updated);
      }
      return { ...payload, id } as Variant;
    },

    deleteVariant: async (id, sid) => {
      const effectiveStoreId = sid ?? storeId();
      if (isOnline()) {
        await real.deleteVariant(id, sid);
        const products = await real.getProducts(undefined, sid);
        if (effectiveStoreId) await cache.setProducts(effectiveStoreId, products);
        return;
      }
      await syncQueue.add("deleteVariant", { id }, effectiveStoreId ?? null);
      const products = await cache.getProducts(effectiveStoreId!);
      if (products) {
        const updated = products.map((p) => ({
          ...p,
          variants: (p.variants ?? []).filter((v) => v.id !== id),
        }));
        await cache.setProducts(effectiveStoreId!, updated);
      }
    },

    getSales: async (params, sid) => {
      const effectiveStoreId = sid ?? storeId();
      if (isOnline()) {
        const data = await real.getSales(params, sid);
        if (effectiveStoreId) await cache.setSales(effectiveStoreId, data);
        return data;
      }
      const cached = await cache.getSales(effectiveStoreId!);
      if (cached) return cached;
      return [];
    },

    getVoidCount: real.getVoidCount
      ? async (params, sid) => {
          if (!isOnline()) return 0;
          return real.getVoidCount!(params, sid);
        }
      : undefined,

    createSale: async (payload, sid) => {
      const effectiveStoreId = sid ?? storeId();
      if (isOnline()) {
        const data = await real.createSale(payload, sid);
        const sales = await real.getSales(undefined, sid);
        if (effectiveStoreId) await cache.setSales(effectiveStoreId, sales);
        return data;
      }

      const cartItems = payload.cartItems ?? payload.items ?? [];
      const subtotal = cartItems.reduce((s, i) => s + (i.subtotal ?? i.quantity * i.price), 0);
      const discountPercent = payload.discountPercent ?? 0;
      const discountAmount = subtotal * (discountPercent / 100);
      const netSubtotal = Math.max(0, subtotal - discountAmount);
      const taxRate = payload.taxRate ?? 0.12;
      const tax = netSubtotal * taxRate;
      const total = netSubtotal + tax;
      const change = (payload.amountReceived ?? 0) - total;

      for (const item of cartItems) {
        const qty = item.quantity ?? 0;
        const productId = item.productId;
        const variantId = item.variantId;
        if (effectiveStoreId && qty > 0) {
          await cache.decrementProductStock(
            effectiveStoreId,
            productId,
            variantId,
            qty
          );
        }
      }

      await syncQueue.add("createSale", payload, effectiveStoreId ?? null);

      const saleId = `pending-${generateId()}`;
      const items = cartItems.map((it) => ({
        id: generateId(),
        saleId,
        productId: it.productId,
        variantId: it.variantId,
        productName: it.name ?? it.productName ?? "",
        variantName: it.variantName,
        quantity: it.quantity,
        price: it.price,
        subtotal: it.subtotal ?? it.quantity * it.price,
      }));

      const sale: Sale = {
        id: saleId,
        cashierId: payload.cashierId,
        cashierName: payload.cashierName,
        total,
        paymentMethod: (payload.paymentMethod as "cash") ?? "cash",
        amountReceived: payload.amountReceived,
        change,
        createdAt: new Date(),
        items,
      };

      await cache.appendSale(effectiveStoreId!, sale);
      return sale;
    },

    voidSale: real.voidSale
      ? async (id, sid) => {
          if (!isOnline()) {
            throw new Error("Go online to void sales.");
          }
          return real.voidSale!(id, sid);
        }
      : undefined,

    getUsers: async (sid) => {
      if (isOnline()) {
        const data = await real.getUsers(sid);
        await cache.setUsers(data);
        return data;
      }
      const cached = await cache.getUsers();
      if (cached) return cached;
      throw new Error("No cached data. Connect to load.");
    },

    createUser: async (payload, sid) => {
      if (!isOnline()) {
        throw new Error("Go online to add users.");
      }
      return real.createUser(payload, sid);
    },

    updateUser: async (id, payload, sid) => {
      if (!isOnline()) {
        throw new Error("Go online to update users.");
      }
      return real.updateUser(id, payload, sid);
    },

    deleteUser: async (id, sid) => {
      if (!isOnline()) {
        throw new Error("Go online to delete users.");
      }
      return real.deleteUser(id, sid);
    },
  };
}
