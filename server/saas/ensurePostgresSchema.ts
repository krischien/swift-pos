import { saasPrisma } from "./db.js";

let ensured = false;

/**
 * Idempotent Postgres patches for Vercel/Neon when db push did not run at build time.
 * Safe to call on every cold start — runs once per instance.
 */
export async function ensurePostgresSchema(): Promise<void> {
  if (ensured) return;
  ensured = true;

  const url = (process.env.SAAS_DATABASE_URL ?? "").trim();
  if (!url.startsWith("postgresql://") && !url.startsWith("postgres://")) {
    return;
  }

  // Product cylinder columns (20260911000000_cylinder_tracking)
  await saasPrisma.$executeRawUnsafe(`
    ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "tracksCylinder" BOOLEAN NOT NULL DEFAULT false;
  `);
  await saasPrisma.$executeRawUnsafe(`
    ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "cylinderSize" TEXT;
  `);
  await saasPrisma.$executeRawUnsafe(`
    ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "depositAmount" DOUBLE PRECISION NOT NULL DEFAULT 0;
  `);
  await saasPrisma.$executeRawUnsafe(`
    ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "emptyStock" INTEGER NOT NULL DEFAULT 0;
  `);

  // CylinderLoan table (IF NOT EXISTS — required for cylinder routes, not product list)
  await saasPrisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "CylinderLoan" (
      "id" TEXT NOT NULL,
      "storeId" TEXT NOT NULL,
      "saleId" TEXT NOT NULL,
      "saleItemId" TEXT,
      "productId" TEXT NOT NULL,
      "quantity" INTEGER NOT NULL,
      "customerName" TEXT,
      "customerPhone" TEXT,
      "depositAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
      "depositRefunded" BOOLEAN NOT NULL DEFAULT false,
      "status" TEXT NOT NULL DEFAULT 'out',
      "outAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "returnedAt" TIMESTAMP(3),
      CONSTRAINT "CylinderLoan_pkey" PRIMARY KEY ("id")
    );
  `);

  // FKs/indexes — ignore if already present
  await saasPrisma.$executeRawUnsafe(`
    DO $$ BEGIN
      ALTER TABLE "CylinderLoan" ADD CONSTRAINT "CylinderLoan_storeId_fkey"
        FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;
  `);
  await saasPrisma.$executeRawUnsafe(`
    DO $$ BEGIN
      ALTER TABLE "CylinderLoan" ADD CONSTRAINT "CylinderLoan_saleId_fkey"
        FOREIGN KEY ("saleId") REFERENCES "Sale"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;
  `);
  await saasPrisma.$executeRawUnsafe(`
    DO $$ BEGIN
      ALTER TABLE "CylinderLoan" ADD CONSTRAINT "CylinderLoan_productId_fkey"
        FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;
  `);
  await saasPrisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "CylinderLoan_storeId_status_idx" ON "CylinderLoan"("storeId", "status");
  `);
  await saasPrisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "CylinderLoan_saleId_idx" ON "CylinderLoan"("saleId");
  `);
}
