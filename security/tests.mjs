import {
  apiFetch,
  loginAs,
  DEMO_USERS,
  login,
  API_BASE,
} from "./fixtures/api.mjs";

function expectStatus(actual, expected, label) {
  if (actual !== expected) {
    throw new Error(`${label}: expected HTTP ${expected}, got ${actual}`);
  }
}

/** @type {import('../types.mjs').SecurityTest[]} */
export const securityTests = [
  // --- Authentication ---
  {
    id: "auth-no-token-products",
    category: "Authentication",
    name: "GET /api/products without token returns 401",
    async run() {
      const { status } = await apiFetch("/api/products");
      expectStatus(status, 401, "Unauthenticated products");
    },
  },
  {
    id: "auth-no-token-categories-write",
    category: "Authentication",
    name: "POST /api/categories without token returns 401",
    async run() {
      const { status } = await apiFetch("/api/categories", {
        method: "POST",
        body: { name: "security-probe" },
      });
      expectStatus(status, 401, "Unauthenticated category create");
    },
  },
  {
    id: "auth-invalid-token",
    category: "Authentication",
    name: "Invalid Bearer token returns 401",
    async run() {
      const { status } = await apiFetch("/api/products?storeId=x", {
        token: "not.a.valid.jwt.token",
      });
      expectStatus(status, 401, "Invalid token");
    },
  },
  {
    id: "auth-missing-store-id",
    category: "Authentication",
    name: "Authenticated request without storeId returns 400",
    async run({ sessions }) {
      const { status } = await apiFetch("/api/products", {
        token: sessions.owner.token,
      });
      expectStatus(status, 400, "Missing storeId");
    },
  },
  {
    id: "auth-login-no-password-leak",
    category: "Authentication",
    name: "Login response does not include password hash",
    async run() {
      const { res, body } = await login(DEMO_USERS.owner.email, DEMO_USERS.owner.password);
      expectStatus(res.status, 200, "Owner login");
      if ("password" in (body.user ?? {})) {
        throw new Error("Login response leaked password field on user object");
      }
    },
  },
  {
    id: "auth-invalid-credentials",
    category: "Authentication",
    name: "Invalid credentials return 401 without leaking user existence details",
    async run() {
      const { res, body } = await login(DEMO_USERS.owner.email, "wrong-password");
      expectStatus(res.status, 401, "Wrong password");
      if (!body?.message?.toLowerCase().includes("invalid")) {
        throw new Error(`Expected generic invalid credentials message, got: ${body?.message}`);
      }
    },
  },

  // --- RBAC (role-based access) ---
  {
    id: "rbac-cashier-no-product-write",
    category: "RBAC",
    name: "Cashier cannot POST /api/products (owner-only)",
    async run({ sessions }) {
      const { status, body } = await apiFetch("/api/products", {
        token: sessions.cashier.token,
        method: "POST",
        storeId: sessions.cashier.storeId,
        body: { name: "security-probe", categoryId: "x", price: 1 },
      });
      expectStatus(status, 403, "Cashier product create");
      if (!body?.message?.toLowerCase().includes("owner")) {
        throw new Error(`Expected owner-required message, got: ${body?.message}`);
      }
    },
  },
  {
    id: "rbac-cashier-no-category-write",
    category: "RBAC",
    name: "Cashier cannot POST /api/categories (owner-only)",
    async run({ sessions }) {
      const { status } = await apiFetch("/api/categories", {
        token: sessions.cashier.token,
        method: "POST",
        storeId: sessions.cashier.storeId,
        body: { name: "security-probe" },
      });
      expectStatus(status, 403, "Cashier category create");
    },
  },
  {
    id: "rbac-cashier-no-users-list",
    category: "RBAC",
    name: "Cashier cannot GET /api/users (owner-only)",
    async run({ sessions }) {
      const { status } = await apiFetch("/api/users", {
        token: sessions.cashier.token,
        storeId: sessions.cashier.storeId,
      });
      expectStatus(status, 403, "Cashier users list");
    },
  },
  {
    id: "rbac-cashier-no-org-users",
    category: "RBAC",
    name: "Cashier cannot GET /api/org/users (owner-only)",
    async run({ sessions }) {
      const { status } = await apiFetch("/api/org/users", {
        token: sessions.cashier.token,
      });
      expectStatus(status, 403, "Cashier org users");
    },
  },
  {
    id: "rbac-owner-can-read-products",
    category: "RBAC",
    name: "Owner can GET /api/products for their store",
    async run({ sessions }) {
      const { status } = await apiFetch("/api/products", {
        token: sessions.owner.token,
        storeId: sessions.owner.storeId,
      });
      expectStatus(status, 200, "Owner products read");
    },
  },
  {
    id: "rbac-cashier-can-read-products",
    category: "RBAC",
    name: "Cashier can GET /api/products for assigned store",
    async run({ sessions }) {
      const { status } = await apiFetch("/api/products", {
        token: sessions.cashier.token,
        storeId: sessions.cashier.storeId,
      });
      expectStatus(status, 200, "Cashier products read");
    },
  },
  {
    id: "rbac-owner-no-admin",
    category: "RBAC",
    name: "Owner cannot access /api/admin/overview",
    async run({ sessions }) {
      const { status } = await apiFetch("/api/admin/overview", {
        token: sessions.owner.token,
      });
      expectStatus(status, 403, "Owner admin overview");
    },
  },
  {
    id: "rbac-cashier-no-admin",
    category: "RBAC",
    name: "Cashier cannot access /api/admin/overview",
    async run({ sessions }) {
      const { status } = await apiFetch("/api/admin/overview", {
        token: sessions.cashier.token,
      });
      expectStatus(status, 403, "Cashier admin overview");
    },
  },
  {
    id: "rbac-admin-can-overview",
    category: "RBAC",
    name: "Super admin can access /api/admin/overview",
    async run({ sessions }) {
      const { status } = await apiFetch("/api/admin/overview", {
        token: sessions.admin.token,
      });
      expectStatus(status, 200, "Admin overview");
    },
  },

  // --- Tenant isolation ---
  {
    id: "tenant-unknown-store",
    category: "Tenant isolation",
    name: "Authenticated user cannot access unknown storeId",
    async run({ sessions }) {
      const fakeStoreId = "00000000-0000-4000-8000-000000000099";
      const { status } = await apiFetch("/api/products", {
        token: sessions.cashier.token,
        storeId: fakeStoreId,
      });
      expectStatus(status, 403, "Unknown store access");
    },
  },

  // --- Dev / production endpoints ---
  {
    id: "dev-demo-reset-local",
    category: "Dev endpoints",
    name: "POST /api/demo/reset-passwords is available in local dev",
    async run() {
      if (process.env.SECURITY_EXPECT_PRODUCTION === "1") {
        return { skipped: true, reason: "Skipped in production mode" };
      }
      const res = await fetch(`${API_BASE}/api/demo/reset-passwords`, { method: "POST" });
      if (res.status === 404) {
        throw new Error(
          "demo/reset-passwords returned 404 — expected open in local dev (set SECURITY_EXPECT_PRODUCTION=1 to assert blocked)",
        );
      }
      if (!res.ok && res.status !== 200) {
        throw new Error(`Unexpected status for demo reset in dev: ${res.status}`);
      }
    },
  },
  {
    id: "prod-demo-reset-blocked",
    category: "Production hardening",
    name: "POST /api/demo/reset-passwords returns 404 when production is expected",
    async run() {
      if (process.env.SECURITY_EXPECT_PRODUCTION !== "1") {
        return { skipped: true, reason: "Set SECURITY_EXPECT_PRODUCTION=1 with NODE_ENV=production server" };
      }
      const res = await fetch(`${API_BASE}/api/demo/reset-passwords`, { method: "POST" });
      expectStatus(res.status, 404, "Production demo reset blocked");
    },
  },
  {
    id: "prod-demo-seed-blocked",
    category: "Production hardening",
    name: "POST /api/demo/seed returns 404 when production is expected",
    async run({ sessions }) {
      if (process.env.SECURITY_EXPECT_PRODUCTION !== "1") {
        return { skipped: true, reason: "Set SECURITY_EXPECT_PRODUCTION=1 with NODE_ENV=production server" };
      }
      const { status } = await apiFetch("/api/demo/seed", {
        token: sessions.owner.token,
        method: "POST",
      });
      expectStatus(status, 404, "Production demo seed blocked");
    },
  },

  // --- Injection / input hardening ---
  {
    id: "injection-xss-category-name",
    category: "Input hardening",
    name: "XSS-like category name is stored safely (no 500)",
    async run({ sessions }) {
      const { status } = await apiFetch("/api/categories", {
        token: sessions.owner.token,
        method: "POST",
        storeId: sessions.owner.storeId,
        body: { name: "<script>alert('xss')</script>" },
      });
      if (status >= 500) throw new Error(`XSS category name caused ${status}`);
    },
  },
  {
    id: "injection-sql-category-name",
    category: "Input hardening",
    name: "SQL-like category name does not cause 500",
    async run({ sessions }) {
      const { status } = await apiFetch("/api/categories", {
        token: sessions.owner.token,
        method: "POST",
        storeId: sessions.owner.storeId,
        body: { name: "'; DROP TABLE categories;--" },
      });
      if (status >= 500) throw new Error(`SQL injection string caused ${status}`);
    },
  },
  {
    id: "oversized-body-categories",
    category: "Input hardening",
    name: "Oversized category name does not cause 500",
    async run({ sessions }) {
      const { status } = await apiFetch("/api/categories", {
        token: sessions.owner.token,
        method: "POST",
        storeId: sessions.owner.storeId,
        body: { name: "x".repeat(100_000) },
      });
      if (status >= 500) throw new Error(`Oversized body caused ${status}`);
    },
  },

  // --- JWT tampering ---
  {
    id: "jwt-alg-none-rejected",
    category: "Authentication",
    name: "JWT with alg=none is rejected",
    async run({ sessions }) {
      const parts = sessions.owner.token.split(".");
      const header = Buffer.from(JSON.stringify({ alg: "none", typ: "JWT" })).toString("base64url");
      const fakeToken = `${header}.${parts[1]}.`;
      const { status } = await apiFetch("/api/products", {
        token: fakeToken,
        storeId: sessions.owner.storeId,
      });
      expectStatus(status, 401, "alg=none token");
    },
  },

  // --- Admin billing authz ---
  {
    id: "rbac-owner-no-billing-payments",
    category: "RBAC",
    name: "Owner cannot GET admin billing payments",
    async run({ sessions }) {
      const orgs = await apiFetch("/api/admin/organizations", { token: sessions.admin.token });
      if (orgs.status !== 200 || !orgs.body?.length) {
        return { skipped: true, reason: "No organizations for billing test" };
      }
      const orgId = orgs.body[0].id;
      const { status } = await apiFetch(`/api/admin/organizations/${orgId}/billing-payments`, {
        token: sessions.owner.token,
      });
      expectStatus(status, 403, "Owner billing payments");
    },
  },

  // --- F&B RBAC ---
  {
    id: "rbac-cashier-no-ingredient-write",
    category: "RBAC",
    name: "Cashier cannot POST /api/ingredients on F&B store",
    async run({ sessions }) {
      const stores = sessions.owner.stores ?? [];
      const fnbStore = stores.find((s) => s.businessMode === "fnb" || s.name?.includes("F&B"));
      if (!fnbStore) {
        return { skipped: true, reason: "No F&B store in demo data — run saas:seed-demo" };
      }
      const { status } = await apiFetch("/api/ingredients", {
        token: sessions.cashier.token,
        method: "POST",
        storeId: fnbStore.id,
        body: { name: "security-probe-ingredient" },
      });
      expectStatus(status, 403, "Cashier ingredient create");
    },
  },

  // --- Sale void authz ---
  {
    id: "sale-void-requires-auth",
    category: "Authentication",
    name: "POST /api/sales/:id/void without token returns 401",
    async run() {
      const { status } = await apiFetch("/api/sales/00000000-0000-4000-8000-000000000001/void", {
        method: "POST",
      });
      expectStatus(status, 401, "Unauthenticated void");
    },
  },

  // --- Signup abuse ---
  {
    id: "signup-missing-fields",
    category: "Input hardening",
    name: "Signup with missing fields returns 400",
    async run() {
      const res = await fetch(`${API_BASE}/api/auth/signup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ organizationName: "x" }),
      });
      expectStatus(res.status, 400, "Incomplete signup");
    },
  },

  // --- Subscription tiers ---
  {
    id: "subscription-status-readable",
    category: "Subscription",
    name: "Owner can GET /api/org/subscription while authenticated",
    async run({ sessions }) {
      const { status, body } = await apiFetch("/api/org/subscription", {
        token: sessions.owner.token,
      });
      expectStatus(status, 200, "Subscription status");
      if (!body?.tier || !body?.status) {
        throw new Error("Subscription payload missing tier/status");
      }
    },
  },
  {
    id: "subscription-request-invalid-tier",
    category: "Subscription",
    name: "POST /api/org/subscription/request rejects invalid tier",
    async run({ sessions }) {
      const { status } = await apiFetch("/api/org/subscription/request", {
        token: sessions.owner.token,
        method: "POST",
        body: { tier: "free" },
      });
      expectStatus(status, 400, "Invalid tier rejected");
    },
  },
];
