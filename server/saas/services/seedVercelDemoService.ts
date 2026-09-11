/**
 * Seeds the existing Demo Organization (bootstrap on Vercel) without deleting users.
 * 3 stores: grocery (retail), F&B, pet shop (KG / weight-friendly catalog).
 * 15+ products per store, 50 sales per store over the last 7 days.
 */
import { saasPrisma } from "../db.js";
import { DEMO_TRIAL_DAYS, addDays } from "../constants/demo.js";

/** Neon/serverless: default 5s interactive tx timeout is too short for seed batches */
const SEED_TX = { timeout: 120_000, maxWait: 30_000 };

const SALES_PER_STORE = 50;
const OPERATING_DAYS = 7;

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomWeightKg(): number {
  return Math.round((0.15 + Math.random() * 2.85) * 100) / 100;
}

type SaleLine = {
  productId?: string;
  menuItemId?: string;
  variantId?: string;
  productName: string;
  variantName?: string;
  quantity: number;
  price: number;
  subtotal: number;
  /** KG / weight lines: units to deduct from stock (defaults to quantity) */
  stockDecrement?: number;
};

function consumptionUnits(recipeQty: number, saleQty: number, wastagePercent: number | null): number {
  const w = 1 + (wastagePercent ?? 0) / 100;
  return Math.max(0, Math.ceil(recipeQty * saleQty * w));
}

async function insertRetailSeedSale(
  storeId: string,
  cashier: { id: string; name: string },
  cart: SaleLine[],
  total: number,
  ticketNumber: string,
  saleDate: Date,
  paymentMethod: string,
): Promise<void> {
  await saasPrisma.$transaction(async (tx) => {
    const sale = await tx.sale.create({
      data: {
        storeId,
        ticketNumber,
        cashierId: cashier.id,
        cashierName: cashier.name,
        total,
        paymentMethod,
        amountReceived: total,
        change: 0,
        createdAt: saleDate,
      },
    });
    for (const item of cart) {
      await tx.saleItem.create({
        data: {
          saleId: sale.id,
          productId: item.productId ?? null,
          variantId: item.variantId ?? null,
          productName: item.productName,
          variantName: item.variantName,
          quantity: item.quantity,
          price: item.price,
          subtotal: item.subtotal,
        },
      });
      const dec = item.stockDecrement ?? item.quantity;
      if (item.variantId) {
        await tx.variant.update({
          where: { id: item.variantId },
          data: { stock: { decrement: dec } },
        });
      } else if (item.productId) {
        await tx.product.update({
          where: { id: item.productId },
          data: { stock: { decrement: dec } },
        });
      }
    }
  }, SEED_TX);
}

async function insertFnbSeedSale(
  storeId: string,
  cashier: { id: string; name: string },
  cart: SaleLine[],
  total: number,
  ticketNumber: string,
  saleDate: Date,
  paymentMethod: string,
): Promise<void> {
  await saasPrisma.$transaction(async (tx) => {
    const sale = await tx.sale.create({
      data: {
        storeId,
        ticketNumber,
        cashierId: cashier.id,
        cashierName: cashier.name,
        total,
        paymentMethod,
        amountReceived: total,
        change: 0,
        createdAt: saleDate,
      },
    });
    for (const item of cart) {
      await tx.saleItem.create({
        data: {
          saleId: sale.id,
          menuItemId: item.menuItemId ?? null,
          productName: item.productName,
          quantity: item.quantity,
          price: item.price,
          subtotal: item.subtotal,
        },
      });
      if (!item.menuItemId) continue;
      const menuItem = await tx.menuItem.findFirst({
        where: { id: item.menuItemId, storeId },
        include: { recipeLines: true },
      });
      if (!menuItem) continue;
      for (const line of menuItem.recipeLines) {
        const dec = consumptionUnits(line.quantity, item.quantity, line.wastagePercent);
        if (dec <= 0) continue;
        await tx.ingredient.update({
          where: { id: line.ingredientId },
          data: { stock: { decrement: dec } },
        });
      }
    }
  }, SEED_TX);
}

