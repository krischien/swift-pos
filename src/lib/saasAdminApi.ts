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
  getPaymentMonitoring: () =>
    adminRequest<{
      asOf: string;
      items: Array<{
        id: string;
        name: string;
        plan: string;
        email: string | null;
        billingDueDate: string | null;
        daysUntilDue: number;
        status: "overdue" | "due_within_7" | "due_within_30" | "due_within_90";
        recentNotifications: Array<{
          id: string;
          message: string;
          type: string;
          createdAt: string;
          expiresAt: string | null;
        }>;
      }>;
      missingBillingDate: Array<{ id: string; name: string; plan: string; email: string | null }>;
    }>("/api/admin/payment-monitoring"),

  getOverview: () => adminRequest<{
    orgCount: number;
    userCount: number;
    storeCount: number;
    overdueBillingCount: number;
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
    tindahanCount?: number;
    negosyoCount?: number;
    kumpanyaCount?: number;
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
      trialEndsAt?: string | null;
      subscription?: {
        id: string;
        tier: string;
        status: string;
        trialEnd?: string | null;
        requestedTier?: string | null;
        setupFeePaid?: boolean;
        monthlyPriceCentavos?: number;
      } | null;
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
      activateTier?: string;
      setupFeePaid?: boolean;
      extendTrialDays?: number;
      subscriptionStatus?: string;
    }
  ) =>
    adminRequest(`/api/admin/organizations/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),

  deleteOrganization: (id: string) =>
    adminRequest(`/api/admin/organizations/${id}`, { method: "DELETE" }),

  getOrganizationBillingPayments: (orgId: string) =>
    adminRequest<
      Array<{
        id: string;
        period: string;
        amountCents: number | null;
        method: string | null;
        note: string | null;
        createdAt: string;
        recordedBy: { id: string; name: string; email: string } | null;
      }>
    >(`/api/admin/organizations/${orgId}/billing-payments`),

  recordOrganizationBillingPayment: (
    orgId: string,
    data: { period: string; amountCents?: number | null; method?: string; note?: string }
  ) =>
    adminRequest<{
      id: string;
      period: string;
      amountCents: number | null;
      method: string | null;
      note: string | null;
      createdAt: string;
      recordedBy: { id: string; name: string; email: string } | null;
      billingDueDate: string;
    }>(`/api/admin/organizations/${orgId}/billing-payments`, {
      method: "POST",
      body: JSON.stringify(data),
    }),

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

  getStores: () =>
    adminRequest<Array<{ id: string; name: string; organizationId: string }>>("/api/admin/stores"),

  getProductRanking: (storeId: string, from: string, to: string) => {
    const params = new URLSearchParams();
    // Omit storeId for "all" so nothing in the chain treats it as a literal id
    if (storeId && storeId !== "all") {
      params.set("storeId", storeId);
    }
    params.set("from", from);
    params.set("to", to);
    return adminRequest<
      Array<{
        rank: number;
        productId: string | null;
        menuItemId: string | null;
        variantId: string | null;
        productName: string;
        variantName: string | null;
        quantity: number;
        revenue: number;
      }>
    >(`/api/admin/reports/product-ranking?${params.toString()}`);
  },

  getProductRankingDrilldown: (
    productId: string | null,
    variantId: string | null,
    from: string,
    to: string,
    menuItemId?: string | null
  ) => {
    const params = new URLSearchParams();
    if (menuItemId) {
      params.set("menuItemId", menuItemId);
    } else if (productId) {
      params.set("productId", productId);
      if (variantId) params.set("variantId", variantId);
    }
    params.set("from", from);
    params.set("to", to);
    return adminRequest<
      Array<{
        rank: number;
        storeId: string;
        storeName: string;
        quantity: number;
        revenue: number;
      }>
    >(`/api/admin/reports/product-ranking/drilldown?${params.toString()}`);
  },
};
