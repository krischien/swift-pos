import rateLimit from "express-rate-limit";

const disabled = process.env.RATE_LIMIT_DISABLED === "1";

function limiter(windowMs: number, max: number) {
  return rateLimit({
    windowMs,
    max: disabled ? 10_000 : max,
    standardHeaders: true,
    legacyHeaders: false,
    message: { message: "Too many requests" },
  });
}

/** POST /api/auth/login — 10 attempts per 15 minutes per IP */
export const loginLimiter = limiter(15 * 60 * 1000, 10);

/** POST /api/auth/signup — 5 attempts per hour per IP */
export const signupLimiter = limiter(60 * 60 * 1000, 5);

/** POST /api/demo/* — 3 attempts per hour per IP (dev only routes) */
export const demoLimiter = limiter(60 * 60 * 1000, 3);
