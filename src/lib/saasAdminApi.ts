/**
 * Super admin API - calls SaaS backend with JWT
 */
import { getSaasApiBase } from "./saasApiConfig";

const getToken = () => window.localStorage.getItem("saas_token");

async function adminRequest<T>(path: string, options?: RequestInit): Promise<T> {
  const token = getToken();
  if (!token) throw new Error("Not authenticated");

  const base = getSaasApiBase();
  const url = base ? `${base.replace(/\/$/, "")}${path}` : path;
  const res = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(options?.headers as Record<string, string>),
    },
  });

  if (!res.ok) {
    const text = await res.text();
    let message = text || res.statusText;
    try {
      const json = JSON.parse(text);
      if (json?.message) message = json.message;
    } catch {
      if (text.length > 200) message = `Request failed (${res.status})`;
    }
    throw new Error(message);
  }

  if (res.status === 204) return undefined as T;
  const ct = res.headers.get("content-type") || "";
  if (!ct.includes("application/json")) return undefined as T;
  return res.json();
}

export const adminApi = {
  getOverview: () => adminRequest<{
    orgCount: number;
    userCount: number;
    storeCount: number;
    recentOrgs: Array<{
      id: string;
      name: string;
      plan: string;
      billingDueDate?: string | null;
      createdAt: string;
      storeCount: number;
      userCount: number;
    }>;
    billingDueSoon: Array<{
      id: string;
      name: string;
      plan: string;
      billingDueDate: string | null;
    }>;
    freeCount?: number;
    proCount?: number;
    enterpriseCount?: number;
    suspendedCount?: number;
  }>("/api/admin/overview"),

  createOrganization: (data: {
    name: string;
    storeName?: string;
    ownerEmail?: string;
    ownerPassword?: string;
    ownerName?: string;
    phone?: string;
    email?: string;
    address?: string;
  }) =>
    adminRequest<{
      id: string;
      name: string;
      plan: string;
      stores: Array<{ id: string; name: string }>;
      users: Array<{ id: string; name: string; email: string; role: string }>;
    }>("/api/admin/organizations", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  getOrganizations: (search?: string, plan?: string) => {
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (plan && plan !== "all") params.set("plan", plan);
    const qs = params.toString();
    return adminRequest<
      Array<{
        id: string;
        name: string;
        plan: string;
        stripeCustomerId?: string;
        billingDueDate?: string | null;
        createdAt: string;
        storeCount: number;
        userCount: number;
      }>
    >(`/api/admin/organizations${qs ? `?${qs}` : ""}`);
  },

  getOrganization: (id: string) =>
    adminRequest<{
      id: string;
      name: string;
      plan: string;
      phone?: string | null;
      email?: string | null;
      address?: string | null;
      billingDueDate?: string | null;
      stores: Array<{ id: string; name: string; address?: string | null }>;
      users: Array<{
        id: string;
        name: string;
        email: string;
        role: string;
        storeIds?: string[];
      }>;
    }>(`/api/admin/organizations/${id}`),

  updateOrganization: (
    id: string,
    data: {
      name?: string;
      plan?: string;
      suspended?: boolean;
      billingDueDate?: string | null;
      phone?: string;
      email?: string;
      address?: string;
    }
  ) =>
    adminRequest(`/api/admin/organizations/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),

  deleteOrganization: (id: string) =>
    adminRequest(`/api/admin/organizations/${id}`, { method: "DELETE" }),

  createOrganizationUser: (
    orgId: string,
    data: { name: string; email: string; password: string; role?: string; storeIds?: string[] }
  ) =>
    adminRequest<{ id: string; name: string; email: string; role: string }>(
      `/api/admin/organizations/${orgId}/users`,
      {
        method: "POST",
        body: JSON.stringify(data),
      }
    ),

  updateOrganizationUser: (
    orgId: string,
    userId: string,
    data: { name?: string; email?: string; password?: string; role?: string; storeIds?: string[] }
  ) =>
    adminRequest<{ id: string; name: string; email: string; role: string }>(
      `/api/admin/organizations/${orgId}/users/${userId}`,
      {
        method: "PATCH",
        body: JSON.stringify(data),
      }
    ),

  deleteOrganizationUser: (orgId: string, userId: string) =>
    adminRequest(`/api/admin/organizations/${orgId}/users/${userId}`, {
      method: "DELETE",
    }),

  createOrganizationNotification: (
    orgId: string,
    data: { message: string; type?: "info" | "warning" | "urgent"; expiresAt?: string }
  ) =>
    adminRequest<{ id: string; message: string; type: string; createdAt: string; expiresAt: string | null }>(
      `/api/admin/organizations/${orgId}/notifications`,
      {
        method: "POST",
        body: JSON.stringify(data),
      }
    ),

  // Store CRUD
  createOrganizationStore: (orgId: string, data: { name: string; address?: string }) =>
    adminRequest<{ id: string; name: string; address: string | null; createdAt: string }>(
      `/api/admin/organizations/${orgId}/stores`,
      { method: "POST", body: JSON.stringify(data) }
    ),

  updateOrganizationStore: (
    orgId: string,
    storeId: string,
    data: { name?: string; address?: string }
  ) =>
    adminRequest<{ id: string; name: string; address: string | null; createdAt: string }>(
      `/api/admin/organizations/${orgId}/stores/${storeId}`,
      { method: "PATCH", body: JSON.stringify(data) }
    ),

  deleteOrganizationStore: (orgId: string, storeId: string) =>
    adminRequest(`/api/admin/organizations/${orgId}/stores/${storeId}`, { method: "DELETE" }),

  seedDemo: () =>
    adminRequest<{
      message: string;
      orgId: string;
      orgName: string;
      storeCount: number;
      salesCount: number;
      logins: Array<{ email: string; role: string }>;
      password: string;
    }>("/api/demo/seed", { method: "POST" }),
};