async function clearOrgCatalog(orgId: string): Promise<void> {
  const stores = await saasPrisma.store.findMany({ where: { organizationId: orgId } });
  const storeIds = stores.map((s) => s.id);
  if (storeIds.length === 0) return;

  await saasPrisma.cylinderLoan.deleteMany({ where: { storeId: { in: storeIds } } });
  await saasPrisma.saleItem.deleteMany({ where: { sale: { storeId: { in: storeIds } } } });
  await saasPrisma.sale.deleteMany({ where: { storeId: { in: storeIds } } });
  await saasPrisma.recipeLine.deleteMany({ where: { menuItem: { storeId: { in: storeIds } } } });
  await saasPrisma.menuItem.deleteMany({ where: { storeId: { in: storeIds } } });
  await saasPrisma.menuCategory.deleteMany({ where: { storeId: { in: storeIds } } });
  await saasPrisma.ingredient.deleteMany({ where: { storeId: { in: storeIds } } });
  await saasPrisma.variant.deleteMany({ where: { product: { storeId: { in: storeIds } } } });
  await saasPrisma.product.deleteMany({ where: { storeId: { in: storeIds } } });
  await saasPrisma.category.deleteMany({ where: { storeId: { in: storeIds } } });
}

async function ensureThreeStores(orgId: string) {
  const existing = await saasPrisma.store.findMany({
    where: { organizationId: orgId },
    orderBy: { createdAt: "asc" },
  });

  let grocery = existing[0];
  if (grocery) {
    grocery = await saasPrisma.store.update({
      where: { id: grocery.id },
      data: {
        name: "Sari-Sari Grocery",
        address: "456 Market St, Quezon City",
        businessMode: "retail",
      },
    });
  } else {
    grocery = await saasPrisma.store.create({
      data: {
        organizationId: orgId,
        name: "Sari-Sari Grocery",
        address: "456 Market St, Quezon City",
        businessMode: "retail",
      },
    });
  }

  let fnb =
    existing.find((s) => s.businessMode === "fnb") ??
    existing.find((s) => s.id !== grocery.id);
  if (fnb && fnb.id !== grocery.id) {
    fnb = await saasPrisma.store.update({
      where: { id: fnb.id },
      data: {
        name: "Brew & Bites Café",
        address: "321 Food Court Lane, Makati",
        businessMode: "fnb",
      },
    });
  } else if (!fnb || fnb.id === grocery.id) {
    fnb = await saasPrisma.store.create({
      data: {
        organizationId: orgId,
        name: "Brew & Bites Café",
        address: "321 Food Court Lane, Makati",
        businessMode: "fnb",
      },
    });
  }

  let pet = existing.find((s) => s.id !== grocery.id && s.id !== fnb.id);
  if (pet) {
    pet = await saasPrisma.store.update({
      where: { id: pet.id },
      data: {
        name: "Paws & Claws Pet Shop",
        address: "88 Pet Lane, Pasig",
        businessMode: "retail",
      },
    });
  } else {
    pet = await saasPrisma.store.create({
      data: {
        organizationId: orgId,
        name: "Paws & Claws Pet Shop",
        address: "88 Pet Lane, Pasig",
        businessMode: "retail",
      },
    });
  }

  const keepIds = new Set([grocery.id, fnb.id, pet.id]);
  const extras = existing.filter((s) => !keepIds.has(s.id));
  for (const s of extras) {
    await saasPrisma.store.delete({ where: { id: s.id } });
  }

  return { grocery, fnb, pet };
}

async function seedRetailProducts(
  storeId: string,
  catalog: Array<{
    name: string;
    category: string;
    itemCode: string;
    price: number;
    stock: number;
    unitOfMeasure?: string;
    hasVariants?: boolean;
    variants?: { name: string; price: number; stock: number }[];
  }>,
): Promise<SaleLine[]> {
  const catMap = new Map<string, string>();
  const lines: SaleLine[] = [];

  for (const row of catalog) {
    if (!catMap.has(row.category)) {
      const cat = await saasPrisma.category.create({
        data: { storeId, name: row.category },
      });
      catMap.set(row.category, cat.id);
    }
    const categoryId = catMap.get(row.category)!;
    const product = await saasPrisma.product.create({
      data: {
        storeId,
        categoryId,
        name: row.name,
        itemCode: row.itemCode,
        hasVariants: row.hasVariants ?? false,
        price: row.price,
        stock: row.stock,
        lowStockThreshold: 10,
        marginPercentage: 25,
        status: "active",
        unitOfMeasure: row.unitOfMeasure ?? "PCS",
      },
    });

    if (row.hasVariants && row.variants?.length) {
      for (const v of row.variants) {
        const variant = await saasPrisma.variant.create({
          data: { productId: product.id, name: v.name, price: v.price, stock: v.stock },
        });
        lines.push({
          productId: product.id,
          variantId: variant.id,
          productName: product.name,
          variantName: variant.name,
          quantity: 1,
          price: variant.price,
          subtotal: variant.price,
        });
      }
    } else {
      lines.push({
        productId: product.id,
        productName: product.name,
        quantity: 1,
        price: product.price ?? 0,
        subtotal: product.price ?? 0,
      });
    }
  }
  return lines;
}

