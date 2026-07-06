export const DEMO_CREDENTIALS = {
  admin: { email: "admin@demo.com", password: "password123" },
  owner: { email: "owner@demo.com", password: "password123" },
  /** After full demo seed (`saas:seed-demo`), use maria — bootstrap-only `cashier@demo.com` may not exist. */
  cashier: { email: "maria@demo.com", password: "password123" },
  maria: { email: "maria@demo.com", password: "password123" },
  juan: { email: "juan@demo.com", password: "password123" },
  pedro: { email: "pedro@demo.com", password: "password123" },
} as const;

export type DemoRole = keyof typeof DEMO_CREDENTIALS;
