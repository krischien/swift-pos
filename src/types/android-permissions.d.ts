interface AndroidPermissionStatus {
  hasPermission: boolean;
}

interface AndroidPermissionsPlugin {
  checkPermission(
    permission: string,
    successCallback: (status: AndroidPermissionStatus) => void,
    errorCallback: (error: any) => void,
  ): void;
  requestPermission(
    permission: string,
    successCallback: (status: AndroidPermissionStatus) => void,
    errorCallback: (error: any) => void,
  ): void;
  requestPermissions(
    permissions: string[],
    successCallback: (status: AndroidPermissionStatus) => void,
    errorCallback: (error: any) => void,
  ): void;
  ANDROID_PERMISSION: {
    ACCESS_COARSE_LOCATION: string;
    ACCESS_FINE_LOCATION: string;
    BLUETOOTH_CONNECT?: string;
    BLUETOOTH_SCAN?: string;
  };
}

interface Cordova {
  plugins?: {
    permissions?: AndroidPermissionsPlugin;
    bluetoothSerial?: BluetoothSerialPlugin;
  };
}


