import React, { createContext, useContext, useState, useCallback, useEffect } from "react";
import { isSaaS } from "@/config/appMode";
import { getSaasToken, fetchStores } from "@/lib/saasAuth";
import type { BusinessMode } from "@/types/pos";

export interface StoreSummary {
  id: string;
  name: string;
  businessMode: BusinessMode;
}

const initialStoresLoading = (): boolean => {
  if (typeof window === "undefined" || !isSaaS()) return false;
  return !!getSaasToken();
};

const DEFAULT_STORE_ID = "default";
const STORES_STORAGE_KEY = "saas_stores";

const normalizeStore = (s: { id: string; name: string; businessMode?: string }): StoreSummary => ({
  id: s.id,
  name: s.name,
  businessMode: s.businessMode === "fnb" ? "fnb" : "retail",
});

const getStoredStores = (): StoreSummary[] => {
  if (typeof window === "undefined" || !isSaaS()) return [];
  try {
    const raw = window.localStorage.getItem(STORES_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Array<{ id: string; name: string; businessMode?: string }>;
    return parsed.map(normalizeStore);
  } catch {
    return [];
  }
};

interface StoreContextType {
  activeStoreId: string;
  setActiveStoreId: (id: string) => void;
  stores: StoreSummary[];
  setStores: (stores: StoreSummary[]) => void;
  storesLoading: boolean;
}

const StoreContext = createContext<StoreContextType | undefined>(undefined);

export const StoreProvider = ({ children }: { children: React.ReactNode }) => {
  const [activeStoreId, setActiveStoreIdState] = useState<string>(() => {
    if (isSaaS()) {
      return window.localStorage.getItem("saas_active_store_id") || DEFAULT_STORE_ID;
    }
    return DEFAULT_STORE_ID;
  });
  const [stores, setStoresState] = useState<StoreSummary[]>(getStoredStores);
  const [storesLoading, setStoresLoading] = useState(initialStoresLoading);

  const setActiveStoreId = useCallback((id: string) => {
    setActiveStoreIdState(id);
    if (isSaaS()) {
      window.localStorage.setItem("saas_active_store_id", id);
    }
  }, []);

  const setStores = useCallback((s: StoreSummary[]) => {
    const normalized = s.map(normalizeStore);
    setStoresState(normalized);
    if (isSaaS() && typeof window !== "undefined") {
      window.localStorage.setItem(STORES_STORAGE_KEY, JSON.stringify(normalized));
    }
  }, []);

  // When we have stores but activeStoreId is invalid, set it to the first store
  useEffect(() => {
    if (!isSaaS() || stores.length === 0) return;
    const current = window.localStorage.getItem("saas_active_store_id");
    if (!current || current === "default" || !stores.some((s) => s.id === current)) {
      setActiveStoreId(stores[0].id);
    }
  }, [stores, setActiveStoreId]);

  // Always refresh stores from the API when logged in. Cached localStorage can list store IDs
  // that no longer exist after a DB reseed, which yields empty products / 403.
  useEffect(() => {
    if (!isSaaS()) return;
    const token = getSaasToken();
    if (!token) {
      setStoresLoading(false);
      return;
    }
    setStoresLoading(true);
    void fetchStores()
      .then((list) => {
        const current = window.localStorage.getItem("saas_active_store_id");
        const activeInvalid =
          !!list.length &&
          !!current &&
          current !== "default" &&
          !list.some((s) => s.id === current);
        if (activeInvalid) {
          void import("@/lib/saasOffline").then(({ clearOfflineData }) =>
            clearOfflineData().catch(() => {})
          );
        }
        setStores(list.map(normalizeStore));
        if (!list.length) {
          setActiveStoreId(DEFAULT_STORE_ID);
        } else if (!current || current === "default" || activeInvalid) {
          setActiveStoreId(list[0].id);
        }
      })
      .finally(() => setStoresLoading(false));
  }, [setStores, setActiveStoreId]);

  return (
    <StoreContext.Provider
      value={{
        activeStoreId,
        setActiveStoreId,
        stores,
        setStores,
        storesLoading,
      }}
    >
      {children}
    </StoreContext.Provider>
  );
};

export const useStore = () => {
  const ctx = useContext(StoreContext);
  if (!ctx) {
    throw new Error("useStore must be used within StoreProvider");
  }
  return ctx;
};
