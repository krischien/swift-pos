import type { CartItem, Product } from "@/types/pos";

export function computeCylinderDeposit(
  cart: CartItem[],
  products: Product[],
  options: { enabled: boolean; collectDeposits: boolean },
): number {
  if (!options.enabled || !options.collectDeposits) return 0;
  let deposit = 0;
  for (const item of cart) {
    if (!item.productId) continue;
    const product = products.find((p) => p.id === item.productId);
    if (!product?.tracksCylinder) continue;
    const exchanged = Math.min(
      item.quantity,
      Math.max(0, Math.floor(item.broughtEmptyQuantity ?? (item.broughtEmpty ? item.quantity : 0))),
    );
    deposit += (product.depositAmount ?? 0) * Math.max(0, item.quantity - exchanged);
  }
  return deposit;
}

export function cartHasOutstandingCylinder(
  cart: CartItem[],
  products: Product[],
  enabled: boolean,
): boolean {
  if (!enabled) return false;
  return cart.some((item) => {
    if (!item.productId) return false;
    const product = products.find((p) => p.id === item.productId);
    if (!product?.tracksCylinder) return false;
    const exchanged = Math.min(
      item.quantity,
      Math.max(0, Math.floor(item.broughtEmptyQuantity ?? (item.broughtEmpty ? item.quantity : 0))),
    );
    return item.quantity - exchanged > 0;
  });
}
