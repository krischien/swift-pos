import type { DataService } from "./types";
import type {
  Category,
  Product,
  Variant,
  User,
  Sale,
  Customer,
  CylinderLoan,
  CylinderStats,
} from "@/types/pos";
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

async function recalculateCylinderStats(storeId: string): Promise<CylinderStats> {
  const products = (await cache.getProducts(storeId)) ?? [];
  const tracked = products.filter((product) => product.tracksCylinder);
  const loans = (await cache.getCylinderLoans(storeId)) ?? [];
  const open = loans.filter((loan) => loan.status === "out" || loan.status === "partial");
  const stats: CylinderStats = {
    filledOnHand: tracked.reduce((sum, product) => sum + Number(product.stock ?? 0), 0),
    emptyOnHand: tracked.reduce((sum, product) => sum + Number(product.emptyStock ?? 0), 0),
    onCustomer: open.reduce((sum, loan) => sum + loan.quantity - loan.returnedQuantity, 0),
    depositLiability: open.reduce(
      (sum, loan) =>
        sum + Math.max(0, loan.depositAmount - (loan.returns ?? []).reduce((r, event) => r + event.refundAmount, 0)),
      0,
    ),
    lowFilledCount: tracked.filter((p) => Number(p.stock ?? 0) > 0 && Number(p.stock) <= p.lowStockThreshold).length,
    outOfFilledCount: tracked.filter((p) => Number(p.stock ?? 0) <= 0).length,
    lowEmptyCount: tracked.filter((p) => Number(p.emptyStock ?? 0) > 0 && Number(p.emptyStock) <= p.lowStockThreshold).length,
    outOfEmptyCount: tracked.filter((p) => Number(p.emptyStock ?? 0) <= 0).length,
  };
  await cache.setCylinderStats(storeId, stats);
  return stats;
}

let syncQueueRegistered = false;
let cachedOfflineService: DataService | null = null;

function processSyncQueue(real: DataService): void {
  if (syncQueueRegistered) return;
  syncQueueRegistered = true;

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
            case "createCustomer":
              await real.createCustomer!(item.payload as any, sid);
              break;
            case "updateCustomer": {
              const p = item.payload as { id: string; payload: any };
              await real.updateCustomer!(p.id, p.payload, sid);
              break;
            }
            case "archiveCustomer": {
              const p = item.payload as { id: string; archived: boolean };
              await real.archiveCustomer!(p.id, p.archived, sid);
              break;
            }
            case "setCustomerSuki": {
              const p = item.payload as { id: string; payload: { enabled: boolean; note?: string } };
              await real.setCustomerSuki!(p.id, p.payload, sid);
              break;
            }
            case "returnCylinder": {
              const p = item.payload as { id: string; options: any };
              await real.returnCylinderLoan!(p.id, p.options, sid);
              break;
            }
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
            const [categories, products, customers, loans, stats] = await Promise.all([
              real.getCategories(sid),
              real.getProducts(undefined, sid),
              real.getCustomers!(undefined, sid),
              real.getCylinderLoans!({ status: "all" }, sid),
              real.getCylinderStats!(sid),
            ]);
            await cache.setCategories(sid, categories);
            await cache.setProducts(sid, products);
            await cache.setCustomers(sid, customers.items);
            await cache.setCylinderLoans(sid, loans);
            await cache.setCylinderStats(sid, stats);
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
}

