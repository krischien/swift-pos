-- Customer-linked canister tracking for solo SQLite.

ALTER TABLE "Product" ADD COLUMN "tracksCylinder" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Product" ADD COLUMN "cylinderSize" TEXT;
ALTER TABLE "Product" ADD COLUMN "depositAmount" REAL NOT NULL DEFAULT 0;
ALTER TABLE "Product" ADD COLUMN "emptyStock" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Sale" ADD COLUMN "customerId" TEXT;
ALTER TABLE "Sale" ADD COLUMN "depositAmount" REAL NOT NULL DEFAULT 0;
ALTER TABLE "Sale" ADD COLUMN "amountDue" REAL NOT NULL DEFAULT 0;
ALTER TABLE "Sale" ADD COLUMN "status" TEXT NOT NULL DEFAULT 'completed';
ALTER TABLE "SaleItem" ADD COLUMN "broughtEmptyQuantity" INTEGER NOT NULL DEFAULT 0;

UPDATE "Sale" SET "amountDue" = "total" + "depositAmount";

CREATE TABLE "Customer" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "storeId" TEXT NOT NULL DEFAULT 'solo',
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
  CONSTRAINT "Customer_sukiAssignedById_fkey" FOREIGN KEY ("sukiAssignedById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE "CylinderLoan" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "storeId" TEXT NOT NULL DEFAULT 'solo',
  "saleId" TEXT NOT NULL,
  "saleItemId" TEXT,
  "productId" TEXT NOT NULL,
  "customerId" TEXT,
  "quantity" INTEGER NOT NULL,
  "returnedQuantity" INTEGER NOT NULL DEFAULT 0,
  "customerName" TEXT,
  "customerPhone" TEXT,
  "depositAmount" REAL NOT NULL DEFAULT 0,
  "depositRefunded" BOOLEAN NOT NULL DEFAULT false,
  "status" TEXT NOT NULL DEFAULT 'out',
  "outAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "returnedAt" DATETIME,
  CONSTRAINT "CylinderLoan_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "Sale" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "CylinderLoan_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "CylinderLoan_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE "CylinderReturn" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "loanId" TEXT NOT NULL,
  "storeId" TEXT NOT NULL DEFAULT 'solo',
  "quantity" INTEGER NOT NULL,
  "refundAmount" REAL NOT NULL DEFAULT 0,
  "actorId" TEXT,
  "actorName" TEXT,
  "note" TEXT,
  "returnedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CylinderReturn_loanId_fkey" FOREIGN KEY ("loanId") REFERENCES "CylinderLoan" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "CylinderReturn_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

UPDATE "CylinderLoan" SET "returnedQuantity" = "quantity" WHERE "status" = 'returned';

CREATE UNIQUE INDEX "Customer_qrToken_key" ON "Customer"("qrToken");
CREATE INDEX "Customer_storeId_normalizedName_idx" ON "Customer"("storeId", "normalizedName");
CREATE INDEX "Customer_storeId_normalizedPhone_idx" ON "Customer"("storeId", "normalizedPhone");
CREATE INDEX "CylinderLoan_storeId_status_idx" ON "CylinderLoan"("storeId", "status");
CREATE INDEX "CylinderLoan_customerId_idx" ON "CylinderLoan"("customerId");
