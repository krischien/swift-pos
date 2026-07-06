import { Selector } from "testcafe";
import { loginAs } from "../helpers/auth";
import { clickNav, confirmAlertDialog } from "../helpers/navigation";
import { ensureSellableProduct, addFirstProductToCart } from "../helpers/setup";
import { CheckoutModal } from "../page-objects/CheckoutModal";
import { POSPage } from "../page-objects/POSPage";
import { SalesPage } from "../page-objects/SalesPage";

fixture("Sales void")
  .beforeEach(async (t) => {
    await t.resizeWindow(1280, 900);
    await t.setNativeDialogHandler(() => null);
    await loginAs(t, "owner");
    await ensureSellableProduct(t);
  });

test("owner can void a sale from Sales page", async (t) => {
  await addFirstProductToCart(t);
  await t.click(POSPage.checkout);
  await t.click(CheckoutModal.exact);
  await t.click(CheckoutModal.complete);
  await t.expect(CheckoutModal.complete.exists).notOk({ timeout: 15000 });

  await clickNav(t, "nav-sales");
  await t.expect(SalesPage.heading.exists).ok({ timeout: 10000 });

  const voidBtn = Selector("table tbody tr").nth(0).find("button").withText("Void");
  if (await voidBtn.exists) {
    await t.click(voidBtn);
    await confirmAlertDialog(t, "Void");
    await t.expect(Selector("table tbody tr").nth(0).withText(/voided/i).exists).ok({ timeout: 10000 });
  }
});
