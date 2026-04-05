import type { Product } from "@/types/pos";

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
  return isLowStock(product) || hasZeroStock(product);
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
    if (stock > 0 && stock <= p.lowStockThreshold) {
      return [{ id: `${p.id}-base`, name: p.name, stock, status: "Low" }];
    }
    return [];
  });
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
    if (stock <= 0) {
      return [{ id: `${p.id}-base`, name: p.name, stock, status: "Out of Stock" }];
    }
    return [];
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
