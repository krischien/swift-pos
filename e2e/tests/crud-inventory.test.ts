import { loginAs } from "../helpers/auth";
import { clickNav } from "../helpers/navigation";
import { uniqueName } from "../fixtures/testData";
import { CategoriesPage } from "../page-objects/CategoriesPage";
import { InventoryPage } from "../page-objects/InventoryPage";

fixture("Inventory CRUD")
  .beforeEach(async (t) => {
    await t.resizeWindow(1280, 900);
    await t.setNativeDialogHandler(() => true);
    await loginAs(t, "owner");

    const categoryName = uniqueName("InvCat");
    await clickNav(t, "nav-categories");
    await t.click(CategoriesPage.addButton);
    await t.typeText(CategoriesPage.nameInput, categoryName, { replace: true });
    await t.click(CategoriesPage.saveButton.withText("Create"));
    await t.expect(CategoriesPage.row(categoryName).exists).ok({ timeout: 10000 });

    await clickNav(t, "nav-inventory");
    await t.expect(InventoryPage.heading.exists).ok({ timeout: 10000 });

    t.fixtureCtx.categoryName = categoryName;
  });

test("owner can create, update, and delete a product", async (t) => {
  const categoryName = t.fixtureCtx.categoryName as string;
  const productName = uniqueName("Product");
  const updatedName = `${productName}-updated`;

  await t.click(InventoryPage.addButton);
  await t.typeText(InventoryPage.nameInput, productName, { replace: true });
  await t.click(InventoryPage.categoryTrigger);
  await t.click(InventoryPage.categoryOption(categoryName));
  await t.typeText(InventoryPage.basePriceInput, "50", { replace: true });
  await t.typeText(InventoryPage.stockInput, "20", { replace: true });
  await t.click(InventoryPage.saveButton.withText("Save Product"));
  await t.expect(InventoryPage.row(productName).exists).ok({ timeout: 15000 });

  await t.click(InventoryPage.editButton(productName));
  await t.typeText(InventoryPage.nameInput, updatedName, { replace: true });
  await t.typeText(InventoryPage.basePriceInput, "75", { replace: true });
  await t.typeText(InventoryPage.stockInput, "15", { replace: true });
  await t.click(InventoryPage.saveButton.withText("Save Changes"));
  await t.expect(InventoryPage.row(updatedName).exists).ok({ timeout: 15000 });

  await t.setNativeDialogHandler(() => true);
  await t.click(InventoryPage.deleteButton(updatedName));
  await t.wait(1000);
  await t.expect(InventoryPage.row(updatedName).exists).notOk({ timeout: 20000 });
});
