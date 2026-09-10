import type { Response, NextFunction } from "express";
import type { AuthRequest } from "./auth.js";
import { saasPrisma } from "../db.js";

/**
 * Ensures storeId is present and user has access (or is super admin).
 * Injects storeId into request for downstream use.
 * Owners can access any store in their org (JWT storeIds may be stale after creating stores).
 */
export async function tenantMiddleware(req: AuthRequest, res: Response, next: NextFunction) {
  const storeId = (req.query.storeId as string) || req.body?.storeId;
  const auth = req.auth;

  if (!auth) {
    return res.status(401).json({ message: "Not authenticated" });
  }

  // Super admin bypasses tenant check (handled in routes that need it)
  if (auth.organizationId === null && auth.role === "super_admin") {
    if (storeId) {
      (req as any).storeId = storeId;
    }
    return next();
  }

  if (!storeId) {
    return res.status(400).json({ message: "storeId is required" });
  }

  // Check user has access to this store
  const storeIds = auth.storeIds || [];
  if (storeIds.includes(storeId)) {
    (req as any).storeId = storeId;
    (req as any).organizationId = auth.organizationId;
    return next();
  }

  // Owners can access any store in their org (JWT storeIds may be stale after creating stores)
  if (auth.role === "owner" && auth.organizationId) {
    try {
      const store = await saasPrisma.store.findFirst({
        where: { id: storeId, organizationId: auth.organizationId },
      });
      if (store) {
        (req as any).storeId = storeId;
        (req as any).organizationId = auth.organizationId;
        return next();
      }
    } catch (err) {
      console.error("[tenant] owner store check failed:", err);
    }
  }

  // Cashiers (and any user with UserStore rows): trust live DB — JWT storeIds often go stale after reseed or store changes
  if (auth.userId && storeId) {
    try {
      const access = await saasPrisma.userStore.findFirst({
        where: { userId: auth.userId, storeId },
      });
      if (access) {
        (req as any).storeId = storeId;
        (req as any).organizationId = auth.organizationId;
        return next();
      }
    } catch (err) {
      console.error("[tenant] userStore check failed:", err);
    }
  }

  return res.status(403).json({ message: "Access denied to this store" });
}
