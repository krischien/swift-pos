/**
 * Runs TestCafe E2E tests and prints a colored pass/fail summary.
 * Usage: node scripts/e2e-run-with-summary.mjs [--headed]
 */
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");

const GREEN = "\x1b[32m";
const RED = "\x1b[31m";
const DIM = "\x1b[2m";
const BOLD = "\x1b[1m";
const RESET = "\x1b[0m";

const headed = process.argv.includes("--headed");
const browser = headed ? "chrome" : "chrome:headless";

function runTestcafe() {
  return new Promise((resolve) => {
    let output = "";
    const args = [
      "testcafe",
      "--config-file",
      "e2e/.testcaferc.cjs",
      "--base-url",
      "http://localhost:8080",
      browser,
      "e2e/tests",
    ];

    const child = spawn("npx", args, {
      shell: true,
      cwd: rootDir,
      env: process.env,
    });

    const append = (chunk, stream) => {
      const text = chunk.toString();
      stream.write(text);
      output += text;
    };

    child.stdout?.on("data", (chunk) => append(chunk, process.stdout));
    child.stderr?.on("data", (chunk) => append(chunk, process.stderr));
    child.on("close", (code) => resolve({ code: code ?? 1, output }));
  });
}

function stripAnsi(text) {
  return text.replace(/\x1b\[[0-9;]*m/g, "");
}

function parseResults(rawOutput) {
  const output = stripAnsi(rawOutput);
  const failures = [];
  let passed = null;
  let totalFailed = null;

  const lines = output.split(/\r?\n/);
  let currentFixture = "";
  let activeFailure = null;

  for (const line of lines) {
    const passedMatch = line.match(/(\d+)\s+passed\s+\(/);
    if (passedMatch) passed = Number(passedMatch[1]);

    const failedSummaryMatch = line.match(/(\d+)\/(\d+)\s+failed\s+\(/);
    if (failedSummaryMatch) {
      totalFailed = Number(failedSummaryMatch[1]);
      const total = Number(failedSummaryMatch[2]);
      passed = total - totalFailed;
    }

    const fixtureMatch =
      line.match(/^\[test\]\s{2}([A-Za-z(].+?)\s*$/) ??
      line.match(/^ {2}([A-Za-z(][^√×]+?)\s*$/);
    if (fixtureMatch && !line.includes("√") && !line.includes("×")) {
      currentFixture = fixtureMatch[1].trim();
      continue;
    }

    const failMatch = line.match(/(?:\[test\]\s*)?×\s+(.+?)(?:\s+\(unstable\))?\s*$/);
    if (failMatch) {
      activeFailure = {
        fixture: currentFixture,
        name: failMatch[1].trim(),
        message: "",
        location: "",
      };
      failures.push(activeFailure);
      continue;
    }

    if (activeFailure) {
      const errMatch = line.match(/^\s+\d+\)\s+(.+)/);
      if (errMatch && !activeFailure.message) {
        activeFailure.message = errMatch[1].trim();
      }

      const locMatch = line.match(/at\s+<anonymous>\s+\(([^)]+e2e[/\\]tests[^)]+)\)/i);
      if (locMatch) {
        activeFailure.location = locMatch[1].replace(/\\/g, "/");
        activeFailure = null;
      }
    }
  }

  return { passed, totalFailed, failures };
}

function printSummary({ code, output }) {
  const { passed, totalFailed, failures } = parseResults(output);
  const failCount = failures.length || totalFailed || (code !== 0 ? "?" : 0);

  console.log("");
  console.log("─".repeat(60));

  if (code === 0) {
    const count = passed ?? "?";
    console.log(`${GREEN}${BOLD}✓ ALL TESTS PASSED${RESET} ${GREEN}(${count} tests)${RESET}`);
  } else {
    console.log(`${RED}${BOLD}✗ TESTS FAILED${RESET} ${RED}(${failCount} failed)${RESET}`);

    if (failures.length > 0) {
      console.log("");
      console.log(`${BOLD}Failure details:${RESET}`);
      failures.forEach((f, i) => {
        const label = f.fixture ? `[${f.fixture}] ${f.name}` : f.name;
        console.log(`${RED}  ${i + 1}. ${label}${RESET}`);
        if (f.message) console.log(`${DIM}     ${f.message}${RESET}`);
        if (f.location) console.log(`${DIM}     → ${f.location}${RESET}`);
      });
    } else {
      console.log(`${DIM}  See TestCafe output above for details.${RESET}`);
    }
  }

  console.log("─".repeat(60));
  console.log("");
}

const { code, output } = await runTestcafe();
printSummary({ code, output });
process.exit(code);
