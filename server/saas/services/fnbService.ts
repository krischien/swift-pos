import { saasPrisma } from "../db.js";

export class FnbStoreError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FnbStoreError";
  }
}

export async function requireFnbStore(storeId: string) {
  const store = await saasPrisma.store.findFirst({ where: { id: storeId } });
  if (!store) throw new FnbStoreError("Store not found");
  if (store.businessMode !== "fnb") {
    throw new FnbStoreError("This feature is only available for Food & Beverage stores");
  }
  return store;
}

export async function listIngredients(storeId: string) {
  return saasPrisma.ingredient.findMany({
    where: { storeId },
    orderBy: { name: "asc" },
  });
}

export async function createIngredient(
  storeId: string,
  data: {
    name: string;
    sku?: string;
    barcode?: string;
    stock?: number;
    lowStockThreshold?: number;
    unitOfMeasure?: string;
    status?: string;
  },
) {
  return saasPrisma.ingredient.create({
    data: {
      storeId,
      name: data.name.trim(),
      sku: data.sku?.trim() || null,
      barcode: data.barcode?.trim() || null,
      stock: data.stock ?? 0,
      lowStockThreshold: data.lowStockThreshold ?? 0,
      unitOfMeasure: data.unitOfMeasure?.trim() || "PCS",
      status: data.status ?? "active",
    },
  });
}

export async function updateIngredient(
  id: string,
  storeId: string,
  data: Partial<{
    name: string;
    sku: string | null;
    barcode: string | null;
    stock: number;
    lowStockThreshold: number;
    unitOfMeasure: string | null;
    status: string;
  }>,
) {
  const existing = await saasPrisma.ingredient.findFirst({ where: { id, storeId } });
  if (!existing) throw new Error("Ingredient not found");
  return saasPrisma.ingredient.update({
    where: { id },
    data: {
      ...(data.name !== undefined && { name: data.name.trim() }),
      ...(data.sku !== undefined && { sku: data.sku?.trim() || null }),
      ...(data.barcode !== undefined && { barcode: data.barcode?.trim() || null }),
      ...(data.stock !== undefined && { stock: data.stock }),
      ...(data.lowStockThreshold !== undefined && { lowStockThreshold: data.lowStockThreshold }),
      ...(data.unitOfMeasure !== undefined && { unitOfMeasure: data.unitOfMeasure?.trim() || null }),
      ...(data.status !== undefined && { status: data.status }),
    },
  });
}

export async function deleteIngredient(id: string, storeId: string) {
  const existing = await saasPrisma.ingredient.findFirst({ where: { id, storeId } });
  if (!existing) throw new Error("Ingredient not found");
  await saasPrisma.ingredient.delete({ where: { id } });
}

export async function listMenuCategories(storeId: string) {
  return saasPrisma.menuCategory.findMany({
    where: { storeId },
    orderBy: { name: "asc" },
  });
}

export async function createMenuCategory(storeId: string, name: string) {
  return saasPrisma.menuCategory.create({
    data: { storeId, name: name.trim() },
  });
}

export async function updateMenuCategory(id: string, storeId: string, name: string) {
  const existing = await saasPrisma.menuCategory.findFirst({ where: { id, storeId } });
  if (!existing) throw new Error("Menu category not found");
  return saasPrisma.menuCategory.update({
    where: { id },
    data: { name: name.trim() },
  });
}

export async function deleteMenuCategory(id: string, storeId: string) {
  const existing = await saasPrisma.menuCategory.findFirst({ where: { id, storeId } });
  if (!existing) throw new Error("Menu category not found");
  await saasPrisma.menuCategory.delete({ where: { id } });
}

export async function listMenuItems(storeId: string, menuCategoryId?: string | null) {
  return saasPrisma.menuItem.findMany({
    where: {
      storeId,
      ...(menuCategoryId ? { menuCategoryId } : {}),
    },
    include: {
      recipeLines: { include: { ingredient: true } },
      menuCategory: true,
    },
    orderBy: { name: "asc" },
  });
}

