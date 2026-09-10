/**
 * SaaS org stores API - CRUD for stores in owner's organization
 */

import { getSaasApiBase } from "./saasApiConfig";

const getAuthToken = () => window.localStorage.getItem("saas_token");

export interface OrgStore {
  id: string;
  name: string;
  address: string | null;
  createdAt: string;
  businessMode?: string;
}

export async function getOrgStores(): Promise<OrgStore[]> {
  const token = getAuthToken();
  if (!token) throw new Error("Not authenticated");
  const res = await fetch(`${getSaasApiBase().replace(/\/$/, "")}/api/org/stores`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || "Failed to fetch stores");
  }
  return res.json();
}

export async function createOrgStore(data: {
  name: string;
  address?: string;
  businessMode?: "retail" | "fnb";
}): Promise<OrgStore> {
  const token = getAuthToken();
  if (!token) throw new Error("Not authenticated");
  const res = await fetch(`${getSaasApiBase().replace(/\/$/, "")}/api/org/stores`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const text = await res.text();
    try {
      const json = JSON.parse(text) as {
        message?: string;
        code?: string;
        upgradeTo?: string;
        max?: number;
        tier?: string;
      };
      const err = new Error(json.message || text || "Failed to create store") as Error & {
        code?: string;
        upgradeTo?: string;
        max?: number;
        tier?: string;
      };
      err.code = json.code;
      err.upgradeTo = json.upgradeTo;
      err.max = json.max;
      err.tier = json.tier;
      throw err;
    } catch (e) {
      if (e instanceof SyntaxError) {
        throw new Error(text || "Failed to create store");
      }
      throw e;
    }
  }
  return res.json();
}

export async function updateOrgStore(
  id: string,
  data: { name?: string; address?: string }
): Promise<OrgStore> {
  const token = getAuthToken();
  if (!token) throw new Error("Not authenticated");
  const res = await fetch(`${getSaasApiBase().replace(/\/$/, "")}/api/org/stores/${id}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || "Failed to update store");
  }
  return res.json();
}

export async function deleteOrgStore(id: string): Promise<void> {
  const token = getAuthToken();
  if (!token) throw new Error("Not authenticated");
  const res = await fetch(`${getSaasApiBase().replace(/\/$/, "")}/api/org/stores/${id}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || "Failed to delete store");
  }
}
