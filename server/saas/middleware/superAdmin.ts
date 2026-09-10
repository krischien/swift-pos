import type { Response, NextFunction } from "express";
import type { AuthRequest } from "./auth.js";

export function superAdminMiddleware(req: AuthRequest, res: Response, next: NextFunction) {
  const auth = req.auth;
  if (!auth) {
    return res.status(401).json({ message: "Not authenticated" });
  }
  if (auth.role !== "super_admin") {
    return res.status(403).json({ message: "Super admin access required" });
  }
  next();
}
