/**
 * Store type: retail | fnb | canister (LPG).
 * Canister uses the retail product catalog + canister monitoring enabled.
 */
export type BusinessMode = "retail" | "fnb" | "canister";

export function normalizeBusinessMode(raw: unknown): BusinessMode {
  if (raw === "fnb") return "fnb";
  if (raw === "canister" || raw === "lpg") return "canister";
  return "retail";
}

/** Prefer explicit mode; fall back to legacy enableCylinderTracking on retail. */
export function resolveBusinessMode(
  businessMode: unknown,
  enableCylinderTracking?: boolean | null,
): BusinessMode {
  const mode = normalizeBusinessMode(businessMode);
  if (mode === "fnb") return "fnb";
  if (mode === "canister" || enableCylinderTracking) return "canister";
  return "retail";
}

export function isFnbMode(mode: unknown): boolean {
  return normalizeBusinessMode(mode) === "fnb";
}

export function isCanisterMode(mode: unknown): boolean {
  return normalizeBusinessMode(mode) === "canister";
}

export function businessModeLabel(mode: unknown): string {
  const m = normalizeBusinessMode(mode);
  if (m === "fnb") return "F&B";
  if (m === "canister") return "Canister";
  return "Retail";
}
