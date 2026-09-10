/** YYYY-MM for calendar month */
const PERIOD_RE = /^(\d{4})-(\d{2})$/;

export function parseBillingPeriod(period: string): { year: number; month: number } {
  const t = period.trim();
  const m = PERIOD_RE.exec(t);
  if (!m) throw new Error("period must be YYYY-MM");
  const year = parseInt(m[1], 10);
  const month = parseInt(m[2], 10);
  if (month < 1 || month > 12) throw new Error("Invalid month in period");
  return { year, month };
}

/**
 * Next billing due date after marking `period` (YYYY-MM) as paid:
 * last day of the calendar month following the paid month, 12:00 UTC (same convention as org detail date input).
 */
export function computeNextBillingDueAfterPaidMonth(periodYyyyMm: string): Date {
  const { year, month } = parseBillingPeriod(periodYyyyMm);
  const hm = month;
  return new Date(Date.UTC(year, hm + 1, 0, 12, 0, 0, 0));
}

/** Aligns with PaymentMonitoring "billing-related" notifications heuristic */
export function looksBillingRelatedMessage(message: string): boolean {
  return /payment|billing|due|invoice|renew|subscription|plan/i.test(message);
}
