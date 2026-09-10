/**
 * API security smoke tests for the SaaS backend.
 * Usage: node scripts/security-run-with-summary.mjs
 *
 * Requires API at SECURITY_API_URL (default http://localhost:4001).
 */
import { checkHealth, loginAs, API_BASE } from "../security/fixtures/api.mjs";
import { securityTests } from "../security/tests.mjs";

const GREEN = "\x1b[32m";
const RED = "\x1b[31m";
const YELLOW = "\x1b[33m";
const DIM = "\x1b[2m";
const BOLD = "\x1b[1m";
const RESET = "\x1b[0m";

async function buildSessions() {
  const [admin, owner, cashier] = await Promise.all([
    loginAs("admin"),
    loginAs("owner"),
    loginAs("cashier"),
  ]);
  return { admin, owner, cashier };
}

function printHeader() {
  console.log("");
  console.log(`${BOLD}Security tests${RESET} ${DIM}→ ${API_BASE}${RESET}`);
  console.log("");
}

function printRunning(test) {
  process.stdout.write(`  ${DIM}…${RESET} ${test.category} — ${test.name}`);
}

function clearLine() {
  process.stdout.write("\r\x1b[K");
}

async function main() {
  printHeader();

  const healthy = await checkHealth();
  if (!healthy) {
    console.error(`${RED}${BOLD}✗ API not reachable at ${API_BASE}${RESET}`);
    console.error(`${DIM}  Start the server: npm run dev:saas${RESET}`);
    console.error(`${DIM}  Or run: npm run security:ci${RESET}`);
    process.exit(1);
  }

  let sessions;
  try {
    sessions = await buildSessions();
  } catch (err) {
    console.error(`${RED}${BOLD}✗ Failed to log in demo users${RESET}`);
    console.error(`${DIM}  ${err.message}${RESET}`);
    console.error(`${DIM}  Ensure demo seed ran (npm run saas:seed-demo or first API bootstrap)${RESET}`);
    process.exit(1);
  }

  const ctx = { sessions, apiBase: API_BASE };
  const passed = [];
  const failed = [];
  const skipped = [];

  for (const test of securityTests) {
    printRunning(test);
    try {
      const result = await test.run(ctx);
      clearLine();
      if (result?.skipped) {
        skipped.push({ test, reason: result.reason });
        console.log(`  ${YELLOW}○${RESET} ${test.category} — ${test.name} ${DIM}(${result.reason})${RESET}`);
      } else {
        passed.push(test);
        console.log(`  ${GREEN}√${RESET} ${test.category} — ${test.name}`);
      }
    } catch (err) {
      clearLine();
      failed.push({ test, error: err.message ?? String(err) });
      console.log(`  ${RED}×${RESET} ${test.category} — ${test.name}`);
      console.log(`    ${RED}${err.message ?? err}${RESET}`);
    }
  }

  const total = securityTests.length;
  const ran = passed.length + failed.length;

  console.log("");
  console.log("─".repeat(60));

  if (failed.length === 0) {
    const skipNote = skipped.length ? ` ${DIM}(${skipped.length} skipped)${RESET}` : "";
    console.log(
      `${GREEN}${BOLD}✓ ALL SECURITY CHECKS PASSED${RESET} ${GREEN}(${passed.length}/${ran} ran)${RESET}${skipNote}`,
    );
  } else {
    console.log(
      `${RED}${BOLD}✗ SECURITY CHECKS FAILED${RESET} ${RED}(${failed.length} failed, ${passed.length} passed)${RESET}`,
    );
    console.log("");
    console.log(`${BOLD}Failure details:${RESET}`);
    failed.forEach((f, i) => {
      console.log(`${RED}  ${i + 1}. [${f.test.category}] ${f.test.name}${RESET}`);
      console.log(`${DIM}     ${f.error}${RESET}`);
      console.log(`${DIM}     id: ${f.test.id}${RESET}`);
    });
  }

  if (skipped.length > 0 && failed.length === 0) {
    console.log("");
    console.log(`${YELLOW}Skipped:${RESET}`);
    skipped.forEach((s) => {
      console.log(`${DIM}  - [${s.test.category}] ${s.test.name}: ${s.reason}${RESET}`);
    });
  }

  console.log("─".repeat(60));
  console.log("");

  process.exit(failed.length > 0 ? 1 : 0);
}

main();
