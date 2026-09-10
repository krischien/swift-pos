/**
 * Load tests — sustained concurrent reads and logins.
 * Requires API running at API_TEST_BASE_URL (default http://localhost:4001).
 * Note: SQLite local dev may show higher latency under concurrent writes.
 */
const API_BASE = process.env.API_TEST_BASE_URL ?? process.env.VITE_SAAS_API_URL ?? "http://localhost:4001";
const CONCURRENCY = Number(process.env.LOAD_CONCURRENCY ?? 50);
const DURATION_SEC = Number(process.env.LOAD_DURATION ?? 10);
const P95_MS = Number(process.env.LOAD_P95_MS ?? 2000);
const LOGIN_P95_MS = Number(process.env.LOAD_LOGIN_P95_MS ?? 3500);
const MAX_ERROR_RATE = Number(process.env.LOAD_MAX_ERROR_RATE ?? 0.05);

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
  return { token: body.token, storeId: body.stores?.[0]?.id };
}

function percentile(values, p) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, idx)];
}

async function sustainedLoad(label, fn, durationSec, concurrency, p95Limit = P95_MS) {
  const latencies = [];
  let errors = 0;
  let total = 0;
  const end = Date.now() + durationSec * 1000;

  async function worker() {
    while (Date.now() < end) {
      const start = Date.now();
      try {
        const ok = await fn();
        latencies.push(Date.now() - start);
        if (!ok) errors++;
      } catch {
        errors++;
        latencies.push(Date.now() - start);
      }
      total++;
    }
  }

  await Promise.all(Array.from({ length: concurrency }, () => worker()));

  const p95 = percentile(latencies, 95);
  const errorRate = errors / Math.max(total, 1);
  console.log(`\n[load] ${label} (${concurrency} workers, ${durationSec}s)`);
  console.log(`  requests: ${total}, errors: ${errors}, p95: ${p95}ms`);

  if (errorRate > MAX_ERROR_RATE) {
    throw new Error(`${label} error rate ${(errorRate * 100).toFixed(1)}% exceeds ${MAX_ERROR_RATE * 100}%`);
  }
  if (p95 > p95Limit) {
    throw new Error(`${label} p95 ${p95}ms exceeds ${p95Limit}ms`);
  }
}

async function main() {
  console.log(`Load tests → ${API_BASE}`);
  await waitForHealth(API_BASE);
  const owner = await loginOwner();

  await sustainedLoad(
    "GET /api/products",
    async () => {
      const res = await fetch(`${API_BASE}/api/products?storeId=${owner.storeId}`, {
        headers: { Authorization: `Bearer ${owner.token}` },
      });
      return res.ok;
    },
    DURATION_SEC,
    CONCURRENCY,
  );

  await sustainedLoad(
    "POST /api/auth/login",
    async () => {
      const res = await fetch(`${API_BASE}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "owner@demo.com", password: "password123" }),
      });
      return res.ok;
    },
    DURATION_SEC,
    Math.min(CONCURRENCY, 20),
    LOGIN_P95_MS,
  );

  console.log("\n✓ Load tests passed");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
