import React, { createContext, useContext, useEffect, useState } from "react";
import { Capacitor } from "@capacitor/core";
import type { PrinterDevice } from "@/lib/printer";

interface SettingsState {
  storeName: string;
  storeAddress: string;
  setStoreName: (name: string) => void;
  setStoreAddress: (address: string) => void;
  autoPrintReceipt: boolean;
  showLogoOnReceipt: boolean;
  receiptLogoUrl: string | null;
  setAutoPrintReceipt: (value: boolean) => void;
  setShowLogoOnReceipt: (value: boolean) => void;
  setReceiptLogoUrl: (value: string | null) => void;
  taxRatePercent: number;
  setTaxRatePercent: (value: number) => void;
  enableDiscounts: boolean;
  enableBarcodeScanning: boolean;
  enablePerKiloPurchase: boolean;
  stickerCodeType: "qr" | "barcode";
  setEnableDiscounts: (value: boolean) => void;
  setEnableBarcodeScanning: (value: boolean) => void;
  setEnablePerKiloPurchase: (value: boolean) => void;
  setStickerCodeType: (value: "qr" | "barcode") => void;
  selectedPrinter: PrinterDevice | null;
  setSelectedPrinter: (device: PrinterDevice | null) => void;
}

interface StoredSettings {
  storeName: string;
  storeAddress: string;
  autoPrintReceipt: boolean;
  showLogoOnReceipt: boolean;
  receiptLogoUrl: string | null;
  taxRatePercent: number;
  enableDiscounts: boolean;
  enableBarcodeScanning: boolean;
  enablePerKiloPurchase: boolean;
  stickerCodeType: "qr" | "barcode";
  printerName: string | null;
  printerAddress: string | null;
}

const SettingsContext = createContext<SettingsState | undefined>(undefined);

const STORAGE_KEY = "swift_pos_settings";

export const SettingsProvider = ({ children }: { children: React.ReactNode }) => {
  const isNativePlatform = Capacitor.isNativePlatform();
  const [storeName, setStoreNameState] = useState("");
  const [storeAddress, setStoreAddressState] = useState("");
  const [autoPrintReceipt, setAutoPrintReceiptState] = useState(true);
  const [showLogoOnReceipt, setShowLogoOnReceiptState] = useState(true);
  const [receiptLogoUrl, setReceiptLogoUrlState] = useState<string | null>(null);
  const [taxRatePercent, setTaxRatePercentState] = useState(12);
  const [enableDiscounts, setEnableDiscountsState] = useState(true);
  const [enableBarcodeScanning, setEnableBarcodeScanningState] = useState(false);
  // On native installs, default to per-kilo ON unless user explicitly disables it in Settings.
  // This avoids "fresh install" behavior differences between Web and Android devices.
  const [enablePerKiloPurchase, setEnablePerKiloPurchaseState] = useState(isNativePlatform);
  const [stickerCodeType, setStickerCodeTypeState] = useState<"qr" | "barcode">("qr");
  const [printerName, setPrinterNameState] = useState<string | null>(null);
  const [printerAddress, setPrinterAddressState] = useState<string | null>(null);

  useEffect(() => {
    const loadSettings = () => {
      try {
        if (typeof window === "undefined" || !window.localStorage) {
          return;
        }
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
          setReceiptLogoUrlState(
            typeof parsed.receiptLogoUrl === "string" ? parsed.receiptLogoUrl : null,
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
          setEnablePerKiloPurchaseState(
            typeof parsed.enablePerKiloPurchase === "boolean"
              ? parsed.enablePerKiloPurchase
              : isNativePlatform,
          );
          setStickerCodeTypeState(
            parsed.stickerCodeType === "barcode" || parsed.stickerCodeType === "qr"
              ? parsed.stickerCodeType
              : "qr"
          );
          setPrinterNameState(parsed.printerName ?? null);
          setPrinterAddressState(parsed.printerAddress ?? null);
        } else {
          // First-run defaults for native installs
          if (isNativePlatform) {
            setEnablePerKiloPurchaseState(true);
            persist({ enablePerKiloPurchase: true });
          }
        }
      } catch (error) {
        // ignore parse errors
      }
    };

    // On mobile, wait a bit for Capacitor to initialize
    if (typeof window !== "undefined" && (window as any).Capacitor) {
      // If Capacitor is available, settings should load immediately
      loadSettings();
    } else {
      // For web or if Capacitor isn't ready, try loading immediately
      loadSettings();
    }
  }, []);

  const buildPersistPayload = (overrides: Partial<StoredSettings> = {}): StoredSettings => ({
    storeName,
    storeAddress,
    autoPrintReceipt,
    showLogoOnReceipt,
    receiptLogoUrl,
    taxRatePercent,
    enableDiscounts,
    enableBarcodeScanning,
    enablePerKiloPurchase,
    stickerCodeType,
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

  const setReceiptLogoUrl = (value: string | null) => {
    setReceiptLogoUrlState(value);
    try {
      persist({ receiptLogoUrl: value });
    } catch {
      // localStorage may fail if image is too large
    }
  };

  const setEnableDiscounts = (value: boolean) => {
    setEnableDiscountsState(value);
    persist({ enableDiscounts: value });
  };

  const setEnableBarcodeScanning = (value: boolean) => {
    setEnableBarcodeScanningState(value);
    persist({ enableBarcodeScanning: value });
  };

  const setEnablePerKiloPurchase = (value: boolean) => {
    setEnablePerKiloPurchaseState(value);
    persist({ enablePerKiloPurchase: value });
  };

  const setStickerCodeType = (value: "qr" | "barcode") => {
    setStickerCodeTypeState(value);
    persist({ stickerCodeType: value });
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
        receiptLogoUrl,
        setAutoPrintReceipt,
        setShowLogoOnReceipt,
        setReceiptLogoUrl,
        taxRatePercent,
        setTaxRatePercent,
        enableDiscounts,
        enableBarcodeScanning,
        enablePerKiloPurchase,
        stickerCodeType,
        setEnableDiscounts,
        setEnableBarcodeScanning,
        setEnablePerKiloPurchase,
        setStickerCodeType,
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


