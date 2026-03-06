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

export async function createOrgStore(data: { name: string; address?: string }): Promise<OrgStore> {
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
    throw new Error(text || "Failed to create store");
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
