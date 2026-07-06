import { describe, test, assert, assertEqual, assertOk } from "../helpers/runner.js";
import { ownerClient } from "../helpers/setup.js";
import { uniqueName } from "../fixtures/testData.js";

describe("Categories CRUD", () => {
  test(
    "owner can create, update, and delete a category",
    async () => {
      const client = await ownerClient();
      const name = uniqueName("Category");
      const updatedName = `${name}-updated`;

      const created = await client.request<{ id: string; name: string }>("POST", "/api/categories", {
        body: { name },
        expectStatus: 201,
      });
      assertEqual(created.name, name);
      assertOk(created.id);

      const updated = await client.request<{ id: string; name: string }>(
        "PUT",
        `/api/categories/${created.id}`,
        { body: { name: updatedName } },
      );
      assertEqual(updated.name, updatedName);

      const list = await client.request<Array<{ id: string; name: string }>>("GET", "/api/categories");
      assert(list.some((c) => c.id === created.id && c.name === updatedName), "category should appear in list");

      await client.request("DELETE", `/api/categories/${created.id}`, { expectStatus: 204 });

      const afterDelete = await client.request<Array<{ id: string }>>("GET", "/api/categories");
      assert(!afterDelete.some((c) => c.id === created.id), "category should be deleted");
    },
    { tags: ["functional", "regression"] },
  );
});

describe("Products CRUD", () => {
  test(
    "owner can create and delete a product",
    async () => {
      const client = await ownerClient();
      const categoryName = uniqueName("Cat");
      const category = await client.request<{ id: string }>("POST", "/api/categories", {
        body: { name: categoryName },
        expectStatus: 201,
      });

      const productName = uniqueName("Product");
      const product = await client.request<{ id: string; name: string }>("POST", "/api/products", {
        body: {
          name: productName,
          categoryId: category.id,
          hasVariants: false,
          basePrice: 100,
          stock: 10,
          status: "active",
        },
        expectStatus: 201,
      });
      assertEqual(product.name, productName);

      const fetched = await client.request<{ id: string; name: string }>("GET", `/api/products/${product.id}`);
      assertEqual(fetched.name, productName);

      await client.request("DELETE", `/api/products/${product.id}`, { expectStatus: 204 });
      await client.request("DELETE", `/api/categories/${category.id}`, { expectStatus: 204 });
    },
    { tags: ["functional", "regression"] },
  );
});
