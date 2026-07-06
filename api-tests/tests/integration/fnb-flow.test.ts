import { describe, test, assertEqual } from "../../helpers/runner.js";
import { ownerClient } from "../../helpers/setup.js";
import { saleTotal } from "../../helpers/client.js";
import { uniqueName } from "../../fixtures/testData.js";

describe("Integration: F&B flow", () => {
  test(
    "ingredient to menu item to F&B sale",
    async () => {
      const client = await ownerClient();
      const stores = await client.getStores();
      client.stores = stores;
      const fnb = client.withStore(client.getStoreByMode("fnb").id);

      const ingredient = await fnb.request<{ id: string; stock: number }>("POST", "/api/ingredients", {
        body: { name: uniqueName("FlowIng"), sku: "FLOW-1", stock: 5000, unitOfMeasure: "g" },
        expectStatus: 201,
      });
      const stockBefore = ingredient.stock;

      const menuCat = await fnb.request<{ id: string }>("POST", "/api/menu-categories", {
        body: { name: uniqueName("FlowMenuCat") },
        expectStatus: 201,
      });

      const menuItem = await fnb.request<{ id: string; name: string; price: number }>(
        "POST",
        "/api/menu-items",
        {
          body: { menuCategoryId: menuCat.id, name: uniqueName("FlowItem"), price: 50 },
          expectStatus: 201,
        },
      );

      await fnb.request("PUT", `/api/menu-items/${menuItem.id}/recipe`, {
        body: { lines: [{ ingredientId: ingredient.id, quantity: 100 }] },
      });

      const users = await client.request<Array<{ id: string; role: string; name?: string }>>(
        "GET",
        "/api/org/users",
        { storeId: null },
      );
      const ownerUser = users.find((u) => u.role === "owner")!;
      const price = menuItem.price;
      const total = saleTotal(price);

      await fnb.request("POST", "/api/sales", {
        body: {
          cartItems: [
            { menuItemId: menuItem.id, productName: menuItem.name, quantity: 1, price, subtotal: price },
          ],
          taxRate: 0.1,
          amountReceived: total,
          paymentMethod: "cash",
          cashierId: ownerUser.id,
          cashierName: ownerUser.name ?? "Owner",
        },
        expectStatus: 201,
      });

      const ingredientsAfter = await fnb.request<Array<{ id: string; stock: number }>>("GET", "/api/ingredients");
      const updated = ingredientsAfter.find((i) => i.id === ingredient.id);
      if (updated) {
        assertEqual(updated.stock < stockBefore, true);
      }

      // Menu item may have sale FK — skip delete after sale; clean up ingredient only if unused
      await fnb.request("DELETE", `/api/menu-categories/${menuCat.id}`, { expectStatus: 204 }).catch(() => {});
      await fnb.request("DELETE", `/api/ingredients/${ingredient.id}`, { expectStatus: 204 }).catch(() => {});
    },
    { tags: ["integration", "regression"] },
  );
});
