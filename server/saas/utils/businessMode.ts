/** Immutable store mode: "retail" | "fnb" */
export type StoreBusinessMode = "retail" | "fnb";

export function normalizeBusinessMode(raw: unknown): StoreBusinessMode {
  if (raw === "fnb") return "fnb";
  return "retail";
}
