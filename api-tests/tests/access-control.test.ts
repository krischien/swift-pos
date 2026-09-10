import { describe, test, assertEqual } from "../helpers/runner.js";
import { ownerClient, cashierClient } from "../helpers/setup.js";
import { DEMO_CREDENTIALS } from "../fixtures/users.js";
import { uniqueName } from "../fixtures/testData.js";

describe("Access control", () => {
  test(
    "cashier cannot create categories (403)",
    async () => {
      const client = await cashierClient();
      await client.request("POST", "/api/categories", {
        body: { name: uniqueName("Blocked") },
        expectStatus: 403,
      });
    },
    { tags: ["functional", "regression"] },
  );

  test(
    "cashier cannot create products (403)",
    async () => {
      const client = await cashierClient();
      await client.request("POST", "/api/products", {
        body: {
          name: uniqueName("Blocked"),
          categoryId: "fake-id",
          hasVariants: false,
          basePrice: 50,
          stock: 1,
        },
        expectStatus: 403,
      });
    },
    { tags: ["functional", "regression"] },
  );

  test(
    "cashier can read categories and products",
    async () => {
      const client = await cashierClient();
      const categories = await client.request<unknown[]>("GET", "/api/categories");
      const products = await client.request<unknown[]>("GET", "/api/products");
      assertEqual(Array.isArray(categories), true);
      assertEqual(Array.isArray(products), true);
    },
    { tags: ["functional", "regression"] },
  );

  test(
    "owner can list org users",
    async () => {
      const client = await ownerClient();
      const users = await client.request<Array<{ email: string }>>("GET", "/api/org/users", {
        storeId: null,
      });
      assertEqual(Array.isArray(users), true);
      assertEqual(users.some((u) => u.email === DEMO_CREDENTIALS.owner.email), true);
    },
    { tags: ["functional", "regression"] },
  );

  test(
    "cashier cannot list org users (403)",
    async () => {
      const client = await cashierClient();
      await client.request("GET", "/api/org/users", { storeId: null, expectStatus: 403 });
    },
    { tags: ["functional", "regression"] },
  );
});

describe("Stores", () => {
  test(
    "owner can list org stores",
    async () => {
      const client = await ownerClient();
      const stores = await client.request<Array<{ id: string; name: string }>>("GET", "/api/stores", {
        storeId: null,
      });
      assertEqual(Array.isArray(stores), true);
      assertEqual(stores.length > 0, true);
    },
    { tags: ["functional", "regression"] },
  );
});
