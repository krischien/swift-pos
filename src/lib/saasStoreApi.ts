/**
 * SaaS store API - fetch and update store info (owner only)
 */
import { getSaasApiBase } from "./saasApiConfig";

const getAuthToken = () => window.localStorage.getItem("saas_token");
const getActiveStoreId = () => window.localStorage.getItem("saas_active_store_id");

export interface StoreInfo {
  id: string;
  name: string;
  address: string | null;
  receiptLogoUrl: string | null;
}

export async function getStore(storeId?: string): Promise<StoreInfo> {
  const token = getAuthToken();
  if (!token) throw new Error("Not authenticated");
  const sid = storeId ?? getActiveStoreId();
  if (!sid) throw new Error("No store selected");
  const base = getSaasApiBase();
  const url = new URL("/api/store", base || window.location.origin);
  url.searchParams.set("storeId", sid);
  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || "Failed to fetch store");
  }
  return res.json();
}

export async function updateStore(
  payload: { name?: string; address?: string },
  storeId?: string
): Promise<StoreInfo> {
  const token = getAuthToken();
  if (!token) throw new Error("Not authenticated");
  const sid = storeId ?? getActiveStoreId();
  if (!sid) throw new Error("No store selected");
  const base = getSaasApiBase();
  const apiUrl = base ? `${base.replace(/\/$/, "")}/api/store` : "/api/store";
  const res = await fetch(apiUrl, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ storeId: sid, ...payload }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || "Failed to update store");
  }
  return res.json();
}
