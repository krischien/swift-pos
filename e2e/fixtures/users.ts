export const DEMO_CREDENTIALS = {
  admin: { email: "admin@demo.com", password: "password123" },
  owner: { email: "owner@demo.com", password: "password123" },
  /** After full demo seed, maria is the demo cashier. */
  cashier: { email: "maria@demo.com", password: "password123" },
} as const;

export type DemoRole = keyof typeof DEMO_CREDENTIALS;
