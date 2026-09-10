import type { TestController } from "../helpers/types";
import { Selector } from "testcafe";
import { loginAs } from "../helpers/auth";
import { clickNav } from "../helpers/navigation";
import { ensureSellableProduct, addFirstProductToCart } from "../helpers/setup";
import { uniqueGcashTxn } from "../fixtures/testData";
import { CheckoutModal } from "../page-objects/CheckoutModal";
import { POSPage } from "../page-objects/POSPage";
import { SalesPage } from "../page-objects/SalesPage";

async function dismissNativeDialogs(t: TestController): Promise<void> {
  await t.setNativeDialogHandler(() => null);
}

fixture("POS payments (owner)")
  .beforeEach(async (t) => {
    await t.resizeWindow(1280, 900);
    await dismissNativeDialogs(t);
    await loginAs(t, "owner");
    await ensureSellableProduct(t);
  });

test("owner can complete a cash sale and verify on Sales", async (t) => {
  await addFirstProductToCart(t);
  await t.click(POSPage.checkout);
  await t.expect(CheckoutModal.title.exists).ok({ timeout: 5000 });
  await t.click(CheckoutModal.exact);
  await t.click(CheckoutModal.complete);
  await t.expect(CheckoutModal.complete.exists).notOk({ timeout: 15000 });

  await clickNav(t, "nav-sales");
  await t.expect(SalesPage.heading.exists).ok({ timeout: 10000 });
  await t.click(Selector('button[role="combobox"]').withText("All payments"));
  await t.click(Selector('[role="option"]').withText("Cash"));
  await t.expect(Selector("table tbody tr").withText(/cash/i).exists).ok({ timeout: 15000 });
});

test("owner can complete a GCash sale and verify transaction ID", async (t) => {
  const gcashTxn = uniqueGcashTxn();

  await addFirstProductToCart(t);
  await t.click(POSPage.checkout);
  await t.click(CheckoutModal.gcash);
  await t.expect(CheckoutModal.amount.value).notEql("", { timeout: 5000 });
  await t.typeText(CheckoutModal.gcashTxn, gcashTxn, { replace: true });
  await t.expect(CheckoutModal.complete.hasAttribute("disabled")).notOk();
  await t.click(CheckoutModal.complete);
  await t.expect(CheckoutModal.gcashTxn.exists).notOk({ timeout: 15000 });

  await clickNav(t, "nav-sales");
  await t.expect(SalesPage.heading.exists).ok({ timeout: 10000 });
  await t.click(Selector('button[role="combobox"]').withText("All payments"));
  await t.click(Selector('[role="option"]').withText("GCash"));
  await t.expect(Selector("table tbody tr").withText(/gcash/i).exists).ok({ timeout: 15000 });
  await t.click(Selector("table tbody tr").nth(0).find("button").withText("View Details"));
  await t.expect(SalesPage.detailsDialog.withText(gcashTxn).exists).ok({ timeout: 5000 });
});

fixture("POS payments (cashier)")
  .beforeEach(async (t) => {
    await t.resizeWindow(1280, 900);
    await dismissNativeDialogs(t);
    await loginAs(t, "cashier");
    await ensureSellableProduct(t);
  });

test("cashier can complete a cash sale", async (t) => {
  await addFirstProductToCart(t);
  await t.click(POSPage.checkout);
  await t.click(CheckoutModal.exact);
  await t.click(CheckoutModal.complete);
  await t.expect(POSPage.cartEmpty.exists).ok({ timeout: 10000 });
});