export async function getMenuItemById(id: string, storeId: string) {
  return saasPrisma.menuItem.findFirst({
    where: { id, storeId },
    include: {
      recipeLines: { include: { ingredient: true } },
      menuCategory: true,
    },
  });
}

export async function createMenuItem(
  storeId: string,
  data: {
    menuCategoryId: string;
    name: string;
    price: number;
    status?: string;
    image?: string;
    barcode?: string;
  },
) {
  const cat = await saasPrisma.menuCategory.findFirst({
    where: { id: data.menuCategoryId, storeId },
  });
  if (!cat) throw new Error("Menu category not found");
  return saasPrisma.menuItem.create({
    data: {
      storeId,
      menuCategoryId: data.menuCategoryId,
      name: data.name.trim(),
      price: data.price,
      status: data.status ?? "active",
      image: data.image?.trim() || null,
      barcode: data.barcode?.trim() || null,
    },
    include: { recipeLines: true, menuCategory: true },
  });
}

export async function updateMenuItem(
  id: string,
  storeId: string,
  data: Partial<{
    menuCategoryId: string;
    name: string;
    price: number;
    status: string;
    image: string | null;
    barcode: string | null;
  }>,
) {
  const existing = await saasPrisma.menuItem.findFirst({ where: { id, storeId } });
  if (!existing) throw new Error("Menu item not found");
  if (data.menuCategoryId) {
    const cat = await saasPrisma.menuCategory.findFirst({
      where: { id: data.menuCategoryId, storeId },
    });
    if (!cat) throw new Error("Menu category not found");
  }
  return saasPrisma.menuItem.update({
    where: { id },
    data: {
      ...(data.menuCategoryId !== undefined && { menuCategoryId: data.menuCategoryId }),
      ...(data.name !== undefined && { name: data.name.trim() }),
      ...(data.price !== undefined && { price: data.price }),
      ...(data.status !== undefined && { status: data.status }),
      ...(data.image !== undefined && { image: data.image?.trim() || null }),
      ...(data.barcode !== undefined && { barcode: data.barcode?.trim() || null }),
    },
    include: { recipeLines: { include: { ingredient: true } }, menuCategory: true },
  });
}

export async function deleteMenuItem(id: string, storeId: string) {
  const existing = await saasPrisma.menuItem.findFirst({ where: { id, storeId } });
  if (!existing) throw new Error("Menu item not found");
  await saasPrisma.menuItem.delete({ where: { id } });
}

export async function replaceRecipe(
  menuItemId: string,
  storeId: string,
  lines: Array<{ ingredientId: string; quantity: number; wastagePercent?: number }>,
) {
  const item = await saasPrisma.menuItem.findFirst({ where: { id: menuItemId, storeId } });
  if (!item) throw new Error("Menu item not found");

  const seen = new Set<string>();
  for (const line of lines) {
    if (seen.has(line.ingredientId)) throw new Error("Duplicate ingredient in recipe");
    seen.add(line.ingredientId);
    if (line.quantity < 0) throw new Error("Recipe quantities must be non-negative");
    const ing = await saasPrisma.ingredient.findFirst({
      where: { id: line.ingredientId, storeId },
    });
    if (!ing) throw new Error(`Ingredient not found: ${line.ingredientId}`);
  }

  await saasPrisma.$transaction(async (tx) => {
    await tx.recipeLine.deleteMany({ where: { menuItemId } });
    if (lines.length === 0) return;
    await tx.recipeLine.createMany({
      data: lines.map((l) => ({
        menuItemId,
        ingredientId: l.ingredientId,
        quantity: l.quantity,
        wastagePercent: l.wastagePercent ?? null,
      })),
    });
  });

  return getMenuItemById(menuItemId, storeId);
}
