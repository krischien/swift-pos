#!/usr/bin/env node
/**
 * Fail fast before build:mobile:saas:prod if API URL is missing or still localhost/dev.
 * Vite merges .env + .env.saas + .env.saas.local — root .env often has localhost:4001.
 */
import { existsSync, readFileSync } from "node:fs";

function readVar(name, files) {
  for (const file of files) {
    if (!existsSync(file)) continue;
    for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const m = trimmed.match(new RegExp(`^${name}=(.*)$`));
      if (m) return m[1].trim().replace(/^["']|["']$/g, "");
    }
  }
  return "";
}

const url =
  process.env.VITE_SAAS_API_URL ||
  readVar("VITE_SAAS_API_URL", [".env.saas.local", ".env.saas", ".env.local", ".env"]);

if (!url) {
  console.error(
    [
      "[build:mobile:saas:prod] VITE_SAAS_API_URL is not set.",
      "",
      "Create .env.saas.local (gitignored) with your prod API URL, e.g.:",
      "  VITE_APP_MODE=saas",
      "  VITE_SAAS_API_URL=https://swift-pos-pied.vercel.app",
      "",
      "Then run: npm run build:mobile:saas:prod",
    ].join("\n"),
  );
  process.exit(1);
}

if (!/^https:\/\//i.test(url)) {
  console.error(
    `[build:mobile:saas:prod] VITE_SAAS_API_URL must be HTTPS for production mobile: ${url}`,
  );
  process.exit(1);
}

if (/localhost|127\.0\.0\.1|10\.0\.2\.2|:4001/i.test(url)) {
  console.error(
    `[build:mobile:saas:prod] VITE_SAAS_API_URL looks like local dev, not prod: ${url}`,
  );
  console.error("Use .env.saas.local to override root .env (which often has localhost:4001).");
  process.exit(1);
}

console.log(`[build:mobile:saas:prod] API URL: ${url}`);
