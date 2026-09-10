/**
 * SaaS organization API - fetch and update org info (owner only for PATCH)
 */

import { getSaasApiBase } from "./saasApiConfig";

const getAuthToken = () => window.localStorage.getItem("saas_token");

export interface OrgInfo {
  id: string;
  name: string;
  plan: string;
  trialEndsAt?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
}

export async function getOrg(): Promise<OrgInfo | null> {
  const token = getAuthToken();
  if (!token) return null;
  const base = getSaasApiBase();
  const url = base ? `${base.replace(/\/$/, "")}/api/org` : "/api/org";
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return null;
  return res.json();
}

export async function updateOrg(payload: {
  phone?: string;
  email?: string;
  address?: string;
}): Promise<OrgInfo> {
  const token = getAuthToken();
  if (!token) throw new Error("Not authenticated");
  const base = getSaasApiBase();
  const url = base ? `${base.replace(/\/$/, "")}/api/org` : "/api/org";
  const res = await fetch(url, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || "Failed to update organization");
  }
  return res.json();
}
