-- Backfill trialEndsAt for existing free organizations (7 days from creation)
UPDATE "Organization"
SET "trialEndsAt" = datetime("createdAt", '+7 days')
WHERE "plan" = 'free' AND "trialEndsAt" IS NULL;
