import { Capacitor } from "@capacitor/core";
import EscPosEncoder, { PrinterWidthEnum } from "@manhnd/esc-pos-encoder";

export interface PrinterDevice {
  name: string;
  address: string;
}

export interface ReceiptItem {
  name: string;
  variantName?: string;
  quantity: number;
  price: number;
  subtotal: number;
}

export interface ReceiptTotals {
  subtotal?: number;
  tax?: number;
  discount?: number;
  total: number;
  amountReceived: number;
  change: number;
}

export interface ReceiptPayload {
  storeName?: string;
  storeAddress?: string;
  cashierName?: string;
  ticketNumber?: string;
  createdAt?: string;
  items: ReceiptItem[];
  totals: ReceiptTotals;
  footerNote?: string;
}

const LINE_WIDTH = 32;

const ensurePlugin = (): BluetoothSerialPlugin => {
  if (!Capacitor.isNativePlatform()) {
    throw new Error("Bluetooth printing is only available on native builds.");
  }
  if (typeof window === "undefined") {
    throw new Error("Window object unavailable.");
  }
  const plugin =
    window.BluetoothSerial ||
    window.bluetoothSerial ||
    window.cordova?.plugins?.bluetoothSerial ||
    (typeof bluetoothSerial !== "undefined" ? bluetoothSerial : undefined);
  if (!plugin) {
    throw new Error(
      "BluetoothSerial plugin not found. Install 'cordova-plugin-bluetooth-serial' and run npx cap sync.",
    );
  }
  return plugin;
};

const promisify = <T>(executor: (resolve: (value: T) => void, reject: (reason?: any) => void) => void) =>
  new Promise<T>(executor);

const androidPermissionNames = {
  BLUETOOTH_CONNECT: "android.permission.BLUETOOTH_CONNECT",
  BLUETOOTH_SCAN: "android.permission.BLUETOOTH_SCAN",
  ACCESS_FINE_LOCATION: "android.permission.ACCESS_FINE_LOCATION",
  ACCESS_COARSE_LOCATION: "android.permission.ACCESS_COARSE_LOCATION",
};

const requestAndroidPermissions = async () => {
  if (!Capacitor.isNativePlatform()) return;
  const perms = window.cordova?.plugins?.permissions;
  if (!perms) return;

  const resolvePermissionName = (pluginName?: string, fallback?: string) => pluginName || fallback;

  const requiredPermissions = [
    resolvePermissionName(perms.ANDROID_PERMISSION?.BLUETOOTH_CONNECT, androidPermissionNames.BLUETOOTH_CONNECT),
    resolvePermissionName(perms.ANDROID_PERMISSION?.BLUETOOTH_SCAN, androidPermissionNames.BLUETOOTH_SCAN),
    resolvePermissionName(perms.ANDROID_PERMISSION?.ACCESS_FINE_LOCATION, androidPermissionNames.ACCESS_FINE_LOCATION),
    resolvePermissionName(perms.ANDROID_PERMISSION?.ACCESS_COARSE_LOCATION, androidPermissionNames.ACCESS_COARSE_LOCATION),
  ].filter(Boolean) as string[];

  const ensurePermission = (permission: string) =>
    new Promise<void>((resolve, reject) => {
      perms.checkPermission(
        permission,
        (status) => {
          if (status.hasPermission) {
            resolve();
          } else {
            perms.requestPermission(
              permission,
              (result) => {
                if (result.hasPermission) {
                  resolve();
                } else {
                  reject(new Error(`Permission denied: ${permission}`));
                }
              },
              reject,
            );
          }
        },
        reject,
      );
    });

  for (const permission of requiredPermissions) {
    await ensurePermission(permission);
  }
};

const ensureBluetoothEnabled = async (plugin: BluetoothSerialPlugin) => {
  const enabled = await promisify<boolean>((resolve) => {
    plugin.isEnabled(
      () => resolve(true),
      () => resolve(false),
    );
  });

  if (!enabled) {
    await promisify<void>((resolve, reject) => plugin.enable(resolve, reject));
  }
};

const ensureConnected = async (plugin: BluetoothSerialPlugin, address: string) => {
  const alreadyConnected = await promisify<boolean>((resolve) => {
    plugin.isConnected(
      () => resolve(true),
      () => resolve(false),
    );
  });

  if (!alreadyConnected) {
    await promisify<void>((resolve, reject) => plugin.connect(address, resolve, reject));
  }
};

