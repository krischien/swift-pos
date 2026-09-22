#!/usr/bin/env node
/**
 * Local pre-push check (same steps as Vercel minus prisma generate when DLL is locked).
 * Vercel always runs: npm run vercel:build (includes prisma generate on Linux).
 *
 * Usage: npm run verify:vercel
 */
import { execSync } from "node:child_process";
import { existsSync } from "node:fs";

console.log("[verify:vercel] SaaS SPA build…");
execSync("npm run build:saas", { stdio: "inherit" });

if (!existsSync("node_modules/.prisma/saas-client/index.js")) {
  console.log("[verify:vercel] Prisma saas client missing — generating once…");
  execSync("npx prisma generate --schema=prisma-saas/schema.pg.prisma", { stdio: "inherit" });
} else {
  console.log("[verify:vercel] Skipping prisma generate (client present). Stop dev:saas if generate fails with EPERM.");
}

console.log("[verify:vercel] API bundle (esbuild)…");
execSync("node scripts/vercel-build-api.mjs", { stdio: "inherit" });

console.log("\n[verify:vercel] OK — safe to push. On Vercel: set env vars, deploy, then prisma:push:saas:prod OR rely on ensurePostgresSchema on first API boot.");
console.log("See docs/PRE_PUSH_VERCEL.md");
