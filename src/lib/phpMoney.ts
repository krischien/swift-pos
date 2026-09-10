/** PHP amounts in pesos; compare using centavos (1/100) to avoid float drift. */
export function phpToCents(amount: number): number {
  if (!Number.isFinite(amount)) return 0;
  return Math.round(Number(amount.toFixed(2)) * 100);
}

export function centsToPhp(cents: number): number {
  return Math.round(cents) / 100;
}

/** Change in pesos from integer centavo amounts (exact for stored values). */
export function changePhpFromCents(amountReceivedCents: number, totalCents: number): number {
  return (amountReceivedCents - totalCents) / 100;
}

export function paymentCoversTotal(amountReceived: number, total: number): boolean {
  return phpToCents(amountReceived) >= phpToCents(total);
}
