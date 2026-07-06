import { loginAs } from "../helpers/auth";
import { clickNav } from "../helpers/navigation";
import { ReportsPage, SettingsPage } from "../page-objects/ExtendedPages";

fixture("Reports and Settings")
  .beforeEach(async (t) => {
    await t.resizeWindow(1280, 900);
    await loginAs(t, "owner");
  });

test("owner can open Reports page", async (t) => {
  await clickNav(t, "nav-reports");
  await t.expect(ReportsPage.heading.exists).ok({ timeout: 10000 });
});

test("owner can open Settings page", async (t) => {
  await clickNav(t, "nav-settings");
  await t.expect(SettingsPage.heading.exists).ok({ timeout: 10000 });
});
