/**
 * SaaS demo seed CLI — 3 themed stores, 30 days of sales history.
 * Run: npm run saas:seed-demo
 * Uses SAAS_DATABASE_URL from env (or .env).
 */
import { runSeedDemo } from "./services/seedDemoService.js";
import { saasPrisma } from "./db.js";

async function main() {
  console.log("Reseeding SaaS demo (3 stores, 100 sales each, 30-day history)...");
  const result = await runSeedDemo();

  console.log("\nDemo seed complete.");
  console.log(`  Org: ${result.orgName} (${result.orgId})`);
  console.log(`  Stores: ${result.storeCount}`);
  for (const store of result.stores) {
    console.log(`    - ${store.name}: ${store.sales} sales`);
  }
  console.log(`  Total sales: ${result.salesCount}`);
  console.log("\n  Logins (password: password123):");
  for (const login of result.logins) {
    console.log(`    ${login.email} — ${login.role}`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => saasPrisma.$disconnect());
