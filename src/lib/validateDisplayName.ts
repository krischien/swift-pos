const CONTROL_CHARS = /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/;
const UNSAFE_DISPLAY_CHARS = /[<>;"\\]/;
const UNSAFE_DISPLAY_PATTERNS = /--|<script|javascript:/i;

/** Client-side mirror of server validateDisplayName — keep in sync. */
export function validateDisplayName(value: string, fieldLabel: string, maxLen = 64): string {
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
