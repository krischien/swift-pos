#!/usr/bin/env node
/**
 * Runs prisma generate for Vercel build.
 * Uses SAAS_DATABASE_URL if set, else a placeholder (generate doesn't need a real DB).
 */
import { execSync } from "child_process";

const url = process.env.SAAS_DATABASE_URL || "postgresql://build:build@localhost:5432/build";
process.env.SAAS_DATABASE_URL = url;
execSync("npx prisma generate --schema=prisma-saas/schema.pg.prisma", { stdio: "inherit" });
