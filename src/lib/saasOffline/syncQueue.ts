import { openDB, DBSchema, IDBPDatabase } from "idb";

const DB_NAME = "swift_pos_saas_sync";
const DB_VERSION = 1;
const STORE_NAME = "sync_queue";

export type SyncOp =
  | "createSale"
  | "createProduct"
  | "updateProduct"
  | "deleteProduct"
  | "createCategory"
  | "updateCategory"
  | "deleteCategory"
  | "createVariant"
  | "updateVariant"
  | "deleteVariant"
  | "createUser"
  | "updateUser"
  | "deleteUser";

export interface SyncQueueItem {
  id: string;
  op: SyncOp;
  payload: unknown;
  storeId: string | null;
  createdAt: number;
}

interface SyncDBSchema extends DBSchema {
  [STORE_NAME]: {
    key: string;
    value: SyncQueueItem;
  };
}

let dbPromise: Promise<IDBPDatabase<SyncDBSchema>> | null = null;

function getDB() {
  if (!dbPromise) {
    dbPromise = openDB<SyncDBSchema>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: "id" });
        }
      },
    });
  }
  return dbPromise;
}

const generateId = () =>
  `${Date.now().toString(36)}${Math.random().toString(36).substr(2, 9)}`;

export const syncQueue = {
  async add(op: SyncOp, payload: unknown, storeId: string | null): Promise<string> {
    const db = await getDB();
    const id = generateId();
    const item: SyncQueueItem = {
      id,
      op,
      payload,
      storeId,
      createdAt: Date.now(),
    };
    await db.put(STORE_NAME, item);
    return id;
  },

  async getAll(): Promise<SyncQueueItem[]> {
    const db = await getDB();
    const items = await db.getAll(STORE_NAME);
    return items.sort((a, b) => a.createdAt - b.createdAt);
  },

  async remove(id: string): Promise<void> {
    const db = await getDB();
    await db.delete(STORE_NAME, id);
  },

  async clear(): Promise<void> {
    const db = await getDB();
    await db.clear(STORE_NAME);
  },

  async count(): Promise<number> {
    const db = await getDB();
    return db.count(STORE_NAME);
  },
};
