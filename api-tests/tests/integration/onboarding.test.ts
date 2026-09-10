import { describe, test, assert, assertEqual } from "../../helpers/runner.js";
import { ApiClient, saleTotal } from "../../helpers/client.js";
import { uniqueEmail, uniqueName } from "../../fixtures/testData.js";

describe("Integration: Onboarding", () => {
  test(
    "signup through sale and void lifecycle",
    async () => {
      const client = new ApiClient();
      const email = uniqueEmail();
      await client.signup({
        organizationName: uniqueName("OnboardOrg"),
        storeName: uniqueName("OnboardStore"),
        adminEmail: email,
        adminPassword: "TestPass123!",
      });

      const category = await client.request<{ id: string }>("POST", "/api/categories", {
        body: { name: uniqueName("OnboardCat") },
        expectStatus: 201,
      });

      const price = 150;
      const product = await client.request<{ id: string; name: string }>("POST", "/api/products", {
        body: {
          name: uniqueName("OnboardProd"),
          categoryId: category.id,
          hasVariants: false,
          basePrice: price,
          stock: 20,
          status: "active",
        },
        expectStatus: 201,
      });

      const users = await client.request<Array<{ id: string; role: string; name?: string }>>(
        "GET",
        "/api/org/users",
        { storeId: null },
      );
      const ownerUser = users.find((u) => u.role === "owner")!;

      const total = saleTotal(price);
      const sale = await client.request<{ id: string }>("POST", "/api/sales", {
        body: {
          cartItems: [{ productId: product.id, productName: product.name, quantity: 1, price, subtotal: price }],
          taxRate: 0.1,
          amountReceived: total,
          paymentMethod: "cash",
          cashierId: ownerUser.id,
          cashierName: ownerUser.name ?? "Owner",
        },
        expectStatus: 201,
      });

      const sales = await client.request<Array<{ id: string }>>("GET", "/api/sales");
      assert(sales.some((s) => s.id === sale.id));

      await client.request("POST", `/api/sales/${sale.id}/void`);
      const voided = await client.request<{ status?: string }>("GET", `/api/sales/${sale.id}`);
      assertEqual((voided.status ?? "").toLowerCase(), "void");
    },
    { tags: ["integration", "regression"] },
  );
});
