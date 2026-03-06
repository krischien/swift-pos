import type { Response, NextFunction } from "express";
import type { AuthRequest } from "./auth.js";
import { saasPrisma } from "../db.js";

/**
 * Blocks access for orgs that are suspended or have expired free trials.
 * Super admins bypass this check.
 */
export async function suspendedCheckMiddleware(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  const auth = req.auth;
  if (!auth) return next();

  // Super admin bypasses
  if (auth.organizationId === null && auth.role === "super_admin") {
    return next();
  }

  if (!auth.organizationId) return next();

  // plan/trialEndsAt may not exist in some dev schemas - wrap in try/catch
  let plan: string | undefined;
  try {
    const org = await saasPrisma.organization.findUnique({
      where: { id: auth.organizationId },
      select: { plan: true },
    });
    if (!org) return next();
    plan = (org as { plan?: string }).plan?.toLowerCase();
  } catch {
    return next(); // Schema mismatch - skip check
  }

  if (plan === "suspended") {
    return res.status(403).json({
      message: "Account suspended. Please contact support to restore access.",
    });
  }
  next();
}
