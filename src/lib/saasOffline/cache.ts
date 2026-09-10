import { openDB, DBSchema, IDBPDatabase } from "idb";
import type { Category, Product, User, Sale } from "@/types/pos";

const DB_NAME = "swift_pos_saas_cache";
const DB_VERSION = 1;

interface CacheDBSchema extends DBSchema {
  categories: {
    key: string;
    value: { storeId: string; data: Category[]; updatedAt: number };
  };
  products: {
    key: string;
    value: { storeId: string; data: Product[]; updatedAt: number };
  };
  users: {
    key: string;
    value: { data: User[]; updatedAt: number };
  };
  sales: {
    key: string;
    value: { storeId: string; data: Sale[]; updatedAt: number };
  };
}

let dbPromise: Promise<IDBPDatabase<CacheDBSchema>> | null = null;

function getDB() {
  if (!dbPromise) {
    dbPromise = openDB<CacheDBSchema>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains("categories")) {
          db.createObjectStore("categories", { keyPath: "storeId" });
        }
        if (!db.objectStoreNames.contains("products")) {
          db.createObjectStore("products", { keyPath: "storeId" });
        }
        if (!db.objectStoreNames.contains("users")) {
          db.createObjectStore("users", { keyPath: "key" });
        }
        if (!db.objectStoreNames.contains("sales")) {
          db.createObjectStore("sales", { keyPath: "storeId" });
        }
      },
    });
  }
  return dbPromise;
}

export const cache = {
  async getCategories(storeId: string): Promise<Category[] | null> {
    const db = await getDB();
    const row = await db.get("categories", storeId);
    return row?.data ?? null;
  },

  async setCategories(storeId: string, data: Category[]): Promise<void> {
    const db = await getDB();
    await db.put("categories", { storeId, data, updatedAt: Date.now() });
  },

  async getProducts(storeId: string): Promise<Product[] | null> {
    const db = await getDB();
    const row = await db.get("products", storeId);
    return row?.data ?? null;
  },

  async setProducts(storeId: string, data: Product[]): Promise<void> {
    const db = await getDB();
    await db.put("products", { storeId, data, updatedAt: Date.now() });
  },

  async getUsers(): Promise<User[] | null> {
    const db = await getDB();
    const row = await db.get("users", "org");
    return row?.data ?? null;
  },

  async setUsers(data: User[]): Promise<void> {
    const db = await getDB();
    await db.put("users", { key: "org", data, updatedAt: Date.now() });
  },

  async getSales(storeId: string): Promise<Sale[] | null> {
    const db = await getDB();
    const row = await db.get("sales", storeId);
    return row?.data ?? null;
  },

  async setSales(storeId: string, data: Sale[]): Promise<void> {
    const db = await getDB();
    await db.put("sales", { storeId, data, updatedAt: Date.now() });
  },

  async appendSale(storeId: string, sale: Sale): Promise<void> {
    const existing = (await this.getSales(storeId)) ?? [];
    await this.setSales(storeId, [...existing, sale]);
  },

  async decrementProductStock(
    storeId: string,
    productId: string,
    variantId: string | undefined,
    quantity: number
  ): Promise<void> {
    const products = await this.getProducts(storeId);
    if (!products) return;

    const updated = products.map((p) => {
      if (p.id !== productId) return p;
      if (variantId && p.variants) {
        return {
          ...p,
          variants: p.variants.map((v) =>
            v.id === variantId
              ? { ...v, stock: Math.max(0, (v.stock ?? 0) - quantity) }
              : v
          ),
        };
      }
      return {
        ...p,
        stock: Math.max(0, (p.stock ?? 0) - quantity),
      };
    });
    await this.setProducts(storeId, updated);
  },

  async clear(): Promise<void> {
    const db = await getDB();
    const tx = db.transaction(
      ["categories", "products", "users", "sales"],
      "readwrite"
    );
    await Promise.all([
      tx.objectStore("categories").clear(),
      tx.objectStore("products").clear(),
      tx.objectStore("users").clear(),
      tx.objectStore("sales").clear(),
      tx.done,
    ]);
  },
};
