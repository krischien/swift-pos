import { describe, test, assert, assertEqual, assertOk } from "../helpers/runner.js";
import { ApiClient } from "../helpers/client.js";
import { DEMO_CREDENTIALS } from "../fixtures/users.js";

describe("Auth", () => {
  const client = new ApiClient();

  test(
    "owner can log in and receives token + stores",
    async () => {
      await client.resetDemoPasswords();
      const data = await client.login(DEMO_CREDENTIALS.owner.email, DEMO_CREDENTIALS.owner.password);
      assertOk(data.token);
      assertEqual(data.user.role, "owner");
      assert(data.stores.length > 0, "owner should have at least one store");
      assertOk(client.storeId);
    },
    { tags: ["functional", "regression"] },
  );

  test(
    "cashier can log in",
    async () => {
      const c = new ApiClient();
      await c.resetDemoPasswords();
      const data = await c.login(DEMO_CREDENTIALS.cashier.email, DEMO_CREDENTIALS.cashier.password);
      assertEqual(data.user.role, "cashier");
      assertOk(data.token);
    },
    { tags: ["functional", "regression"] },
  );

  test(
    "admin can log in as super_admin",
    async () => {
      const data = await client.login(DEMO_CREDENTIALS.admin.email, DEMO_CREDENTIALS.admin.password);
      assertEqual(data.user.role, "super_admin");
      assertOk(data.token);
    },
    { tags: ["functional", "regression"] },
  );

  test(
    "invalid password returns 401",
    async () => {
      const c = new ApiClient();
      await c.request("POST", "/api/auth/login", {
        body: { email: DEMO_CREDENTIALS.owner.email, password: "wrong-password" },
        auth: false,
        expectStatus: 401,
      });
    },
    { tags: ["functional", "regression"] },
  );

  test(
    "missing credentials returns 400",
    async () => {
      const c = new ApiClient();
      await c.request("POST", "/api/auth/login", {
        body: { email: "", password: "" },
        auth: false,
        expectStatus: 400,
      });
    },
    { tags: ["functional", "regression"] },
  );

  test(
    "protected route without token returns 401",
    async () => {
      const c = new ApiClient();
      await c.request("GET", "/api/categories", { auth: false, expectStatus: 401 });
    },
    { tags: ["functional", "regression"] },
  );
});
