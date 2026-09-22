/**
 * Seed a middle-tier (Negosyo) sample organization with 4 stores:
 * Grocery, Pet Store, F&B, and LPG Canister Monitoring.
 *
 * Usage: npx tsx --env-file=.env server/saas/scripts/seedNegosyoSampleOrg.ts
 *
 * One store per cashier (no shared F&B + LPG login):
 *   owner@backbone.demo   — all 4 stores
 *   grocery@backbone.demo — Sample Grocery only
 *   pet@backbone.demo     — Sample Pet Store only
 *   cafe@backbone.demo    — Sample Cafe & Grill (F&B) only
 *   lpg@backbone.demo     — Sample LPG Canister Shop only
 * Password for all: password123
 */
import { randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { saasPrisma } from "../db.js";
import { TIERS } from "../config/tiers.js";

const ORG_NAME = "Backbone Multi-Store Sample";
const PASSWORD = "password123";

const ACCOUNTS = [
  { email: "owner@backbone.demo", name: "Sample Owner", role: "owner" as const },
  { email: "grocery@backbone.demo", name: "Ana Grocery", role: "cashier" as const },
  { email: "pet@backbone.demo", name: "Ben Pet Shop", role: "cashier" as const },
  { email: "cafe@backbone.demo", name: "Cara Cafe", role: "cashier" as const },
  { email: "lpg@backbone.demo", name: "Leo LPG", role: "cashier" as const },
];

function normalizeName(value: string) {
  return value.trim().toLocaleLowerCase().replace(/\s+/g, " ");
}

async function wipeOrg(orgId: string) {
  const stores = await saasPrisma.store.findMany({ where: { organizationId: orgId }, select: { id: true } });
  const storeIds = stores.map((s) => s.id);
  const users = await saasPrisma.user.findMany({ where: { organizationId: orgId }, select: { id: true } });
  const userIds = users.map((u) => u.id);

  if (storeIds.length) {
    await saasPrisma.cylinderReturn.deleteMany({ where: { storeId: { in: storeIds } } }).catch(() => undefined);
    await saasPrisma.cylinderLoan.deleteMany({ where: { storeId: { in: storeIds } } }).catch(() => undefined);
    await saasPrisma.customer.deleteMany({ where: { storeId: { in: storeIds } } }).catch(() => undefined);
    await saasPrisma.saleItem.deleteMany({ where: { sale: { storeId: { in: storeIds } } } });
    await saasPrisma.sale.deleteMany({ where: { storeId: { in: storeIds } } });
    await saasPrisma.menuItem.deleteMany({ where: { storeId: { in: storeIds } } });
    await saasPrisma.menuCategory.deleteMany({ where: { storeId: { in: storeIds } } });
    await saasPrisma.ingredient.deleteMany({ where: { storeId: { in: storeIds } } });
    await saasPrisma.variant.deleteMany({ where: { product: { storeId: { in: storeIds } } } });
    await saasPrisma.product.deleteMany({ where: { storeId: { in: storeIds } } });
    await saasPrisma.category.deleteMany({ where: { storeId: { in: storeIds } } });
  }
  await saasPrisma.userStore.deleteMany({
    where: { OR: [{ userId: { in: userIds } }, { storeId: { in: storeIds } }] },
  });
  await saasPrisma.organizationNotification.deleteMany({ where: { organizationId: orgId } });
  await saasPrisma.organizationBillingPayment.deleteMany({ where: { organizationId: orgId } });
  await saasPrisma.organizationSubscription.deleteMany({ where: { organizationId: orgId } });
  await saasPrisma.user.deleteMany({ where: { organizationId: orgId } });
  await saasPrisma.store.deleteMany({ where: { organizationId: orgId } });
  await saasPrisma.organization.delete({ where: { id: orgId } });
}

async function seedRetailCatalog(
  storeId: string,
  categories: string[],
  products: Array<{
    name: string;
    category: string;
    price: number;
    stock: number;
    tracksCylinder?: boolean;
    cylinderSize?: string;
    depositAmount?: number;
    emptyStock?: number;
  }>,
) {
  const categoryIds = new Map<string, string>();
  for (const name of categories) {
    const cat = await saasPrisma.category.create({ data: { storeId, name } });
    categoryIds.set(name, cat.id);
  }
  for (const [index, item] of products.entries()) {
    await saasPrisma.product.create({
      data: {
        storeId,
        categoryId: categoryIds.get(item.category)!,
        name: item.name,
        itemCode: `SMPL-${storeId.slice(-4).toUpperCase()}-${String(index + 1).padStart(3, "0")}`,
        hasVariants: false,
        price: item.price,
        stock: item.stock,
        lowStockThreshold: 5,
        marginPercentage: 25,
        status: "active",
        tracksCylinder: item.tracksCylinder ?? false,
        cylinderSize: item.cylinderSize ?? null,
        depositAmount: item.depositAmount ?? 0,
        emptyStock: item.emptyStock ?? 0,
      },
    });
  }
}

async function seedFnbCatalog(storeId: string) {
  const ingredients = [
    { name: "Coffee Beans", stock: 40, unitOfMeasure: "KG" },
    { name: "Milk", stock: 30, unitOfMeasure: "L" },
    { name: "Burger Patty", stock: 50, unitOfMeasure: "PCS" },
    { name: "Burger Bun", stock: 60, unitOfMeasure: "PCS" },
    { name: "French Fries", stock: 25, unitOfMeasure: "KG" },
  ];
  const ingredientIds: string[] = [];
  for (const item of ingredients) {
    const row = await saasPrisma.ingredient.create({
      data: {
        storeId,
        name: item.name,
        stock: item.stock,
        lowStockThreshold: 5,
        unitOfMeasure: item.unitOfMeasure,
        status: "active",
      },
    });
    ingredientIds.push(row.id);
  }

  const drinks = await saasPrisma.menuCategory.create({ data: { storeId, name: "Drinks" } });
  const meals = await saasPrisma.menuCategory.create({ data: { storeId, name: "Meals" } });

  const icedCoffee = await saasPrisma.menuItem.create({
    data: { storeId, menuCategoryId: drinks.id, name: "Iced Coffee", price: 120, status: "active" },
  });
  const burger = await saasPrisma.menuItem.create({
    data: { storeId, menuCategoryId: meals.id, name: "Classic Burger", price: 180, status: "active" },
  });
  const fries = await saasPrisma.menuItem.create({
    data: { storeId, menuCategoryId: meals.id, name: "Fries", price: 80, status: "active" },
  });

  await saasPrisma.recipeLine.createMany({
    data: [
      { menuItemId: icedCoffee.id, ingredientId: ingredientIds[0], quantity: 0.02, wastagePercent: 5 },
      { menuItemId: icedCoffee.id, ingredientId: ingredientIds[1], quantity: 0.15, wastagePercent: 2 },
      { menuItemId: burger.id, ingredientId: ingredientIds[2], quantity: 1, wastagePercent: 0 },
      { menuItemId: burger.id, ingredientId: ingredientIds[3], quantity: 1, wastagePercent: 0 },
      { menuItemId: fries.id, ingredientId: ingredientIds[4], quantity: 0.2, wastagePercent: 5 },
    ],
  });
}

async function seedCanisterCustomers(storeId: string) {
  const customers = [
    { name: "Rosa Cruz", phone: "09171110001", nickname: "Suki Rosa", address: "Blk 1 Lot 2" },
    { name: "Mike Tan", phone: "09172220002", nickname: null, address: "Purok 3" },
    { name: "Liza Gomez", phone: "09173330003", nickname: "Ate Liza", address: "Phase 2" },
  ];
  for (const customer of customers) {
    await saasPrisma.customer.create({
      data: {
        storeId,
        name: customer.name,
        normalizedName: normalizeName(customer.name),
        phone: customer.phone,
        normalizedPhone: customer.phone,
        nickname: customer.nickname,
        address: customer.address,
        qrToken: randomBytes(24).toString("base64url"),
      },
    });
  }
}

async function main() {
  const existing = await saasPrisma.organization.findFirst({ where: { name: ORG_NAME } });
  if (existing) {
    console.log(`Replacing existing org: ${ORG_NAME}`);
    await wipeOrg(existing.id);
  }

  // Free reserved emails if leftover from a partial run
  for (const account of ACCOUNTS) {
    const user = await saasPrisma.user.findUnique({ where: { email: account.email } });
    if (user?.organizationId) {
      const org = await saasPrisma.organization.findUnique({ where: { id: user.organizationId } });
      if (org && org.name !== ORG_NAME) {
        throw new Error(`Email ${account.email} already belongs to org "${org.name}". Aborting.`);
      }
    } else if (user) {
      await saasPrisma.user.delete({ where: { id: user.id } });
    }
  }

  const periodEnd = new Date();
  periodEnd.setMonth(periodEnd.getMonth() + 1);
  const periodStart = new Date();

  const org = await saasPrisma.organization.create({
    data: {
      name: ORG_NAME,
      plan: "negosyo",
      phone: "+63 917 000 1111",
      email: "sample@backbone.demo",
      address: "100 Sample Plaza, Makati",
      trialEndsAt: null,
      billingDueDate: periodEnd,
    },
  });

  await saasPrisma.organizationSubscription.create({
    data: {
      organizationId: org.id,
      tier: "negosyo",
      status: "active",
      trialStart: null,
      trialEnd: null,
      currentPeriodStart: periodStart,
      currentPeriodEnd: periodEnd,
      monthlyPriceCentavos: TIERS.negosyo.priceMonthlyCentavos,
      setupFeePaid: true,
    },
  });

  const grocery = await saasPrisma.store.create({
    data: {
      organizationId: org.id,
      name: "Sample Grocery",
      address: "12 Market Road",
      businessMode: "retail",
    },
  });
  const pet = await saasPrisma.store.create({
    data: {
      organizationId: org.id,
      name: "Sample Pet Store",
      address: "45 Pet Lane",
      businessMode: "retail",
    },
  });
  const cafe = await saasPrisma.store.create({
    data: {
      organizationId: org.id,
      name: "Sample Cafe & Grill",
      address: "78 Food Court",
      businessMode: "fnb",
    },
  });
  const lpg = await saasPrisma.store.create({
    data: {
      organizationId: org.id,
      name: "Sample LPG Canister Shop",
      address: "90 Gas Station Road",
      businessMode: "canister",
      enableCylinderTracking: true,
      collectCylinderDeposits: true,
    },
  });

  const hashed = await bcrypt.hash(PASSWORD, 10);
  const createdUsers = [];
  for (const account of ACCOUNTS) {
    const user = await saasPrisma.user.create({
      data: {
        organizationId: org.id,
        name: account.name,
        email: account.email,
        password: hashed,
        role: account.role,
      },
    });
    createdUsers.push(user);
  }
  const [owner, groceryCashier, petCashier, cafeCashier, lpgCashier] = createdUsers;

  await saasPrisma.userStore.createMany({
    data: [
      { userId: owner.id, storeId: grocery.id },
      { userId: owner.id, storeId: pet.id },
      { userId: owner.id, storeId: cafe.id },
      { userId: owner.id, storeId: lpg.id },
      { userId: groceryCashier.id, storeId: grocery.id },
      { userId: petCashier.id, storeId: pet.id },
      { userId: cafeCashier.id, storeId: cafe.id },
      { userId: lpgCashier.id, storeId: lpg.id },
    ],
  });

  await seedRetailCatalog(
    grocery.id,
    ["Produce", "Pantry", "Drinks"],
    [
      { name: "Rice 25kg", category: "Pantry", price: 1450, stock: 40 },
      { name: "Eggs (tray)", category: "Produce", price: 280, stock: 25 },
      { name: "Cooking Oil 1L", category: "Pantry", price: 120, stock: 60 },
      { name: "Bottled Water 1L", category: "Drinks", price: 25, stock: 100 },
    ],
  );

  await seedRetailCatalog(
    pet.id,
    ["Dog", "Cat", "Accessories"],
    [
      { name: "Dog Food 3kg", category: "Dog", price: 650, stock: 30 },
      { name: "Cat Litter 5kg", category: "Cat", price: 320, stock: 24 },
      { name: "Pet Shampoo", category: "Accessories", price: 180, stock: 20 },
      { name: "Leash", category: "Accessories", price: 250, stock: 15 },
    ],
  );

  await seedFnbCatalog(cafe.id);

  await seedRetailCatalog(
    lpg.id,
    ["LPG", "Accessories"],
    [
      {
        name: "11kg LPG Refill",
        category: "LPG",
        price: 950,
        stock: 20,
        tracksCylinder: true,
        cylinderSize: "11kg",
        depositAmount: 1500,
        emptyStock: 8,
      },
      {
        name: "2.7kg Butane",
        category: "LPG",
        price: 280,
        stock: 35,
        tracksCylinder: true,
        cylinderSize: "2.7kg",
        depositAmount: 400,
        emptyStock: 12,
      },
      { name: "Hose Clamp", category: "Accessories", price: 45, stock: 50 },
      { name: "Regulator", category: "Accessories", price: 350, stock: 10 },
    ],
  );
  await seedCanisterCustomers(lpg.id);

  console.log("Negosyo sample organization ready.");
  console.log(`  Org: ${org.name} (${org.id})`);
  console.log(`  Plan/tier: negosyo (active)`);
  console.log("  Stores:");
  console.log(`    - ${grocery.name} [retail]`);
  console.log(`    - ${pet.name} [retail]`);
  console.log(`    - ${cafe.name} [fnb]`);
  console.log(`    - ${lpg.name} [canister]`);
  console.log("  Accounts (password for all: password123):");
  for (const account of ACCOUNTS) {
    console.log(`    - ${account.email} (${account.role})`);
  }
  console.log("  Cashiers are scoped to one store each; use owner@ to switch all four branches.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await saasPrisma.$disconnect();
  });
