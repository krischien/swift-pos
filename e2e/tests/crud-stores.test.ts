import { loginAs } from "../helpers/auth";
import { clickNav, confirmAlertDialog } from "../helpers/navigation";
import { uniqueName } from "../fixtures/testData";
import { StoresPage } from "../page-objects/StoresPage";

fixture("Stores CRUD")
  .beforeEach(async (t) => {
    await t.resizeWindow(1280, 900);
    await loginAs(t, "owner");
    await clickNav(t, "nav-stores");
    await t.expect(StoresPage.heading.exists).ok({ timeout: 10000 });
  });

test("owner can create, update, and delete a store", async (t) => {
  const name = uniqueName("Store");
  const updatedName = `${name}-updated`;
  const address = "123 E2E Test Street";

  await t.click(StoresPage.addButton);
  await t.typeText(StoresPage.nameInput, name, { replace: true });
  await t.typeText(StoresPage.addressInput, address, { replace: true });
  await t.click(StoresPage.saveButton.withText("Create"));
  await t.expect(StoresPage.row(name).exists).ok({ timeout: 15000 });

  await t.click(StoresPage.editButton(name));
  await t.typeText(StoresPage.nameInput, updatedName, { replace: true });
  await t.click(StoresPage.saveButton.withText("Update"));
  await t.expect(StoresPage.row(updatedName).exists).ok({ timeout: 10000 });

  await t.click(StoresPage.deleteButton(updatedName));
  await confirmAlertDialog(t);
  await t.expect(StoresPage.row(updatedName).exists).notOk({ timeout: 15000 });
});
