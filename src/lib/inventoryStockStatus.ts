import type { Ingredient, Product } from "@/types/pos";

export interface SimpleStockItem {
  stock: number;
  lowStockThreshold: number;
}

export function isSimpleLowStock(item: SimpleStockItem): boolean {
  return item.stock > 0 && item.stock <= item.lowStockThreshold;
}

export function hasSimpleZeroStock(item: SimpleStockItem): boolean {
  return (item.stock ?? 0) <= 0;
}

export function needsIngredientAttention(ing: Ingredient): boolean {
  return isSimpleLowStock(ing) || hasSimpleZeroStock(ing);
}

/** Empty cylinder pool (exchange stock) — uses same threshold as filled. */
export function isCylinderEmptyLow(product: Product): boolean {
  if (!product.tracksCylinder) return false;
  const empty = product.emptyStock ?? 0;
  return empty > 0 && empty <= product.lowStockThreshold;
}

export function hasCylinderEmptyZero(product: Product): boolean {
  if (!product.tracksCylinder) return false;
  return (product.emptyStock ?? 0) <= 0;
}

export function isCylinderFilledLow(product: Product): boolean {
  if (!product.tracksCylinder) return isLowStock(product);
  const stock = product.stock ?? 0;
  return stock > 0 && stock <= product.lowStockThreshold;
}

export function hasCylinderFilledZero(product: Product): boolean {
  if (!product.tracksCylinder) return hasZeroStock(product);
  return (product.stock ?? 0) <= 0;
}

export function needsCylinderStockAttention(product: Product): boolean {
  if (!product.tracksCylinder) return needsStockAttention(product);
  return (
    isCylinderFilledLow(product) ||
    hasCylinderFilledZero(product) ||
    isCylinderEmptyLow(product) ||
    hasCylinderEmptyZero(product)
  );
}

export function hasCylinderStockOut(product: Product): boolean {
  if (!product.tracksCylinder) return hasZeroStock(product);
  return hasCylinderFilledZero(product) || hasCylinderEmptyZero(product);
}

/** Same rules as Inventory: low = stock > 0 && stock <= threshold; variants use `hasVariants && variants` (empty array matches Inventory). */
export function isLowStock(product: Product): boolean {
  if (product.hasVariants && product.variants) {
    return product.variants.some(
      (v) => v.stock > 0 && v.stock <= product.lowStockThreshold,
    );
  }
  const stock = product.stock || 0;
  return stock > 0 && stock <= product.lowStockThreshold;
}

export function hasZeroStock(product: Product): boolean {
  if (product.hasVariants && product.variants) {
    return product.variants.some((v) => (v.stock ?? 0) <= 0);
  }
  return (product.stock ?? 0) <= 0;
}

export function outOfStockVariantCount(product: Product): number {
  if (!product.hasVariants || !product.variants) return 0;
  return product.variants.filter((v) => (v.stock ?? 0) <= 0).length;
}

export function needsStockAttention(product: Product): boolean {
  const base = isLowStock(product) || hasZeroStock(product);
  if (!product.tracksCylinder) return base;
  return base || isCylinderEmptyLow(product) || hasCylinderEmptyZero(product);
}

export type StockAlertLineItem = { id: string; name: string; stock: number; status: string };

export function buildLowStockLineItems(products: Product[]): StockAlertLineItem[] {
  return products.flatMap((p) => {
    if (p.hasVariants && p.variants) {
      return p.variants
        .filter((v) => v.stock > 0 && v.stock <= p.lowStockThreshold)
        .map((v) => ({
          id: `${p.id}-${v.id}`,
          name: `${p.name} - ${v.name}`,
          stock: v.stock ?? 0,
          status: "Low",
        }));
    }
    const stock = p.stock || 0;
    const lines: StockAlertLineItem[] = [];
    if (stock > 0 && stock <= p.lowStockThreshold) {
      lines.push({ id: `${p.id}-base`, name: p.name, stock, status: "Low" });
    }
    if (p.tracksCylinder) {
      const empty = p.emptyStock ?? 0;
      if (empty > 0 && empty <= p.lowStockThreshold) {
        lines.push({
          id: `${p.id}-empty`,
          name: `${p.name} (empty)`,
          stock: empty,
          status: "Low Empty",
        });
      }
    }
    return lines;
  });
}

export function buildIngredientLowStockLineItems(ingredients: Ingredient[]): StockAlertLineItem[] {
  return ingredients
    .filter((ing) => isSimpleLowStock(ing))
    .map((ing) => ({
      id: ing.id,
      name: ing.name,
      stock: ing.stock,
      status: "Low",
    }));
}

export function buildIngredientOutOfStockLineItems(ingredients: Ingredient[]): StockAlertLineItem[] {
  return ingredients
    .filter((ing) => hasSimpleZeroStock(ing))
    .map((ing) => ({
      id: ing.id,
      name: ing.name,
      stock: ing.stock,
      status: "Out of Stock",
    }));
}

export function buildOutOfStockLineItems(products: Product[]): StockAlertLineItem[] {
  return products.flatMap((p) => {
    if (p.hasVariants && p.variants) {
      return p.variants
        .filter((v) => (v.stock ?? 0) <= 0)
        .map((v) => ({
          id: `${p.id}-${v.id}`,
          name: `${p.name} - ${v.name}`,
          stock: v.stock ?? 0,
          status: "Out of Stock",
        }));
    }
    const stock = p.stock ?? 0;
    const lines: StockAlertLineItem[] = [];
    if (stock <= 0) {
      lines.push({ id: `${p.id}-base`, name: p.name, stock, status: "Out of Stock" });
    }
    if (p.tracksCylinder && (p.emptyStock ?? 0) <= 0) {
      lines.push({
        id: `${p.id}-empty-oos`,
        name: `${p.name} (empty)`,
        stock: p.emptyStock ?? 0,
        status: "No Empties",
      });
    }
    return lines;
  });
}

export type StoreCatalogSlice = { storeId: string; storeName: string; products: Product[] };

/** Combine per-store stock lines when “All stores” is selected; disambiguates ids and labels with store name. */
export function buildAggregatedStockAlertLines(
  catalogs: StoreCatalogSlice[],
  buildLines: (products: Product[]) => StockAlertLineItem[],
): StockAlertLineItem[] {
  const out: StockAlertLineItem[] = [];
  for (const { storeId, storeName, products } of catalogs) {
    for (const item of buildLines(products)) {
      out.push({
        ...item,
        id: `${storeId}-${item.id}`,
        name: `${item.name} — ${storeName}`,
      });
    }
  }
  return out;
}
