/**
 * @typedef {{ id: string; category: string; name: string; run: (ctx: SecurityContext) => Promise<void | { skipped: boolean; reason: string }> }} SecurityTest
 * @typedef {{ token: string; storeId?: string; user: object; stores: object[] }} Session
 * @typedef {{ admin: Session; owner: Session; cashier: Session }} Sessions
 * @typedef {{ sessions: Sessions; apiBase: string }} SecurityContext
 */

export {};
