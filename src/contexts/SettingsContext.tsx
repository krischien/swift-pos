import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { Capacitor } from "@capacitor/core";
import type { PrinterDevice } from "@/lib/printer";
import { useStore } from "@/contexts/StoreContext";

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
  enableTax: boolean;
  setEnableTax: (value: boolean) => void;
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
  enableTax: boolean;
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

type SettingsByStore = Record<string, StoredSettings>;

const getDefaultSettings = (isNativePlatform: boolean): StoredSettings => ({
  storeName: "",
  storeAddress: "",
  autoPrintReceipt: true,
  showLogoOnReceipt: true,
  receiptLogoUrl: null,
  enableTax: true,
  taxRatePercent: 12,
  enableDiscounts: true,
  enableBarcodeScanning: false,
  enablePerKiloPurchase: isNativePlatform,
  stickerCodeType: "qr",
  printerName: null,
  printerAddress: null,
});

const isOldFormat = (parsed: unknown): parsed is StoredSettings =>
  typeof parsed === "object" &&
  parsed !== null &&
  ("storeName" in parsed || "enableTax" in parsed || "autoPrintReceipt" in parsed);

const applyToState = (
  s: Partial<StoredSettings>,
  setters: {
    setStoreNameState: (v: string) => void;
    setStoreAddressState: (v: string) => void;
    setAutoPrintReceiptState: (v: boolean) => void;
    setShowLogoOnReceiptState: (v: boolean) => void;
    setReceiptLogoUrlState: (v: string | null) => void;
    setEnableTaxState: (v: boolean) => void;
    setTaxRatePercentState: (v: number) => void;
    setEnableDiscountsState: (v: boolean) => void;
    setEnableBarcodeScanningState: (v: boolean) => void;
    setEnablePerKiloPurchaseState: (v: boolean) => void;
    setStickerCodeTypeState: (v: "qr" | "barcode") => void;
    setPrinterNameState: (v: string | null) => void;
    setPrinterAddressState: (v: string | null) => void;
  },
  isNativePlatform: boolean,
) => {
  setters.setStoreNameState(s.storeName ?? "");
  setters.setStoreAddressState(s.storeAddress ?? "");
  setters.setAutoPrintReceiptState(typeof s.autoPrintReceipt === "boolean" ? s.autoPrintReceipt : true);
  setters.setShowLogoOnReceiptState(typeof s.showLogoOnReceipt === "boolean" ? s.showLogoOnReceipt : true);
  setters.setReceiptLogoUrlState(typeof s.receiptLogoUrl === "string" ? s.receiptLogoUrl : null);
  setters.setEnableTaxState(typeof s.enableTax === "boolean" ? s.enableTax : true);
  setters.setTaxRatePercentState(typeof s.taxRatePercent === "number" ? s.taxRatePercent : 12);
  setters.setEnableDiscountsState(typeof s.enableDiscounts === "boolean" ? s.enableDiscounts : true);
  setters.setEnableBarcodeScanningState(
    typeof s.enableBarcodeScanning === "boolean" ? s.enableBarcodeScanning : false,
  );
  setters.setEnablePerKiloPurchaseState(
    typeof s.enablePerKiloPurchase === "boolean" ? s.enablePerKiloPurchase : isNativePlatform,
  );
  setters.setStickerCodeTypeState(
    s.stickerCodeType === "barcode" || s.stickerCodeType === "qr" ? s.stickerCodeType : "qr",
  );
  setters.setPrinterNameState(s.printerName ?? null);
  setters.setPrinterAddressState(s.printerAddress ?? null);
};

