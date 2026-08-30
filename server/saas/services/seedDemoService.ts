/**
 * SaaS demo seed service - callable from API or CLI.
 * Creates Demo Organization with 3 themed stores, realistic inventory, and 30 days of sales.
 */
import bcrypt from "bcryptjs";
import { saasPrisma } from "../db.js";
import {
  DEMO_STORES,
  SALES_HISTORY_DAYS,
  SALES_PER_STORE,
  type StoreSeed,
} from "../data/seedDemoCatalog.js";

const DEFAULT_PASSWORD = "password123";

interface SellableItem {
  productId: string;
  variantId?: string;
  productName: string;
  variantName?: string;
  price: number;
  stockKey: string;
  popularity: number;
}

interface StockTracker {
  productId: string;
  variantId?: string;
  remaining: number;
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pickWeighted<T extends { popularity: number }>(items: T[]): T {
  const total = items.reduce((sum, item) => sum + item.popularity, 0);
  let roll = Math.random() * total;
  for (const item of items) {
    roll -= item.popularity;
    if (roll <= 0) return item;
  }
  return items[items.length - 1];
}

function pickSaleHour(store: StoreSeed): number {
  if (Math.random() < 0.65 && store.peakHours.length > 0) {
    return store.peakHours[randomInt(0, store.peakHours.length - 1)];
  }
  return randomInt(8, 20);
}

function pickPaymentMethod(): "cash" | "gcash" {
  return Math.random() < 0.65 ? "cash" : "gcash";
}

export interface SeedDemoResult {
  orgId: string;
  orgName: string;
  storeCount: number;
  salesCount: number;
  stores: { name: string; sales: number }[];
  logins: { email: string; role: string }[];
}

async function wipeDemoOrganization(): Promise<void> {
  const existingDemo = await saasPrisma.organization.findFirst({
    where: { name: "Demo Organization" },
    include: { stores: true, users: true },
  });
  if (!existingDemo) return;

  const storeIds = existingDemo.stores.map((s) => s.id);
  const userIds = existingDemo.users.map((u) => u.id);

  await saasPrisma.saleItem.deleteMany({ where: { sale: { storeId: { in: storeIds } } } });
  await saasPrisma.sale.deleteMany({ where: { storeId: { in: storeIds } } });
  await saasPrisma.variant.deleteMany({ where: { product: { storeId: { in: storeIds } } } });
  await saasPrisma.product.deleteMany({ where: { storeId: { in: storeIds } } });
  await saasPrisma.category.deleteMany({ where: { storeId: { in: storeIds } } });
  await saasPrisma.userStore.deleteMany({
    where: { OR: [{ userId: { in: userIds } }, { storeId: { in: storeIds } }] },
  });
  await saasPrisma.organizationNotification.deleteMany({ where: { organizationId: existingDemo.id } });
  await saasPrisma.user.deleteMany({ where: { organizationId: existingDemo.id } });
  await saasPrisma.store.deleteMany({ where: { organizationId: existingDemo.id } });
  await saasPrisma.organization.delete({ where: { id: existingDemo.id } });
}

async function createProductsForStore(
  storeId: string,
  storeSeed: StoreSeed,
): Promise<SellableItem[]> {
  const categoryMap = new Map<string, string>();
  for (const name of storeSeed.categories) {
    const cat = await saasPrisma.category.create({
      data: { storeId, name },
    });
    categoryMap.set(name, cat.id);
  }

  const sellable: SellableItem[] = [];

  for (const tmpl of storeSeed.products) {
    const categoryId = categoryMap.get(tmpl.category) ?? [...categoryMap.values()][0];
    const product = await saasPrisma.product.create({
      data: {
        storeId,
        categoryId,
        name: tmpl.name,
        itemCode: tmpl.itemCode,
        hasVariants: !!tmpl.hasVariants,
        price: tmpl.price ?? 0,
        stock: tmpl.hasVariants ? null : (tmpl.stock ?? 0),
        lowStockThreshold: tmpl.lowStockThreshold,
        marginPercentage: tmpl.marginPercentage ?? 25,
        status: "active",
      },
    });

    if (tmpl.hasVariants && tmpl.variants?.length) {
      for (const v of tmpl.variants) {
        const variant = await saasPrisma.variant.create({
          data: {
            productId: product.id,
            name: v.name,
            price: v.price,
            stock: v.stock,
          },
        });
        sellable.push({
          productId: product.id,
          variantId: variant.id,
          productName: product.name,
          variantName: variant.name,
          price: variant.price,
          stockKey: `${product.id}:${variant.id}`,
          popularity: tmpl.popularity ?? 1,
        });
      }
    } else {
      sellable.push({
        productId: product.id,
        productName: product.name,
        price: product.price ?? 0,
        stockKey: product.id,
        popularity: tmpl.popularity ?? 1,
      });
    }
  }

  return sellable;
}

async function loadStockLevels(sellable: SellableItem[]): Promise<Map<string, StockTracker>> {
  const stock = new Map<string, StockTracker>();
  for (const item of sellable) {
    if (item.variantId) {
      const variant = await saasPrisma.variant.findUnique({ where: { id: item.variantId } });
      stock.set(item.stockKey, {
        productId: item.productId,
        variantId: item.variantId,
        remaining: variant?.stock ?? 0,
      });
    } else {
      const product = await saasPrisma.product.findUnique({ where: { id: item.productId } });
      stock.set(item.stockKey, {
        productId: item.productId,
        remaining: product?.stock ?? 0,
      });
    }
  }
  return stock;
}

function getInStockItems(sellable: SellableItem[], stock: Map<string, StockTracker>): SellableItem[] {
  return sellable.filter((item) => (stock.get(item.stockKey)?.remaining ?? 0) > 0);
}

async function generateSalesForStore(
  storeId: string,
  storeSeed: StoreSeed,
  sellable: SellableItem[],
  cashier: { id: string; name: string },
  ticketCounterStart: number,
): Promise<number> {
  const stock = await loadStockLevels(sellable);
  const now = new Date();
  const startDate = addDays(now, -SALES_HISTORY_DAYS);
  let ticketCounter = ticketCounterStart;

  const pendingSales: {
    ticketNumber: string;
    saleDate: Date;
    paymentMethod: "cash" | "gcash";
    total: number;
    amountReceived: number;
    change: number;
    items: {
      productId: string;
      variantId?: string;
      productName: string;
      variantName?: string;
      quantity: number;
      price: number;
      subtotal: number;
    }[];
  }[] = [];

  for (let i = 0; i < SALES_PER_STORE; i++) {
    const available = getInStockItems(sellable, stock);
    if (available.length === 0) break;

    const dayOffset = randomInt(0, SALES_HISTORY_DAYS);
    const saleDate = addDays(startDate, dayOffset);
    saleDate.setHours(pickSaleHour(storeSeed), randomInt(0, 59), randomInt(0, 59), 0);

    const numItems = randomInt(1, Math.min(5, available.length));
    const selectedItems: { item: SellableItem; quantity: number }[] = [];
    const pool = [...available];

    for (let n = 0; n < numItems && pool.length > 0; n++) {
      const picked = pickWeighted(pool.map((p) => ({ ...p, popularity: p.popularity })));
      const tracker = stock.get(picked.stockKey)!;
      const maxQty = Math.min(tracker.remaining, picked.productName.includes("Rice") ? 2 : 3);
      const quantity = randomInt(1, maxQty);
      selectedItems.push({ item: picked, quantity });
      tracker.remaining -= quantity;
      if (tracker.remaining <= 0) {
        const idx = pool.findIndex((p) => p.stockKey === picked.stockKey);
        if (idx >= 0) pool.splice(idx, 1);
      }
    }

    if (selectedItems.length === 0) continue;

    const items = selectedItems.map(({ item, quantity }) => ({
      productId: item.productId,
      variantId: item.variantId,
      productName: item.productName,
      variantName: item.variantName,
      quantity,
      price: item.price,
      subtotal: Math.round(item.price * quantity * 100) / 100,
    }));

    const total = Math.round(items.reduce((sum, row) => sum + row.subtotal, 0) * 100) / 100;
    const paymentMethod = pickPaymentMethod();
    const amountReceived = paymentMethod === "cash" ? Math.ceil(total / 20) * 20 : total;
    const change = Math.round((amountReceived - total) * 100) / 100;
    ticketCounter += 1;

    pendingSales.push({
      ticketNumber: `${storeSeed.ticketPrefix}-${ticketCounter}`,
      saleDate,
      paymentMethod,
      total,
      amountReceived,
      change: Math.max(0, change),
      items,
    });
  }

  for (const saleData of pendingSales) {
    await saasPrisma.$transaction(async (tx) => {
      const sale = await tx.sale.create({
        data: {
          storeId,
          ticketNumber: saleData.ticketNumber,
          cashierId: cashier.id,
          cashierName: cashier.name,
          total: saleData.total,
          paymentMethod: saleData.paymentMethod,
          amountReceived: saleData.amountReceived,
          change: saleData.change,
          createdAt: saleData.saleDate,
        },
      });

      for (const item of saleData.items) {
        await tx.saleItem.create({
          data: {
            saleId: sale.id,
            productId: item.productId,
            variantId: item.variantId,
            productName: item.productName,
            variantName: item.variantName,
            quantity: item.quantity,
            price: item.price,
            subtotal: item.subtotal,
          },
        });

        if (item.variantId) {
          await tx.variant.update({
            where: { id: item.variantId },
            data: { stock: { decrement: item.quantity } },
          });
        } else {
          await tx.product.update({
            where: { id: item.productId },
            data: { stock: { decrement: item.quantity } },
          });
        }
      }
    });
  }

  return ticketCounter;
}

async function ensureSuperAdmins(): Promise<void> {
  const superAdminEmails = (process.env.SUPER_ADMIN_EMAILS || "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  const adminPassword = process.env.SUPER_ADMIN_DEFAULT_PASSWORD || "changeme123";

  for (const email of superAdminEmails) {
    const existing = await saasPrisma.user.findUnique({ where: { email } });
    if (!existing) {
      const hashed = await bcrypt.hash(adminPassword, 10);
      await saasPrisma.user.create({
        data: {
          organizationId: null,
          name: "Super Admin",
          email,
          password: hashed,
          role: "super_admin",
        },
      });
    }
  }
}

export async function runSeedDemo(): Promise<SeedDemoResult> {
  await wipeDemoOrganization();

  const trialEndsAt = addDays(new Date(), 30);
  const org = await saasPrisma.organization.create({
    data: {
      name: "Demo Organization",
      plan: "free",
      trialEndsAt,
      phone: "+63 912 345 6789",
      email: "demo@example.com",
      address: "123 Demo St, Metro Manila",
    },
  });

  const hashedPassword = await bcrypt.hash(DEFAULT_PASSWORD, 10);

  const owner = await saasPrisma.user.create({
    data: {
      organizationId: org.id,
      name: "Demo Owner",
      email: "owner@demo.com",
      password: hashedPassword,
      role: "owner",
    },
  });

  const maria = await saasPrisma.user.create({
    data: {
      organizationId: org.id,
      name: "Maria Santos",
      email: "maria@demo.com",
      password: hashedPassword,
      role: "cashier",
    },
  });

  const juan = await saasPrisma.user.create({
    data: {
      organizationId: org.id,
      name: "Juan Dela Cruz",
      email: "juan@demo.com",
      password: hashedPassword,
      role: "cashier",
    },
  });

  const cafeCashier = await saasPrisma.user.create({
    data: {
      organizationId: org.id,
      name: "Ana Reyes",
      email: "cashier@demo.com",
      password: hashedPassword,
      role: "cashier",
    },
  });

  const cashierByEmail = new Map([
    ["maria@demo.com", maria],
    ["juan@demo.com", juan],
    ["cashier@demo.com", cafeCashier],
  ]);

  const createdStores: { id: string; seed: StoreSeed; sellable: SellableItem[] }[] = [];
  let ticketCounter = 1000;

  for (const storeSeed of DEMO_STORES) {
    const store = await saasPrisma.store.create({
      data: {
        organizationId: org.id,
        name: storeSeed.name,
        address: storeSeed.address,
      },
    });

    const sellable = await createProductsForStore(store.id, storeSeed);
    createdStores.push({ id: store.id, seed: storeSeed, sellable });

    const userLinks = [
      { userId: owner.id, storeId: store.id },
      { userId: maria.id, storeId: store.id },
      { userId: juan.id, storeId: store.id },
      { userId: cafeCashier.id, storeId: store.id },
    ];
    await saasPrisma.userStore.createMany({ data: userLinks });

    const cashier = cashierByEmail.get(storeSeed.cashierEmail) ?? maria;
    ticketCounter = await generateSalesForStore(
      store.id,
      storeSeed,
      sellable,
      cashier,
      ticketCounter,
    );
  }

  await ensureSuperAdmins();

  const storeIds = createdStores.map((s) => s.id);
  const totalSales = await saasPrisma.sale.count({
    where: { storeId: { in: storeIds } },
  });

  const storeSummaries = await Promise.all(
    createdStores.map(async (s) => ({
      name: s.seed.name,
      sales: await saasPrisma.sale.count({ where: { storeId: s.id } }),
    })),
  );

  return {
    orgId: org.id,
    orgName: org.name,
    storeCount: createdStores.length,
    salesCount: totalSales,
    stores: storeSummaries,
    logins: [
      { email: "owner@demo.com", role: "owner (all stores)" },
      { email: "maria@demo.com", role: "cashier — Sari-Sari Corner" },
      { email: "juan@demo.com", role: "cashier — Paws & Claws Pet Shoppe" },
      { email: "cashier@demo.com", role: "cashier — Brew & Bites Cafe" },
    ],
  };
}
