/** Shared SwiftPOS pricing tiers (centavos). Keep in sync with server/saas/config/tiers.ts */

export type TierId = "tindahan" | "negosyo" | "kumpanya";

export type SubscriptionStatus =
  | "trialing"
  | "active"
  | "pending_payment"
  | "past_due"
  | "cancelled"
  | "expired";

export const TIER_ORDER: TierId[] = ["tindahan", "negosyo", "kumpanya"];

export const SETUP_FEE_CENTAVOS = 149_900;
export const TRIAL_DAYS = 7;

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
    priceMonthlyCentavos: 49_900,
    maxBranches: 3,
    maxUsers: 5,
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
    priceMonthlyCentavos: 99_900,
    maxBranches: 8,
    maxUsers: 15,
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
    priceMonthlyCentavos: 199_900,
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

export function formatPhpFromCentavos(centavos: number): string {
  return (centavos / 100).toLocaleString("en-PH", {
    style: "currency",
    currency: "PHP",
    maximumFractionDigits: 0,
  });
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
  const id = (normalizeLegacyPlan(tier).tier) as TierId;
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

export const BILLING_DEFAULTS = {
  gcash: process.env.VITE_BILLING_GCASH ?? "0923 835 1690",
  bank: process.env.VITE_BILLING_BANK ?? "BDO — Account details on request",
  phone: process.env.VITE_BILLING_CONTACT_PHONE ?? "+63 923 835 1690",
  email: process.env.VITE_BILLING_CONTACT_EMAIL ?? "hello@backbone.ph",
};
