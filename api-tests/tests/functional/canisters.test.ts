import { describe, test, assert, assertEqual } from "../../helpers/runner.js";
import { ownerClient, cashierClient } from "../../helpers/setup.js";
import { uniqueName } from "../../fixtures/testData.js";

describe("Functional: Canister monitoring", () => {
  test(
    "customer-linked sale collects deposits and supports partial returns and manual Suki",
    async () => {
      const owner = await ownerClient();
      let storeId: string;
      try {
        storeId = owner.getStoreByMode("canister").id;
      } catch {
        const created = await owner.request<{ id: string }>("POST", "/api/org/stores", {
          body: { name: uniqueName("Canister Shop"), businessMode: "canister" },
          expectStatus: 201,
          storeId: null,
        });
        storeId = created.id;
      }
      const client = owner.withStore(storeId);
      await client.request("PATCH", "/api/store", {
        body: { collectCylinderDeposits: true },
      });

      const category = await client.request<{ id: string }>("POST", "/api/categories", {
        body: { name: uniqueName("CanisterCat") },
        expectStatus: 201,
      });
      const product = await client.request<{ id: string; name: string }>("POST", "/api/products", {
        body: {
          name: uniqueName("11kg LPG"),
          categoryId: category.id,
          itemCode: uniqueName("LPG"),
          hasVariants: false,
          price: 900,
          stock: 10,
          lowStockThreshold: 2,
          tracksCylinder: true,
          cylinderSize: "11kg",
          depositAmount: 500,
        },
        expectStatus: 201,
      });
      const customer = await client.request<{ id: string; qrToken: string }>("POST", "/api/customers", {
        body: { name: uniqueName("Canister Customer"), phone: "09171234567" },
        expectStatus: 201,
      });
      assert(!customer.qrToken.includes("09171234567"), "QR token must not contain customer PII");
      await client.request("POST", "/api/customers", {
        body: { name: uniqueName("Duplicate Phone"), phone: "0917 123 4567" },
        expectStatus: 400,
      });

      const users = await client.request<Array<{ id: string; role: string; name: string }>>(
        "GET",
        "/api/org/users",
        { storeId: null },
      );
      const actor = users.find((user) => user.role === "owner")!;
      const merchandiseTotal = 1_800 * 1.1;
      const sale = await client.request<{
        id: string;
        depositAmount: number;
        amountDue: number;
        customerId: string;
      }>("POST", "/api/sales", {
        body: {
          cartItems: [{
            productId: product.id,
            productName: product.name,
            quantity: 2,
            price: 900,
            subtotal: 1_800,
            broughtEmptyQuantity: 0,
          }],
          taxRate: 0.1,
          discountPercent: 0,
          amountReceived: merchandiseTotal + 1_000,
          cashierId: actor.id,
          cashierName: actor.name,
          customerId: customer.id,
        },
        expectStatus: 201,
      });
      assertEqual(sale.customerId, customer.id);
      assertEqual(sale.depositAmount, 1_000);
      assertEqual(sale.amountDue, merchandiseTotal + 1_000);

      const loans = await client.request<Array<{
        id: string;
        saleId: string;
        quantity: number;
        returnedQuantity: number;
        status: string;
      }>>("GET", "/api/cylinder-loans?status=all");
      const loan = loans.find((row) => row.saleId === sale.id);
      assert(loan, "sale should create a customer-linked canister loan");
      assertEqual(loan!.quantity, 2);

      const partial = await client.request<{ returnedQuantity: number; status: string }>(
        "POST",
        `/api/cylinder-loans/${loan!.id}/return`,
        { body: { quantity: 1, refundAmount: 500, note: "API test partial return" } },
      );
      assertEqual(partial.returnedQuantity, 1);
      assertEqual(partial.status, "partial");

      const suki = await client.request<{ isSuki: boolean }>(
        "POST",
        `/api/customers/${customer.id}/suki`,
        { body: { enabled: true, note: "Frequent and trusted" } },
      );
      assertEqual(suki.isSuki, true);

      const cashier = (await cashierClient()).withStore(storeId);
      await cashier.request("POST", `/api/customers/${customer.id}/suki`, {
        body: { enabled: false },
        expectStatus: 403,
      });
    },
    { tags: ["functional", "regression"] },
  );
});

