import React, { createContext, useContext } from "react";
import { isSaaS } from "@/config/appMode";
import type { DataService } from "@/lib/dataLayer/types";
import { soloDataService } from "@/lib/dataLayer/soloDataService";
import { createOfflineSaasDataService } from "@/lib/dataLayer/offlineSaasDataService";

interface DataLayerContextType {
  dataService: DataService;
}

const DataLayerContext = createContext<DataLayerContextType | undefined>(undefined);

export const DataLayerProvider = ({ children }: { children: React.ReactNode }) => {
  const dataService = isSaaS() ? createOfflineSaasDataService() : soloDataService;

  return (
    <DataLayerContext.Provider value={{ dataService }}>
      {children}
    </DataLayerContext.Provider>
  );
};

export const useDataLayer = (): DataService => {
  const ctx = useContext(DataLayerContext);
  if (!ctx) {
    throw new Error("useDataLayer must be used within DataLayerProvider");
  }
  return ctx.dataService;
};
