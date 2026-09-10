import { Selector } from "testcafe";
import { loginAs } from "../helpers/auth";
import { getPathname } from "../helpers/browser";

fixture("Access control")
  .beforeEach(async (t) => {
    await t.resizeWindow(1280, 900);
    await loginAs(t, "cashier");
  });

test("cashier is redirected from owner-only routes", async (t) => {
  await t.navigateTo("/categories");
  await t.expect(getPathname()).contains("/pos", { timeout: 10000 });
  await t.expect(getPathname()).notContains("/categories");
});

test("cashier sidebar hides owner management links", async (t) => {
  await t.expect(Selector('[data-testid="nav-pos"]').exists).ok();
  await t.expect(Selector('[data-testid="nav-categories"]').exists).notOk();
  await t.expect(Selector('[data-testid="nav-inventory"]').exists).notOk();
  await t.expect(Selector('[data-testid="nav-stores"]').exists).notOk();
  await t.expect(Selector('[data-testid="nav-users"]').exists).notOk();
  await t.expect(Selector('[data-testid="nav-sales"]').exists).notOk();
});
