/**
 * Backfill OrganizationSubscription from legacy Organization.plan values.
 * Run: npx tsx --env-file=.env server/saas/scripts/backfillSubscriptions.ts
 */
import { saasPrisma } from "../db.js";
import { TIERS, TRIAL_DAYS, normalizeLegacyPlan } from "../config/tiers.js";

async function main() {
  const orgs = await saasPrisma.organization.findMany({
    include: { subscription: true },
  });

  const now = new Date();
  let created = 0;
  let updatedPlans = 0;

  for (const org of orgs) {
    const legacy = (org.plan ?? "free").toLowerCase();
    const { tier } = normalizeLegacyPlan(legacy);

    let status: string;
    let plan: string;
    let trialStart: Date | null = null;
    let trialEnd: Date | null = org.trialEndsAt ? new Date(org.trialEndsAt) : null;

    if (legacy === "suspended") {
      status = "expired";
      plan = "suspended";
    } else if (legacy === "pro") {
      status = "active";
      plan = "negosyo";
    } else if (legacy === "enterprise") {
      status = "active";
      plan = "kumpanya";
    } else if (legacy === "free" || legacy === "tindahan") {
      if (trialEnd && trialEnd < now) {
        status = "expired";
        plan = "suspended";
      } else {
        status = "trialing";
        plan = "tindahan";
        if (!trialEnd) {
          trialStart = now;
          trialEnd = new Date(now.getTime() + TRIAL_DAYS * 24 * 60 * 60 * 1000);
        } else {
          trialStart = new Date(trialEnd.getTime() - TRIAL_DAYS * 24 * 60 * 60 * 1000);
        }
      }
    } else if (legacy === "negosyo" || legacy === "kumpanya") {
      status = "active";
      plan = legacy;
    } else {
      status = "trialing";
      plan = "tindahan";
    }

    const price = TIERS[tier as keyof typeof TIERS]?.priceMonthlyCentavos ?? TIERS.tindahan.priceMonthlyCentavos;

    if (!org.subscription) {
      await saasPrisma.organizationSubscription.create({
        data: {
          organizationId: org.id,
          tier: plan === "suspended" ? "tindahan" : (plan as string),
          status,
          trialStart,
          trialEnd,
          monthlyPriceCentavos: price,
          currentPeriodStart: status === "active" ? now : null,
          currentPeriodEnd:
            status === "active"
              ? new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)
              : null,
        },
      });
      created++;
    }

    if (org.plan !== plan || (trialEnd && org.trialEndsAt?.getTime() !== trialEnd.getTime())) {
      await saasPrisma.organization.update({
        where: { id: org.id },
        data: {
          plan,
          trialEndsAt: trialEnd ?? org.trialEndsAt,
        },
      });
      updatedPlans++;
    }
  }

  console.log(`Backfill done. subscriptions created=${created}, plans updated=${updatedPlans}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => saasPrisma.$disconnect());
