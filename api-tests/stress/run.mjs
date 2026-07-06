/**
 * Stress tests — burst concurrent sale creates.
 * SQLite local dev may lock under heavy writes; set STRESS_SKIP_WRITES=1 to skip burst sales.
 */
const API_BASE = process.env.API_TEST_BASE_URL ?? process.env.VITE_SAAS_API_URL ?? "http://localhost:4001";
const BURST_SIZE = Number(process.env.STRESS_BURST_SIZE ?? 30);
const RAMP_CONNECTIONS = Number(process.env.STRESS_RAMP_CONNECTIONS ?? 100);

async function waitForHealth(baseUrl) {
  for (let i = 0; i < 120; i++) {
    try {
      const res = await fetch(`${baseUrl}/api/health`);
      if (res.ok) return;
    } catch {
      // retry
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error("Health check timed out");
}

async function loginOwner() {
  await fetch(`${API_BASE}/api/demo/reset-passwords`, { method: "POST" }).catch(() => {});
  const res = await fetch(`${API_BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "owner@demo.com", password: "password123" }),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(`Login failed: ${res.status}`);
  return { token: body.token, storeId: body.stores?.[0]?.id, userId: body.user.id, userName: body.user.name };
}

async function apiFetch(path, { token, method = "GET", body, storeId } = {}) {
  const url = new URL(path, API_BASE);
  if (storeId) url.searchParams.set("storeId", storeId);
  const headers = { "Content-Type": "application/json", Accept: "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(url, {
    method,
    headers,
    body: body != null ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => null);
  return { status: res.status, data };
}

async function burstSales(session, product) {
  const price = product.basePrice ?? product.price ?? 100;
  const total = price + price * 0.1;
  const tasks = Array.from({ length: BURST_SIZE }, () =>
    apiFetch("/api/sales", {
      token: session.token,
      method: "POST",
      storeId: session.storeId,
      body: {
        cartItems: [{ productId: product.id, productName: product.name, quantity: 1, price, subtotal: price }],
        taxRate: 0.1,
        amountReceived: total,
        paymentMethod: "cash",
        cashierId: session.userId,
        cashierName: session.userName ?? "Owner",
      },
    }),
  );
  const results = await Promise.allSettled(tasks);
  const statuses = results.map((r) => (r.status === "fulfilled" ? r.value.status : 0));
  const success = statuses.filter((s) => s === 201).length;
  const serverErrors = statuses.filter((s) => s >= 500).length;
  console.log(`  burst sales: ${success}/${BURST_SIZE} succeeded, ${serverErrors} server errors`);
  if (serverErrors > BURST_SIZE * 0.5) {
    throw new Error(`Too many 5xx during burst (${serverErrors}/${BURST_SIZE}) — SQLite may be locking`);
  }
}

async function rampReadLoad(session) {
  console.log(`\n[stress] ramp read load (${RAMP_CONNECTIONS} concurrent GET /api/products)`);
  const tasks = Array.from({ length: RAMP_CONNECTIONS }, () =>
    apiFetch("/api/products", { token: session.token, storeId: session.storeId }),
  );
  const results = await Promise.allSettled(tasks);
  const ok = results.filter((r) => r.status === "fulfilled" && r.value.status === 200).length;
  const errors = results.length - ok;
  console.log(`  ${ok}/${RAMP_CONNECTIONS} OK, ${errors} failed`);
  if (ok < RAMP_CONNECTIONS * 0.8) {
    throw new Error(`Ramp read success rate too low: ${ok}/${RAMP_CONNECTIONS}`);
  }
}

async function main() {
  console.log(`Stress tests → ${API_BASE}`);
  console.log("Note: SQLite local dev may lock under heavy concurrent writes.");
  await waitForHealth(API_BASE);

  const session = await loginOwner();
  const productsRes = await apiFetch("/api/products", { token: session.token, storeId: session.storeId });
  if (productsRes.status !== 200 || !productsRes.data?.length) {
    throw new Error("Need products for stress test — run saas:seed-demo");
  }

  await rampReadLoad(session);

  if (process.env.STRESS_SKIP_WRITES !== "1") {
    console.log(`\n[stress] burst ${BURST_SIZE} concurrent sale creates`);
    await burstSales(session, productsRes.data[0]);
  } else {
    console.log("\n[stress] skipping write burst (STRESS_SKIP_WRITES=1)");
  }

  console.log("\n✓ Stress tests passed");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
