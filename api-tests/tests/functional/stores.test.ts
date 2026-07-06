import { describe, test, assert, assertEqual } from "../../helpers/runner.js";
import { ownerClient } from "../../helpers/setup.js";
import { uniqueName } from "../../fixtures/testData.js";

describe("Functional: Stores", () => {
  test(
    "owner can create, update, and delete an org store",
    async () => {
      const client = await ownerClient();
      const name = uniqueName("Store");

      const created = await client.request<{ id: string; name: string }>("POST", "/api/org/stores", {
        body: { name, address: "123 Test St" },
        storeId: null,
        expectStatus: 201,
      });
      assertEqual(created.name, name);

      const updatedName = `${name}-updated`;
      const updated = await client.request<{ name: string }>("PATCH", `/api/org/stores/${created.id}`, {
        body: { name: updatedName },
        storeId: null,
      });
      assertEqual(updated.name, updatedName);

      const orgStores = await client.request<Array<{ id: string }>>("GET", "/api/org/stores", {
        storeId: null,
      });
      assert(orgStores.some((s) => s.id === created.id), "store in org list");

      await client.request("DELETE", `/api/org/stores/${created.id}`, { storeId: null, expectStatus: 204 });
    },
    { tags: ["functional", "regression"] },
  );

  test(
    "owner can GET and PATCH active store",
    async () => {
      const client = await ownerClient();
      const store = await client.request<{ id: string; name: string }>("GET", "/api/store");
      assertEqual(typeof store.name, "string");

      const newName = `${store.name}-patched`;
      const patched = await client.request<{ name: string }>("PATCH", "/api/store", {
        body: { name: newName },
      });
      assertEqual(patched.name, newName);

      await client.request("PATCH", "/api/store", { body: { name: store.name } });
    },
    { tags: ["functional", "regression"] },
  );

  test(
    "PATCH store rejects businessMode change",
    async () => {
      const client = await ownerClient();
      await client.request("PATCH", "/api/store", {
        body: { businessMode: "fnb" },
        expectStatus: 400,
      });
    },
    { tags: ["functional", "regression"] },
  );
});