const GROCERY_CATALOG = [
  { name: "Jasmine Rice 1kg", category: "Pantry", itemCode: "GRO-001", price: 52, stock: 200 },
  { name: "Cooking Oil 1L", category: "Pantry", itemCode: "GRO-002", price: 85, stock: 120 },
  { name: "Instant Noodles", category: "Pantry", itemCode: "GRO-003", price: 15, stock: 300 },
  { name: "Canned Sardines", category: "Pantry", itemCode: "GRO-004", price: 28, stock: 180 },
  { name: "SkyFlakes Crackers", category: "Snacks", itemCode: "GRO-005", price: 12, stock: 250 },
  { name: "Potato Chips", category: "Snacks", itemCode: "GRO-006", price: 35, stock: 150 },
  { name: "Chocolate Bar", category: "Snacks", itemCode: "GRO-007", price: 45, stock: 200 },
  { name: "Cola 1.5L", category: "Beverages", itemCode: "GRO-008", price: 65, stock: 100 },
  { name: "Orange Juice 1L", category: "Beverages", itemCode: "GRO-009", price: 78, stock: 80 },
  { name: "Bottled Water 500ml", category: "Beverages", itemCode: "GRO-010", price: 18, stock: 400 },
  { name: "Fresh Eggs (tray)", category: "Fresh", itemCode: "GRO-011", price: 220, stock: 60 },
  { name: "Fresh Milk 1L", category: "Fresh", itemCode: "GRO-012", price: 95, stock: 70 },
  { name: "White Bread", category: "Fresh", itemCode: "GRO-013", price: 55, stock: 90 },
  { name: "Bar Soap", category: "Household", itemCode: "GRO-014", price: 38, stock: 160 },
  { name: "Laundry Detergent", category: "Household", itemCode: "GRO-015", price: 12, stock: 500, unitOfMeasure: "PCS" },
];

const PET_CATALOG = [
  { name: "Premium Dog Food", category: "Pet Food", itemCode: "PET-001", price: 320, stock: 500, unitOfMeasure: "KG" },
  { name: "Cat Dry Food", category: "Pet Food", itemCode: "PET-002", price: 280, stock: 400, unitOfMeasure: "KG" },
  { name: "Bird Seed Mix", category: "Pet Food", itemCode: "PET-003", price: 150, stock: 200, unitOfMeasure: "KG" },
  { name: "Aquarium Fish Food", category: "Pet Food", itemCode: "PET-004", price: 45, stock: 120, unitOfMeasure: "KG" },
  { name: "Puppy Milk Replacer", category: "Pet Food", itemCode: "PET-005", price: 420, stock: 80, unitOfMeasure: "KG" },
  { name: "Bulk Dog Treats", category: "Treats", itemCode: "PET-006", price: 380, stock: 150, unitOfMeasure: "KG" },
  { name: "Cat Litter (scoop)", category: "Supplies", itemCode: "PET-007", price: 95, stock: 300, unitOfMeasure: "KG" },
  { name: "Dog Leash", category: "Accessories", itemCode: "PET-008", price: 250, stock: 40 },
  { name: "Cat Toy Mouse", category: "Accessories", itemCode: "PET-009", price: 85, stock: 60 },
  { name: "Pet Shampoo", category: "Grooming", itemCode: "PET-010", price: 195, stock: 55 },
  { name: "Flea Collar", category: "Grooming", itemCode: "PET-011", price: 320, stock: 35 },
  { name: "Chew Bone Large", category: "Treats", itemCode: "PET-012", price: 120, stock: 90 },
  { name: "Hamster Bedding", category: "Supplies", itemCode: "PET-013", price: 180, stock: 70, unitOfMeasure: "KG" },
  { name: "Fish Tank Filter", category: "Aquarium", itemCode: "PET-014", price: 890, stock: 15 },
  { name: "Pet Carrier Small", category: "Accessories", itemCode: "PET-015", price: 650, stock: 20 },
];

