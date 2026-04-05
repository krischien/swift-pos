import React, { createContext, useContext, useState, useCallback } from "react";
import { User, type UserRole } from "@/types/pos";
import { api } from "@/lib/api";
import { isSaaS } from "@/config/appMode";
import {
  saasLogin,
  setSaasToken,
  clearSaasToken,
} from "@/lib/saasAuth";

export interface LoginResult {
  user: User;
  stores?: Array<{ id: string; name: string }>;
  organization?: { id: string; name: string; plan: string; trialEndsAt?: string | null } | null;
}

interface AuthContextType {
  user: User | null;
  organization: { id: string; name: string; plan: string; trialEndsAt?: string | null } | null;
  /** Updates org from GET /api/org so trial banner matches the API (fixes stale localStorage after login). */
  syncOrganization: (org: { id: string; name: string; plan: string; trialEndsAt?: string | null } | null) => void;
  login: (email: string, password: string) => Promise<LoginResult>;
  logout: () => void;
  setUserFromAuth: (user: User) => void;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const USER_STORAGE_KEY = "quickpos:user";
const ORG_STORAGE_KEY = "quickpos:organization";

const getStoredUser = (): User | null => {
  if (typeof window === "undefined") {
    return null;
  }
  if (isSaaS()) {
    const token = window.localStorage.getItem("saas_token");
    if (!token) return null;
  }
  const raw = window.localStorage.getItem(USER_STORAGE_KEY);
  if (!raw) {
    return null;
  }
  try {
    return JSON.parse(raw) as User;
  } catch (error) {
    console.warn("Failed to parse stored user", error);
    window.localStorage.removeItem(USER_STORAGE_KEY);
    return null;
  }
};

const persistUser = (value: User | null) => {
  if (typeof window === "undefined") return;
  if (value) {
    window.localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(value));
  } else {
    window.localStorage.removeItem(USER_STORAGE_KEY);
  }
};

const getStoredOrganization = (): AuthContextType["organization"] => {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(ORG_STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AuthContextType["organization"];
  } catch {
    window.localStorage.removeItem(ORG_STORAGE_KEY);
    return null;
  }
};

const persistOrganization = (value: AuthContextType["organization"]) => {
  if (typeof window === "undefined") return;
  if (value) {
    window.localStorage.setItem(ORG_STORAGE_KEY, JSON.stringify(value));
  } else {
    window.localStorage.removeItem(ORG_STORAGE_KEY);
  }
};

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(() => getStoredUser());
  const [organization, setOrganization] = useState<AuthContextType["organization"]>(
    () => getStoredOrganization()
  );

  const login = async (email: string, password: string): Promise<LoginResult> => {
    if (isSaaS()) {
      const res = await saasLogin(email, password);
      setSaasToken(res.token);
      const u: User = {
        id: res.user.id,
        name: res.user.name,
        email: res.user.email,
        role: res.user.role as UserRole,
      };
      persistUser(u);
      setUser(u);
      const org = res.organization
        ? {
            id: res.organization.id,
            name: res.organization.name,
            plan: res.organization.plan,
            trialEndsAt: res.organization.trialEndsAt,
          }
        : null;
      persistOrganization(org);
      setOrganization(org);
      return { user: u, stores: res.stores, organization: org };
    }
    const loggedInUser = await api.login({ email, password });
    const u = loggedInUser as User;
    persistUser(u);
    setUser(u);
    return { user: u };
  };

  const logout = () => {
    if (isSaaS()) {
      clearSaasToken();
    }
    setUser(null);
    setOrganization(null);
    persistUser(null);
    persistOrganization(null);
  };

  const setUserFromAuth = (u: User) => {
    persistUser(u);
    setUser(u);
  };

  const syncOrganization = useCallback((org: AuthContextType["organization"]) => {
    persistOrganization(org);
    setOrganization(org);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        organization,
        syncOrganization,
        login,
        logout,
        setUserFromAuth,
        isAuthenticated: !!user,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
};
