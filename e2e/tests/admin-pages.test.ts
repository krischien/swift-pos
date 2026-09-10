import { Selector } from "testcafe";
import { loginAs } from "../helpers/auth";
import { getPathname } from "../helpers/browser";
import {
  AdminOrganizationsPage,
  AdminProductRankingPage,
  AdminPaymentMonitoringPage,
} from "../page-objects/ExtendedPages";
import { AdminDashboardPage } from "../page-objects/LoginPage";

fixture("Admin pages")
  .beforeEach(async (t) => {
    await t.resizeWindow(1280, 900);
    await loginAs(t, "admin");
  });

test("admin can view organizations list", async (t) => {
  await t.navigateTo("/admin/organizations");
  await t.expect(getPathname()).contains("/admin/organizations", { timeout: 10000 });
  await t.expect(AdminOrganizationsPage.heading.exists).ok({ timeout: 10000 });
});

test("admin can view product ranking", async (t) => {
  await t.navigateTo("/admin/product-ranking");
  await t.expect(AdminProductRankingPage.heading.exists).ok({ timeout: 10000 });
});

test("admin can view payment monitoring", async (t) => {
  await t.navigateTo("/admin/payment-monitoring");
  await t.expect(AdminPaymentMonitoringPage.heading.exists).ok({ timeout: 10000 });
});

test("admin dashboard loads", async (t) => {
  await t.navigateTo("/admin");
  await t.expect(AdminDashboardPage.heading.exists).ok({ timeout: 10000 });
});

test("admin can open org detail from list", async (t) => {
  await t.navigateTo("/admin/organizations");
  const firstRow = Selector("table tbody tr").nth(0);
  if (await firstRow.exists) {
    await t.click(firstRow);
    await t.expect(getPathname()).match(/\/admin\/organizations\/.+/, { timeout: 10000 });
  }
});
