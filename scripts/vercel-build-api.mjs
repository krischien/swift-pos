#!/usr/bin/env node
/**
 * Vercel API build: bundle Express app to api/_handler.cjs (utility file, not a function).
 * api/index.js is the committed Vercel entry that require()s the handler.
 * Do NOT output api/index.js here — @vercel/node only recognizes .js/.ts in `functions` config.
 */
import { execSync } from "node:child_process";
import { unlinkSync } from "node:fs";

const stale = ["api/index.cjs", "saas-api-handler.cjs", "api/handler.cjs"];
for (const file of stale) {
  try {
    unlinkSync(file);
  } catch {
    /* absent */
  }
}

execSync(
  "npx esbuild server/saas/index.ts --bundle --platform=node --format=cjs --outfile=api/_handler.cjs --packages=external",
  { stdio: "inherit" },
);