const disconnectSafe = async (plugin: BluetoothSerialPlugin) => {
  try {
    await promisify<void>((resolve, reject) => plugin.disconnect(resolve, reject));
  } catch {
    // Ignore disconnect errors
  }
};

const formatCurrency = (value: number) => {
  if (Number.isNaN(value)) return "0.00";
  return value.toFixed(2);
};

const formatColumns = (left: string, right: string, width = LINE_WIDTH) => {
  const sanitizedLeft = left ?? "";
  const sanitizedRight = right ?? "";
  const available = Math.max(0, width - sanitizedRight.length);
  const trimmedLeft = sanitizedLeft.length > available ? `${sanitizedLeft.slice(0, available - 1)}…` : sanitizedLeft;
  return `${trimmedLeft.padEnd(available)}${sanitizedRight}`;
};

const buildEscPosReceipt = (payload: ReceiptPayload) => {
  const encoder = new EscPosEncoder();
  encoder.initialize().setPinterType(PrinterWidthEnum._58).codepage("cp437");

  encoder.align("center").bold();
  encoder.line(payload.storeName || "QuickScale");
  encoder.bold(false);
  if (payload.storeAddress) {
    encoder.line(payload.storeAddress);
  }
  encoder.line(`Ticket: ${payload.ticketNumber ?? ""}`);
  encoder.line(`Cashier: ${payload.cashierName || ""}`);
  encoder.printLine("-", "", false);
  encoder.align("left");

  if (!payload.items.length) {
    encoder.line("No items");
  } else {
    payload.items.forEach((item) => {
      const nameLine = item.variantName ? `${item.name} (${item.variantName})` : item.name;
      encoder.line(nameLine);
      encoder.line(
        formatColumns(
          `${item.quantity} x ${formatCurrency(item.price)}`,
          formatCurrency(item.subtotal),
        ),
      );
    });
  }

  encoder.printLine("-", "", false);
  if (typeof payload.totals.subtotal === "number") {
    encoder.line(formatColumns("Subtotal", formatCurrency(payload.totals.subtotal)));
  }
  if (typeof payload.totals.tax === "number") {
    encoder.line(formatColumns("Tax", formatCurrency(payload.totals.tax)));
  }
  if (typeof payload.totals.discount === "number" && payload.totals.discount > 0) {
    encoder.line(formatColumns("Discount", `-${formatCurrency(payload.totals.discount)}`));
  }
  encoder.bold(true).line(formatColumns("TOTAL", formatCurrency(payload.totals.total))).bold(false);
  encoder.line(formatColumns("Received", formatCurrency(payload.totals.amountReceived)));
  encoder.line(formatColumns("Change", formatCurrency(payload.totals.change)));

  encoder.align("center").line(payload.footerNote || "Thank you for shopping!");
  encoder.line("This is not an Official Receipt");
  encoder.newline().newline().newline().newline().cut();

  return encoder.encode();
};

export const printerService = {
  isSupported: () => Capacitor.isNativePlatform(),

  async listDevices(): Promise<PrinterDevice[]> {
    const plugin = ensurePlugin();
    await requestAndroidPermissions();
    await ensureBluetoothEnabled(plugin);
    const devices = await promisify<BluetoothSerialDevice[]>((resolve, reject) =>
      plugin.list(resolve, reject),
    );
    return devices
      .map((device) => ({
        name: device.name || device.id || "Unknown printer",
        address: device.address || device.id || "",
      }))
      .filter((device) => device.address);
  },

  async print(address: string, payload: ReceiptPayload): Promise<void> {
    const plugin = ensurePlugin();
    await requestAndroidPermissions();
    await ensureBluetoothEnabled(plugin);
    await ensureConnected(plugin, address);
    const bytes = buildEscPosReceipt(payload);
    try {
      await promisify<void>((resolve, reject) => plugin.write(bytes.buffer, resolve, reject));
    } finally {
      await disconnectSafe(plugin);
    }
  },

  async test(address: string, storeName?: string, storeAddress?: string) {
    await printerService.print(address, {
      storeName: storeName || "QuickScale",
      storeAddress,
      cashierName: "Test Print",
      ticketNumber: `TEST-${Date.now().toString(36).toUpperCase()}`,
      createdAt: new Date().toISOString(),
      items: [
        { name: "Sample Item", quantity: 1, price: 0, subtotal: 0 },
      ],
      totals: {
        total: 0,
        amountReceived: 0,
        change: 0,
      },
      footerNote: "Printer configuration successful",
    });
  },
};


