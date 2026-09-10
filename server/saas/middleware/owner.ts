import type { Response, NextFunction } from "express";
import type { AuthRequest } from "./auth.js";

/**
 * Restricts access to owner role only. Use for store management routes
 * (categories, users, etc.) that should only be accessible by org owners.
 */
export function ownerMiddleware(req: AuthRequest, res: Response, next: NextFunction) {
  const auth = req.auth;
  if (!auth) {
    return res.status(401).json({ message: "Not authenticated" });
  }
  if (auth.role !== "owner") {
    return res.status(403).json({ message: "Owner access required" });
  }
  next();
}
