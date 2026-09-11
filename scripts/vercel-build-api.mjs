#!/usr/bin/env node
/**
 * Vercel API build: bundle Express app to lib/saas-api.cjs (outside /api so Vercel file trace includes it).
 * api/index.js is the committed Vercel entry that require()s the bundle.
 */
import { execSync } from "node:child_process";
import { mkdirSync, unlinkSync } from "node:fs";

const stale = [
  "api/index.cjs",
  "api/_handler.cjs",
  "saas-api-handler.cjs",
  "api/handler.cjs",
];
for (const file of stale) {
  try {
    unlinkSync(file);
  } catch {
    /* absent */
  }
}

mkdirSync("lib", { recursive: true });

execSync(
  "npx esbuild server/saas/index.ts --bundle --platform=node --format=cjs --outfile=lib/saas-api.cjs --packages=external",
  { stdio: "inherit" },
);
