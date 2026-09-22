import { Selector } from "testcafe";
import { loginAs } from "../helpers/auth";
import { clickNav } from "../helpers/navigation";

fixture("Canister Monitoring")
  .beforeEach(async (t) => {
    await t.resizeWindow(1280, 900);
    await loginAs(t, "owner");
  });

test("owner can enable and open the dedicated canister workspace", async (t) => {
  await clickNav(t, "nav-settings");
  const trackingSwitch = Selector("#cylinder-tracking");
  await t.expect(trackingSwitch.exists).ok({ timeout: 10000 });

  const wasEnabled = await trackingSwitch.getAttribute("data-state") === "checked";
  if (!wasEnabled) await t.click(trackingSwitch);

  const canisterNav = Selector('[data-testid="nav-canisters"]');
  await t.expect(canisterNav.exists).ok({ timeout: 10000 });
  await t.click(canisterNav);
  await t.expect(Selector("h1").withText("Canister Monitoring").exists).ok({ timeout: 10000 });
  await t.expect(Selector("button").withText("Outstanding").exists).ok();
  await t.expect(Selector("button").withText("Customers").exists).ok();
  await t.expect(Selector("button").withText("Suki Candidates").exists).ok();

  if (!wasEnabled) {
    await clickNav(t, "nav-settings");
    await t.click(trackingSwitch);
    await t.expect(canisterNav.exists).notOk({ timeout: 10000 });
  }
});

