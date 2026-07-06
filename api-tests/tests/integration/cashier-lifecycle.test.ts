import { describe, test, assert, assertEqual } from "../../helpers/runner.js";
import { ApiClient, saleTotal } from "../../helpers/client.js";
import { ownerClient } from "../../helpers/setup.js";
import { uniqueEmail, uniqueName } from "../../fixtures/testData.js";

describe("Integration: Cashier lifecycle", () => {
  test(
    "owner creates cashier who completes a sale then owner deletes cashier",
    async () => {
      const owner = await ownerClient();
      const email = uniqueEmail();
      const name = uniqueName("TempCashier");

      const cashier = await owner.request<{ id: string; email: string }>("POST", "/api/users", {
        body: { name, email, password: "TestPass123!", role: "cashier" },
        expectStatus: 201,
      });

      const cashierClient = new ApiClient();
      await cashierClient.login(email, "TestPass123!");

      const products = await cashierClient.request<Array<{ id: string; name: string; basePrice?: number; price?: number }>>(
        "GET",
        "/api/products",
      );
      assert(products.length > 0, "cashier should see products");
      const product = products[0];
      const price = product.basePrice ?? product.price ?? 100;
      const total = saleTotal(price);

      const sale = await cashierClient.request<{ id: string }>("POST", "/api/sales", {
        body: {
          cartItems: [{ productId: product.id, productName: product.name, quantity: 1, price, subtotal: price }],
          taxRate: 0.1,
          amountReceived: total,
          paymentMethod: "cash",
          cashierId: cashier.id,
          cashierName: name,
        },
        expectStatus: 201,
      });
      assertEqual(typeof sale.id, "string");

      await owner.request("DELETE", `/api/users/${cashier.id}`, { expectStatus: 204 });
    },
    { tags: ["integration", "regression"] },
  );
});
