import { describe, test, assert, assertEqual, assertOk } from "../../helpers/runner.js";
import { ownerClient } from "../../helpers/setup.js";

describe("Functional: Org", () => {
  test(
    "owner can GET and PATCH org profile",
    async () => {
      const client = await ownerClient();
      const org = await client.request<{ id: string; name: string; phone?: string }>("GET", "/api/org", {
        storeId: null,
      });
      assertOk(org);
      assertEqual(typeof org.name, "string");

      const phone = "+63 900 000 0001";
      const patched = await client.request<{ phone?: string }>("PATCH", "/api/org", {
        body: { phone },
        storeId: null,
      });
      assertEqual(patched.phone, phone);
    },
    { tags: ["functional", "regression"] },
  );

  test(
    "owner can list notifications",
    async () => {
      const client = await ownerClient();
      const notifications = await client.request<unknown[]>("GET", "/api/notifications", {
        storeId: null,
      });
      assert(Array.isArray(notifications), "notifications should be array");
    },
    { tags: ["functional", "regression"] },
  );
});
