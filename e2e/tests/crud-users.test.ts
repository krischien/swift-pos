import { loginAs } from "../helpers/auth";
import { clickNav, confirmAlertDialog } from "../helpers/navigation";
import { uniqueName, uniqueEmail } from "../fixtures/testData";
import { UsersPage } from "../page-objects/UsersPage";

fixture("Users CRUD")
  .beforeEach(async (t) => {
    await t.resizeWindow(1280, 900);
    await loginAs(t, "owner");
    await clickNav(t, "nav-users");
    await t.expect(UsersPage.heading.exists).ok({ timeout: 10000 });
  });

test("owner can create, update, and delete a user", async (t) => {
  const name = uniqueName("User");
  const email = uniqueEmail();
  const updatedName = `${name}-updated`;

  await t.click(UsersPage.addButton);
  await t.typeText(UsersPage.nameInput, name, { replace: true });
  await t.typeText(UsersPage.emailInput, email, { replace: true });
  await t.typeText(UsersPage.passwordInput, "password123", { replace: true });
  await t.click(UsersPage.roleTrigger);
  await t.click(UsersPage.roleOption("cashier"));
  await t.click(UsersPage.saveButton.withText("Create"));
  await t.expect(UsersPage.row(name).exists).ok({ timeout: 15000 });

  await t.click(UsersPage.editButton(name));
  await t.typeText(UsersPage.nameInput, updatedName, { replace: true });
  await t.click(UsersPage.saveButton.withText("Update"));
  await t.expect(UsersPage.row(updatedName).exists).ok({ timeout: 10000 });

  await t.click(UsersPage.deleteButton(updatedName));
  await confirmAlertDialog(t);
  await t.expect(UsersPage.row(updatedName).exists).notOk({ timeout: 15000 });
});
