import { describe, test, assert, assertEqual } from "../../helpers/runner.js";
import { adminClient, ownerClient, cashierClient } from "../../helpers/setup.js";
import { uniqueEmail, uniqueName } from "../../fixtures/testData.js";
import { DEMO_CREDENTIALS } from "../../fixtures/users.js";

describe("Functional: Admin", () => {
  test(
    "super admin can access overview, organizations, stores, and reports",
    async () => {
      const admin = await adminClient();

      await admin.request("GET", "/api/admin/overview", { storeId: null });
      const orgs = await admin.request<unknown[]>("GET", "/api/admin/organizations", { storeId: null });
      assert(Array.isArray(orgs));

      await admin.request("GET", "/api/admin/stores", { storeId: null });
      await admin.request("GET", "/api/admin/reports/product-ranking", { storeId: null });
      await admin.request("GET", "/api/admin/payment-monitoring", { storeId: null });
    },
    { tags: ["functional", "regression"] },
  );

  test(
    "super admin can create and delete an organization",
    async () => {
      const admin = await adminClient();
      const orgName = uniqueName("AdminOrg");
      const email = uniqueEmail();

      const created = await admin.request<{ id: string; name: string }>("POST", "/api/admin/organizations", {
        body: {
          name: orgName,
          storeName: uniqueName("AdminStore"),
          ownerEmail: email,
          ownerPassword: "TestPass123!",
          ownerName: "Admin Created Owner",
        },
        storeId: null,
        expectStatus: 201,
      });
      assertEqual(created.name, orgName);

      const detail = await admin.request<{ id: string }>("GET", `/api/admin/organizations/${created.id}`, {
        storeId: null,
      });
      assertEqual(detail.id, created.id);

      await admin.request("DELETE", `/api/admin/api/admin/organizations/${created.id}`, {
        storeId: null,
        expectStatus: 204,
      });
    },
    { tags: ["functional", "regression"] },
  );

  test(
    "super admin can seed demo via admin endpoint",
    async () => {
      const admin = await adminClient();
      const result = await admin.request<{ message?: string }>("POST", "/api/admin/seed-demo", {
        storeId: null,
      });
      assertEqual(typeof result.message, "string");
    },
    { tags: ["functional", "regression"] },
  );

  test(
    "owner and cashier cannot access admin overview (403)",
    async () => {
      const owner = await ownerClient();
      await owner.request("GET", "/api/admin/overview", { storeId: null, expectStatus: 403 });

      const cashier = await cashierClient();
      await cashier.request("GET", "/api/admin/overview", { storeId: null, expectStatus: 403 });
    },
    { tags: ["functional", "regression"] },
  );
});
