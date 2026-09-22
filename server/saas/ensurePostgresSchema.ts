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

  await saasPrisma.$executeRawUnsafe(`
    ALTER TABLE "Store" ADD COLUMN IF NOT EXISTS "enableCylinderTracking" BOOLEAN NOT NULL DEFAULT false;
    ALTER TABLE "Store" ADD COLUMN IF NOT EXISTS "collectCylinderDeposits" BOOLEAN NOT NULL DEFAULT true;
    ALTER TABLE "Sale" ADD COLUMN IF NOT EXISTS "customerId" TEXT;
    ALTER TABLE "Sale" ADD COLUMN IF NOT EXISTS "depositAmount" DOUBLE PRECISION NOT NULL DEFAULT 0;
    ALTER TABLE "Sale" ADD COLUMN IF NOT EXISTS "amountDue" DOUBLE PRECISION NOT NULL DEFAULT 0;
    ALTER TABLE "SaleItem" ADD COLUMN IF NOT EXISTS "broughtEmptyQuantity" INTEGER NOT NULL DEFAULT 0;
    ALTER TABLE "CylinderLoan" ADD COLUMN IF NOT EXISTS "customerId" TEXT;
    ALTER TABLE "CylinderLoan" ADD COLUMN IF NOT EXISTS "returnedQuantity" INTEGER NOT NULL DEFAULT 0;
    UPDATE "Sale" SET "amountDue" = "total" + "depositAmount" WHERE "amountDue" = 0;
    UPDATE "CylinderLoan" SET "returnedQuantity" = "quantity"
      WHERE "status" = 'returned' AND "returnedQuantity" <> "quantity";
  `);

  await saasPrisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "Customer" (
      "id" TEXT NOT NULL,
      "storeId" TEXT NOT NULL,
      "name" TEXT NOT NULL,
      "normalizedName" TEXT NOT NULL,
      "phone" TEXT,
      "normalizedPhone" TEXT,
      "nickname" TEXT,
      "address" TEXT,
      "qrToken" TEXT NOT NULL,
      "isSuki" BOOLEAN NOT NULL DEFAULT false,
      "sukiAssignedAt" TIMESTAMP(3),
      "sukiAssignedById" TEXT,
      "sukiNote" TEXT,
      "archived" BOOLEAN NOT NULL DEFAULT false,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "Customer_pkey" PRIMARY KEY ("id")
    );
    CREATE UNIQUE INDEX IF NOT EXISTS "Customer_qrToken_key" ON "Customer"("qrToken");
    CREATE INDEX IF NOT EXISTS "Customer_storeId_normalizedName_idx" ON "Customer"("storeId", "normalizedName");
    CREATE INDEX IF NOT EXISTS "Customer_storeId_normalizedPhone_idx" ON "Customer"("storeId", "normalizedPhone");
    CREATE INDEX IF NOT EXISTS "Customer_storeId_archived_idx" ON "Customer"("storeId", "archived");
  `);

  await saasPrisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "CylinderReturn" (
      "id" TEXT NOT NULL,
      "loanId" TEXT NOT NULL,
      "storeId" TEXT NOT NULL,
      "quantity" INTEGER NOT NULL,
      "refundAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
      "actorId" TEXT,
      "actorName" TEXT,
      "note" TEXT,
      "returnedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "CylinderReturn_pkey" PRIMARY KEY ("id")
    );
    CREATE INDEX IF NOT EXISTS "CylinderReturn_loanId_returnedAt_idx" ON "CylinderReturn"("loanId", "returnedAt");
    CREATE INDEX IF NOT EXISTS "CylinderReturn_storeId_returnedAt_idx" ON "CylinderReturn"("storeId", "returnedAt");
    CREATE INDEX IF NOT EXISTS "CylinderLoan_customerId_idx" ON "CylinderLoan"("customerId");
  `);

  const constraints = [
    `ALTER TABLE "Customer" ADD CONSTRAINT "Customer_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE`,
    `ALTER TABLE "Customer" ADD CONSTRAINT "Customer_sukiAssignedById_fkey" FOREIGN KEY ("sukiAssignedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE`,
    `ALTER TABLE "Sale" ADD CONSTRAINT "Sale_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE`,
    `ALTER TABLE "CylinderLoan" ADD CONSTRAINT "CylinderLoan_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE`,
    `ALTER TABLE "CylinderReturn" ADD CONSTRAINT "CylinderReturn_loanId_fkey" FOREIGN KEY ("loanId") REFERENCES "CylinderLoan"("id") ON DELETE CASCADE ON UPDATE CASCADE`,
    `ALTER TABLE "CylinderReturn" ADD CONSTRAINT "CylinderReturn_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE`,
    `ALTER TABLE "CylinderReturn" ADD CONSTRAINT "CylinderReturn_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE`,
  ];
  for (const statement of constraints) {
    await saasPrisma.$executeRawUnsafe(`
      DO $$ BEGIN ${statement};
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    `);
  }
}
