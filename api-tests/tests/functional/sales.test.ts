import { describe, test, assertEqual, assert } from "../../helpers/runner.js";
import { ApiClient, saleTotal } from "../../helpers/client.js";
import { ownerClient, cashierClient } from "../../helpers/setup.js";
import { uniqueName } from "../../fixtures/testData.js";
import { saasPrisma } from "../../../server/saas/db.js";

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

function saleBody(
  product: { id: string; name: string },
  price: number,
  cashier: { id: string; name?: string },
) {
  const total = saleTotal(price, 0.1, 0);
  return {
    cartItems: [{ productId: product.id, productName: product.name, quantity: 1, price, subtotal: price }],
    taxRate: 0.1,
    discountPercent: 0,
    amountReceived: total,
    paymentMethod: "cash",
    cashierId: cashier.id,
    cashierName: cashier.name ?? "Cashier",
  };
}

describe("Functional: Sales", () => {
  test(
    "owner can get sale by id, void count, and void a sale with audit fields",
    async () => {
      const client = await ownerClient();
      const users = await client.request<Array<{ id: string; role: string; name?: string }>>(
        "GET",
        "/api/org/users",
        { storeId: null },
      );
      const ownerUser = users.find((u) => u.role === "owner")!;
      const { product, price } = await createProductForSale(client);

      const created = await client.request<{ id: string; status?: string }>("POST", "/api/sales", {
        body: saleBody(product, price, ownerUser),
        expectStatus: 201,
      });

      const fetched = await client.request<{ id: string }>("GET", `/api/sales/${created.id}`);
      assertEqual(fetched.id, created.id);

      const voidCount = await client.request<{ count: number }>("GET", "/api/sales/void-count");
      assertEqual(typeof voidCount.count, "number");

      const voided = await client.request<{
        status?: string;
        voidedById?: string;
        voidedByName?: string;
        voidedAt?: string;
      }>("POST", `/api/sales/${created.id}/void`);
      assertEqual((voided.status ?? "").toLowerCase(), "void");
      assertEqual(voided.voidedById, ownerUser.id);
      assert(voided.voidedByName, "voidedByName should be set");
      assert(voided.voidedAt, "voidedAt should be set");

      await client.request("POST", `/api/sales/${created.id}/void`, { expectStatus: 400 });
    },
    { tags: ["functional", "regression"] },
  );

  test(
    "cashier can void own sale from today; blocked on others and older sales",
    async () => {
      const owner = await ownerClient();
      const cashier = await cashierClient();
      const users = await owner.request<Array<{ id: string; role: string; name?: string; email?: string }>>(
        "GET",
        "/api/org/users",
        { storeId: null },
      );
      const ownerUser = users.find((u) => u.role === "owner")!;
      const cashierUser =
        users.find((u) => u.role === "cashier" && u.email?.includes("maria")) ??
        users.find((u) => u.role === "cashier")!;
      assert(cashierUser, "demo cashier user required");

      const { product, price } = await createProductForSale(owner);

      const ownSale = await cashier.request<{ id: string }>("POST", "/api/sales", {
        body: saleBody(product, price, cashierUser),
        expectStatus: 201,
      });

      const voidedOwn = await cashier.request<{
        status?: string;
        voidedById?: string;
        voidedByName?: string;
        voidedAt?: string;
      }>("POST", `/api/sales/${ownSale.id}/void`);
      assertEqual((voidedOwn.status ?? "").toLowerCase(), "void");
      assertEqual(voidedOwn.voidedById, cashierUser.id);
      assert(voidedOwn.voidedAt, "voidedAt should be set");

      const otherSale = await owner.request<{ id: string }>("POST", "/api/sales", {
        body: saleBody(product, price, ownerUser),
        expectStatus: 201,
      });
      await cashier.request("POST", `/api/sales/${otherSale.id}/void`, { expectStatus: 403 });

      const oldSale = await cashier.request<{ id: string }>("POST", "/api/sales", {
        body: saleBody(product, price, cashierUser),
        expectStatus: 201,
      });
      const yesterday = new Date();
      yesterday.setUTCDate(yesterday.getUTCDate() - 1);
      await saasPrisma.sale.update({
        where: { id: oldSale.id },
        data: { createdAt: yesterday },
      });
      await cashier.request("POST", `/api/sales/${oldSale.id}/void`, { expectStatus: 403 });

      await owner.request("POST", `/api/sales/${oldSale.id}/void`);
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
          ...saleBody(product, price, ownerUser),
          amountReceived: 1,
        },
        expectStatus: 400,
      });
    },
    { tags: ["functional", "regression"] },
  );
});
