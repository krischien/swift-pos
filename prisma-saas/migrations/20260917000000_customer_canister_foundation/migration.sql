-- Customer-linked canister tracking (SQLite development history).
-- PostgreSQL deployments use schema.pg.prisma plus ensurePostgresSchema.ts.

ALTER TABLE "Store" ADD COLUMN "enableCylinderTracking" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Store" ADD COLUMN "collectCylinderDeposits" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Sale" ADD COLUMN "customerId" TEXT;
ALTER TABLE "Sale" ADD COLUMN "depositAmount" REAL NOT NULL DEFAULT 0;
ALTER TABLE "Sale" ADD COLUMN "amountDue" REAL NOT NULL DEFAULT 0;
ALTER TABLE "SaleItem" ADD COLUMN "broughtEmptyQuantity" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "CylinderLoan" ADD COLUMN "customerId" TEXT;
ALTER TABLE "CylinderLoan" ADD COLUMN "returnedQuantity" INTEGER NOT NULL DEFAULT 0;

UPDATE "Sale" SET "amountDue" = "total" + "depositAmount";
UPDATE "CylinderLoan" SET "returnedQuantity" = "quantity" WHERE "status" = 'returned';

CREATE TABLE "Customer" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "storeId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "normalizedName" TEXT NOT NULL,
  "phone" TEXT,
  "normalizedPhone" TEXT,
  "nickname" TEXT,
  "address" TEXT,
  "qrToken" TEXT NOT NULL,
  "isSuki" BOOLEAN NOT NULL DEFAULT false,
  "sukiAssignedAt" DATETIME,
  "sukiAssignedById" TEXT,
  "sukiNote" TEXT,
  "archived" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Customer_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "Customer_sukiAssignedById_fkey" FOREIGN KEY ("sukiAssignedById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE "CylinderReturn" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "loanId" TEXT NOT NULL,
  "storeId" TEXT NOT NULL,
  "quantity" INTEGER NOT NULL,
  "refundAmount" REAL NOT NULL DEFAULT 0,
  "actorId" TEXT,
  "actorName" TEXT,
  "note" TEXT,
  "returnedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CylinderReturn_loanId_fkey" FOREIGN KEY ("loanId") REFERENCES "CylinderLoan" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "CylinderReturn_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "CylinderReturn_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "Customer_qrToken_key" ON "Customer"("qrToken");
CREATE INDEX "Customer_storeId_normalizedName_idx" ON "Customer"("storeId", "normalizedName");
CREATE INDEX "Customer_storeId_normalizedPhone_idx" ON "Customer"("storeId", "normalizedPhone");
CREATE INDEX "Customer_storeId_archived_idx" ON "Customer"("storeId", "archived");
CREATE INDEX "CylinderLoan_customerId_idx" ON "CylinderLoan"("customerId");
CREATE INDEX "CylinderReturn_loanId_returnedAt_idx" ON "CylinderReturn"("loanId", "returnedAt");
CREATE INDEX "CylinderReturn_storeId_returnedAt_idx" ON "CylinderReturn"("storeId", "returnedAt");
