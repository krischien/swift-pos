import type { TestTag } from "./runner.js";

const SUITE_TAG_MAP: Record<string, TestTag[]> = {
  smoke: ["smoke"],
  functional: ["functional"],
  integration: ["integration"],
  regression: ["regression"],
  fuzz: ["fuzz"],
  all: [],
};

export function parseRunOptions(argv: string[]): { tags?: TestTag[]; skipWait: boolean; suite: string } {
  const skipWait = argv.includes("--no-wait");
  let suite = "all";
  let tags: TestTag[] | undefined;

  for (const arg of argv) {
    if (arg.startsWith("--suite=")) {
      suite = arg.slice("--suite=".length);
    }
    if (arg.startsWith("--tags=")) {
      tags = arg
        .slice("--tags=".length)
        .split(",")
        .filter(Boolean) as TestTag[];
    }
  }

  if (!tags && SUITE_TAG_MAP[suite] !== undefined) {
    tags = SUITE_TAG_MAP[suite].length > 0 ? SUITE_TAG_MAP[suite] : undefined;
  }

  return { tags, skipWait, suite };
}
