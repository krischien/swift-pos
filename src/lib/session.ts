import { isSaaS } from "@/config/appMode";
import { clearSaasToken } from "@/lib/saasAuth";

const USER_STORAGE_KEY = "quickpos:user";
const ORG_STORAGE_KEY = "quickpos:organization";
const STORES_STORAGE_KEY = "saas_stores";

/** Remove all client-side auth/session keys (SaaS + solo user blob). */
export function clearClientSession(): void {
  if (typeof window === "undefined") return;
  if (isSaaS()) {
    clearSaasToken();
  }
  window.localStorage.removeItem(USER_STORAGE_KEY);
  window.localStorage.removeItem(ORG_STORAGE_KEY);
  window.localStorage.removeItem(STORES_STORAGE_KEY);
}

export function hasActiveClientSession(): boolean {
  if (typeof window === "undefined") return false;
  if (isSaaS() && !window.localStorage.getItem("saas_token")) return false;
  return !!window.localStorage.getItem(USER_STORAGE_KEY);
}
