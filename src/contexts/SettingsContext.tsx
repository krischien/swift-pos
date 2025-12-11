import React, { createContext, useContext, useEffect, useState } from "react";
import type { PrinterDevice } from "@/lib/printer";

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
  enableImageSearch: boolean;
  setEnableDiscounts: (value: boolean) => void;
  setEnableBarcodeScanning: (value: boolean) => void;
  setEnableImageSearch: (value: boolean) => void;
  selectedPrinter: PrinterDevice | null;
  setSelectedPrinter: (device: PrinterDevice | null) => void;
}

interface StoredSettings {
  storeName: string;
  storeAddress: string;
  autoPrintReceipt: boolean;
  showLogoOnReceipt: boolean;
  taxRatePercent: number;
  enableDiscounts: boolean;
  enableBarcodeScanning: boolean;
  enableImageSearch: boolean;
  printerName: string | null;
  printerAddress: string | null;
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
  const [enableImageSearch, setEnableImageSearchState] = useState(true);
  const [printerName, setPrinterNameState] = useState<string | null>(null);
  const [printerAddress, setPrinterAddressState] = useState<string | null>(null);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as Partial<StoredSettings>;
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
        setEnableImageSearchState(
          typeof parsed.enableImageSearch === "boolean" ? parsed.enableImageSearch : true,
        );
        setPrinterNameState(parsed.printerName ?? null);
        setPrinterAddressState(parsed.printerAddress ?? null);
      }
    } catch {
      // ignore parse errors
    }
  }, []);

  const buildPersistPayload = (overrides: Partial<StoredSettings> = {}): StoredSettings => ({
    storeName,
    storeAddress,
    autoPrintReceipt,
    showLogoOnReceipt,
    taxRatePercent,
    enableDiscounts,
    enableBarcodeScanning,
    enableImageSearch,
    printerName,
    printerAddress,
    ...overrides,
  });

  const persist = (overrides?: Partial<StoredSettings>) => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(buildPersistPayload(overrides)));
    } catch {
      // ignore storage errors
    }
  };

  const setStoreName = (name: string) => {
    setStoreNameState(name);
    persist({ storeName: name });
  };

  const setStoreAddress = (address: string) => {
    setStoreAddressState(address);
    persist({ storeAddress: address });
  };

  const setAutoPrintReceipt = (value: boolean) => {
    setAutoPrintReceiptState(value);
    persist({ autoPrintReceipt: value });
  };

  const setShowLogoOnReceipt = (value: boolean) => {
    setShowLogoOnReceiptState(value);
    persist({ showLogoOnReceipt: value });
  };

  const setEnableDiscounts = (value: boolean) => {
    setEnableDiscountsState(value);
    persist({ enableDiscounts: value });
  };

  const setEnableBarcodeScanning = (value: boolean) => {
    setEnableBarcodeScanningState(value);
    persist({ enableBarcodeScanning: value });
  };

  const setEnableImageSearch = (value: boolean) => {
    setEnableImageSearchState(value);
    persist({ enableImageSearch: value });
  };

  const setTaxRatePercent = (value: number) => {
    const safe = Number.isNaN(value) ? 12 : Math.max(0, Math.min(100, value));
    setTaxRatePercentState(safe);
    persist({ taxRatePercent: safe });
  };

  const setSelectedPrinter = (device: PrinterDevice | null) => {
    setPrinterNameState(device?.name ?? null);
    setPrinterAddressState(device?.address ?? null);
    persist({
      printerName: device?.name ?? null,
      printerAddress: device?.address ?? null,
    });
  };

  const selectedPrinter =
    printerAddress && printerName
      ? { name: printerName, address: printerAddress }
      : printerAddress
        ? { name: "Bluetooth printer", address: printerAddress }
        : null;

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
        enableImageSearch,
        setEnableDiscounts,
        setEnableBarcodeScanning,
        setEnableImageSearch,
        selectedPrinter,
        setSelectedPrinter,
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


