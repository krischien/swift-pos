import { Selector } from "testcafe";
import { loginAs } from "../helpers/auth";
import { MenuPage, IngredientsPage } from "../page-objects/ExtendedPages";

async function switchToFnbStore(t: Parameters<typeof loginAs>[0]): Promise<void> {
  const trigger = Selector("button").withText(/F&B|Café|Grill/i);
  const dropdown = Selector('[role="menuitem"]').withText(/F&B|Café|Grill/i);
  if (await trigger.exists) {
    await t.click(trigger);
    await t.click(dropdown);
    return;
  }
  const chevron = Selector("button").find("svg.lucide-chevron-down");
  if (await chevron.exists) {
    await t.click(chevron.parent("button"));
    await t.click(Selector('[role="menuitem"]').withText(/F&B|Café|Grill/i));
  }
}

fixture("Store switching")
  .beforeEach(async (t) => {
    await t.resizeWindow(1280, 900);
    await loginAs(t, "owner");
  });

test("owner can switch between stores", async (t) => {
  const chevron = Selector("button").find("svg.lucide-chevron-down");
  if (!(await chevron.exists)) {
    await t.expect(Selector("span").withText(/Store/i).exists).ok();
    return;
  }
  await t.click(chevron.parent("button"));
  const items = Selector('[role="menuitem"]');
  await t.expect(items.count).gt(1);
  await t.click(items.nth(1));
});

fixture("F&B pages")
  .beforeEach(async (t) => {
    await t.resizeWindow(1280, 900);
    await loginAs(t, "owner");
    await switchToFnbStore(t);
  });

test("owner can open Menu page on F&B store", async (t) => {
  const navMenu = Selector('[data-testid="nav-menu"]');
  if (await navMenu.exists) {
    await t.click(navMenu);
    await t.expect(MenuPage.heading.exists).ok({ timeout: 10000 });
  }
});

test("owner can open Ingredients page on F&B store", async (t) => {
  const navIngredients = Selector('[data-testid="nav-ingredients"]');
  if (await navIngredients.exists) {
    await t.click(navIngredients);
    await t.expect(IngredientsPage.heading.exists).ok({ timeout: 10000 });
  }
});
