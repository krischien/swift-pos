/**
 * App mode: solo (offline-first, single store) or saas (online, multi-store, subscription)
 * Set via VITE_APP_MODE env var. Defaults to "solo".
 */
export const APP_MODE = (import.meta.env.VITE_APP_MODE as "solo" | "saas") || "solo";

export const isSaaS = (): boolean => APP_MODE === "saas";
export const isSolo = (): boolean => APP_MODE === "solo";
