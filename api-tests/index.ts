import { API_BASE_URL } from "./fixtures/config.js";
import { waitForHealth } from "./helpers/client.js";
import { runAll, getRegisteredTestCount } from "./helpers/runner.js";
import { parseRunOptions } from "./helpers/suite.js";

import "./tests/smoke.test.js";
import "./tests/auth.test.js";
import "./tests/catalog.test.js";
import "./tests/sales.test.js";
import "./tests/access-control.test.js";
import "./tests/fuzz.test.js";
import "./tests/regression/contracts.test.js";
import "./tests/functional/auth.test.js";
import "./tests/functional/users.test.js";
import "./tests/functional/stores.test.js";
import "./tests/functional/products.test.js";
import "./tests/functional/sales.test.js";
import "./tests/functional/org.test.js";
import "./tests/functional/fnb.test.js";
import "./tests/functional/admin.test.js";
import "./tests/integration/onboarding.test.js";
import "./tests/integration/cashier-lifecycle.test.js";
import "./tests/integration/multi-store.test.js";
import "./tests/integration/fnb-flow.test.js";

const GREEN = "\x1b[32m";
const RED = "\x1b[31m";
const DIM = "\x1b[2m";
const BOLD = "\x1b[1m";
const RESET = "\x1b[0m";

async function main(): Promise<void> {
  const { tags, skipWait, suite } = parseRunOptions(process.argv.slice(2));
  console.log(`${DIM}API base: ${API_BASE_URL}${RESET}`);
  console.log(`${DIM}Suite: ${suite}${RESET}`);
  console.log(`${DIM}Registered tests: ${getRegisteredTestCount()}${RESET}`);

  if (!skipWait) {
    process.stdout.write(`${DIM}Waiting for ${API_BASE_URL}/api/health ...${RESET}\n`);
    await waitForHealth(API_BASE_URL);
  }

  const { results, passed, failed, total } = await runAll({ tags });

  if (total === 0) {
    console.log(`${RED}No tests matched suite "${suite}"${RESET}`);
    process.exit(1);
  }

  for (const r of results) {
    const label = `[${r.suite}] ${r.name}`;
    if (r.passed) {
      console.log(`${GREEN}✓${RESET} ${label}`);
    } else {
      console.log(`${RED}✗${RESET} ${label}`);
      if (r.error) console.log(`${DIM}  ${r.error}${RESET}`);
    }
  }

  console.log("");
  console.log("─".repeat(60));
  if (failed === 0) {
    console.log(`${GREEN}${BOLD}✓ ALL TESTS PASSED${RESET} ${GREEN}(${passed} tests)${RESET}`);
  } else {
    console.log(`${RED}${BOLD}✗ TESTS FAILED${RESET} ${RED}(${failed} failed, ${passed} passed)${RESET}`);
  }
  console.log("─".repeat(60));

  process.exit(failed === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
