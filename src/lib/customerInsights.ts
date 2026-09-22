import type { CustomerDetail } from "@/types/pos";

export type ScoredCustomer = CustomerDetail & {
  insightScore: number;
};

export function isInactiveSuki(customer: CustomerDetail, now = Date.now()): boolean {
  if (!customer.isSuki || !customer.evidence.lastPurchaseAt) return customer.isSuki;
  return now - new Date(customer.evidence.lastPurchaseAt).getTime() >= 90 * 86_400_000;
}

const band = (sorted: number[], value: number, higherIsBetter = true): number => {
  if (sorted.length <= 1) return 3;
  const ascending = [...sorted].sort((a, b) => a - b);
  let position = 0;
  for (let index = 0; index < ascending.length; index += 1) {
    if (ascending[index] <= value) position = index;
  }
  const percentile = Math.max(0, position) / Math.max(1, ascending.length - 1);
  const score = percentile < 1 / 3 ? 1 : percentile < 2 / 3 ? 2 : 3;
  return higherIsBetter ? score : 4 - score;
};

/**
 * Store-relative RFM ranking. Suki remains manually assigned; this only
 * provides evidence for the owner.
 */
export function rankSukiCandidates(customers: CustomerDetail[]): ScoredCustomer[] {
  const candidates = customers.filter((customer) => !customer.isSuki && !customer.archived);
  const recencies = candidates.map((customer) => {
    const at = customer.evidence.lastPurchaseAt;
    return at ? Math.max(0, (Date.now() - new Date(at).getTime()) / 86_400_000) : Number.MAX_SAFE_INTEGER;
  });
  const frequencies = candidates.map((customer) => customer.evidence.frequency180d);
  const monetary = candidates.map((customer) => customer.evidence.monetary180d);

  return candidates
    .map((customer, index) => {
      const recencyScore = band(recencies, recencies[index], false);
      const frequencyScore = band(frequencies, frequencies[index]);
      const monetaryScore = band(monetary, monetary[index]);
      return {
        ...customer,
        insightScore: recencyScore + frequencyScore + monetaryScore,
      };
    })
    .sort((a, b) =>
      b.insightScore - a.insightScore ||
      b.evidence.frequency180d - a.evidence.frequency180d ||
      b.evidence.monetary180d - a.evidence.monetary180d,
    );
}

export function rankReliableCustomers(customers: CustomerDetail[]): ScoredCustomer[] {
  return customers
    .filter((customer) => customer.evidence.completedOutcomes >= 3)
    .map((customer) => {
      const returnPoints = (customer.evidence.returnRate ?? 0) * 70;
      const speedPoints = customer.evidence.avgReturnDays == null
        ? 0
        : Math.max(0, 30 - Math.min(30, customer.evidence.avgReturnDays));
      return {
        ...customer,
        insightScore: Math.round((returnPoints + speedPoints) * 10) / 10,
      };
    })
    .sort((a, b) =>
      b.insightScore - a.insightScore ||
      b.evidence.frequency180d - a.evidence.frequency180d,
    );
}

