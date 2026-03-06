/**
 * SaaS demo seed service - callable from API.
 * Creates/resets Demo Organization with 2 stores, 1 owner, 2 cashiers, products, and 10 days of sales.
 */
import bcrypt from "bcryptjs";
import { saasPrisma } from "../db.js";
import { mockCategories, mockProducts } from "../../../src/lib/mockData.js";

const DEFAULT_PASSWORD = "password123";

const categoryNames = mockCategories.map((c) => c.name);

interface ProductTemplate {
  name: string;
  categoryIndex: number;
  itemCode: string;
  hasVariants: boolean;
  price?: number;
  stock?: number;
  lowStockThreshold: number;
  marginPercentage: number;
  variants?: { name: string; price: number; stock: number }[];
}

const productTemplates: ProductTemplate[] = mockProducts.map((p, idx) => {
  const catIdx = mockCategories.findIndex((c) => c.id === p.categoryId);
  return {
    name: p.name,
    categoryIndex: catIdx >= 0 ? catIdx : 0,
    itemCode: p.itemCode ?? `ITEM-${String(idx + 1).padStart(4, "0")}`,
    hasVariants: p.hasVariants ?? false,
    price: p.price,
    stock: p.stock,
    lowStockThreshold: p.lowStockThreshold ?? 10,
    marginPercentage: (p as { marginPercentage?: number }).marginPercentage ?? 25 + (idx % 15),
    variants: p.variants?.map((v) => ({
      name: v.name,
      price: v.price,
      stock: v.stock,
    })),
  };
});

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export interface SeedDemoResult {
  orgId: string;
  orgName: string;
  storeCount: number;
  salesCount: number;
  logins: { email: string; role: string }[];
}

export async function runSeedDemo(): Promise<SeedDemoResult> {
  const existingDemo = await saasPrisma.organization.findFirst({
    where: { name: "Demo Organization" },
    include: { stores: true, users: true },
  });

  if (existingDemo) {
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

  const trialEndsAt = addDays(new Date(), 7);
  const org = await saasPrisma.organization.create({
    data: {
      name: "Demo Organization",
      plan: "free",
      trialEndsAt,
      phone: "+63 912 345 6789",
      email: "demo@example.com",
      address: "123 Demo St, Manila",
    },
  });

  const store1 = await saasPrisma.store.create({
    data: { organizationId: org.id, name: "Main Store", address: "456 Main Ave" },
  });
  const store2 = await saasPrisma.store.create({
    data: { organizationId: org.id, name: "Second Store", address: "789 Second Store Rd" },
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
  const cashier1 = await saasPrisma.user.create({
    data: {
      organizationId: org.id,
      name: "Maria Santos",
      email: "maria@demo.com",
      password: hashedPassword,
      role: "cashier",
    },
  });
  const cashier2 = await saasPrisma.user.create({
    data: {
      organizationId: org.id,
      name: "Juan Dela Cruz",
      email: "juan@demo.com",
      password: hashedPassword,
      role: "cashier",
    },
  });

  await saasPrisma.userStore.createMany({
    data: [
      { userId: owner.id, storeId: store1.id },
      { userId: owner.id, storeId: store2.id },
      { userId: cashier1.id, storeId: store1.id },
      { userId: cashier2.id, storeId: store2.id },
    ],
  });

  const stores = [store1, store2];
  const cashiers = [cashier1, cashier2];
  const storeProducts = new Map<string, { productId: string; variantId?: string; productName: string; variantName?: string; price: number }[]>();

  for (const store of stores) {
    const categories: { id: string; name: string }[] = [];
    for (const name of categoryNames) {
      const cat = await saasPrisma.category.create({
        data: { storeId: store.id, name },
      });
      categories.push({ id: cat.id, name: cat.name });
    }

    const productsForSale: { productId: string; variantId?: string; productName: string; variantName?: string; price: number }[] = [];

    for (const tmpl of productTemplates) {
      const categoryId = categories[tmpl.categoryIndex]?.id ?? categories[0].id;
      const product = await saasPrisma.product.create({
        data: {
          storeId: store.id,
          categoryId,
          name: tmpl.name,
          itemCode: tmpl.itemCode,
          hasVariants: tmpl.hasVariants,
          price: tmpl.price ?? 0,
          stock: tmpl.stock ?? 100,
          lowStockThreshold: tmpl.lowStockThreshold,
          marginPercentage: tmpl.marginPercentage,
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
          productsForSale.push({
            productId: product.id,
            variantId: variant.id,
            productName: product.name,
            variantName: variant.name,
            price: variant.price,
          });
        }
      } else {
        productsForSale.push({
          productId: product.id,
          productName: product.name,
          price: product.price ?? 0,
        });
      }
    }
    storeProducts.set(store.id, productsForSale);
  }

  const now = new Date();
  const startDate = addDays(now, -10);
  let ticketCounter = 1000;

  for (let d = 0; d <= 10; d++) {
    const dayStart = addDays(startDate, d);
    for (const store of stores) {
      const salesPerStorePerDay = randomInt(4, 15);
      for (let s = 0; s < salesPerStorePerDay; s++) {
        const products = storeProducts.get(store.id)!;
        if (products.length === 0) continue;

        const numItems = randomInt(1, 5);
        const selectedItems: { productId: string; variantId?: string; productName: string; variantName?: string; price: number; quantity: number }[] = [];
        const used = new Set<number>();
        for (let i = 0; i < numItems; i++) {
          const idx = randomInt(0, products.length - 1);
          if (used.has(idx)) continue;
          used.add(idx);
          const p = products[idx];
          selectedItems.push({ ...p, quantity: randomInt(1, 3) });
        }

        const items = selectedItems.map((item) => ({
          productId: item.productId,
          variantId: item.variantId,
          productName: item.productName,
          variantName: item.variantName,
          quantity: item.quantity,
          price: item.price,
          subtotal: item.price * item.quantity,
        }));

        const subtotal = items.reduce((sum, i) => sum + i.subtotal, 0);
        const total = Math.round(subtotal * 100) / 100;
        const amountReceived = total;
        const cashier = stores.indexOf(store) === 0 ? cashiers[0] : cashiers[1];
        const hour = randomInt(8, 20);
        const minute = randomInt(0, 59);
        const saleDate = new Date(dayStart);
        saleDate.setHours(hour, minute, 0, 0);
        ticketCounter += 1;
        const ticketNumber = `T-${ticketCounter}`;

        await saasPrisma.$transaction(async (tx) => {
          const sale = await tx.sale.create({
            data: {
              storeId: store.id,
              ticketNumber,
              cashierId: cashier.id,
              cashierName: cashier.name,
              total,
              paymentMethod: "cash",
              amountReceived,
              change: 0,
              createdAt: saleDate,
            },
          });
          for (const item of items) {
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
    }
  }

  const totalSales = await saasPrisma.sale.count({
    where: { storeId: { in: stores.map((s) => s.id) } },
  });

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

  return {
    orgId: org.id,
    orgName: org.name,
    storeCount: stores.length,
    salesCount: totalSales,
    logins: [
      { email: "owner@demo.com", role: "owner" },
      { email: "maria@demo.com", role: "cashier (Main Store)" },
      { email: "juan@demo.com", role: "cashier (Second Store)" },
    ],
  };
}
