/**
 * Bootstrap seed - runs on server startup when DB has no users.
 * Creates default admin, owner, and cashier accounts for first-time setup.
 */
import bcrypt from "bcryptjs";
import { saasPrisma } from "../db.js";
import { DEMO_TRIAL_DAYS, addDays } from "../constants/demo.js";

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

  const trialEndsAt = addDays(new Date(), DEMO_TRIAL_DAYS);
  const org = await saasPrisma.organization.create({
    data: {
      name: "Demo Organization",
      plan: "tindahan",
      trialEndsAt,
      email: "demo@example.com",
    },
  });

  await saasPrisma.organizationSubscription.create({
    data: {
      organizationId: org.id,
      tier: "tindahan",
      status: "trialing",
      trialStart: new Date(),
      trialEnd: trialEndsAt,
      monthlyPriceCentavos: 49900,
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

/**
 * When the DB already had users, bootstrap is skipped and quick-login emails may be missing.
 * Ensures admin@demo.com, owner@demo.com, and cashier@demo.com exist for local dev / demo buttons.
 */
export async function ensureDemoQuickLoginUsers(): Promise<void> {
  const [existingOwner, existingCashier, existingAdmin] = await Promise.all([
    saasPrisma.user.findUnique({ where: { email: "owner@demo.com" } }),
    saasPrisma.user.findUnique({ where: { email: "cashier@demo.com" } }),
    saasPrisma.user.findUnique({ where: { email: "admin@demo.com" } }),
  ]);

  const needOwner = !existingOwner;
  const needCashier = !existingCashier;
  const needAdmin = !existingAdmin;

  if (!needOwner && !needCashier && !needAdmin) return;

  const hashedPassword = await bcrypt.hash(DEFAULT_PASSWORD, 10);

  if (needAdmin) {
    await saasPrisma.user.create({
      data: {
        organizationId: null,
        name: "Demo Admin",
        email: DEMO_CREDENTIALS.admin.email,
        password: hashedPassword,
        role: "super_admin",
      },
    });
  }

  if (!needOwner && !needCashier) {
    console.log("[Bootstrap] Ensured missing demo admin@demo.com only.");
    return;
  }

  let org = await saasPrisma.organization.findFirst({
    where: { name: "Demo Organization", email: "demo@example.com" },
  });
  if (!org) {
    const trialEndsAt = addDays(new Date(), DEMO_TRIAL_DAYS);
    org = await saasPrisma.organization.create({
      data: {
        name: "Demo Organization",
        plan: "tindahan",
        trialEndsAt,
        email: "demo@example.com",
      },
    });
    await saasPrisma.organizationSubscription.create({
      data: {
        organizationId: org.id,
        tier: "tindahan",
        status: "trialing",
        trialStart: new Date(),
        trialEnd: trialEndsAt,
        monthlyPriceCentavos: 49900,
      },
    });
  }

  let store = await saasPrisma.store.findFirst({ where: { organizationId: org.id } });
  if (!store) {
    store = await saasPrisma.store.create({
      data: { organizationId: org.id, name: "Main Store", address: "123 Demo St" },
    });
  }

  if (needOwner) {
    const owner = await saasPrisma.user.create({
      data: {
        organizationId: org.id,
        name: "Demo Owner",
        email: DEMO_CREDENTIALS.owner.email,
        password: hashedPassword,
        role: "owner",
      },
    });
    await saasPrisma.userStore.create({
      data: { userId: owner.id, storeId: store.id },
    });
  }
  if (needCashier) {
    const cashier = await saasPrisma.user.create({
      data: {
        organizationId: org.id,
        name: "Demo Cashier",
        email: DEMO_CREDENTIALS.cashier.email,
        password: hashedPassword,
        role: "cashier",
      },
    });
    await saasPrisma.userStore.create({
      data: { userId: cashier.id, storeId: store.id },
    });
  }

  console.log(
    "[Bootstrap] Ensured missing demo quick-login user(s):" +
      (needOwner ? " owner@demo.com" : "") +
      (needCashier ? " cashier@demo.com" : "") +
      (needAdmin ? " admin@demo.com" : "")
  );
}
