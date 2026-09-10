import { describe, test, assert, assertEqual, assertOk } from "../helpers/runner.js";
import { ownerClient, cashierClient } from "../helpers/setup.js";
import { ApiClient } from "../helpers/client.js";
import { DEMO_CREDENTIALS } from "../fixtures/users.js";
import { uniqueGcashTxn, uniqueName } from "../fixtures/testData.js";
import { saleTotal } from "../helpers/client.js";

async function createSellableProduct(client: Awaited<ReturnType<typeof ownerClient>>) {
  const category = await client.request<{ id: string }>("POST", "/api/categories", {
    body: { name: uniqueName("SaleCat") },
    expectStatus: 201,
  });
  const price = 100;
  const product = await client.request<{ id: string }>("POST", "/api/products", {
    body: {
      name: uniqueName("SaleProduct"),
      categoryId: category.id,
      hasVariants: false,
      basePrice: price,
      stock: 20,
      status: "active",
    },
    expectStatus: 201,
  });
  return { productId: product.id, price };
}

describe("Sales", () => {
  test(
    "owner can create a cash sale",
    async () => {
      const client = await ownerClient();
      const users = await client.request<Array<{ id: string; role: string; name?: string }>>(
        "GET",
        "/api/org/users",
        { storeId: null },
      );
      const ownerUser = users.find((u) => u.role === "owner")!;
      const { productId, price } = await createSellableProduct(client);
      const total = saleTotal(price);

      const sale = await client.request<{ id: string; paymentMethod: string }>("POST", "/api/sales", {
        body: {
          cartItems: [{ productId, productName: "Test Product", quantity: 1, price, subtotal: price }],
          taxRate: 0.1,
          amountReceived: total,
          paymentMethod: "cash",
          cashierId: ownerUser.id,
          cashierName: ownerUser.name ?? "Owner",
        },
        expectStatus: 201,
      });

      assertOk(sale.id);
      assertEqual(sale.paymentMethod, "cash");

      const sales = await client.request<Array<{ id: string }>>("GET", "/api/sales");
      assert(sales.some((s) => s.id === sale.id), "sale should appear in sales list");
    },
    { tags: ["functional", "regression"] },
  );

  test(
    "owner can create a GCash sale with transaction ID",
    async () => {
      const client = await ownerClient();
      const users = await client.request<Array<{ id: string; role: string; name?: string }>>(
        "GET",
        "/api/org/users",
        { storeId: null },
      );
      const ownerUser = users.find((u) => u.role === "owner")!;
      const { productId, price } = await createSellableProduct(client);
      const total = saleTotal(price);
      const gcashTxn = uniqueGcashTxn();

      const sale = await client.request<{ id: string; paymentMethod: string; gcashTransactionId?: string }>(
        "POST",
        "/api/sales",
        {
          body: {
            cartItems: [{ productId, productName: "GCash Product", quantity: 1, price, subtotal: price }],
            taxRate: 0.1,
            amountReceived: total,
            paymentMethod: "gcash",
            gcashTransactionId: gcashTxn,
            cashierId: ownerUser.id,
            cashierName: ownerUser.name ?? "Owner",
          },
          expectStatus: 201,
        },
      );

      assertEqual(sale.paymentMethod, "gcash");
      assertEqual(sale.gcashTransactionId, gcashTxn);
    },
    { tags: ["functional", "regression"] },
  );

  test(
    "cashier can create a cash sale",
    async () => {
      const client = new ApiClient();
      await client.resetDemoPasswords();
      const login = await client.login(DEMO_CREDENTIALS.cashier.email, DEMO_CREDENTIALS.cashier.password);
      const products = await client.request<Array<{ id: string; name: string; basePrice?: number; price?: number }>>(
        "GET",
        "/api/products",
      );
      assert(products.length > 0, "cashier store should have at least one product");

      const product = products[0];
      const price = product.basePrice ?? product.price ?? 100;
      const total = saleTotal(price);

      const sale = await client.request<{ id: string }>("POST", "/api/sales", {
        body: {
          cartItems: [
            { productId: product.id, productName: product.name, quantity: 1, price, subtotal: price },
          ],
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
    { tags: ["functional", "regression"] },
  );
});
