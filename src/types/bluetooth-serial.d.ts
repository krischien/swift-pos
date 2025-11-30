interface BluetoothSerialDevice {
  id?: string;
  uuid?: string;
  name?: string;
  address?: string;
  class?: number;
}

interface BluetoothSerialPlugin {
  list(success: (devices: BluetoothSerialDevice[]) => void, failure: (error: any) => void): void;
  connect(address: string, success: () => void, failure: (error: any) => void): void;
  disconnect(success: () => void, failure: (error: any) => void): void;
  isConnected(success: () => void, failure: () => void): void;
  write(
    data: ArrayBuffer | Uint8Array | string,
    success: () => void,
    failure: (error: any) => void,
  ): void;
  isEnabled(success: () => void, failure: () => void): void;
  enable(success: () => void, failure: (error: any) => void): void;
}

interface Window {
  BluetoothSerial?: BluetoothSerialPlugin;
  bluetoothSerial?: BluetoothSerialPlugin;
  cordova?: Cordova;
}

declare const bluetoothSerial: BluetoothSerialPlugin | undefined;



