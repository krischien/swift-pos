import React, { createContext, useContext, useEffect, useState } from "react";

interface SettingsState {
  storeName: string;
  storeAddress: string;
  setStoreName: (name: string) => void;
  setStoreAddress: (address: string) => void;
  autoPrintReceipt: boolean;
  showLogoOnReceipt: boolean;
  setAutoPrintReceipt: (value: boolean) => void;
  setShowLogoOnReceipt: (value: boolean) => void;
  taxRatePercent: number;
  setTaxRatePercent: (value: number) => void;
  enableDiscounts: boolean;
  enableBarcodeScanning: boolean;
  setEnableDiscounts: (value: boolean) => void;
  setEnableBarcodeScanning: (value: boolean) => void;
}

const SettingsContext = createContext<SettingsState | undefined>(undefined);

const STORAGE_KEY = "swift_pos_settings";

export const SettingsProvider = ({ children }: { children: React.ReactNode }) => {
  const [storeName, setStoreNameState] = useState("");
  const [storeAddress, setStoreAddressState] = useState("");
  const [autoPrintReceipt, setAutoPrintReceiptState] = useState(true);
  const [showLogoOnReceipt, setShowLogoOnReceiptState] = useState(true);
  const [taxRatePercent, setTaxRatePercentState] = useState(12);
  const [enableDiscounts, setEnableDiscountsState] = useState(true);
  const [enableBarcodeScanning, setEnableBarcodeScanningState] = useState(false);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as {
          storeName?: string;
          storeAddress?: string;
          autoPrintReceipt?: boolean;
          showLogoOnReceipt?: boolean;
          taxRatePercent?: number;
          enableDiscounts?: boolean;
          enableBarcodeScanning?: boolean;
        };
        setStoreNameState(parsed.storeName ?? "");
        setStoreAddressState(parsed.storeAddress ?? "");
        setAutoPrintReceiptState(
          typeof parsed.autoPrintReceipt === "boolean" ? parsed.autoPrintReceipt : true,
        );
        setShowLogoOnReceiptState(
          typeof parsed.showLogoOnReceipt === "boolean" ? parsed.showLogoOnReceipt : true,
        );
        setTaxRatePercentState(
          typeof parsed.taxRatePercent === "number" ? parsed.taxRatePercent : 12,
        );
        setEnableDiscountsState(
          typeof parsed.enableDiscounts === "boolean" ? parsed.enableDiscounts : true,
        );
        setEnableBarcodeScanningState(
          typeof parsed.enableBarcodeScanning === "boolean" ? parsed.enableBarcodeScanning : false,
        );
      }
    } catch {
      // ignore parse errors
    }
  }, []);

  const persist = (next: {
    storeName: string;
    storeAddress: string;
    autoPrintReceipt: boolean;
    showLogoOnReceipt: boolean;
    taxRatePercent: number;
    enableDiscounts: boolean;
    enableBarcodeScanning: boolean;
  }) => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // ignore storage errors
    }
  };

  const setStoreName = (name: string) => {
    setStoreNameState(name);
    persist({
      storeName: name,
      storeAddress,
      autoPrintReceipt,
      showLogoOnReceipt,
      taxRatePercent,
      enableDiscounts,
      enableBarcodeScanning,
    });
  };

  const setStoreAddress = (address: string) => {
    setStoreAddressState(address);
    persist({
      storeName,
      storeAddress: address,
      autoPrintReceipt,
      showLogoOnReceipt,
      taxRatePercent,
      enableDiscounts,
      enableBarcodeScanning,
    });
  };

  const setAutoPrintReceipt = (value: boolean) => {
    setAutoPrintReceiptState(value);
    persist({
      storeName,
      storeAddress,
      autoPrintReceipt: value,
      showLogoOnReceipt,
      taxRatePercent,
      enableDiscounts,
      enableBarcodeScanning,
    });
  };

  const setShowLogoOnReceipt = (value: boolean) => {
    setShowLogoOnReceiptState(value);
    persist({
      storeName,
      storeAddress,
      autoPrintReceipt,
      showLogoOnReceipt: value,
      taxRatePercent,
      enableDiscounts,
      enableBarcodeScanning,
    });
  };

  const setEnableDiscounts = (value: boolean) => {
    setEnableDiscountsState(value);
    persist({
      storeName,
      storeAddress,
      autoPrintReceipt,
      showLogoOnReceipt,
      taxRatePercent,
      enableDiscounts: value,
      enableBarcodeScanning,
    });
  };

  const setEnableBarcodeScanning = (value: boolean) => {
    setEnableBarcodeScanningState(value);
    persist({
      storeName,
      storeAddress,
      autoPrintReceipt,
      showLogoOnReceipt,
      taxRatePercent,
      enableDiscounts,
      enableBarcodeScanning: value,
    });
  };

  const setTaxRatePercent = (value: number) => {
    const safe = Number.isNaN(value) ? 12 : Math.max(0, Math.min(100, value));
    setTaxRatePercentState(safe);
    persist({
      storeName,
      storeAddress,
      autoPrintReceipt,
      showLogoOnReceipt,
      taxRatePercent: safe,
      enableDiscounts,
      enableBarcodeScanning,
    });
  };

  return (
    <SettingsContext.Provider
      value={{
        storeName,
        storeAddress,
        setStoreName,
        setStoreAddress,
        autoPrintReceipt,
        showLogoOnReceipt,
        setAutoPrintReceipt,
        setShowLogoOnReceipt,
        taxRatePercent,
        setTaxRatePercent,
        enableDiscounts,
        enableBarcodeScanning,
        setEnableDiscounts,
        setEnableBarcodeScanning,
      }}
    >
      {children}
    </SettingsContext.Provider>
  );
};

export const useSettings = () => {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error("useSettings must be used within SettingsProvider");
  return ctx;
};


