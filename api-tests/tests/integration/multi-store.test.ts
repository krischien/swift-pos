import { describe, test, assert, assertEqual } from "../../helpers/runner.js";
import { ownerClient } from "../../helpers/setup.js";
import { uniqueName } from "../../fixtures/testData.js";

describe("Integration: Multi-store", () => {
  test(
    "categories are isolated per store",
    async () => {
      const client = await ownerClient();
      const storeA = client.storeId!;
      const stores = await client.getStores();
      const storeBEntry = stores.find((s) => s.id !== storeA);
      assert(storeBEntry, "need second store");

      const catName = uniqueName("StoreCat");
      const created = await client.request<{ id: string }>("POST", "/api/categories", {
        body: { name: catName },
        expectStatus: 201,
      });

      const storeB = client.withStore(storeBEntry.id);
      const listB = await storeB.request<Array<{ id: string; name: string }>>("GET", "/api/categories");
      assert(!listB.some((c) => c.id === created.id), "category should not appear in other store");

      const listA = await client.request<Array<{ id: string }>>("GET", "/api/categories");
      assert(listA.some((c) => c.id === created.id));

      await client.request("DELETE", `/api/categories/${created.id}`, { expectStatus: 204 });
    },
    { tags: ["integration", "regression"] },
  );

  test(
    "owner can create a new store and CRUD within it",
    async () => {
      const client = await ownerClient();
      const name = uniqueName("NewStore");

      const store = await client.request<{ id: string; name: string }>("POST", "/api/org/stores", {
        body: { name },
        storeId: null,
        expectStatus: 201,
      });
      assertEqual(store.name, name);

      const scoped = client.withStore(store.id);
      const cat = await scoped.request<{ id: string }>("POST", "/api/categories", {
        body: { name: uniqueName("NewStoreCat") },
        expectStatus: 201,
      });
      assertEqual(typeof cat.id, "string");

      await scoped.request("DELETE", `/api/categories/${cat.id}`, { expectStatus: 204 });
      await client.request("DELETE", `/api/org/stores/${store.id}`, { storeId: null, expectStatus: 204 });
    },
    { tags: ["integration", "regression"] },
  );
});
