#!/usr/bin/env node
/**
 * Vercel build: generate Prisma client + sync Postgres schema to SAAS_DATABASE_URL.
 * Uses SAAS_DATABASE_URL from Vercel env; placeholder only when unset (local dry-run).
 */
import { execSync } from "node:child_process";

const url = (process.env.SAAS_DATABASE_URL || "").trim()
  || "postgresql://build:build@localhost:5432/build";
process.env.SAAS_DATABASE_URL = url;

execSync("npx prisma generate --schema=prisma-saas/schema.pg.prisma", {
  stdio: "inherit",
});

const isRealPostgres =
  (url.startsWith("postgresql://") || url.startsWith("postgres://")) &&
  !url.includes("build:build@localhost");

if (isRealPostgres) {
  console.log("[vercel] Syncing Postgres schema (prisma db push)…");
  execSync(
    "npx prisma db push --schema=prisma-saas/schema.pg.prisma --skip-generate",
    { stdio: "inherit" },
  );
} else {
  console.log("[vercel] Skipping db push — SAAS_DATABASE_URL is not a live Postgres URL.");
}
