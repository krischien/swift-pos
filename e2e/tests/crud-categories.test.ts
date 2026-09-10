import { loginAs } from "../helpers/auth";
import { clickNav, confirmAlertDialog } from "../helpers/navigation";
import { uniqueName } from "../fixtures/testData";
import { CategoriesPage } from "../page-objects/CategoriesPage";

fixture("Categories CRUD")
  .beforeEach(async (t) => {
    await t.resizeWindow(1280, 900);
    await loginAs(t, "owner");
    await clickNav(t, "nav-categories");
    await t.expect(CategoriesPage.heading.exists).ok({ timeout: 10000 });
  });

test("owner can create, update, and delete a category", async (t) => {
  const name = uniqueName("Category");
  const updatedName = `${name}-updated`;

  await t.click(CategoriesPage.addButton);
  await t.typeText(CategoriesPage.nameInput, name, { replace: true });
  await t.click(CategoriesPage.saveButton.withText("Create"));
  await t.expect(CategoriesPage.row(name).exists).ok({ timeout: 10000 });

  await t.click(CategoriesPage.editButton(name));
  await t.typeText(CategoriesPage.nameInput, updatedName, { replace: true });
  await t.click(CategoriesPage.saveButton.withText("Update"));
  await t.expect(CategoriesPage.row(updatedName).exists).ok({ timeout: 10000 });

  await t.click(CategoriesPage.deleteButton(updatedName));
  await confirmAlertDialog(t);
  await t.expect(CategoriesPage.row(updatedName).exists).notOk({ timeout: 10000 });
});
