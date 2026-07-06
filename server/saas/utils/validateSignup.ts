import { trimString } from "./sanitizeInput.js";

const MAX_EMAIL = 255;
const MAX_NAME = 255;
const MIN_PASSWORD = 8;

export interface SignupBody {
  organizationName?: string;
  storeName?: string;
  adminEmail?: string;
  adminPassword?: string;
  adminName?: string;
  adminPhone?: string;
}

export type ValidatedSignup = {
  organizationName: string;
  storeName: string;
  adminEmail: string;
  adminPassword: string;
  adminName: string;
  adminPhone: string | null;
};

export function validateSignupBody(body: SignupBody): ValidatedSignup | { error: string } {
  const organizationName = trimString(body.organizationName, MAX_NAME);
  const storeName = trimString(body.storeName, MAX_NAME);
  const adminEmail = trimString(body.adminEmail, MAX_EMAIL)?.toLowerCase() ?? null;
  const adminPassword = typeof body.adminPassword === "string" ? body.adminPassword : "";
  const adminName = trimString(body.adminName, MAX_NAME);
  const adminPhone = trimString(body.adminPhone, 50);

  if (!organizationName || !storeName || !adminEmail || !adminPassword) {
    return {
      error: "Organization name, store name, email, and password are required",
    };
  }

  if (adminPassword.length < MIN_PASSWORD) {
    return { error: `Password must be at least ${MIN_PASSWORD} characters` };
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(adminEmail)) {
    return { error: "Invalid email address" };
  }

  return {
    organizationName,
    storeName,
    adminEmail,
    adminPassword,
    adminName: adminName || adminEmail,
    adminPhone: adminPhone ?? null,
  };
}
