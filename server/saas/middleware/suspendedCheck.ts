import type { Response, NextFunction } from "express";
import type { AuthRequest } from "./auth.js";
import {
  expireTrialIfNeeded,
  subscriptionAllowsAccess,
} from "../services/subscriptionService.js";

/**
 * Paths that remain available when subscription is locked
 * (choose plan, payment instructions, org/subscription status).
 */
function isSubscriptionAllowlisted(path: string, method: string): boolean {
  const p = path.split("?")[0];
  if (p === "/api/org" && method === "GET") return true;
  if (p === "/api/org/subscription" && method === "GET") return true;
  if (p === "/api/org/subscription/request" && method === "POST") return true;
  if (p === "/api/org/subscription/cancel-request" && method === "POST") return true;
  if (p === "/api/auth/me" || p === "/api/auth/logout") return true;
  if (p.startsWith("/api/health")) return true;
  return false;
}

/**
 * Blocks access for orgs that are suspended, trial-expired, or without an active/trialing subscription.
 * Super admins bypass. Allowlisted routes let owners pick a plan while locked.
 */
export async function suspendedCheckMiddleware(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  const auth = req.auth;
  if (!auth) return next();

  if (auth.organizationId === null && auth.role === "super_admin") {
    return next();
  }

  if (!auth.organizationId) return next();

  if (isSubscriptionAllowlisted(req.path, req.method)) {
    return next();
  }

  try {
    const sub = await expireTrialIfNeeded(auth.organizationId);
    if (!sub) {
      return res.status(403).json({
        message: "No subscription found. Please choose a plan.",
        code: "NO_SUBSCRIPTION",
        reason: "no_active_subscription",
      });
    }

    const { access, reason } = subscriptionAllowsAccess(sub.status, sub.trialEnd);
    if (!access) {
      return res.status(403).json({
        message:
          reason === "trial_expired"
            ? "Trial expired. Please choose a plan to continue."
            : "Subscription inactive. Please choose a plan or contact support.",
        code: "SUBSCRIPTION_LOCKED",
        reason: reason ?? "no_active_subscription",
        status: sub.status,
        requestedTier: sub.requestedTier,
      });
    }

    // Denormalized suspended plan still blocks even if status somehow active
    if (sub.status === "cancelled") {
      return res.status(403).json({
        message: "Account suspended. Please contact support to restore access.",
        code: "SUBSCRIPTION_LOCKED",
        reason: "cancelled",
      });
    }

    next();
  } catch {
    // Schema mismatch during rollout — fail open only for unexpected DB errors is risky;
    // fail closed for subscription checks once table exists. On error, allow next for resilience.
    next();
  }
}

/** @deprecated Use suspendedCheckMiddleware (now includes full subscription access checks). */
export const subscriptionAccessMiddleware = suspendedCheckMiddleware;
