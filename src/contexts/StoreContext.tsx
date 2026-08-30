import React, { createContext, useContext, useState, useCallback, useEffect } from "react";
import { isSaaS } from "@/config/appMode";
import { getSaasToken, fetchStores } from "@/lib/saasAuth";
import { useAuth } from "@/contexts/AuthContext";

const DEFAULT_STORE_ID = "default";
const STORES_STORAGE_KEY = "saas_stores";

const getStoredStores = (): Array<{ id: string; name: string }> => {
  if (typeof window === "undefined" || !isSaaS()) return [];
  try {
    const raw = window.localStorage.getItem(STORES_STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as Array<{ id: string; name: string }>;
  } catch {
    return [];
  }
};

interface StoreContextType {
  activeStoreId: string;
  setActiveStoreId: (id: string) => void;
  stores: Array<{ id: string; name: string }>;
  setStores: (stores: Array<{ id: string; name: string }>) => void;
  storesLoading: boolean;
}

const StoreContext = createContext<StoreContextType | undefined>(undefined);

export const StoreProvider = ({ children }: { children: React.ReactNode }) => {
  const { isAuthenticated } = useAuth();
  const [activeStoreId, setActiveStoreIdState] = useState<string>(() => {
    if (isSaaS()) {
      return window.localStorage.getItem("saas_active_store_id") || DEFAULT_STORE_ID;
    }
    return DEFAULT_STORE_ID;
  });
  const [stores, setStoresState] = useState<Array<{ id: string; name: string }>>(getStoredStores);
  const [storesLoading, setStoresLoading] = useState(false);

  const setActiveStoreId = useCallback((id: string) => {
    setActiveStoreIdState(id);
    if (isSaaS()) {
      window.localStorage.setItem("saas_active_store_id", id);
    }
  }, []);

  const setStores = useCallback((s: Array<{ id: string; name: string }>) => {
    setStoresState(s);
    if (isSaaS() && typeof window !== "undefined") {
      window.localStorage.setItem(STORES_STORAGE_KEY, JSON.stringify(s));
    }
  }, []);

  // Reset in-memory store scope when session ends (logout)
  useEffect(() => {
    if (isAuthenticated) return;
    setStoresState([]);
    setActiveStoreIdState(DEFAULT_STORE_ID);
    if (isSaaS() && typeof window !== "undefined") {
      window.localStorage.removeItem("saas_active_store_id");
      window.localStorage.removeItem(STORES_STORAGE_KEY);
    }
  }, [isAuthenticated]);

  // When we have stores but activeStoreId is invalid, set it to the first store
  useEffect(() => {
    if (!isSaaS() || stores.length === 0) return;
    const current = window.localStorage.getItem("saas_active_store_id");
    if (!current || current === "default" || !stores.some((s) => s.id === current)) {
      setActiveStoreId(stores[0].id);
    }
  }, [stores, setActiveStoreId]);

  useEffect(() => {
    if (!isSaaS() || stores.length > 0) return;
    const token = getSaasToken();
    if (!token) return;
    setStoresLoading(true);
    void fetchStores()
      .then((list) => {
        if (list.length > 0) {
          setStores(list);
          const current = window.localStorage.getItem("saas_active_store_id");
          if (!current || current === "default" || !list.some((s) => s.id === current)) {
            setActiveStoreId(list[0].id);
          }
        }
      })
      .finally(() => setStoresLoading(false));
  }, [stores.length, setStores, setActiveStoreId]);

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
