/**
 * Trim, strip null bytes, and enforce max length on user-provided text fields.
 */
export function trimString(value: unknown, maxLen = 255): string | null {
  if (value == null || typeof value !== "string") return null;
  const cleaned = value.replace(/\0/g, "").trim();
  if (!cleaned) return null;
  return cleaned.length > maxLen ? cleaned.slice(0, maxLen) : cleaned;
}

export function requireTrimString(value: unknown, fieldLabel: string, maxLen = 255): string {
  const result = trimString(value, maxLen);
  if (!result) {
    throw new Error(`${fieldLabel} is required`);
  }
  return result;
}

export function optionalTrimString(value: unknown, maxLen = 255): string | undefined {
  if (value == null) return undefined;
  const result = trimString(value, maxLen);
  return result ?? undefined;
}
