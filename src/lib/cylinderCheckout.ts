import type { CartItem, Product } from "@/types/pos";

export function computeCylinderDeposit(
  cart: CartItem[],
  products: Product[],
  options: { enabled: boolean; collectDeposits: boolean },
): number {
  if (!options.enabled || !options.collectDeposits) return 0;
  let deposit = 0;
  for (const item of cart) {
    if (!item.productId || item.broughtEmpty) continue;
    const product = products.find((p) => p.id === item.productId);
    if (!product?.tracksCylinder) continue;
    deposit += (product.depositAmount ?? 0) * item.quantity;
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
    if (!item.productId || item.broughtEmpty) return false;
    const product = products.find((p) => p.id === item.productId);
    return Boolean(product?.tracksCylinder);
  });
}
