#!/usr/bin/env node
/**
 * Creates .vercel/output for Build Output API.
 * Bypasses Vercel's automatic api/ bundling (which was causing server/saas/index import errors).
 */
import { mkdir, cp, writeFile } from "fs/promises";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { execSync } from "child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const out = join(root, ".vercel", "output");
const funcDir = join(out, "functions", "api.func");

async function run() {
  console.log("[vercel-output] Building...");
  execSync("npm run build:saas", { cwd: root, stdio: "inherit" });
  execSync("npx prisma generate --schema=prisma-saas/schema.pg.prisma", { cwd: root, stdio: "inherit" });
  // DB schema: run separately before deploy: npx prisma db push --schema=prisma-saas/schema.pg.prisma

  await mkdir(funcDir, { recursive: true });
  await mkdir(join(out, "static"), { recursive: true });

  console.log("[vercel-output] Bundling API...");
  execSync(
    "npx esbuild server/saas/index.ts --bundle --platform=node --format=esm --outfile=.vercel/output/functions/api.func/index.js --packages=external",
    { cwd: root, stdio: "inherit" }
  );
  await cp(join(root, "dist"), join(out, "static"), { recursive: true });

  await mkdir(join(funcDir, "prisma-saas", "generated"), { recursive: true });
  await cp(join(root, "prisma-saas", "generated"), join(funcDir, "prisma-saas", "generated"), {
    recursive: true,
  });

  await writeFile(
    join(funcDir, ".vc-config.json"),
    JSON.stringify({
      runtime: "nodejs22.x",
      handler: "index.js",
      launcherType: "Nodejs",
      maxDuration: 30,
      memory: 1024,
    })
  );

  await writeFile(
    join(out, "config.json"),
    JSON.stringify({
      version: 3,
      routes: [
        { handle: "filesystem" },
        { src: "/(.*)", dest: "/index.html" },
      ],
    })
  );

  console.log("[vercel-output] Done. Output at .vercel/output");
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
