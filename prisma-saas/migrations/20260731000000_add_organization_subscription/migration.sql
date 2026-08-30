-- Org-level subscriptions (Tindahan / Negosyo / Kumpanya)
-- CreateTable
CREATE TABLE "OrganizationSubscription" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organizationId" TEXT NOT NULL,
    "tier" TEXT NOT NULL DEFAULT 'tindahan',
    "status" TEXT NOT NULL DEFAULT 'trialing',
    "trialStart" DATETIME,
    "trialEnd" DATETIME,
    "currentPeriodStart" DATETIME,
    "currentPeriodEnd" DATETIME,
    "monthlyPriceCentavos" INTEGER NOT NULL DEFAULT 49900,
    "setupFeePaid" BOOLEAN NOT NULL DEFAULT false,
    "requestedTier" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "OrganizationSubscription_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "OrganizationSubscription_organizationId_key" ON "OrganizationSubscription"("organizationId");
