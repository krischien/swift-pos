/**
 * Apply prisma-saas Postgres schema to Neon/VPS.
 * Usage (PowerShell):
 *   $env:SAAS_DATABASE_URL = "postgresql://...@.../neondb?sslmode=require"
 *   npm run prisma:push:saas:prod
 *
 * migrate deploy cannot be used: prisma-saas/migrations are SQLite history
 * (migration_lock.toml provider=sqlite). Greenfield / Neon sync = db push.
 */
import { spawnSync } from "node:child_process";

const url = process.env.SAAS_DATABASE_URL?.trim();
if (!url) {
  console.error(
    "SAAS_DATABASE_URL is not set.\n\nPowerShell:\n  $env:SAAS_DATABASE_URL = \"postgresql://USER:PASS@HOST/neondb?sslmode=require\"\n  npm run prisma:push:saas:prod\n",
  );
  process.exit(1);
}
if (!url.startsWith("postgresql://") && !url.startsWith("postgres://")) {
  console.error(
    `SAAS_DATABASE_URL must be a Postgres URL for Neon/prod push.\nGot: ${url.slice(0, 32)}…\n(Your .env SQLite file: URL will NOT work — set $env:SAAS_DATABASE_URL for this shell.)`,
  );
  process.exit(1);
}

const result = spawnSync(
  "npx",
  ["prisma", "db", "push", "--schema=prisma-saas/schema.pg.prisma"],
  {
    stdio: "inherit",
    shell: true,
    env: process.env,
  },
);

process.exit(result.status ?? 1);
