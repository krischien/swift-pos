import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "change-me-in-production";
const SUPER_ADMIN_EMAILS = (process.env.SUPER_ADMIN_EMAILS || "")
  .split(",")
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

export interface JwtPayload {
  userId: string;
  email: string;
  organizationId: string | null;
  role: string;
  storeIds?: string[];
}

export type AuthRequest = Request<any, any, any, any> & {
  auth?: JwtPayload;
  storeId?: string;
  organizationId?: string | null;
};

export function authMiddleware(req: AuthRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Missing or invalid authorization header" });
  }

  const token = authHeader.slice(7);
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as JwtPayload;
    req.auth = decoded;
    next();
  } catch {
    return res.status(401).json({ message: "Invalid or expired token" });
  }
}

export function isSuperAdmin(email: string): boolean {
  const e = email.toLowerCase();
  if (SUPER_ADMIN_EMAILS.includes(e)) return true;
  if (SUPER_ADMIN_EMAILS.length === 0 && e === "admin@demo.com") return true;
  return false;
}

export function getJwtSecret(): string {
  return JWT_SECRET;
}