export function createOfflineSaasDataService(): DataService {
  if (cachedOfflineService) return cachedOfflineService;

  const real = createSaasDataService();
  processSyncQueue(real);

  cachedOfflineService = {
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
        const [sales, products, loans, stats] = await Promise.all([
          real.getSales(undefined, sid),
          real.getProducts(undefined, sid),
          real.getCylinderLoans!({ status: "all" }, sid),
          real.getCylinderStats!(sid),
        ]);
        if (effectiveStoreId) {
          await cache.setSales(effectiveStoreId, sales);
          await cache.setProducts(effectiveStoreId, products);
          await cache.setCylinderLoans(effectiveStoreId, loans);
          await cache.setCylinderStats(effectiveStoreId, stats);
        }
        return data;
      }

      const cartItems = payload.cartItems ?? payload.items ?? [];
      if (cartItems.some((i: { menuItemId?: string }) => !!i.menuItemId)) {
        throw new Error("Food & beverage sales require an internet connection.");
      }
      const subtotal = cartItems.reduce((s, i) => s + (i.subtotal ?? i.quantity * i.price), 0);
      const discountPercent = Math.max(0, Math.min(100, payload.discountPercent ?? 0));
      const discountAmount = subtotal * (discountPercent / 100);
      const netSubtotal = Math.max(0, subtotal - discountAmount);
      const taxRate = payload.taxRate ?? 0.1;
      const tax = netSubtotal * taxRate;
      const total = netSubtotal + tax;
      const products = effectiveStoreId ? (await cache.getProducts(effectiveStoreId)) ?? [] : [];
      const customers = effectiveStoreId ? (await cache.getCustomers(effectiveStoreId)) ?? [] : [];
      const linkedCustomer = customers.find((customer) => customer.id === payload.customerId);
      const exchangeQuantity = (item: (typeof cartItems)[number]) =>
        Math.min(
          item.quantity,
          Math.max(0, Math.floor(item.broughtEmptyQuantity ?? (item.broughtEmpty ? item.quantity : 0))),
        );
      const cylinderLines = cartItems.filter(
        (item) => products.find((product) => product.id === item.productId)?.tracksCylinder,
      );
      if (cylinderLines.length && payload.cylinderTrackingEnabled === false) {
        throw new Error("Canister Monitoring is disabled");
      }
      const outstanding = cylinderLines.reduce(
        (sum, item) => sum + item.quantity - exchangeQuantity(item),
        0,
      );
      if (outstanding > 0 && (!payload.customerId || !linkedCustomer)) {
        throw new Error("A cached customer is required for an offline canister loan.");
      }
      const collectDeposits = payload.collectDeposits !== false;
      const depositAmount = cylinderLines.reduce((sum, item) => {
        const product = products.find((candidate) => candidate.id === item.productId);
        return sum + (collectDeposits
          ? (item.quantity - exchangeQuantity(item)) * Number(product?.depositAmount ?? 0)
          : 0);
      }, 0);
      const amountDue = total + depositAmount;
      if ((payload.amountReceived ?? 0) + 0.005 < amountDue) {
        throw new Error("Amount received is less than total due");
      }
      const change = Math.round(((payload.amountReceived ?? 0) - amountDue) * 100) / 100;

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

      if (effectiveStoreId && cylinderLines.length) {
        const updatedProducts = ((await cache.getProducts(effectiveStoreId)) ?? []).map((product) => {
          const line = cylinderLines.find((item) => item.productId === product.id);
          return line
            ? { ...product, emptyStock: Number(product.emptyStock ?? 0) + exchangeQuantity(line) }
            : product;
        });
        await cache.setProducts(effectiveStoreId, updatedProducts);
      }

      const saleId = `pending-${generateId()}`;
      const queuedCartItems = cartItems.map((item) => {
        const isLoan = cylinderLines.includes(item) && item.quantity - exchangeQuantity(item) > 0;
        return { ...item, ...(isLoan ? { cylinderLoanId: `pending-${generateId()}` } : {}) };
      });
      await syncQueue.add(
        "createSale",
        { ...payload, cartItems: queuedCartItems, items: undefined },
        effectiveStoreId ?? null,
      );

      const items = queuedCartItems.map((it) => ({
        id: generateId(),
        saleId,
        productId: it.productId,
        menuItemId: it.menuItemId,
        variantId: it.variantId,
        productName: it.name ?? it.productName ?? "",
        variantName: it.variantName,
        quantity: it.quantity,
        price: it.price,
        subtotal: it.subtotal ?? it.quantity * it.price,
        broughtEmptyQuantity: exchangeQuantity(it),
      }));

      const sale: Sale = {
        id: saleId,
        cashierId: payload.cashierId,
        cashierName: payload.cashierName,
        total,
        depositAmount,
        amountDue,
        customerId: payload.customerId ?? null,
        paymentMethod: (payload.paymentMethod as "cash") ?? "cash",
        amountReceived: payload.amountReceived,
        change,
        createdAt: new Date(),
        items,
      };

      await cache.appendSale(effectiveStoreId!, sale);
      if (effectiveStoreId && cylinderLines.length) {
        const loans = (await cache.getCylinderLoans(effectiveStoreId)) ?? [];
        const pendingLoans: CylinderLoan[] = queuedCartItems.flatMap((line) => {
          if (!products.find((product) => product.id === line.productId)?.tracksCylinder) return [];
          const quantity = line.quantity - exchangeQuantity(line);
          if (quantity <= 0) return [];
          const product = products.find((candidate) => candidate.id === line.productId)!;
          return [{
            id: line.cylinderLoanId!,
            storeId: effectiveStoreId,
            saleId,
            productId: line.productId!,
            customerId: payload.customerId ?? null,
            customerName: linkedCustomer?.name ?? payload.customerName ?? null,
            customerPhone: linkedCustomer?.phone ?? payload.customerPhone ?? null,
            quantity,
            returnedQuantity: 0,
            depositAmount: collectDeposits ? quantity * Number(product.depositAmount ?? 0) : 0,
            depositRefunded: false,
            status: "out",
            outAt: new Date().toISOString(),
            product: { id: product.id, name: product.name, cylinderSize: product.cylinderSize },
            customer: linkedCustomer ?? null,
            sale: { id: saleId, createdAt: new Date().toISOString(), cashierName: payload.cashierName },
            returns: [],
          }];
        });
        await cache.setCylinderLoans(effectiveStoreId, [...pendingLoans, ...loans]);
        await recalculateCylinderStats(effectiveStoreId);
        if (payload.customerId) await cache.removeCustomerDetail(effectiveStoreId, payload.customerId);
      }
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

    getIngredients: async (sid) => {
      if (!isOnline()) throw new Error("Connect to load ingredients.");
      return real.getIngredients(sid);
    },
    createIngredient: async (payload, sid) => {
      if (!isOnline()) throw new Error("Go online to manage ingredients.");
      return real.createIngredient(payload, sid);
    },
    updateIngredient: async (id, payload, sid) => {
      if (!isOnline()) throw new Error("Go online to manage ingredients.");
      return real.updateIngredient(id, payload, sid);
    },
    deleteIngredient: async (id, sid) => {
      if (!isOnline()) throw new Error("Go online to manage ingredients.");
      return real.deleteIngredient(id, sid);
    },

    getMenuCategories: async (sid) => {
      if (!isOnline()) throw new Error("Connect to load menu.");
      return real.getMenuCategories(sid);
    },
    createMenuCategory: async (payload, sid) => {
      if (!isOnline()) throw new Error("Go online to manage menu.");
      return real.createMenuCategory(payload, sid);
    },
    updateMenuCategory: async (id, payload, sid) => {
      if (!isOnline()) throw new Error("Go online to manage menu.");
      return real.updateMenuCategory(id, payload, sid);
    },
    deleteMenuCategory: async (id, sid) => {
      if (!isOnline()) throw new Error("Go online to manage menu.");
      return real.deleteMenuCategory(id, sid);
    },

    getMenuItems: async (params, sid) => {
      if (!isOnline()) throw new Error("Connect to load menu.");
      return real.getMenuItems(params, sid);
    },
    createMenuItem: async (payload, sid) => {
      if (!isOnline()) throw new Error("Go online to manage menu.");
      return real.createMenuItem(payload, sid);
    },
    updateMenuItem: async (id, payload, sid) => {
      if (!isOnline()) throw new Error("Go online to manage menu.");
      return real.updateMenuItem(id, payload, sid);
    },
    deleteMenuItem: async (id, sid) => {
      if (!isOnline()) throw new Error("Go online to manage menu.");
      return real.deleteMenuItem(id, sid);
    },
    replaceMenuItemRecipe: async (menuItemId, payload, sid) => {
      if (!isOnline()) throw new Error("Go online to manage recipes.");
      return real.replaceMenuItemRecipe(menuItemId, payload, sid);
    },

    getCylinderLoans: real.getCylinderLoans
      ? async (params, sid) => {
          const effectiveStoreId = sid ?? storeId();
          if (isOnline()) {
            const rows = await real.getCylinderLoans!({ status: "all" }, sid);
            if (effectiveStoreId) await cache.setCylinderLoans(effectiveStoreId, rows);
            return params?.status && params.status !== "all"
              ? rows.filter((loan) => loan.status === params.status)
              : rows;
          }
          const rows = (await cache.getCylinderLoans(effectiveStoreId!)) ?? [];
          return params?.status && params.status !== "all"
            ? rows.filter((loan) => loan.status === params.status)
            : rows;
        }
      : undefined,
    getCylinderStats: real.getCylinderStats
      ? async (sid) => {
          const effectiveStoreId = sid ?? storeId();
          if (isOnline()) {
            const stats = await real.getCylinderStats!(sid);
            if (effectiveStoreId) await cache.setCylinderStats(effectiveStoreId, stats);
            return stats;
          }
          return (await cache.getCylinderStats(effectiveStoreId!)) ??
            recalculateCylinderStats(effectiveStoreId!);
        }
      : undefined,
    returnCylinderLoan: real.returnCylinderLoan
      ? async (loanId, options, sid) => {
          const effectiveStoreId = sid ?? storeId();
          if (!isOnline()) {
            const eventId = options.eventId ?? generateId();
            const loans = (await cache.getCylinderLoans(effectiveStoreId!)) ?? [];
            const loan = loans.find((candidate) => candidate.id === loanId);
            if (!loan) throw new Error("Outstanding canister record not found");
            const quantity = Math.floor(options.quantity);
            const remaining = loan.quantity - loan.returnedQuantity;
            if (quantity <= 0 || quantity > remaining) {
              throw new Error(`Return quantity must be between 1 and ${remaining}`);
            }
            const refundAmount = Math.max(0, options.refundAmount ?? 0);
            const returnedQuantity = loan.returnedQuantity + quantity;
            const returnedAt = new Date().toISOString();
            const updatedLoan: CylinderLoan = {
              ...loan,
              returnedQuantity,
              status: returnedQuantity === loan.quantity ? "returned" : "partial",
              returnedAt: returnedQuantity === loan.quantity ? returnedAt : null,
              returns: [...(loan.returns ?? []), {
                id: eventId,
                loanId,
                storeId: effectiveStoreId!,
                quantity,
                refundAmount,
                note: options.note ?? null,
                returnedAt,
              }],
            };
            await cache.setCylinderLoans(
              effectiveStoreId!,
              loans.map((candidate) => candidate.id === loanId ? updatedLoan : candidate),
            );
            const products = (await cache.getProducts(effectiveStoreId!)) ?? [];
            await cache.setProducts(effectiveStoreId!, products.map((product) =>
              product.id === loan.productId
                ? { ...product, emptyStock: Number(product.emptyStock ?? 0) + quantity }
                : product,
            ));
            await recalculateCylinderStats(effectiveStoreId!);
            if (loan.customerId) await cache.removeCustomerDetail(effectiveStoreId!, loan.customerId);
            await syncQueue.add(
              "returnCylinder",
              { id: loanId, options: { ...options, eventId } },
              effectiveStoreId ?? null,
            );
            return updatedLoan;
          }
          const updated = await real.returnCylinderLoan!(loanId, options, sid);
          if (effectiveStoreId) {
            const [loans, products, stats] = await Promise.all([
              real.getCylinderLoans!({ status: "all" }, sid),
              real.getProducts(undefined, sid),
              real.getCylinderStats!(sid),
            ]);
            await cache.setCylinderLoans(effectiveStoreId, loans);
            await cache.setProducts(effectiveStoreId, products);
            await cache.setCylinderStats(effectiveStoreId, stats);
          }
          return updated;
        }
      : undefined,
    getCustomers: async (params, sid) => {
      const effectiveStoreId = sid ?? storeId();
      if (isOnline()) {
        const result = await real.getCustomers!({ ...params, page: 1, pageSize: 100 }, sid);
        if (effectiveStoreId) await cache.setCustomers(effectiveStoreId, result.items);
        return real.getCustomers!(params, sid);
      }
      const all = (await cache.getCustomers(effectiveStoreId!)) ?? [];
      const q = params?.search?.trim().toLowerCase();
      const filtered = all.filter((customer) => {
        if (customer.archived !== Boolean(params?.archived)) return false;
        if (!q) return true;
        return [customer.name, customer.phone, customer.nickname, customer.address]
          .some((value) => value?.toLowerCase().includes(q));
      });
      const page = Math.max(1, params?.page ?? 1);
      const pageSize = Math.min(100, Math.max(1, params?.pageSize ?? 25));
      return {
        items: filtered.slice((page - 1) * pageSize, page * pageSize),
        total: filtered.length,
        page,
        pageSize,
      };
    },
    getRecentCustomers: async (limit, sid) => {
      const effectiveStoreId = sid ?? storeId();
      if (isOnline()) {
        const rows = await real.getRecentCustomers!(limit, sid);
        if (effectiveStoreId) {
          for (const customer of rows) await cache.upsertCustomer(effectiveStoreId, customer);
        }
        return rows;
      }
      const customers = (await cache.getCustomers(effectiveStoreId!)) ?? [];
      const sales = (await cache.getSales(effectiveStoreId!)) ?? [];
      const lastSale = new Map<string, number>();
      for (const sale of sales) {
        if (sale.customerId) {
          lastSale.set(sale.customerId, Math.max(lastSale.get(sale.customerId) ?? 0, new Date(sale.createdAt).getTime()));
        }
      }
      return customers.filter((customer) => !customer.archived)
        .sort((a, b) => (lastSale.get(b.id) ?? 0) - (lastSale.get(a.id) ?? 0))
        .slice(0, limit ?? 12);
    },
    getCustomerByQr: async (token, sid) => {
      const effectiveStoreId = sid ?? storeId();
      if (isOnline()) {
        const customer = await real.getCustomerByQr!(token, sid);
        if (effectiveStoreId) await cache.upsertCustomer(effectiveStoreId, customer);
        return customer;
      }
      const customer = ((await cache.getCustomers(effectiveStoreId!)) ?? [])
        .find((candidate) => candidate.qrToken === token && !candidate.archived);
      if (!customer) throw new Error("Customer not found in offline cache.");
      return customer;
    },
    getCustomer: async (id, sid) => {
      const effectiveStoreId = sid ?? storeId();
      if (isOnline()) {
        const detail = await real.getCustomer!(id, sid);
        if (effectiveStoreId) await cache.setCustomerDetail(effectiveStoreId, detail);
        return detail;
      }
      const cached = await cache.getCustomerDetail(effectiveStoreId!, id);
      if (cached) return cached;
      const customer = ((await cache.getCustomers(effectiveStoreId!)) ?? []).find((row) => row.id === id);
      if (!customer) throw new Error("Customer not found in offline cache.");
      const sales = ((await cache.getSales(effectiveStoreId!)) ?? [])
        .filter((sale) => sale.customerId === id)
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      const loans = ((await cache.getCylinderLoans(effectiveStoreId!)) ?? []).filter((loan) => loan.customerId === id);
      let returnedQuantity = 0;
      let writtenOffQuantity = 0;
      let weightedReturnDays = 0;
      let weightedReturnQuantity = 0;
      for (const loan of loans) {
        const events = loan.returns ?? [];
        const eventQuantity = events.reduce((sum, event) => sum + event.quantity, 0);
        const resolvedReturned = Math.min(
          loan.quantity,
          eventQuantity > 0
            ? eventQuantity
            : loan.status === "returned"
              ? (loan.returnedQuantity || loan.quantity)
              : loan.returnedQuantity,
        );
        returnedQuantity += resolvedReturned;
        if (loan.status === "written_off") {
          writtenOffQuantity += Math.max(0, loan.quantity - resolvedReturned);
        }
        for (const event of events) {
          weightedReturnDays +=
            Math.max(0, (new Date(event.returnedAt).getTime() - new Date(loan.outAt).getTime()) / 86_400_000) *
            event.quantity;
          weightedReturnQuantity += event.quantity;
        }
        if (!events.length && loan.status === "returned" && loan.returnedAt && resolvedReturned > 0) {
          weightedReturnDays +=
            Math.max(0, (new Date(loan.returnedAt).getTime() - new Date(loan.outAt).getTime()) / 86_400_000) *
            resolvedReturned;
          weightedReturnQuantity += resolvedReturned;
        }
      }
      const completedOutcomes = returnedQuantity + writtenOffQuantity;
      const since = Date.now() - 180 * 86_400_000;
      return {
        ...customer,
        sales,
        cylinderLoans: loans,
        evidence: {
          lastPurchaseAt: sales[0]?.createdAt ? new Date(sales[0].createdAt).toISOString() : null,
          frequency180d: sales.filter((sale) =>
            new Date(sale.createdAt).getTime() >= since && sale.status !== "void").length,
          monetary180d: sales.filter((sale) => new Date(sale.createdAt).getTime() >= since && sale.status !== "void")
            .reduce((sum, sale) => sum + sale.total, 0),
          completedOutcomes,
          reliableQualification: completedOutcomes >= 3,
          returnRate: completedOutcomes ? returnedQuantity / completedOutcomes : null,
          avgReturnDays: weightedReturnQuantity ? weightedReturnDays / weightedReturnQuantity : null,
          openQuantity: loans.filter((loan) => loan.status === "out" || loan.status === "partial")
            .reduce((sum, loan) => sum + loan.quantity - loan.returnedQuantity, 0),
          writeoffs: writtenOffQuantity,
        },
      };
    },
    createCustomer: async (payload, sid) => {
      const effectiveStoreId = sid ?? storeId();
      if (isOnline()) {
        const customer = await real.createCustomer!(payload, sid);
        if (effectiveStoreId) await cache.upsertCustomer(effectiveStoreId, customer);
        return customer;
      }
      const id = payload.id ?? generateId();
      const normalizedPhone = payload.phone?.replace(/[^\d+]/g, "") || null;
      const cachedCustomers = effectiveStoreId
        ? (await cache.getCustomers(effectiveStoreId)) ?? []
        : [];
      if (
        normalizedPhone &&
        cachedCustomers.some((customer) =>
          !customer.archived && customer.normalizedPhone === normalizedPhone)
      ) {
        throw new Error("An active customer already uses this phone number");
      }
      const qrToken = payload.qrToken ?? `${crypto.randomUUID().replace(/-/g, "")}${generateId()}`;
      const queued = { ...payload, id, qrToken };
      await syncQueue.add("createCustomer", queued, effectiveStoreId ?? null);
      const customer = {
        ...queued,
        storeId: effectiveStoreId ?? "",
        normalizedName: payload.name.trim().toLowerCase(),
        normalizedPhone,
        qrToken,
        isSuki: false,
        archived: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      } as Customer;
      if (effectiveStoreId) await cache.upsertCustomer(effectiveStoreId, customer);
      return customer;
    },
    updateCustomer: async (id, payload, sid) => {
      const effectiveStoreId = sid ?? storeId();
      if (isOnline()) {
        const customer = await real.updateCustomer!(id, payload, sid);
        if (effectiveStoreId) await cache.upsertCustomer(effectiveStoreId, customer);
        return customer;
      }
      const cachedCustomers = (await cache.getCustomers(effectiveStoreId!)) ?? [];
      const normalizedPhone = payload.phone?.replace(/[^\d+]/g, "") || null;
      if (
        normalizedPhone &&
        cachedCustomers.some((customer) =>
          customer.id !== id && !customer.archived && customer.normalizedPhone === normalizedPhone)
      ) {
        throw new Error("An active customer already uses this phone number");
      }
      await syncQueue.add("updateCustomer", { id, payload }, effectiveStoreId ?? null);
      const existing = cachedCustomers.find((row) => row.id === id);
      if (!existing) throw new Error("Customer not found in offline cache.");
      const customer = {
        ...existing,
        ...payload,
        normalizedName: payload.name.trim().toLowerCase(),
        normalizedPhone,
        updatedAt: new Date().toISOString(),
      };
      await cache.upsertCustomer(effectiveStoreId!, customer);
      await cache.removeCustomerDetail(effectiveStoreId!, id);
      return customer;
    },
    archiveCustomer: async (id, archived, sid) => {
      const effectiveStoreId = sid ?? storeId();
      if (isOnline()) {
        const customer = await real.archiveCustomer!(id, archived, sid);
        if (effectiveStoreId) await cache.upsertCustomer(effectiveStoreId, customer);
        return customer;
      }
      const value = archived ?? true;
      await syncQueue.add("archiveCustomer", { id, archived: value }, effectiveStoreId ?? null);
      const existing = ((await cache.getCustomers(effectiveStoreId!)) ?? []).find((row) => row.id === id);
      if (!existing) throw new Error("Customer not found in offline cache.");
      const customer = { ...existing, archived: value, updatedAt: new Date().toISOString() };
      await cache.upsertCustomer(effectiveStoreId!, customer);
      await cache.removeCustomerDetail(effectiveStoreId!, id);
      return customer;
    },
    setCustomerSuki: async (id, payload, sid) => {
      const effectiveStoreId = sid ?? storeId();
      if (isOnline()) {
        const customer = await real.setCustomerSuki!(id, payload, sid);
        if (effectiveStoreId) await cache.upsertCustomer(effectiveStoreId, customer);
        return customer;
      }
      await syncQueue.add("setCustomerSuki", { id, payload }, effectiveStoreId ?? null);
      const existing = ((await cache.getCustomers(effectiveStoreId!)) ?? []).find((row) => row.id === id);
      if (!existing) throw new Error("Customer not found in offline cache.");
      const customer = {
        ...existing,
        isSuki: payload.enabled,
        sukiAssignedAt: payload.enabled ? new Date().toISOString() : null,
        sukiNote: payload.enabled ? payload.note ?? null : null,
        updatedAt: new Date().toISOString(),
      };
      await cache.upsertCustomer(effectiveStoreId!, customer);
      await cache.removeCustomerDetail(effectiveStoreId!, id);
      return customer;
    },
  };

  return cachedOfflineService;
}
