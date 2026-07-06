type TestFn = () => void | Promise<void>;

export type TestTag =
  | "smoke"
  | "functional"
  | "integration"
  | "regression"
  | "fuzz";

export interface TestOptions {
  tags?: TestTag[];
}

interface TestCase {
  suite: string;
  name: string;
  fn: TestFn;
  tags: TestTag[];
}

const tests: TestCase[] = [];
let currentSuite = "(root)";

export function describe(name: string, fn: () => void): void {
  const prev = currentSuite;
  currentSuite = name;
  fn();
  currentSuite = prev;
}

export function test(name: string, fn: TestFn, options: TestOptions = {}): void {
  tests.push({
    suite: currentSuite,
    name,
    fn,
    tags: options.tags ?? ["regression"],
  });
}

export function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

export function assertEqual<T>(actual: T, expected: T, message?: string): void {
  if (actual !== expected) {
    throw new Error(message ?? `Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

export function assertOk(actual: unknown, message?: string): void {
  if (actual == null || actual === false) {
    throw new Error(message ?? `Expected truthy value, got ${JSON.stringify(actual)}`);
  }
}

export function assertIncludes(haystack: string, needle: string, message?: string): void {
  if (!haystack.includes(needle)) {
    throw new Error(message ?? `Expected "${haystack}" to include "${needle}"`);
  }
}

export function assertOneOf<T>(actual: T, expected: T[], message?: string): void {
  if (!expected.includes(actual)) {
    throw new Error(message ?? `Expected one of ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

export function assertStatusNot500(status: number, context: string): void {
  if (status >= 500) {
    throw new Error(`${context}: server returned ${status} (expected 4xx, not 5xx)`);
  }
}

export function assertHasKeys(obj: Record<string, unknown>, keys: string[], label: string): void {
  for (const key of keys) {
    if (!(key in obj)) {
      throw new Error(`${label}: missing key "${key}"`);
    }
  }
}

export interface RunOptions {
  tags?: TestTag[];
}

export interface TestResult {
  suite: string;
  name: string;
  passed: boolean;
  error?: string;
  tags: TestTag[];
}

function matchesTags(testTags: TestTag[], filterTags?: TestTag[]): boolean {
  if (!filterTags || filterTags.length === 0) return true;
  return filterTags.some((t) => testTags.includes(t));
}

export async function runAll(options: RunOptions = {}): Promise<{
  results: TestResult[];
  passed: number;
  failed: number;
  total: number;
}> {
  const filtered = tests.filter((t) => matchesTags(t.tags, options.tags));
  const results: TestResult[] = [];

  for (const { suite, name, fn, tags } of filtered) {
    try {
      await fn();
      results.push({ suite, name, passed: true, tags });
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      results.push({ suite, name, passed: false, error, tags });
    }
  }

  const passed = results.filter((r) => r.passed).length;
  const failed = results.length - passed;
  return { results, passed, failed, total: filtered.length };
}

export function getRegisteredTestCount(): number {
  return tests.length;
}
