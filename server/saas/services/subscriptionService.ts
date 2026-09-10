import { saasPrisma } from "../db.js";
import {
  TIERS,
  TRIAL_DAYS,
  type TierId,
  type SubscriptionStatus,
  getTierFeatures,
  getTierLimits,
  isTierId,
  normalizeLegacyPlan,
} from "../config/tiers.js";

export type OrgSubscriptionRow = {
  id: string;
  organizationId: string;
  tier: string;
  status: string;
  trialStart: Date | null;
  trialEnd: Date | null;
  currentPeriodStart: Date | null;
  currentPeriodEnd: Date | null;
  monthlyPriceCentavos: number;
  setupFeePaid: boolean;
  requestedTier: string | null;
};

/** Whether the org may use the app (POS, inventory, etc.). */
export function subscriptionAllowsAccess(
  status: string,
  trialEnd: Date | null | undefined
): { access: boolean; reason?: string } {
  const s = status.toLowerCase();
  if (s === "active") return { access: true };
  if (s === "trialing") {
    if (trialEnd && new Date(trialEnd) < new Date()) {
      return { access: false, reason: "trial_expired" };
    }
    return { access: true };
  }
  if (s === "pending_payment") return { access: false, reason: "pending_payment" };
  if (s === "past_due") return { access: false, reason: "past_due" };
  if (s === "cancelled") return { access: false, reason: "cancelled" };
  if (s === "expired") return { access: false, reason: "expired" };
  return { access: false, reason: "no_active_subscription" };
}

export async function ensureOrgSubscription(organizationId: string) {
  const existing = await saasPrisma.organizationSubscription.findUnique({
    where: { organizationId },
  });
  if (existing) return existing;

  const org = await saasPrisma.organization.findUnique({
    where: { id: organizationId },
  });
  if (!org) return null;

  const { tier, plan } = normalizeLegacyPlan(org.plan);
  const now = new Date();
  const trialEnd = org.trialEndsAt ? new Date(org.trialEndsAt) : null;
  let status: SubscriptionStatus = "trialing";
  let denormPlan = plan;

  if (plan === "suspended") {
    status = "expired";
    denormPlan = "suspended";
  } else if (plan === "negosyo" || plan === "kumpanya") {
    status = "active";
    denormPlan = plan;
  } else if (trialEnd && trialEnd < now) {
    status = "expired";
    denormPlan = "suspended";
  } else {
    status = "trialing";
    denormPlan = "tindahan";
  }

  return saasPrisma.organizationSubscription.create({
    data: {
      organizationId,
      tier: denormPlan === "suspended" ? "tindahan" : tier,
      status,
      trialStart: status === "trialing" ? now : null,
      trialEnd: status === "trialing" ? trialEnd ?? new Date(now.getTime() + TRIAL_DAYS * 86400000) : trialEnd,
      monthlyPriceCentavos: TIERS[tier].priceMonthlyCentavos,
    },
  });
}

export async function expireTrialIfNeeded(organizationId: string) {
  const sub = await ensureOrgSubscription(organizationId);
  if (!sub) return null;

  if (
    sub.status === "trialing" &&
    sub.trialEnd &&
    new Date(sub.trialEnd) < new Date()
  ) {
    await saasPrisma.$transaction([
      saasPrisma.organizationSubscription.update({
        where: { organizationId },
        data: { status: "expired" },
      }),
      saasPrisma.organization.update({
        where: { id: organizationId },
        data: { plan: "suspended" },
      }),
    ]);
    return saasPrisma.organizationSubscription.findUnique({
      where: { organizationId },
    });
  }
  return sub;
}

export async function createTrialSubscription(organizationId: string) {
  const now = new Date();
  const trialEnd = new Date(now.getTime() + TRIAL_DAYS * 86400000);
  return saasPrisma.organizationSubscription.create({
    data: {
      organizationId,
      tier: "tindahan",
      status: "trialing",
      trialStart: now,
      trialEnd,
      monthlyPriceCentavos: TIERS.tindahan.priceMonthlyCentavos,
    },
  });
}

export async function requestPlan(organizationId: string, tier: TierId) {
  await ensureOrgSubscription(organizationId);
  return saasPrisma.organizationSubscription.update({
    where: { organizationId },
    data: {
      requestedTier: tier,
      status: "pending_payment",
      monthlyPriceCentavos: TIERS[tier].priceMonthlyCentavos,
    },
  });
}

export async function activateSubscription(
  organizationId: string,
  tier: TierId,
  opts?: { setupFeePaid?: boolean; extendDays?: number }
) {
  await ensureOrgSubscription(organizationId);
  const now = new Date();
  const periodEnd = new Date(now.getTime() + 30 * 86400000);
  const billingDue = opts?.extendDays
    ? new Date(now.getTime() + opts.extendDays * 86400000)
    : periodEnd;

  await saasPrisma.$transaction([
    saasPrisma.organizationSubscription.update({
      where: { organizationId },
      data: {
        tier,
        status: "active",
        requestedTier: null,
        monthlyPriceCentavos: TIERS[tier].priceMonthlyCentavos,
        currentPeriodStart: now,
        currentPeriodEnd: periodEnd,
        ...(opts?.setupFeePaid !== undefined
          ? { setupFeePaid: opts.setupFeePaid }
          : {}),
      },
    }),
    saasPrisma.organization.update({
      where: { id: organizationId },
      data: {
        plan: tier,
        billingDueDate: billingDue,
        trialEndsAt: null,
      },
    }),
  ]);

  return saasPrisma.organizationSubscription.findUnique({
    where: { organizationId },
  });
}

