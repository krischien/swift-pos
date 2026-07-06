const DEFAULT_JWT_SECRETS = new Set([
  "change-me-in-production",
  "change-me-in-production-use-long-random-string",
]);

export function isProductionRuntime(): boolean {
  return process.env.NODE_ENV === "production" || process.env.VERCEL === "1";
}

function parseCorsOrigins(): { allowAll: boolean; explicit: string[] } {
  const raw =
    process.env.SAAS_CORS_ORIGINS?.split(",").map((o) => o.trim()).filter(Boolean) ?? [];
  return {
    allowAll: raw.includes("*"),
    explicit: raw.filter((o) => o !== "*"),
  };
}

export function validateSecurityEnv(): void {
  const jwtSecret = (process.env.JWT_SECRET ?? "").trim();
  const { allowAll, explicit } = parseCorsOrigins();

  if (isProductionRuntime()) {
    if (
      !jwtSecret ||
      DEFAULT_JWT_SECRETS.has(jwtSecret) ||
      jwtSecret.length < 32
    ) {
      console.error(
        "[Security] JWT_SECRET must be a random string of at least 32 characters in production (not the default).",
      );
      process.exit(1);
    }

    if (process.env.VERCEL === "1" && (allowAll || explicit.length === 0)) {
      console.error(
        "[Security] SAAS_CORS_ORIGINS must list explicit origins on Vercel (your app URL + capacitor://localhost). Do not use * or leave empty.",
      );
      process.exit(1);
    }

    if (process.env.NODE_ENV === "production" && !process.env.VERCEL && (allowAll || explicit.length === 0)) {
      console.warn(
        "[Security] SAAS_CORS_ORIGINS is empty or * with NODE_ENV=production. Set explicit origins before exposing this server.",
      );
    }
    return;
  }

  if (!jwtSecret || [...DEFAULT_JWT_SECRETS].some((d) => jwtSecret.startsWith("change-me"))) {
    console.warn("[Security] Using default JWT_SECRET — acceptable for local dev only.");
  }
}
