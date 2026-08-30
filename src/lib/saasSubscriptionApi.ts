import { getSaasApiBase } from "./saasApiConfig";
import type { TierId, TierDefinition } from "@/config/tiers";

export type SubscriptionPayload = {
  organizationId: string;
  organizationName: string;
  plan: string;
  tier: string;
  status: string;
  trialEndsAt: string | null;
  currentPeriodEnd: string | null;
  monthlyPriceCentavos: number;
  setupFeePaid: boolean;
  requestedTier: string | null;
  limits: { maxBranches: number | null; maxUsers: number | null };
  usage: { storeCount: number; userCount: number };
  features: {
    excelExport: boolean;
    multiBranchComparison: boolean;
    advancedLowStock: boolean;
    hqDashboard: boolean;
    prioritySupport: boolean;
    dedicatedAccountManager: boolean;
    directPhoneSupport: boolean;
  };
  tiers?: TierDefinition[];
  billingContact?: {
    gcash: string;
    bank: string;
    phone: string;
    email: string;
  };
  setupFeeCentavos?: number;
  paymentReference?: string;
};

function authHeaders(): HeadersInit {
  const token = window.localStorage.getItem("saas_token");
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
}

function apiUrl(path: string): string {
  const base = getSaasApiBase().replace(/\/$/, "");
  return `${base}${path}`;
}

export async function getSubscription(): Promise<SubscriptionPayload> {
  const res = await fetch(apiUrl("/api/org/subscription"), {
    headers: authHeaders(),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || "Failed to fetch subscription");
  }
  return res.json();
}

export async function requestSubscriptionPlan(tier: TierId): Promise<SubscriptionPayload> {
  const res = await fetch(apiUrl("/api/org/subscription/request"), {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ tier }),
  });
  if (!res.ok) {
    const text = await res.text();
    let message = text;
    try {
      message = (JSON.parse(text) as { message?: string }).message || text;
    } catch {
      /* ignore */
    }
    throw new Error(message || "Failed to request plan");
  }
  return res.json();
}

export async function cancelSubscriptionRequest(): Promise<{ ok: boolean; message: string }> {
  const res = await fetch(apiUrl("/api/org/subscription/cancel-request"), {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({}),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || "Failed to cancel");
  }
  return res.json();
}

export function isSubscriptionLocked(status: string | undefined | null): boolean {
  if (!status) return false;
  const s = status.toLowerCase();
  return (
    s === "expired" ||
    s === "pending_payment" ||
    s === "past_due" ||
    s === "cancelled"
  );
}

export function subscriptionAllowsApp(
  status: string | undefined | null,
  trialEndsAt?: string | null
): boolean {
  if (!status) return true;
  const s = status.toLowerCase();
  if (s === "active") return true;
  if (s === "trialing") {
    if (trialEndsAt && new Date(trialEndsAt) < new Date()) return false;
    return true;
  }
  return false;
}
