export const DEMO_CREDENTIALS = {
  admin: { email: "admin@demo.com", password: "password123" },
  owner: { email: "owner@demo.com", password: "password123" },
  cashier: { email: "cashier@demo.com", password: "password123" },
} as const;

export type DemoRole = keyof typeof DEMO_CREDENTIALS;
