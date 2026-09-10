/**
 * SaaS seed - creates super admin user when SUPER_ADMIN_EMAILS is set.
 * Run: SAAS_DATABASE_URL=... SUPER_ADMIN_EMAILS=admin@example.com npx tsx server/saas/seed.ts
 */
import bcrypt from "bcryptjs";
import { saasPrisma } from "./db.js";

const SUPER_ADMIN_EMAILS = (process.env.SUPER_ADMIN_EMAILS || "")
  .split(",")
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

async function main() {
  if (SUPER_ADMIN_EMAILS.length === 0) {
    console.log("Set SUPER_ADMIN_EMAILS env var (comma-separated) to create super admin users.");
    return;
  }

  const defaultPassword = process.env.SUPER_ADMIN_DEFAULT_PASSWORD || "changeme123";

  for (const email of SUPER_ADMIN_EMAILS) {
    const existing = await saasPrisma.user.findUnique({ where: { email } });
    if (existing) {
      console.log(`Super admin ${email} already exists.`);
      continue;
    }
    const hashed = await bcrypt.hash(defaultPassword, 10);
    await saasPrisma.user.create({
      data: {
        organizationId: null,
        name: "Super Admin",
        email,
        password: hashed,
        role: "super_admin",
      },
    });
    console.log(`Created super admin: ${email} (password: ${defaultPassword})`);
  }
}

main()
  .catch(console.error)
  .finally(() => saasPrisma.$disconnect());
