import { describe, test, assertEqual } from "../../helpers/runner.js";
import { ApiClient } from "../../helpers/client.js";
import { DEMO_CREDENTIALS } from "../../fixtures/users.js";
import { uniqueEmail, uniqueName } from "../../fixtures/testData.js";
import { adminClient } from "../../helpers/setup.js";

describe("Functional: Auth", () => {
  test(
    "POST /api/auth/signup creates org, store, and owner",
    async () => {
      const client = new ApiClient();
      const email = uniqueEmail();
      const orgName = uniqueName("Org");
      const storeName = uniqueName("Store");

      const data = await client.signup({
        organizationName: orgName,
        storeName,
        adminEmail: email,
        adminPassword: "TestPass123!",
        adminName: "Test Owner",
      });

      assertEqual(data.user.email, email);
      assertEqual(data.user.role, "owner");
      assertEqual(data.organization.name, orgName);
      assertEqual(data.stores.length, 1);
      assertEqual(data.stores[0].name, storeName);
    },
    { tags: ["functional", "regression"] },
  );

  test(
    "duplicate email on signup returns 400",
    async () => {
      const client = new ApiClient();
      await client.request("POST", "/api/auth/signup", {
        body: {
          organizationName: uniqueName("Org"),
          storeName: uniqueName("Store"),
          adminEmail: DEMO_CREDENTIALS.owner.email,
          adminPassword: "TestPass123!",
        },
        auth: false,
        expectStatus: 400,
      });
    },
    { tags: ["functional", "regression"] },
  );

  test(
    "suspended org owner cannot log in (403)",
    async () => {
      const signupClient = new ApiClient();
      const email = uniqueEmail();
      const signup = await signupClient.signup({
        organizationName: uniqueName("SuspendOrg"),
        storeName: uniqueName("SuspendStore"),
        adminEmail: email,
        adminPassword: "TestPass123!",
      });

      const admin = await adminClient();
      await admin.request("PATCH", `/api/admin/organizations/${signup.organization.id}`, {
        body: { suspended: true },
        storeId: null,
      });

      const loginClient = new ApiClient();
      await loginClient.request("POST", "/api/auth/login", {
        body: { email, password: "TestPass123!" },
        auth: false,
        expectStatus: 403,
      });
    },
    { tags: ["functional", "regression"] },
  );
});
