/**
 * SaaS demo seed CLI — same as POST /api/demo/seed and dev startup when DB has no products.
 * Run: npm run saas:seed-demo
 *
 * Seeds Demo Organization: 3 retail (incl. LPG/canister) + 1 F&B store, Negosyo trial tier, sales history.
 * Logins: owner@demo.com (all 4), maria/juan/pedro/lpg@demo.com (password123).
 */
import { saasPrisma } from "./db.js";
import { runSeedDemo } from "./services/seedDemoService.js";

async function main() {
  console.log("Running full SaaS demo seed (4 stores incl. F&B + LPG, trial, sales history)…");
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