async function seedFnbStore(storeId: string): Promise<SaleLine[]> {
  const ingredientDefs = [
    { key: "coffee", name: "Arabica Coffee Beans", sku: "ING-COF", stock: 500_000, unitOfMeasure: "g" },
    { key: "milk", name: "Fresh Milk", sku: "ING-MLK", stock: 800_000, unitOfMeasure: "ml" },
    { key: "syrup", name: "Sugar Syrup", sku: "ING-SYP", stock: 200_000, unitOfMeasure: "ml" },
    { key: "patty", name: "Beef Patty", sku: "ING-BEF", stock: 400_000, unitOfMeasure: "g" },
    { key: "bun", name: "Burger Bun", sku: "ING-BUN", stock: 50_000, unitOfMeasure: "PCS" },
    { key: "cheese", name: "Cheese Slice", sku: "ING-CHS", stock: 40_000, unitOfMeasure: "PCS" },
    { key: "lettuce", name: "Lettuce", sku: "ING-LET", stock: 150_000, unitOfMeasure: "g" },
    { key: "fries", name: "Frozen Fries", sku: "ING-FRI", stock: 600_000, unitOfMeasure: "g" },
    { key: "oil", name: "Fryer Oil", sku: "ING-OIL", stock: 200_000, unitOfMeasure: "ml" },
    { key: "tea", name: "Black Tea Leaves", sku: "ING-TEA", stock: 100_000, unitOfMeasure: "g" },
    { key: "cream", name: "Whipped Cream", sku: "ING-CRM", stock: 120_000, unitOfMeasure: "ml" },
    { key: "chicken", name: "Grilled Chicken", sku: "ING-CHK", stock: 300_000, unitOfMeasure: "g" },
    { key: "rice", name: "Steamed Rice", sku: "ING-RIC", stock: 400_000, unitOfMeasure: "g" },
    { key: "egg", name: "Fresh Egg", sku: "ING-EGG", stock: 30_000, unitOfMeasure: "PCS" },
    { key: "tomato", name: "Tomato", sku: "ING-TOM", stock: 80_000, unitOfMeasure: "g" },
  ];
  const ingId = new Map<string, string>();
  for (const def of ingredientDefs) {
    const row = await saasPrisma.ingredient.create({
      data: {
        storeId,
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

  const catDrinks = await saasPrisma.menuCategory.create({ data: { storeId, name: "Coffee & Drinks" } });
  const catMeals = await saasPrisma.menuCategory.create({ data: { storeId, name: "Meals" } });
  const catSides = await saasPrisma.menuCategory.create({ data: { storeId, name: "Sides" } });

  async function menuItem(
    menuCategoryId: string,
    name: string,
    price: number,
    recipe: Array<{ ingKey: string; qty: number }>,
  ): Promise<SaleLine> {
    const item = await saasPrisma.menuItem.create({
      data: { storeId, menuCategoryId, name, price, status: "active" },
    });
    await saasPrisma.recipeLine.createMany({
      data: recipe.map((r) => ({
        menuItemId: item.id,
        ingredientId: ingId.get(r.ingKey)!,
        quantity: r.qty,
        wastagePercent: null,
      })),
    });
    return { menuItemId: item.id, productName: name, quantity: 1, price, subtotal: price };
  }

  return [
    await menuItem(catDrinks.id, "Iced Latte", 125, [
      { ingKey: "coffee", qty: 18 },
      { ingKey: "milk", qty: 250 },
      { ingKey: "syrup", qty: 12 },
    ]),
    await menuItem(catDrinks.id, "Cappuccino", 110, [
      { ingKey: "coffee", qty: 15 },
      { ingKey: "milk", qty: 180 },
    ]),
    await menuItem(catDrinks.id, "Milk Tea", 95, [
      { ingKey: "tea", qty: 8 },
      { ingKey: "milk", qty: 200 },
      { ingKey: "syrup", qty: 15 },
    ]),
    await menuItem(catDrinks.id, "Iced Americano", 99, [{ ingKey: "coffee", qty: 20 }]),
    await menuItem(catMeals.id, "Classic Beef Burger", 195, [
      { ingKey: "patty", qty: 150 },
      { ingKey: "bun", qty: 1 },
      { ingKey: "lettuce", qty: 25 },
    ]),
    await menuItem(catMeals.id, "Cheese Burger", 220, [
      { ingKey: "patty", qty: 150 },
      { ingKey: "bun", qty: 1 },
      { ingKey: "cheese", qty: 1 },
    ]),
    await menuItem(catMeals.id, "Chicken Rice Bowl", 185, [
      { ingKey: "chicken", qty: 180 },
      { ingKey: "rice", qty: 250 },
      { ingKey: "tomato", qty: 30 },
    ]),
    await menuItem(catMeals.id, "Breakfast Silog", 165, [
      { ingKey: "egg", qty: 1 },
      { ingKey: "rice", qty: 200 },
    ]),
    await menuItem(catSides.id, "Crispy Fries", 85, [
      { ingKey: "fries", qty: 150 },
      { ingKey: "oil", qty: 25 },
    ]),
    await menuItem(catSides.id, "Side Salad", 75, [{ ingKey: "lettuce", qty: 80 }]),
    await menuItem(catDrinks.id, "Frappe Special", 145, [
      { ingKey: "coffee", qty: 20 },
      { ingKey: "milk", qty: 180 },
      { ingKey: "cream", qty: 40 },
    ]),
    await menuItem(catMeals.id, "Double Patty Burger", 265, [
      { ingKey: "patty", qty: 300 },
      { ingKey: "bun", qty: 1 },
      { ingKey: "cheese", qty: 2 },
    ]),
    await menuItem(catMeals.id, "Grilled Chicken Sandwich", 210, [
      { ingKey: "chicken", qty: 120 },
      { ingKey: "bun", qty: 1 },
      { ingKey: "lettuce", qty: 20 },
    ]),
    await menuItem(catSides.id, "Cheesy Fries", 105, [
      { ingKey: "fries", qty: 150 },
      { ingKey: "cheese", qty: 1 },
    ]),
    await menuItem(catDrinks.id, "Hot Chocolate", 115, [
      { ingKey: "milk", qty: 220 },
      { ingKey: "syrup", qty: 20 },
    ]),
  ];
}

function pickSaleLine(lines: SaleLine[], isPetKg: boolean): SaleLine {
  const line = lines[randomInt(0, lines.length - 1)];
  if (isPetKg) {
    const kgProduct = lines.find((l) => l.productName.includes("Food") || l.productName.includes("Treats") || l.productName.includes("Litter") || l.productName.includes("Bedding"));
    const target = kgProduct ?? line;
    const weight = randomWeightKg();
    const unitPrice = target.price;
    const subtotal = Math.round(unitPrice * weight * 100) / 100;
    return {
      ...target,
      variantName: `${weight} kg`,
      quantity: 1,
      price: subtotal,
      subtotal,
      stockDecrement: weight,
    };
  }
  const qty = randomInt(1, 3);
  return {
    ...line,
    quantity: qty,
    subtotal: Math.round(line.price * qty * 100) / 100,
  };
}

async function seedStoreSales(
  storeId: string,
  lines: SaleLine[],
  cashier: { id: string; name: string },
  options: { prefix: string; isFnb: boolean; isPetKg: boolean },
): Promise<number> {
  const now = new Date();
  const startDate = addDays(now, -(OPERATING_DAYS - 1));
  let ticketCounter = 1000;
  let created = 0;

  const perDay = Math.floor(SALES_PER_STORE / OPERATING_DAYS);
  const extra = SALES_PER_STORE % OPERATING_DAYS;

  for (let d = 0; d < OPERATING_DAYS; d++) {
    const daySales = perDay + (d < extra ? 1 : 0);
    const dayStart = addDays(startDate, d);

    for (let s = 0; s < daySales; s++) {
      const numItems = randomInt(1, 4);
      const cart: SaleLine[] = [];
      for (let i = 0; i < numItems; i++) {
        cart.push(pickSaleLine(lines, options.isPetKg));
      }
      const total = Math.round(cart.reduce((sum, c) => sum + c.subtotal, 0) * 100) / 100;
      const hour = randomInt(8, 21);
      const minute = randomInt(0, 59);
      const saleDate = new Date(dayStart);
      saleDate.setHours(hour, minute, 0, 0);
      ticketCounter += 1;

      const paymentMethod = randomInt(0, 4) === 0 ? "gcash" : "cash";
      const ticketNumber = `${options.prefix}-${ticketCounter}`;
      if (options.isFnb) {
        await insertFnbSeedSale(storeId, cashier, cart, total, ticketNumber, saleDate, paymentMethod);
      } else {
        await insertRetailSeedSale(storeId, cashier, cart, total, ticketNumber, saleDate, paymentMethod);
      }
      created += 1;
    }
  }
  return created;
}

export interface SeedVercelDemoResult {
  orgId: string;
  orgName: string;
  stores: { name: string; products: number; sales: number }[];
  logins: { email: string; role: string }[];
  note: string;
}

export async function runSeedVercelDemo(): Promise<SeedVercelDemoResult> {
  const owner = await saasPrisma.user.findUnique({
    where: { email: "owner@demo.com" },
    include: { organization: true },
  });
  if (!owner?.organizationId || !owner.organization) {
    throw new Error(
      "Demo org not found. Visit Vercel once so bootstrap creates owner@demo.com, then re-run seed.",
    );
  }

  const org = owner.organization;
  const trialEndsAt = addDays(new Date(), DEMO_TRIAL_DAYS);
  await saasPrisma.organization.update({
    where: { id: org.id },
    data: {
      name: "Demo Organization",
      plan: "tindahan",
      trialEndsAt,
      email: org.email ?? "demo@example.com",
      phone: org.phone ?? "+63 912 345 6789",
      address: org.address ?? "123 Demo St, Manila",
    },
  });
  await saasPrisma.organizationSubscription.upsert({
    where: { organizationId: org.id },
    create: {
      organizationId: org.id,
      tier: "tindahan",
      status: "trialing",
      trialStart: new Date(),
      trialEnd: trialEndsAt,
      monthlyPriceCentavos: 49900,
    },
    update: {
      tier: "tindahan",
      status: "trialing",
      trialEnd: trialEndsAt,
    },
  });

  await clearOrgCatalog(org.id);
  const { grocery, fnb, pet } = await ensureThreeStores(org.id);

  const cashier =
    (await saasPrisma.user.findUnique({ where: { email: "cashier@demo.com" } })) ?? owner;

  const storeIds = [grocery.id, fnb.id, pet.id];
  await saasPrisma.userStore.deleteMany({
    where: { userId: { in: [owner.id, cashier.id] } },
  });
  await saasPrisma.userStore.createMany({
    data: [
      ...storeIds.map((storeId) => ({ userId: owner.id, storeId })),
      ...storeIds.map((storeId) => ({ userId: cashier.id, storeId })),
    ],
  });

  const groceryLines = await seedRetailProducts(grocery.id, GROCERY_CATALOG);
  const petLines = await seedRetailProducts(pet.id, PET_CATALOG);
  const fnbLines = await seedFnbStore(fnb.id);

  console.log("  Creating sales (50 × 3 stores, last 7 days)…");
  const grocerySales = await seedStoreSales(grocery.id, groceryLines, cashier, {
    prefix: "G",
    isFnb: false,
    isPetKg: false,
  });
  console.log(`    ${grocery.name}: ${grocerySales} sales`);
  const petSales = await seedStoreSales(pet.id, petLines, cashier, {
    prefix: "P",
    isFnb: false,
    isPetKg: true,
  });
  console.log(`    ${pet.name}: ${petSales} sales`);
  const fnbSales = await seedStoreSales(fnb.id, fnbLines, cashier, {
    prefix: "F",
    isFnb: true,
    isPetKg: false,
  });
  console.log(`    ${fnb.name}: ${fnbSales} sales`);

  return {
    orgId: org.id,
    orgName: org.name,
    stores: [
      { name: grocery.name, products: GROCERY_CATALOG.length, sales: grocerySales },
      { name: fnb.name, products: fnbLines.length, sales: fnbSales },
      { name: pet.name, products: PET_CATALOG.length, sales: petSales },
    ],
    logins: [
      { email: "owner@demo.com", role: "owner (all 3 stores)" },
      { email: "cashier@demo.com", role: "cashier (all 3 stores)" },
      { email: "admin@demo.com", role: "super_admin" },
    ],
    note:
      "Enable Settings → Per-kilo / weight purchase on Paws & Claws Pet Shop to demo KG pricing at POS.",
  };
}
