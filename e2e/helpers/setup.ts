import { Selector } from "testcafe";
import type { TestController } from "./types";
import { uniqueName } from "../fixtures/testData";
import { CategoriesPage } from "../page-objects/CategoriesPage";
import { InventoryPage } from "../page-objects/InventoryPage";
import { POSPage } from "../page-objects/POSPage";
import { clickNav } from "./navigation";

/** Ensure at least one sellable product is visible on POS (retail store). */
export async function ensureSellableProduct(t: TestController): Promise<void> {
  await t.navigateTo("/pos");
  await t.resizeWindow(1280, 900);

  if ((await POSPage.productCard.count) > 0) {
    return;
  }

  const categoryName = uniqueName("Cat");
  const productName = uniqueName("Product");

  await clickNav(t, "nav-categories");
  await t.expect(CategoriesPage.heading.exists).ok({ timeout: 10000 });
  await t.click(CategoriesPage.addButton);
  await t.typeText(CategoriesPage.nameInput, categoryName, { replace: true });
  await t.click(CategoriesPage.saveButton.withText("Create"));
  await t.expect(CategoriesPage.row(categoryName).exists).ok({ timeout: 10000 });

  await clickNav(t, "nav-inventory");
  await t.expect(InventoryPage.heading.exists).ok({ timeout: 10000 });
  await t.click(InventoryPage.addButton);
  await t.typeText(InventoryPage.nameInput, productName, { replace: true });
  await t.click(InventoryPage.categoryTrigger);
  await t.click(InventoryPage.categoryOption(categoryName));
  await t.typeText(InventoryPage.basePriceInput, "100", { replace: true });
  await t.typeText(InventoryPage.stockInput, "10", { replace: true });
  await t.click(InventoryPage.saveButton.withText("Save Product"));
  await t.expect(InventoryPage.row(productName).exists).ok({ timeout: 15000 });

  await clickNav(t, "nav-pos");
  await t.expect(Selector('[data-testid="product-card"]').exists).ok({ timeout: 10000 });
}

export async function addFirstProductToCart(t: TestController): Promise<void> {
  await t.expect(POSPage.inStockProduct.exists).ok({ timeout: 10000 });
  await t.click(POSPage.inStockProduct.nth(0));
  const addToCart = Selector("button").withText("Add to Cart");
  if (await addToCart.exists) {
    await t.click(addToCart);
  }
  await t.expect(POSPage.checkout.hasAttribute("disabled")).notOk({ timeout: 5000 });
}
