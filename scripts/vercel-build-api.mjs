#!/usr/bin/env node
/**
 * Vercel API build: output CommonJS to api/index.cjs only.
 * Do NOT create api/index.js — @vercel/node re-bundles .js entries into broken ESM.
 */
import { execSync } from "node:child_process";
import { unlinkSync } from "node:fs";

const stale = ["api/index.js", "saas-api-handler.cjs", "api/handler.cjs"];
for (const file of stale) {
  try {
    unlinkSync(file);
  } catch {
    /* absent */
  }
}

execSync(
  "npx esbuild server/saas/index.ts --bundle --platform=node --format=cjs --outfile=api/index.cjs --packages=external",
  { stdio: "inherit" },
);
