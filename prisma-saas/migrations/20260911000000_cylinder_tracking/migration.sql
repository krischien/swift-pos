-- Cylinder / LPG returnable asset tracking (SaaS)

ALTER TABLE "Product" ADD COLUMN "tracksCylinder" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Product" ADD COLUMN "cylinderSize" TEXT;
ALTER TABLE "Product" ADD COLUMN "depositAmount" REAL NOT NULL DEFAULT 0;
ALTER TABLE "Product" ADD COLUMN "emptyStock" INTEGER NOT NULL DEFAULT 0;

CREATE TABLE "CylinderLoan" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "storeId" TEXT NOT NULL,
    "saleId" TEXT NOT NULL,
    "saleItemId" TEXT,
    "productId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "customerName" TEXT,
    "customerPhone" TEXT,
    "depositAmount" REAL NOT NULL DEFAULT 0,
    "depositRefunded" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'out',
    "outAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "returnedAt" DATETIME,
    CONSTRAINT "CylinderLoan_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CylinderLoan_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "Sale" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CylinderLoan_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "CylinderLoan_storeId_status_idx" ON "CylinderLoan"("storeId", "status");
CREATE INDEX "CylinderLoan_saleId_idx" ON "CylinderLoan"("saleId");
