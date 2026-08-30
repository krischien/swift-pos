/**
 * SaaS demo seed service - callable from API.
 * Creates/resets Demo Organization with 2 retail stores + 1 F&B store, owner, cashiers, products/menu, and ~11 days of sales.
 */
import bcrypt from "bcryptjs";
import { saasPrisma } from "../db.js";
import { mockCategories, mockProducts } from "../../../src/lib/mockData.js";
import { DEMO_TRIAL_DAYS, addDays } from "../constants/demo.js";
import { createSale } from "./saleService.js";

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
    await saasPrisma.menuItem.deleteMany({ where: { storeId: { in: storeIds } } });
    await saasPrisma.menuCategory.deleteMany({ where: { storeId: { in: storeIds } } });
    await saasPrisma.ingredient.deleteMany({ where: { storeId: { in: storeIds } } });
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

  const trialEndsAt = addDays(new Date(), DEMO_TRIAL_DAYS);
  const org = await saasPrisma.organization.create({
    data: {
      name: "Demo Organization",
      plan: "tindahan",
      trialEndsAt,
      phone: "+63 912 345 6789",
      email: "demo@example.com",
      address: "123 Demo St, Manila",
    },
  });

  await saasPrisma.organizationSubscription.create({
    data: {
      organizationId: org.id,
      tier: "tindahan",
      status: "trialing",
      trialStart: new Date(),
      trialEnd: trialEndsAt,
      monthlyPriceCentavos: 49900,
    },
  });

  const store1 = await saasPrisma.store.create({
    data: { organizationId: org.id, name: "Main Store", address: "456 Main Ave" },
  });
  const store2 = await saasPrisma.store.create({
    data: { organizationId: org.id, name: "Second Store", address: "789 Second Store Rd" },
  });
  const store3 = await saasPrisma.store.create({
    data: {
      organizationId: org.id,
      name: "Demo Café & Grill (F&B)",
      address: "321 Food Court Lane",
      businessMode: "fnb",
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
  const cashier3 = await saasPrisma.user.create({
    data: {
      organizationId: org.id,
      name: "Pedro Ramos",
      email: "pedro@demo.com",
      password: hashedPassword,
      role: "cashier",
    },
  });

  await saasPrisma.userStore.createMany({
    data: [
      { userId: owner.id, storeId: store1.id },
      { userId: owner.id, storeId: store2.id },
      { userId: owner.id, storeId: store3.id },
      { userId: cashier1.id, storeId: store1.id },
      { userId: cashier1.id, storeId: store3.id },
      { userId: cashier2.id, storeId: store2.id },
      { userId: cashier2.id, storeId: store3.id },
      { userId: cashier3.id, storeId: store3.id },
    ],
  });

  const retailStores = [store1, store2];
  const retailCashiers = [cashier1, cashier2];
  const fnbCashiers = [cashier1, cashier2, cashier3];
  const storeProducts = new Map<string, { productId: string; variantId?: string; productName: string; variantName?: string; price: number }[]>();

  for (const store of retailStores) {
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

  // --- F&B catalog (Demo Café & Grill) ---
  type MenuLine = { menuItemId: string; productName: string; price: number };
  const ingredientDefs: { key: string; name: string; sku: string; stock: number; unitOfMeasure: string }[] = [
    { key: "coffee", name: "Arabica Coffee Beans", sku: "ING-COF", stock: 500_000, unitOfMeasure: "g" },
    { key: "milk", name: "Fresh Milk", sku: "ING-MLK", stock: 800_000, unitOfMeasure: "ml" },
    { key: "syrup", name: "Sugar Syrup", sku: "ING-SYP", stock: 200_000, unitOfMeasure: "ml" },
    { key: "patty", name: "Beef Patty", sku: "ING-BEF", stock: 400_000, unitOfMeasure: "g" },
    { key: "bun", name: "Burger Bun", sku: "ING-BUN", stock: 50_000, unitOfMeasure: "PCS" },
    { key: "cheese", name: "Cheese Slice", sku: "ING-CHS", stock: 40_000, unitOfMeasure: "PCS" },
    { key: "lettuce", name: "Lettuce", sku: "ING-LET", stock: 150_000, unitOfMeasure: "g" },
    { key: "fries", name: "Frozen Fries", sku: "ING-FRI", stock: 600_000, unitOfMeasure: "g" },
    { key: "oil", name: "Fryer Oil", sku: "ING-OIL", stock: 200_000, unitOfMeasure: "ml" },
  ];
  const ingId = new Map<string, string>();
  for (const def of ingredientDefs) {
    const row = await saasPrisma.ingredient.create({
      data: {
        storeId: store3.id,
        name: def.name,
        sku: def.sku,
        stock: def.stock,
        lowStockThreshold: 500,
        unitOfMeasure: def.unitOfMeasure,
        status: "active",
      },
    });
    ingId.set(def.key, row.id);
  }

  const catCoffee = await saasPrisma.menuCategory.create({
    data: { storeId: store3.id, name: "Coffee & Drinks" },
  });
  const catBurgers = await saasPrisma.menuCategory.create({
    data: { storeId: store3.id, name: "Burgers" },
  });
  const catSides = await saasPrisma.menuCategory.create({
    data: { storeId: store3.id, name: "Sides" },
  });

  async function createMenuWithRecipe(
    menuCategoryId: string,
    name: string,
    price: number,
    recipe: Array<{ ingKey: string; qty: number }>,
  ): Promise<MenuLine> {
    const item = await saasPrisma.menuItem.create({
      data: {
        storeId: store3.id,
        menuCategoryId,
        name,
        price,
        status: "active",
      },
    });
    await saasPrisma.recipeLine.createMany({
      data: recipe.map((r) => ({
        menuItemId: item.id,
        ingredientId: ingId.get(r.ingKey)!,
        quantity: r.qty,
        wastagePercent: null,
      })),
    });
    return { menuItemId: item.id, productName: name, price };
  }

  const menuForSale: MenuLine[] = [];
  menuForSale.push(
    await createMenuWithRecipe(catCoffee.id, "Iced Latte", 125, [
      { ingKey: "coffee", qty: 18 },
      { ingKey: "milk", qty: 250 },
      { ingKey: "syrup", qty: 12 },
    ]),
  );
  menuForSale.push(
    await createMenuWithRecipe(catCoffee.id, "Cappuccino", 110, [
      { ingKey: "coffee", qty: 15 },
      { ingKey: "milk", qty: 180 },
    ]),
  );
  menuForSale.push(
    await createMenuWithRecipe(catBurgers.id, "Classic Beef Burger", 195, [
      { ingKey: "patty", qty: 150 },
      { ingKey: "bun", qty: 1 },
      { ingKey: "lettuce", qty: 25 },
    ]),
  );
  menuForSale.push(
    await createMenuWithRecipe(catBurgers.id, "Cheese Burger", 220, [
      { ingKey: "patty", qty: 150 },
      { ingKey: "bun", qty: 1 },
      { ingKey: "cheese", qty: 1 },
      { ingKey: "lettuce", qty: 20 },
    ]),
  );
  menuForSale.push(
    await createMenuWithRecipe(catSides.id, "Crispy Fries", 85, [
      { ingKey: "fries", qty: 150 },
      { ingKey: "oil", qty: 25 },
    ]),
  );

  const now = new Date();
  const startDate = addDays(now, -10);
  let ticketCounter = 1000;

  for (let d = 0; d <= 10; d++) {
    const dayStart = addDays(startDate, d);
    for (const store of retailStores) {
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
        const cashier = retailStores.indexOf(store) === 0 ? retailCashiers[0] : retailCashiers[1];
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

    // F&B store: menu sales (ingredient stock via createSale)
    const salesFnb = randomInt(4, 15);
    for (let s = 0; s < salesFnb; s++) {
      const numItems = randomInt(1, 4);
      const selectedMenu: { menuItemId: string; productName: string; price: number; quantity: number }[] = [];
      const usedM = new Set<number>();
      for (let i = 0; i < numItems; i++) {
        const idx = randomInt(0, menuForSale.length - 1);
        if (usedM.has(idx)) continue;
        usedM.add(idx);
        const m = menuForSale[idx];
        selectedMenu.push({ ...m, quantity: randomInt(1, 3) });
      }
      if (selectedMenu.length === 0) continue;

      const cartItems = selectedMenu.map((row) => ({
        menuItemId: row.menuItemId,
        productName: row.productName,
        quantity: row.quantity,
        price: row.price,
        subtotal: Math.round(row.price * row.quantity * 100) / 100,
      }));
      const subtotal = cartItems.reduce((sum, i) => sum + i.subtotal, 0);
      const total = Math.round(subtotal * 100) / 100;
      const cashier = fnbCashiers[randomInt(0, fnbCashiers.length - 1)];
      const hour = randomInt(8, 21);
      const minute = randomInt(0, 59);
      const saleDate = new Date(dayStart);
      saleDate.setHours(hour, minute, 0, 0);
      ticketCounter += 1;
      const ticketNumber = `F-${ticketCounter}`;

      await createSale({
        storeId: store3.id,
        cashierId: cashier.id,
        cashierName: cashier.name,
        total,
        paymentMethod: "cash",
        amountReceived: total,
        change: 0,
        ticketNumber,
        createdAt: saleDate,
        items: cartItems.map((c) => ({
          menuItemId: c.menuItemId,
          productName: c.productName,
          quantity: c.quantity,
          price: c.price,
          subtotal: c.subtotal,
        })),
      });
    }
  }

  const allStoreIds = [store1.id, store2.id, store3.id];
  const totalSales = await saasPrisma.sale.count({
    where: { storeId: { in: allStoreIds } },
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
    storeCount: allStoreIds.length,
    salesCount: totalSales,
    logins: [
      { email: "owner@demo.com", role: "owner (all 3 stores)" },
      { email: "maria@demo.com", role: "cashier (Main + F&B)" },
      { email: "juan@demo.com", role: "cashier (Second + F&B)" },
      { email: "pedro@demo.com", role: "cashier (F&B only)" },
    ],
  };
}
