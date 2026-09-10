import { describe, test, assertHasKeys } from "../../helpers/runner.js";
import { ownerClient } from "../../helpers/setup.js";
import { DEMO_CREDENTIALS } from "../../fixtures/users.js";

describe("Regression: Contracts", () => {
  test(
    "login response has expected shape",
    async () => {
      const client = await ownerClient();
      const { data } = await client.rawRequest("POST", "/api/auth/login", {
        body: { email: DEMO_CREDENTIALS.owner.email, password: DEMO_CREDENTIALS.owner.password },
        auth: false,
      });
      const body = data as Record<string, unknown>;
      assertHasKeys(body, ["token", "user", "stores"], "login");
      assertHasKeys(body.user as Record<string, unknown>, ["id", "email", "role"], "login.user");
    },
    { tags: ["regression"] },
  );

  test(
    "product response has expected shape",
    async () => {
      const client = await ownerClient();
      const products = await client.request<Array<Record<string, unknown>>>("GET", "/api/products");
      if (products.length === 0) return;
      assertHasKeys(products[0], ["id", "name"], "product");
    },
    { tags: ["regression"] },
  );

  test(
    "sale response has expected shape",
    async () => {
      const client = await ownerClient();
      const sales = await client.request<Array<Record<string, unknown>>>("GET", "/api/sales");
      if (sales.length === 0) return;
      assertHasKeys(sales[0], ["id", "total", "paymentMethod"], "sale");
    },
    { tags: ["regression"] },
  );
});
