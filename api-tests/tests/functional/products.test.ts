import { describe, test, assert, assertEqual } from "../../helpers/runner.js";
import { ownerClient } from "../../helpers/setup.js";
import { uniqueName } from "../../fixtures/testData.js";

describe("Functional: Products", () => {
  test(
    "owner can update product and manage variants",
    async () => {
      const client = await ownerClient();

      const category = await client.request<{ id: string }>("POST", "/api/categories", {
        body: { name: uniqueName("ProdCat") },
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

      const updatedName = `${productName}-updated`;
      const updated = await client.request<{ name: string }>("PUT", `/api/products/${product.id}`, {
        body: { name: updatedName, basePrice: 120 },
      });
      assertEqual(updated.name, updatedName);

      const searchResults = await client.request<Array<{ id: string }>>("GET", "/api/products", {
        body: undefined,
      });
      // search via query - need rawRequest or extend client for query params
      const url = new URL("/api/products", client.baseUrl);
      url.searchParams.set("storeId", client.storeId!);
      url.searchParams.set("search", updatedName);
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${client.token}` },
      });
      const searched = (await res.json()) as Array<{ id: string }>;
      assert(searched.some((p) => p.id === product.id), "product found by search");

      const withVariants = await client.request<{ id: string }>("POST", "/api/products", {
        body: {
          name: uniqueName("VariantProduct"),
          categoryId: category.id,
          hasVariants: true,
          basePrice: 0,
          stock: 0,
          status: "active",
        },
        expectStatus: 201,
      });

      const variant = await client.request<{ id: string; name: string }>(
        "POST",
        `/api/products/${withVariants.id}/variants`,
        {
          body: { name: "Size M", price: 50, stock: 5 },
          expectStatus: 201,
        },
      );

      const variants = await client.request<Array<{ id: string }>>(
        "GET",
        `/api/products/${withVariants.id}/variants`,
      );
      assert(variants.some((v) => v.id === variant.id), "variant listed");

      const variantUpdated = await client.request<{ name: string }>("PUT", `/api/variants/${variant.id}`, {
        body: { name: "Size L", price: 60, stock: 8 },
      });
      assertEqual(variantUpdated.name, "Size L");

      await client.request("DELETE", `/api/variants/${variant.id}`, { expectStatus: 204 });
      await client.request("DELETE", `/api/products/${withVariants.id}`, { expectStatus: 204 });
      await client.request("DELETE", `/api/products/${product.id}`, { expectStatus: 204 });
      await client.request("DELETE", `/api/categories/${category.id}`, { expectStatus: 204 });
    },
    { tags: ["functional", "regression"] },
  );
});
