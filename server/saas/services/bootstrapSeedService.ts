/**
 * Bootstrap seed - runs on server startup when DB has no users.
 * Creates default admin, owner, and cashier accounts for first-time setup.
 */
import bcrypt from "bcryptjs";
import { saasPrisma } from "../db.js";

const DEFAULT_PASSWORD = "password123";

export const DEMO_CREDENTIALS = {
  admin: { email: "admin@demo.com", password: DEFAULT_PASSWORD, role: "super_admin" },
  owner: { email: "owner@demo.com", password: DEFAULT_PASSWORD, role: "owner" },
  cashier: { email: "cashier@demo.com", password: DEFAULT_PASSWORD, role: "cashier" },
} as const;

export async function runBootstrapSeed(): Promise<boolean> {
  const userCount = await saasPrisma.user.count();
  if (userCount > 0) return false;

  const hashedPassword = await bcrypt.hash(DEFAULT_PASSWORD, 10);

  await saasPrisma.user.create({
    data: {
      organizationId: null,
      name: "Demo Admin",
      email: DEMO_CREDENTIALS.admin.email,
      password: hashedPassword,
      role: "super_admin",
    },
  });

  const trialEndsAt = new Date();
  trialEndsAt.setDate(trialEndsAt.getDate() + 30);
  const org = await saasPrisma.organization.create({
    data: {
      name: "Demo Organization",
      plan: "free",
      trialEndsAt,
      email: "demo@example.com",
    },
  });

  const store = await saasPrisma.store.create({
    data: { organizationId: org.id, name: "Main Store", address: "123 Demo St" },
  });

  const owner = await saasPrisma.user.create({
    data: {
      organizationId: org.id,
      name: "Demo Owner",
      email: DEMO_CREDENTIALS.owner.email,
      password: hashedPassword,
      role: "owner",
    },
  });

  const cashier = await saasPrisma.user.create({
    data: {
      organizationId: org.id,
      name: "Demo Cashier",
      email: DEMO_CREDENTIALS.cashier.email,
      password: hashedPassword,
      role: "cashier",
    },
  });

  await saasPrisma.userStore.createMany({
    data: [
      { userId: owner.id, storeId: store.id },
      { userId: cashier.id, storeId: store.id },
    ],
  });

  console.log(`[Bootstrap] Created default accounts (password: ${DEFAULT_PASSWORD}):`);
  console.log(`  - admin@demo.com (super_admin)`);
  console.log(`  - owner@demo.com (owner)`);
  console.log(`  - cashier@demo.com (cashier)`);

  return true;
}
