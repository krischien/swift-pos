/**
 * SaaS demo seed CLI — same as POST /api/demo/seed and dev startup when DB has no products.
 * Run: npm run saas:seed-demo
 *
 * Seeds Demo Organization: 2 retail + 1 F&B store, 15-day trial, products + menu/recipes, ~11 days of sales.
 * Logins: owner@demo.com, maria@demo.com, juan@demo.com, pedro@demo.com (password123). Quick-login cashier@demo.com is added on next API dev start via ensureDemoQuickLoginUsers.
 */
import { saasPrisma } from "./db.js";
import { runSeedDemo } from "./services/seedDemoService.js";

async function main() {
  console.log("Running full SaaS demo seed (3 stores incl. F&B, 15-day trial, sales history)…");
  const result = await runSeedDemo();
  console.log("\nDemo seed complete.");
  console.log(`  Org: ${result.orgName} (${result.orgId})`);
  console.log(`  Stores: ${result.storeCount}`);
  console.log(`  Sales: ${result.salesCount}`);
  console.log(`  Logins: ${result.logins.map((l) => `${l.email} (${l.role})`).join(", ")}`);
  console.log(`  Password: password123`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => saasPrisma.$disconnect());
