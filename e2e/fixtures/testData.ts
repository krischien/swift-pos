export function uniqueName(prefix: string): string {
  return `e2e-${prefix}-${Date.now()}`;
}

export function uniqueEmail(): string {
  return `e2e-user-${Date.now()}@test.com`;
}

export function uniqueGcashTxn(): string {
  return `E2E-GCASH-${Date.now()}`;
}
