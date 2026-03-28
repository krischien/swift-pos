/** Centavo-based helpers to avoid float errors (e.g. 5.37 vs 5.370000000000001). */

export function pesoCents(n: number): number {
  return Math.round((Number.isFinite(n) ? n : 0) * 100);
}

export function changeFromAmountAndTotal(amountReceived: number, total: number): number {
  return (pesoCents(amountReceived) - pesoCents(total)) / 100;
}

export function isAmountInsufficient(amountReceived: number, total: number): boolean {
  return pesoCents(amountReceived) < pesoCents(total);
}
