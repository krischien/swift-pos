import { PrismaClient } from "../../prisma-saas/generated/saas-client";

const globalForPrisma = globalThis as unknown as {
  saasPrisma?: PrismaClient;
};

export const saasPrisma =
  globalForPrisma.saasPrisma ??
  new PrismaClient({
    log: ["error", "warn"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.saasPrisma = saasPrisma;
}
