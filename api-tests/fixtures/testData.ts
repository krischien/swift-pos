export function uniqueName(prefix: string): string {
  return `api-${prefix}-${Date.now()}`;
}

export function uniqueEmail(): string {
  return `api-user-${Date.now()}@test.com`;
}

export function uniqueGcashTxn(): string {
  return `API-GCASH-${Date.now()}`;
}
