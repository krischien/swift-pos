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

const CONTROL_CHARS = /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/;
const UNSAFE_DISPLAY_CHARS = /[<>;"\\]/;
const UNSAFE_DISPLAY_PATTERNS = /--|<script|javascript:/i;

/**
 * Human-facing labels (category names, menu tabs, etc.).
 * Rejects HTML/script markers and common SQL-injection punctuation while allowing
 * normal retail names (e.g. "Mom's Kitchen", "Hot Drinks").
 */
export function validateDisplayName(value: unknown, fieldLabel: string, maxLen = 64): string {
  if (value == null || typeof value !== "string") {
    throw new Error(`${fieldLabel} is required`);
  }
  const cleaned = value.replace(/\0/g, "").trim();
  if (!cleaned) {
    throw new Error(`${fieldLabel} is required`);
  }
  if (cleaned.length > maxLen) {
    throw new Error(`${fieldLabel} must be at most ${maxLen} characters`);
  }
  if (CONTROL_CHARS.test(cleaned)) {
    throw new Error(`${fieldLabel} contains invalid characters`);
  }
  if (UNSAFE_DISPLAY_CHARS.test(cleaned) || UNSAFE_DISPLAY_PATTERNS.test(cleaned)) {
    throw new Error(`${fieldLabel} contains disallowed characters`);
  }
  if (!/[\p{L}\p{N}]/u.test(cleaned)) {
    throw new Error(`${fieldLabel} must include at least one letter or number`);
  }
  return cleaned;
}