export const SettingsProvider = ({ children }: { children: React.ReactNode }) => {
  const isNativePlatform = Capacitor.isNativePlatform();
  const { activeStoreId } = useStore();
  const [storeName, setStoreNameState] = useState("");
  const [storeAddress, setStoreAddressState] = useState("");
  const [autoPrintReceipt, setAutoPrintReceiptState] = useState(true);
  const [showLogoOnReceipt, setShowLogoOnReceiptState] = useState(true);
  const [receiptLogoUrl, setReceiptLogoUrlState] = useState<string | null>(null);
  const [enableTax, setEnableTaxState] = useState(true);
  const [taxRatePercent, setTaxRatePercentState] = useState(12);
  const [enableDiscounts, setEnableDiscountsState] = useState(true);
  const [enableBarcodeScanning, setEnableBarcodeScanningState] = useState(false);
  const [enablePerKiloPurchase, setEnablePerKiloPurchaseState] = useState(isNativePlatform);
  const [stickerCodeType, setStickerCodeTypeState] = useState<"qr" | "barcode">("qr");
  const [printerName, setPrinterNameState] = useState<string | null>(null);
  const [printerAddress, setPrinterAddressState] = useState<string | null>(null);

  const loadForStore = useCallback(
    (storeId: string) => {
      try {
        if (typeof window === "undefined" || !window.localStorage) return;
        const raw = window.localStorage.getItem(STORAGE_KEY);
        if (!raw) {
          const defaults = getDefaultSettings(isNativePlatform);
          applyToState(defaults, {
            setStoreNameState,
            setStoreAddressState,
            setAutoPrintReceiptState,
            setShowLogoOnReceiptState,
            setReceiptLogoUrlState,
            setEnableTaxState,
            setTaxRatePercentState,
            setEnableDiscountsState,
            setEnableBarcodeScanningState,
            setEnablePerKiloPurchaseState,
            setStickerCodeTypeState,
            setPrinterNameState,
            setPrinterAddressState,
          }, isNativePlatform);
          if (isNativePlatform) {
            const byStore: SettingsByStore = { [storeId]: { ...defaults, enablePerKiloPurchase: true } };
            window.localStorage.setItem(STORAGE_KEY, JSON.stringify(byStore));
          }
          return;
        }
        const parsed = JSON.parse(raw) as unknown;
        let byStore: SettingsByStore;
        if (isOldFormat(parsed)) {
          byStore = { default: parsed as StoredSettings };
          window.localStorage.setItem(STORAGE_KEY, JSON.stringify(byStore));
        } else if (typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)) {
          byStore = parsed as SettingsByStore;
        } else {
          byStore = {};
        }
        const storeSettings = byStore[storeId] ?? getDefaultSettings(isNativePlatform);
        applyToState(storeSettings, {
          setStoreNameState,
          setStoreAddressState,
          setAutoPrintReceiptState,
          setShowLogoOnReceiptState,
          setReceiptLogoUrlState,
          setEnableTaxState,
          setTaxRatePercentState,
          setEnableDiscountsState,
          setEnableBarcodeScanningState,
          setEnablePerKiloPurchaseState,
          setStickerCodeTypeState,
          setPrinterNameState,
          setPrinterAddressState,
        }, isNativePlatform);
      } catch {
        // ignore parse errors
      }
    },
    [isNativePlatform],
  );

  useEffect(() => {
    loadForStore(activeStoreId);
  }, [activeStoreId, loadForStore]);

  const buildPersistPayload = (overrides: Partial<StoredSettings> = {}): StoredSettings => ({
    storeName,
    storeAddress,
    autoPrintReceipt,
    showLogoOnReceipt,
    receiptLogoUrl,
    enableTax,
    taxRatePercent,
    enableDiscounts,
    enableBarcodeScanning,
    enablePerKiloPurchase,
    stickerCodeType,
    printerName,
    printerAddress,
    ...overrides,
  });

  const persist = useCallback(
    (overrides?: Partial<StoredSettings>) => {
      try {
        if (typeof window === "undefined" || !window.localStorage) return;
        const raw = window.localStorage.getItem(STORAGE_KEY);
        let byStore: SettingsByStore = {};
        if (raw) {
          const parsed = JSON.parse(raw) as unknown;
          if (isOldFormat(parsed)) {
            byStore = { default: parsed as StoredSettings };
          } else if (typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)) {
            byStore = parsed as SettingsByStore;
          }
        }
        byStore[activeStoreId] = buildPersistPayload(overrides);
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(byStore));
      } catch {
        // ignore storage errors
      }
    },
    [activeStoreId, storeName, storeAddress, autoPrintReceipt, showLogoOnReceipt, receiptLogoUrl, enableTax, taxRatePercent, enableDiscounts, enableBarcodeScanning, enablePerKiloPurchase, stickerCodeType, printerName, printerAddress],
  );

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

  const setEnableTax = (value: boolean) => {
    setEnableTaxState(value);
    persist({ enableTax: value });
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
        enableTax,
        setEnableTax,
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


