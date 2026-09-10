/**
 * Runs SaaS API tests via tsx and prints a colored pass/fail summary.
 * Usage: node scripts/api-run-with-summary.mjs [--no-wait]
 */
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");

const extraArgs = process.argv.slice(2);

function runApiTests() {
  return new Promise((resolve) => {
    const args = ["tsx", "api-tests/index.ts", ...extraArgs];
    const child = spawn("npx", args, {
      shell: true,
      cwd: rootDir,
      env: process.env,
    });

    child.stdout?.pipe(process.stdout);
    child.stderr?.pipe(process.stderr);
    child.on("close", (code) => resolve(code ?? 1));
  });
}

const code = await runApiTests();
process.exit(code);
