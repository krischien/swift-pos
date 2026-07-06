import { describe, test, assertEqual } from "../../helpers/runner.js";
import { ApiClient, saleTotal } from "../../helpers/client.js";
import { ownerClient } from "../../helpers/setup.js";
import { uniqueName } from "../../fixtures/testData.js";

async function createProductForSale(client: ApiClient) {
  const category = await client.request<{ id: string }>("POST", "/api/categories", {
    body: { name: uniqueName("SaleCat") },
    expectStatus: 201,
  });
  const price = 200;
  const product = await client.request<{ id: string; name: string }>("POST", "/api/products", {
    body: {
      name: uniqueName("SaleProd"),
      categoryId: category.id,
      hasVariants: false,
      basePrice: price,
      stock: 50,
      status: "active",
    },
    expectStatus: 201,
  });
  return { product, price };
}

describe("Functional: Sales", () => {
  test(
    "owner can get sale by id, void count, and void a sale",
    async () => {
      const client = await ownerClient();
      const users = await client.request<Array<{ id: string; role: string; name?: string }>>(
        "GET",
        "/api/org/users",
        { storeId: null },
      );
      const ownerUser = users.find((u) => u.role === "owner")!;
      const { product, price } = await createProductForSale(client);
      const total = saleTotal(price, 0.1, 0);

      const created = await client.request<{ id: string; status?: string }>("POST", "/api/sales", {
        body: {
          cartItems: [{ productId: product.id, productName: product.name, quantity: 1, price, subtotal: price }],
          taxRate: 0.1,
          discountPercent: 0,
          amountReceived: total,
          paymentMethod: "cash",
          cashierId: ownerUser.id,
          cashierName: ownerUser.name ?? "Owner",
        },
        expectStatus: 201,
      });

      const fetched = await client.request<{ id: string }>("GET", `/api/sales/${created.id}`);
      assertEqual(fetched.id, created.id);

      const voidCount = await client.request<{ count: number }>("GET", "/api/sales/void-count");
      assertEqual(typeof voidCount.count, "number");

      const voided = await client.request<{ status?: string }>("POST", `/api/sales/${created.id}/void`);
      assertEqual((voided.status ?? "").toLowerCase(), "void");

      await client.request("POST", `/api/sales/${created.id}/void`, { expectStatus: 400 });
    },
    { tags: ["functional", "regression"] },
  );

  test(
    "insufficient payment returns 400",
    async () => {
      const client = await ownerClient();
      const users = await client.request<Array<{ id: string; role: string; name?: string }>>(
        "GET",
        "/api/org/users",
        { storeId: null },
      );
      const ownerUser = users.find((u) => u.role === "owner")!;
      const { product, price } = await createProductForSale(client);

      await client.request("POST", "/api/sales", {
        body: {
          cartItems: [{ productId: product.id, productName: product.name, quantity: 1, price, subtotal: price }],
          taxRate: 0.1,
          amountReceived: 1,
          paymentMethod: "cash",
          cashierId: ownerUser.id,
          cashierName: ownerUser.name ?? "Owner",
        },
        expectStatus: 400,
      });
    },
    { tags: ["functional", "regression"] },
  );
});
