/**
 * Seed existing Demo Organization for Vercel/Neon (3 stores, 15+ products each, 50 sales/store × 7 days).
 *
 * Usage:
 *   $env:SAAS_DATABASE_URL = "postgresql://..."   # Vercel Neon URL
 *   npm run saas:seed-vercel-demo:prod
 */
import { saasPrisma } from "./db.js";
import { runSeedVercelDemo } from "./services/seedVercelDemoService.js";

async function main() {
  const url = (process.env.SAAS_DATABASE_URL ?? "").trim();
  if (!url.startsWith("postgresql://") && !url.startsWith("postgres://")) {
    console.error(
      "Set SAAS_DATABASE_URL to your Vercel/Neon Postgres URL.\n" +
        '  $env:SAAS_DATABASE_URL = "postgresql://..."\n' +
        "  npm run saas:seed-vercel-demo:prod",
    );
    process.exit(1);
  }

  console.log("Seeding Demo Organization (existing org + users)…");
  const result = await runSeedVercelDemo();
  console.log("\nDone.");
  console.log(`  Org: ${result.orgName} (${result.orgId})`);
  for (const s of result.stores) {
    console.log(`  ${s.name}: ${s.products} products, ${s.sales} sales (7 days)`);
  }
  console.log("  Logins (password123):");
  for (const l of result.logins) {
    console.log(`    ${l.email} — ${l.role}`);
  }
  console.log(`\n  ${result.note}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => saasPrisma.$disconnect());
