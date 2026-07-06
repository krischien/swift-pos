import { Selector } from "testcafe";
import type { TestController } from "./types";

export async function waitForAppReady(t: TestController): Promise<void> {
  await t.expect(Selector('[data-testid="nav-pos"]').exists).ok({ timeout: 10000 });
}

export async function goTo(t: TestController, path: string): Promise<void> {
  await t.navigateTo(path);
  await waitForAppReady(t);
}

export async function clickNav(t: TestController, testId: string): Promise<void> {
  await t.click(Selector(`[data-testid="${testId}"]`));
}

export async function confirmAlertDialog(t: TestController, action = "Delete"): Promise<void> {
  const dialog = Selector('[role="alertdialog"]');
  await t.expect(dialog.exists).ok({ timeout: 5000 });
  await t.click(dialog.find("button").withText(action));
}
