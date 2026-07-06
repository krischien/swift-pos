import { Selector } from "testcafe";

export const POSPage = {
  productCard: Selector('[data-testid="product-card"]'),
  inStockProduct: Selector('[data-testid="product-card"]').filter(
    (node) => !(node as HTMLButtonElement).disabled,
  ),
  productByName: (name: string) => Selector(`[data-testid="product-card"][data-product-name="${name}"]`),
  checkout: Selector('[data-testid="pos-checkout"]'),
  cartEmpty: Selector("p").withText("Cart is empty"),
};
