/**
 * Owner/Cashier quick-login on /login (never includes super-admin).
 * - Dev server: shown by default.
 * - Production: shown when VITE_QUICK_LOGIN_DEMO=true (set in .env.saas for build:saas).
 */
export function showLoginQuickDemo(): boolean {
  if (import.meta.env.DEV) return true;
  return import.meta.env.VITE_QUICK_LOGIN_DEMO === "true";
}
