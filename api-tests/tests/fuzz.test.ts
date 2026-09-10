import { describe, test, assert, assertOneOf, assertStatusNot500 } from "../helpers/runner.js";
import { ApiClient } from "../helpers/client.js";
import { ownerClient } from "../helpers/setup.js";
import { DEMO_CREDENTIALS } from "../fixtures/users.js";
import { uniqueName } from "../fixtures/testData.js";

describe("Fuzz", () => {
  test(
    "malformed login payloads never return 500",
    async () => {
      const client = new ApiClient();
      const payloads = [
        {},
        { email: "", password: "" },
        { email: "not-an-email", password: "x" },
        { email: "a".repeat(500), password: "x" },
        { email: "'; DROP TABLE users;--", password: "x" },
      ];
      for (const body of payloads) {
        const { status } = await client.rawRequest("POST", "/api/auth/login", { body, auth: false });
        assertStatusNot500(status, "login fuzz");
        assertOneOf(status, [400, 401], `login fuzz status ${status}`);
      }
    },
    { tags: ["fuzz"] },
  );

  test(
    "malformed category/product/sale payloads never return 500",
    async () => {
      const client = await ownerClient();

      const categoryCases = [
        { name: 123 },
        { name: "<script>alert(1)</script>" },
        { name: "" },
        {},
      ];
      for (const body of categoryCases) {
        const { status } = await client.rawRequest("POST", "/api/categories", { body });
        assertStatusNot500(status, "category fuzz");
      }

      const productCases = [
        { name: "x", categoryId: "not-a-uuid", hasVariants: "yes" },
        { name: "", categoryId: "", hasVariants: false },
        { price: "free" },
      ];
      for (const body of productCases) {
        const { status } = await client.rawRequest("POST", "/api/products", { body });
        assertStatusNot500(status, "product fuzz");
      }

      const saleCases = [
        { cartItems: "not-array" },
        { cartItems: [] },
        { cartItems: [{ quantity: -1, price: "x", subtotal: NaN }] },
      ];
      for (const body of saleCases) {
        const { status } = await client.rawRequest("POST", "/api/sales", { body });
        assertStatusNot500(status, "sale fuzz");
      }
    },
    { tags: ["fuzz"] },
  );

  test(
    "invalid id paths never return 500",
    async () => {
      const client = await ownerClient();
      const badIds = [
        "../../../etc/passwd",
        "00000000-0000-4000-8000-000000000099",
        "' OR 1=1 --",
      ];
      for (const id of badIds) {
        for (const path of [`/api/categories/${id}`, `/api/products/${id}`, `/api/sales/${id}`]) {
          const { status } = await client.rawRequest("GET", path);
          assertStatusNot500(status, `GET ${path}`);
        }
      }
    },
    { tags: ["fuzz"] },
  );
});
