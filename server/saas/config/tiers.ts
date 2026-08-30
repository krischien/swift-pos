/** Shared SwiftPOS pricing tiers (centavos). Keep in sync with src/config/tiers.ts */

export type TierId = "tindahan" | "negosyo" | "kumpanya";

export type SubscriptionStatus =
  | "trialing"
  | "active"
  | "pending_payment"
  | "past_due"
  | "cancelled"
  | "expired";

export const TIER_ORDER: TierId[] = ["tindahan", "negosyo", "kumpanya"];

export const SETUP_FEE_CENTAVOS = Number(process.env.SETUP_FEE ?? 149_900);
export const TRIAL_DAYS = Number(process.env.TRIAL_DAYS ?? 7);

export interface TierDefinition {
  id: TierId;
  name: string;
  tagline: string;
  priceMonthlyCentavos: number;
  maxBranches: number | null;
  maxUsers: number | null;
  features: string[];
  popular?: boolean;
}

export const TIERS: Record<TierId, TierDefinition> = {
  tindahan: {
    id: "tindahan",
    name: "Tindahan",
    tagline: "Para sa iyong tindahan",
    priceMonthlyCentavos: Number(process.env.TINDAHAN_PRICE ?? 49_900),
    maxBranches: Number(process.env.TINDAHAN_MAX_BRANCHES ?? 3),
    maxUsers: Number(process.env.TINDAHAN_MAX_USERS ?? 5),
    features: [
      "Full POS & checkout",
      "Inventory management",
      "Sales reports & dashboard",
      "Receipt printing",
      "Email support",
    ],
  },
  negosyo: {
    id: "negosyo",
    name: "Negosyo",
    tagline: "Para sa lumalaking negosyo",
    priceMonthlyCentavos: Number(process.env.NEGOSYO_PRICE ?? 99_900),
    maxBranches: Number(process.env.NEGOSYO_MAX_BRANCHES ?? 8),
    maxUsers: Number(process.env.NEGOSYO_MAX_USERS ?? 15),
    popular: true,
    features: [
      "Everything in Tindahan",
      "Multi-branch sales comparison",
      "Advanced low-stock alerts",
      "Excel export",
      "Priority support",
    ],
  },
  kumpanya: {
    id: "kumpanya",
    name: "Kumpanya",
    tagline: "Para sa iyong kumpanya",
    priceMonthlyCentavos: Number(process.env.KUMPANYA_PRICE ?? 199_900),
    maxBranches: null,
    maxUsers: null,
    features: [
      "Everything in Negosyo",
      "Centralized HQ dashboard",
      "Dedicated account manager",
      "Custom onboarding",
      "Direct phone support",
    ],
  },
};

export function isTierId(value: string): value is TierId {
  return value === "tindahan" || value === "negosyo" || value === "kumpanya";
}

export function tierRank(tier: string | null | undefined): number {
  const id = (tier ?? "").toLowerCase() as TierId;
  const idx = TIER_ORDER.indexOf(id);
  return idx >= 0 ? idx : -1;
}

export function hasMinTier(
  current: string | null | undefined,
  min: TierId
): boolean {
  return tierRank(current) >= tierRank(min);
}

export function nextUpgradeTier(current: TierId): TierId | null {
  const idx = TIER_ORDER.indexOf(current);
  if (idx < 0 || idx >= TIER_ORDER.length - 1) return null;
  return TIER_ORDER[idx + 1];
}

export function normalizeLegacyPlan(plan: string | null | undefined): {
  tier: TierId;
  plan: string;
} {
  const p = (plan ?? "tindahan").toLowerCase();
  if (p === "pro") return { tier: "negosyo", plan: "negosyo" };
  if (p === "enterprise") return { tier: "kumpanya", plan: "kumpanya" };
  if (p === "free") return { tier: "tindahan", plan: "tindahan" };
  if (p === "tindahan" || p === "negosyo" || p === "kumpanya") {
    return { tier: p, plan: p };
  }
  if (p === "suspended") return { tier: "tindahan", plan: "suspended" };
  return { tier: "tindahan", plan: p };
}

export function getTierFeatures(tier: string | null | undefined) {
  const id = normalizeLegacyPlan(tier).tier;
  const rank = tierRank(id);
  return {
    excelExport: rank >= tierRank("negosyo"),
    multiBranchComparison: rank >= tierRank("negosyo"),
    advancedLowStock: rank >= tierRank("negosyo"),
    hqDashboard: rank >= tierRank("kumpanya"),
    prioritySupport: rank >= tierRank("negosyo"),
    dedicatedAccountManager: rank >= tierRank("kumpanya"),
    directPhoneSupport: rank >= tierRank("kumpanya"),
  };
}

export function getBillingContact() {
  return {
    gcash: process.env.BILLING_GCASH ?? "0923 835 1690",
    bank: process.env.BILLING_BANK ?? "BDO — Account details on request",
    phone: process.env.BILLING_CONTACT_PHONE ?? "+63 923 835 1690",
    email: process.env.BILLING_CONTACT_EMAIL ?? "hello@backbone.ph",
  };
}

export function getTierLimits(tier: string | null | undefined) {
  const id = normalizeLegacyPlan(tier).tier;
  const def = TIERS[id];
  return {
    tier: id,
    maxBranches: def.maxBranches,
    maxUsers: def.maxUsers,
    priceMonthlyCentavos: def.priceMonthlyCentavos,
  };
}
