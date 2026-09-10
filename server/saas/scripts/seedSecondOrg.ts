/**
 * Dev helper: create a second organization for cross-tenant manual QA.
 * Usage: npm run saas:seed-second-org
 *
 * Credentials (local dev only):
 *   owner@orgb.demo.com / password123
 */
import bcrypt from "bcryptjs";
import { saasPrisma } from "../db.js";

const OWNER_EMAIL = "owner@orgb.demo.com";
const OWNER_PASSWORD = "password123";

async function main() {
  const existing = await saasPrisma.user.findUnique({ where: { email: OWNER_EMAIL } });
  if (existing) {
    console.log(`Second org already seeded (${OWNER_EMAIL}).`);
    return;
  }

  const trialEndsAt = new Date();
  trialEndsAt.setDate(trialEndsAt.getDate() + 15);

  const org = await saasPrisma.organization.create({
    data: {
      name: "Org B (Security QA)",
      plan: "tindahan",
      email: "orgb@demo.example.com",
      trialEndsAt,
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
    data: {
      organizationId: org.id,
      name: "Org B Main Store",
      address: "999 Second Tenant Ave",
    },
  });

  const hashedPassword = await bcrypt.hash(OWNER_PASSWORD, 10);
  const owner = await saasPrisma.user.create({
    data: {
      organizationId: org.id,
      name: "Org B Owner",
      email: OWNER_EMAIL,
      password: hashedPassword,
      role: "owner",
    },
  });

  await saasPrisma.userStore.create({
    data: { userId: owner.id, storeId: store.id },
  });

  console.log("Second organization created for security QA:");
  console.log(`  Org: ${org.name} (${org.id})`);
  console.log(`  Store: ${store.name} (${store.id})`);
  console.log(`  Login: ${OWNER_EMAIL} / ${OWNER_PASSWORD}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await saasPrisma.$disconnect();
  });
