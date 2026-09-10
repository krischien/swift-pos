import { describe, test, assert, assertEqual, assertOk } from "../../helpers/runner.js";
import { ownerClient } from "../../helpers/setup.js";
import { uniqueEmail, uniqueName } from "../../fixtures/testData.js";

describe("Functional: Users", () => {
  test(
    "owner can create, update, and delete a user",
    async () => {
      const client = await ownerClient();
      const email = uniqueEmail();
      const name = uniqueName("User");

      const created = await client.request<{ id: string; email: string; role: string }>("POST", "/api/users", {
        body: { name, email, password: "TestPass123!", role: "cashier" },
        expectStatus: 201,
      });
      assertEqual(created.email, email);
      assertEqual(created.role, "cashier");

      const updatedName = `${name}-updated`;
      const updated = await client.request<{ name: string }>("PUT", `/api/users/${created.id}`, {
        body: { name: updatedName },
      });
      assertEqual(updated.name, updatedName);

      const list = await client.request<Array<{ id: string }>>("GET", "/api/users");
      assert(list.some((u) => u.id === created.id), "user should appear in list");

      await client.request("DELETE", `/api/users/${created.id}`, { expectStatus: 204 });
    },
    { tags: ["functional", "regression"] },
  );

  test(
    "invalid role on user create returns 400",
    async () => {
      const client = await ownerClient();
      await client.request("POST", "/api/users", {
        body: {
          name: uniqueName("BadRole"),
          email: uniqueEmail(),
          password: "TestPass123!",
          role: "super_admin",
        },
        expectStatus: 400,
      });
    },
    { tags: ["functional", "regression"] },
  );
});
