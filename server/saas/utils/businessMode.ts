/** Immutable store type: retail | fnb | canister (LPG) */
export type StoreBusinessMode = "retail" | "fnb" | "canister";

export function normalizeBusinessMode(raw: unknown): StoreBusinessMode {
  if (raw === "fnb") return "fnb";
  if (raw === "canister" || raw === "lpg") return "canister";
  return "retail";
}

/** Resolve type from DB row (migrates legacy retail+enableCylinderTracking → canister). */
export function resolveBusinessMode(
  businessMode: unknown,
  enableCylinderTracking?: boolean | null,
): StoreBusinessMode {
  const mode = normalizeBusinessMode(businessMode);
  if (mode === "fnb") return "fnb";
  if (mode === "canister" || enableCylinderTracking) return "canister";
  return "retail";
}

export function cylinderTrackingForMode(mode: StoreBusinessMode): boolean {
  return mode === "canister";
}

export function isFnbMode(mode: unknown): boolean {
  return normalizeBusinessMode(mode) === "fnb";
}

/** Retail catalog (products) — includes canister stores. */
export function isRetailCatalogMode(mode: unknown): boolean {
  return !isFnbMode(mode);
}
