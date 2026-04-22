/**
 * `npm run dev:saas` uses the Prisma client from prisma-saas/schema.prisma (SQLite).
 * A PostgreSQL URL requires the client from schema.pg.prisma (see `npm run build:api` / Vercel).
 */
export function ensureSqliteSaasDatabaseUrl(): void {
  const raw = process.env.SAAS_DATABASE_URL;
  const url = (raw ?? "").trim();

  if (!url) {
    const fallback = "file:./prisma-saas/saas-dev.db";
    console.warn(`[SaaS] SAAS_DATABASE_URL unset; defaulting to ${fallback} (see .env.example)`);
    process.env.SAAS_DATABASE_URL = fallback;
    return;
  }

  if (/^postgres(ql)?:\/\//i.test(url)) {
    console.error(
      [
        "[SaaS] SAAS_DATABASE_URL is PostgreSQL, but this dev server uses the SQLite Prisma client (prisma-saas/schema.prisma).",
        "",
        "For local API development, set in .env:",
        '  SAAS_DATABASE_URL="file:./prisma-saas/saas-dev.db"',
        "",
        "Then sync the schema:",
        "  npx prisma db push --schema=prisma-saas/schema.prisma",
        "",
        "Production / Postgres uses schema.pg.prisma and a different generate step (see package.json build:api).",
      ].join("\n"),
    );
    process.exit(1);
  }

  if (!url.startsWith("file:")) {
    console.error(
      `[SaaS] SAAS_DATABASE_URL must start with file: for SQLite dev (see .env.example). Got: ${url.slice(0, 48)}${url.length > 48 ? "…" : ""}`,
    );
    process.exit(1);
  }
}