export async function cancelSubscription(organizationId: string) {
  await saasPrisma.$transaction([
    saasPrisma.organizationSubscription.update({
      where: { organizationId },
      data: { status: "cancelled" },
    }),
    saasPrisma.organization.update({
      where: { id: organizationId },
      data: { plan: "suspended" },
    }),
  ]);
}

export async function getOrgUsage(organizationId: string) {
  const [storeCount, userCount] = await Promise.all([
    saasPrisma.store.count({ where: { organizationId } }),
    saasPrisma.user.count({ where: { organizationId } }),
  ]);
  return { storeCount, userCount };
}

export async function assertCanAddBranch(organizationId: string): Promise<{
  ok: boolean;
  code?: string;
  message?: string;
  upgradeTo?: TierId | null;
  current?: number;
  max?: number | null;
  tier?: string;
}> {
  const sub = await expireTrialIfNeeded(organizationId);
  if (!sub) return { ok: false, code: "NO_SUBSCRIPTION", message: "No subscription" };

  const access = subscriptionAllowsAccess(sub.status, sub.trialEnd);
  if (!access.access) {
    return {
      ok: false,
      code: "SUBSCRIPTION_LOCKED",
      message: "Subscription inactive. Choose a plan to continue.",
    };
  }

  const limits = getTierLimits(sub.tier);
  const { storeCount } = await getOrgUsage(organizationId);
  if (limits.maxBranches !== null && storeCount >= limits.maxBranches) {
    const upgradeTo =
      limits.tier === "tindahan" ? "negosyo" : limits.tier === "negosyo" ? "kumpanya" : null;
    return {
      ok: false,
      code: "TIER_LIMIT_BRANCH",
      message: `Naabot mo na ang limitasyon ng iyong ${TIERS[limits.tier].name} plan (${limits.maxBranches} branches).`,
      upgradeTo,
      current: storeCount,
      max: limits.maxBranches,
      tier: limits.tier,
    };
  }
  return { ok: true, current: storeCount, max: limits.maxBranches, tier: limits.tier };
}

export async function assertCanAddUser(organizationId: string): Promise<{
  ok: boolean;
  code?: string;
  message?: string;
  upgradeTo?: TierId | null;
  current?: number;
  max?: number | null;
  tier?: string;
}> {
  const sub = await expireTrialIfNeeded(organizationId);
  if (!sub) return { ok: false, code: "NO_SUBSCRIPTION", message: "No subscription" };

  const access = subscriptionAllowsAccess(sub.status, sub.trialEnd);
  if (!access.access) {
    return {
      ok: false,
      code: "SUBSCRIPTION_LOCKED",
      message: "Subscription inactive. Choose a plan to continue.",
    };
  }

  const limits = getTierLimits(sub.tier);
  const { userCount } = await getOrgUsage(organizationId);
  if (limits.maxUsers !== null && userCount >= limits.maxUsers) {
    const upgradeTo =
      limits.tier === "tindahan" ? "negosyo" : limits.tier === "negosyo" ? "kumpanya" : null;
    return {
      ok: false,
      code: "TIER_LIMIT_USER",
      message: `Naabot mo na ang limitasyon ng iyong ${TIERS[limits.tier].name} plan (${limits.maxUsers} users).`,
      upgradeTo,
      current: userCount,
      max: limits.maxUsers,
      tier: limits.tier,
    };
  }
  return { ok: true, current: userCount, max: limits.maxUsers, tier: limits.tier };
}

export function buildSubscriptionPublicPayload(
  org: { id: string; name: string; plan: string; trialEndsAt?: Date | null },
  sub: OrgSubscriptionRow | null,
  usage: { storeCount: number; userCount: number }
) {
  const tier = sub?.tier ?? normalizeLegacyPlan(org.plan).tier;
  const limits = getTierLimits(tier);
  const features = getTierFeatures(tier);
  return {
    organizationId: org.id,
    organizationName: org.name,
    plan: org.plan,
    tier,
    status: sub?.status ?? (org.plan === "suspended" ? "expired" : "trialing"),
    trialEndsAt: sub?.trialEnd?.toISOString() ?? org.trialEndsAt?.toISOString() ?? null,
    currentPeriodEnd: sub?.currentPeriodEnd?.toISOString() ?? null,
    monthlyPriceCentavos: sub?.monthlyPriceCentavos ?? limits.priceMonthlyCentavos,
    setupFeePaid: sub?.setupFeePaid ?? false,
    requestedTier: sub?.requestedTier ?? null,
    limits: {
      maxBranches: limits.maxBranches,
      maxUsers: limits.maxUsers,
    },
    usage,
    features,
  };
}

export { isTierId, TIERS, getTierFeatures, getTierLimits };
