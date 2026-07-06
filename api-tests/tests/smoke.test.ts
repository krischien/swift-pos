import { describe, test, assert, assertEqual, assertOk } from "../helpers/runner.js";
import { ApiClient, saleTotal } from "../helpers/client.js";
import { DEMO_CREDENTIALS } from "../fixtures/users.js";
import { ensureDemoData } from "../helpers/setup.js";

describe("Smoke", () => {
  test(
    "GET /api/health returns ok",
    async () => {
      const client = new ApiClient();
      const data = await client.request<{ status: string; mode: string }>("GET", "/api/health", {
        auth: false,
      });
      assertEqual(data.status, "ok");
      assertEqual(data.mode, "saas");
    },
    { tags: ["smoke", "regression"] },
  );

  test(
    "owner can log in",
    async () => {
      const client = new ApiClient();
      await client.resetDemoPasswords();
      const data = await client.login(DEMO_CREDENTIALS.owner.email, DEMO_CREDENTIALS.owner.password);
      assertOk(data.token);
      assertEqual(data.user.role, "owner");
    },
    { tags: ["smoke", "regression"] },
  );

  test(
    "cashier can log in",
    async () => {
      const client = new ApiClient();
      await ensureDemoData(client);
      const data = await client.login(DEMO_CREDENTIALS.cashier.email, DEMO_CREDENTIALS.cashier.password);
      assertOk(data.token);
      assertEqual(data.user.role, "cashier");
    },
    { tags: ["smoke", "regression"] },
  );

  test(
    "admin can log in",
    async () => {
      const client = new ApiClient();
      const data = await client.login(DEMO_CREDENTIALS.admin.email, DEMO_CREDENTIALS.admin.password);
      assertOk(data.token);
      assertEqual(data.user.role, "super_admin");
    },
    { tags: ["smoke", "regression"] },
  );

  test(
    "owner can list stores and products",
    async () => {
      const client = new ApiClient();
      await ensureDemoData(client);
      const stores = await client.request<unknown[]>("GET", "/api/stores", { storeId: null });
      const products = await client.request<unknown[]>("GET", "/api/products");
      assert(Array.isArray(stores) && stores.length > 0, "stores should be non-empty");
      assert(Array.isArray(products), "products should be an array");
    },
    { tags: ["smoke", "regression"] },
  );

  test(
    "owner can complete a minimal cash sale",
    async () => {
      const client = new ApiClient();
      const login = await ensureDemoData(client);
      const products = await client.request<Array<{ id: string; name: string; basePrice?: number; price?: number }>>(
        "GET",
        "/api/products",
      );
      assert(products.length > 0, "need at least one product");
      const product = products[0];
      const price = product.basePrice ?? product.price ?? 100;
      const total = saleTotal(price);

      const sale = await client.request<{ id: string }>("POST", "/api/sales", {
        body: {
          cartItems: [{ productId: product.id, productName: product.name, quantity: 1, price, subtotal: price }],
          taxRate: 0.1,
          amountReceived: total,
          paymentMethod: "cash",
          cashierId: login.user.id,
          cashierName: login.user.name ?? login.user.email,
        },
        expectStatus: 201,
      });
      assertOk(sale.id);
    },
    { tags: ["smoke", "regression"] },
  );
});
