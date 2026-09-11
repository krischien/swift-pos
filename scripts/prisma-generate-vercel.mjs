#!/usr/bin/env node
/**
 * Vercel build: generate Prisma client + sync Postgres schema to SAAS_DATABASE_URL.
 * SAAS_DATABASE_URL must be enabled for "Build" in Vercel env settings (not just Runtime).
 */
import { execSync } from "node:child_process";

const onVercel = process.env.VERCEL === "1";
const url = (process.env.SAAS_DATABASE_URL || "").trim();

if (onVercel && !url) {
  console.error(
    [
      "[vercel] SAAS_DATABASE_URL is missing at BUILD time.",
      "In Vercel → Settings → Environment Variables, enable SAAS_DATABASE_URL for",
      "Production (and Preview if needed) under scope: Build AND Runtime.",
      "Without it, prisma db push cannot run during deploy.",
    ].join("\n"),
  );
  process.exit(1);
}

process.env.SAAS_DATABASE_URL =
  url || "postgresql://build:build@localhost:5432/build";

execSync("npx prisma generate --schema=prisma-saas/schema.pg.prisma", {
  stdio: "inherit",
});

const isRealPostgres =
  (process.env.SAAS_DATABASE_URL.startsWith("postgresql://") ||
    process.env.SAAS_DATABASE_URL.startsWith("postgres://")) &&
  !process.env.SAAS_DATABASE_URL.includes("build:build@localhost");

if (isRealPostgres) {
  console.log("[vercel] Syncing Postgres schema (prisma db push)…");
  execSync(
    "npx prisma db push --schema=prisma-saas/schema.pg.prisma --skip-generate",
    { stdio: "inherit" },
  );
} else if (!onVercel) {
  console.log("[vercel] Skipping db push — no live Postgres URL (local dry-run).");
}
