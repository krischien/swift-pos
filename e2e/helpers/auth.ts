import { Selector } from "testcafe";
import type { TestController } from "./types";
import { DEMO_CREDENTIALS, type DemoRole } from "../fixtures/users";
import { getPathname } from "./browser";

const signInButton = Selector('button[type="submit"]').withText("Sign In");
const emailInput = Selector("#email");
const passwordInput = Selector("#password");

export async function loginAs(t: TestController, role: DemoRole): Promise<void> {
  const { email, password } = DEMO_CREDENTIALS[role];

  await t.navigateTo("/login");
  await t.typeText(emailInput, email, { replace: true });
  await t.typeText(passwordInput, password, { replace: true });
  await t.click(signInButton);

  if (role === "admin") {
    await t.expect(getPathname()).contains("/admin", { timeout: 15000 });
    await t.expect(Selector("h1").withText("Dashboard").exists).ok({ timeout: 15000 });
  } else {
    await t.expect(getPathname()).contains("/pos", { timeout: 15000 });
    await t.expect(Selector('[data-testid="nav-pos"]').exists).ok({ timeout: 15000 });
  }
}

export async function loginWithCredentials(
  t: TestController,
  email: string,
  password: string,
): Promise<void> {
  await t.navigateTo("/login");
  await t.typeText(emailInput, email, { replace: true });
  await t.typeText(passwordInput, password, { replace: true });
  await t.click(signInButton);
}

export async function logout(t: TestController): Promise<void> {
  const logoutBtn = Selector("button").withText("Logout");
  if (await logoutBtn.exists) {
    await t.click(logoutBtn);
    await t.expect(Selector("#email").exists).ok({ timeout: 10000 });
  }
}
