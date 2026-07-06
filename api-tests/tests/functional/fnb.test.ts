import { describe, test, assert, assertEqual } from "../../helpers/runner.js";
import { ownerClient } from "../../helpers/setup.js";
import { uniqueName } from "../../fixtures/testData.js";

describe("Functional: F&B", () => {
  test(
    "owner can CRUD ingredients, menu, and recipe on F&B store",
    async () => {
      const client = await ownerClient();
      const stores = await client.getStores();
      client.stores = stores;
      const fnbStore = client.getStoreByMode("fnb");
      const fnb = client.withStore(fnbStore.id);

      const ingredient = await fnb.request<{ id: string; name: string }>("POST", "/api/ingredients", {
        body: { name: uniqueName("Ingredient"), sku: "ING-TEST", stock: 1000, unitOfMeasure: "g" },
        expectStatus: 201,
      });

      const ingredients = await fnb.request<Array<{ id: string }>>("GET", "/api/ingredients");
      assert(ingredients.some((i) => i.id === ingredient.id));

      await fnb.request("PATCH", `/api/ingredients/${ingredient.id}`, {
        body: { stock: 900 },
      });

      const menuCat = await fnb.request<{ id: string }>("POST", "/api/menu-categories", {
        body: { name: uniqueName("MenuCat") },
        expectStatus: 201,
      });

      const menuItem = await fnb.request<{ id: string }>("POST", "/api/menu-items", {
        body: { menuCategoryId: menuCat.id, name: uniqueName("MenuItem"), price: 99 },
        expectStatus: 201,
      });

      await fnb.request("PUT", `/api/menu-items/${menuItem.id}/recipe`, {
        body: { lines: [{ ingredientId: ingredient.id, quantity: 10 }] },
      });

      const menuItems = await fnb.request<Array<{ id: string }>>("GET", "/api/menu-items");
      assert(menuItems.some((m) => m.id === menuItem.id));

      await fnb.request("DELETE", `/api/menu-items/${menuItem.id}`, { expectStatus: 204 });
      await fnb.request("DELETE", `/api/menu-categories/${menuCat.id}`, { expectStatus: 204 });
      await fnb.request("DELETE", `/api/ingredients/${ingredient.id}`, { expectStatus: 204 });
    },
    { tags: ["functional", "regression"] },
  );

  test(
    "retail store rejects F&B ingredient create (403)",
    async () => {
      const client = await ownerClient();
      const stores = await client.getStores();
      client.stores = stores;
      const retail = client.withStore(client.getStoreByMode("retail").id);

      await retail.request("POST", "/api/ingredients", {
        body: { name: uniqueName("Blocked") },
        expectStatus: 403,
      });
    },
    { tags: ["functional", "regression"] },
  );
});
