/**
 * SaaS org notifications API - fetch banner notifications for logged-in org users
 */

// In dev with SaaS mode, use "" so requests go through Vite proxy to SaaS server
import { getSaasApiBase } from "./saasApiConfig";

export interface OrgNotification {
  id: string;
  organizationId: string;
  message: string;
  type: "info" | "warning" | "urgent";
  createdAt: string;
  expiresAt: string | null;
}

export async function getOrgNotifications(): Promise<OrgNotification[]> {
  const token = window.localStorage.getItem("saas_token");
  if (!token) return [];

  const res = await fetch(`${getSaasApiBase().replace(/\/$/, "")}/api/notifications`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return [];
  return res.json();
}

export interface OrgInfo {
  id: string;
  name: string;
  plan: string;
  trialEndsAt: string | null;
}

export async function getOrgInfo(): Promise<OrgInfo | null> {
  const token = window.localStorage.getItem("saas_token");
  if (!token) return null;

  const res = await fetch(`${getSaasApiBase().replace(/\/$/, "")}/api/org`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return null;
  const data = await res.json();
  return data;
}
