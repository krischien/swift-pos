import { Selector } from "testcafe";
import { loginAs, loginWithCredentials } from "../helpers/auth";
import { getPathname } from "../helpers/browser";
import { LoginPage } from "../page-objects/LoginPage";
import { AdminDashboardPage } from "../page-objects/AdminDashboardPage";
import { DEMO_CREDENTIALS } from "../fixtures/users";

import { BASE_URL } from "../fixtures/baseUrl";

fixture("Login")
  .page(`${BASE_URL}/login`)
  .beforeEach(async (t) => {
    await t.resizeWindow(1280, 900);
  });

test("admin can log in successfully", async (t) => {
  await loginAs(t, "admin");
  await t.expect(AdminDashboardPage.heading.exists).ok();
  await t.expect(getPathname()).contains("/admin");
});

test("owner can log in successfully", async (t) => {
  await loginAs(t, "owner");
  await t.expect(Selector('[data-testid="nav-pos"]').exists).ok();
  await t.expect(getPathname()).contains("/pos");
});

test("cashier can log in successfully", async (t) => {
  await loginAs(t, "cashier");
  await t.expect(Selector('[data-testid="nav-pos"]').exists).ok();
  await t.expect(getPathname()).contains("/pos");
});

test("invalid credentials show error", async (t) => {
  await loginWithCredentials(t, DEMO_CREDENTIALS.owner.email, "wrong-password");
  await t
    .expect(Selector("*").withText(/Login failed|Invalid credentials/i).exists)
    .ok({ timeout: 10000 });
  await t.expect(getPathname()).contains("/login");
});

test("empty form cannot submit", async (t) => {
  await t.click(LoginPage.signIn);
  await t.expect(getPathname()).contains("/login");
  const emailValid = await t.eval(() => {
    const el = document.querySelector("#email") as HTMLInputElement | null;
    return el?.validity.valid ?? true;
  });
  await t.expect(emailValid).notOk();
});

test("cashier cannot access admin dashboard", async (t) => {
  await loginAs(t, "cashier");
  await t.navigateTo("/admin");
  await t.expect(getPathname()).notContains("/admin", { timeout: 10000 });
  await t.expect(AdminDashboardPage.heading.exists).notOk();
});
