/**
 * PHP peso amounts — use centavo integers for comparisons and stored change.
 * Rounds via toFixed(2) before scaling so values like exact GCash matches and
 * recomputed totals don’t fail from float noise (e.g. 99.999999 vs 100).
 */

export function phpToCents(amount: number): number {
  if (!Number.isFinite(amount)) return 0;
  return Math.round(Number(amount.toFixed(2)) * 100);
}

export function centsToPhp(cents: number): number {
  return Math.round(cents) / 100;
}

export function changePhpFromCents(amountReceivedCents: number, totalCents: number): number {
  return (amountReceivedCents - totalCents) / 100;
}

export function paymentCoversTotal(amountReceived: number, total: number): boolean {
  return phpToCents(amountReceived) >= phpToCents(total);
}
