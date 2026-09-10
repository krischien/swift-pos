import { Selector } from "testcafe";
import type { TestController } from "../helpers/types";
import { loginAs } from "../helpers/auth";
import { uniqueEmail, uniqueName } from "../fixtures/testData";
import { SignupPage } from "../page-objects/ExtendedPages";
import { getPathname } from "../helpers/browser";

fixture("Signup")
  .beforeEach(async (t) => {
    await t.resizeWindow(1280, 900);
  });

test("user can sign up and land on POS", async (t) => {
  const email = uniqueEmail();
  await t.navigateTo("/signup");
  await t.typeText(SignupPage.orgInput, uniqueName("Org"), { replace: true });
  await t.typeText(SignupPage.storeInput, uniqueName("Store"), { replace: true });
  await t.typeText(SignupPage.emailInput, email, { replace: true });
  await t.typeText(SignupPage.passwordInput, "TestPass123!", { replace: true });
  await t.click(SignupPage.submit);
  await t.expect(getPathname()).contains("/pos", { timeout: 15000 });
  await t.expect(Selector('[data-testid="nav-pos"]').exists).ok({ timeout: 10000 });
});
