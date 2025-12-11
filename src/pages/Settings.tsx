import { useState, useEffect } from "react";
import { Capacitor } from "@capacitor/core";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Bluetooth, Loader2, Printer as PrinterIcon, RefreshCcw, Database, Download, RotateCcw, Upload } from "lucide-react";
import { useSettings } from "@/contexts/SettingsContext";
import { useToast } from "@/hooks/use-toast";
import { printerService, type PrinterDevice } from "@/lib/printer";
import { api } from "@/lib/api";
import {
  createMobileBackup,
  exportMobileBackup,
  listMobileBackups,
  restoreMobileBackup,
  type MobileBackup,
} from "@/lib/mobileBackup";

const Settings = () => {
  const { toast } = useToast();
  const {
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
  } = useSettings();
  const [availablePrinters, setAvailablePrinters] = useState<PrinterDevice[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [backups, setBackups] = useState<Array<{ filename: string; path: string; size: number; date: string }>>([]);
  const [loadingBackups, setLoadingBackups] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [selectedBackup, setSelectedBackup] = useState<string>("");
  const [showRestoreDialog, setShowRestoreDialog] = useState(false);
  const [mobileBackups, setMobileBackups] = useState<MobileBackup[]>([]);
  const [loadingMobileBackups, setLoadingMobileBackups] = useState(false);
  const [creatingMobileBackup, setCreatingMobileBackup] = useState(false);
  const [exportingMobileBackup, setExportingMobileBackup] = useState(false);
  const [selectedMobileBackup, setSelectedMobileBackup] = useState<string>("");
  const [showMobileRestoreDialog, setShowMobileRestoreDialog] = useState(false);
  const isNative = Capacitor.isNativePlatform();

  const handleScanPrinters = async () => {
    if (!isNative) {
      toast({
        title: "Bluetooth unavailable",
        description: "Printer scanning works only inside the Android app build.",
      });
      return;
    }
    setIsScanning(true);
    try {
      const devices = await printerService.listDevices();
      setAvailablePrinters(devices);
      if (!devices.length) {
        toast({
          title: "No printers found",
          description: "Pair your printer in Android settings first, then try scanning again.",
        });
      }
    } catch (error: any) {
      toast({
        title: "Scan failed",
        description: error?.message ?? "Unable to list paired printers.",
        variant: "destructive",
      });
    } finally {
      setIsScanning(false);
    }
  };

  const handleSelectPrinter = (device: PrinterDevice) => {
    setSelectedPrinter(device);
    toast({
      title: "Printer selected",
      description: `${device.name} (${device.address})`,
    });
  };

  const handleTestPrint = async () => {
    if (!isNative) {
      toast({
        title: "Bluetooth unavailable",
        description: "Test prints can only run inside the Android app build.",
        variant: "destructive",
      });
      return;
    }
    if (!selectedPrinter) {
      toast({
        title: "No printer selected",
        description: "Choose a printer first, then run a test print.",
      });
      return;
    }
    setIsTesting(true);
    try {
      await printerService.test(selectedPrinter.address, storeName, storeAddress);
      toast({
        title: "Test receipt sent",
        description: selectedPrinter.name,
      });
    } catch (error: any) {
      toast({
        title: "Test print failed",
        description: error?.message ?? "Unable to send data to the printer.",
        variant: "destructive",
      });
    } finally {
      setIsTesting(false);
    }
  };

  const loadBackups = async () => {
    if (isNative) return; // Backups only available on server
    setLoadingBackups(true);
    try {
      const backupList = await api.getBackups();
      setBackups(backupList);
      if (backupList.length > 0 && !selectedBackup) {
        setSelectedBackup(backupList[0].filename);
      }
    } catch (error: any) {
      const errorMessage = error?.message || "";
      const isConnectionError = errorMessage.includes("CONNECTION_REFUSED") || 
                               errorMessage.includes("Failed to fetch") ||
                               errorMessage.includes("NetworkError");
      
      toast({
        title: "Failed to load backups",
        description: isConnectionError
          ? "Server is not running. Please start the server with 'npm run dev:server'"
          : errorMessage || "Unable to fetch backup list.",
        variant: "destructive",
      });
    } finally {
      setLoadingBackups(false);
    }
  };

  const handleRestore = async () => {
    if (!selectedBackup) {
      toast({
        title: "No backup selected",
        description: "Please select a backup to restore from.",
        variant: "destructive",
      });
      return;
    }

    setRestoring(true);
    try {
      await api.restoreBackup(selectedBackup);
      toast({
        title: "Database restored",
        description: `Successfully restored from ${selectedBackup}. Please refresh the page.`,
      });
      setShowRestoreDialog(false);
      // Reload backups after restore
      await loadBackups();
    } catch (error: any) {
      const errorMessage = error?.message || "";
      const isConnectionError = errorMessage.includes("CONNECTION_REFUSED") || 
                               errorMessage.includes("Failed to fetch") ||
                               errorMessage.includes("NetworkError");
      
      toast({
        title: "Restore failed",
        description: isConnectionError
          ? "Server is not running. Please start the server with 'npm run dev:server'"
          : errorMessage || "Unable to restore database.",
        variant: "destructive",
      });
    } finally {
      setRestoring(false);
    }
  };

  const handleCreateBackup = async () => {
    setLoadingBackups(true);
    try {
      await api.createBackup();
      toast({
        title: "Backup created",
        description: "Manual backup created successfully.",
      });
      await loadBackups();
    } catch (error: any) {
      const errorMessage = error?.message || "";
      const isConnectionError = errorMessage.includes("CONNECTION_REFUSED") || 
                               errorMessage.includes("Failed to fetch") ||
                               errorMessage.includes("NetworkError");
      
      toast({
        title: "Backup failed",
        description: isConnectionError
          ? "Server is not running. Please start the server with 'npm run dev:server'"
          : errorMessage || "Unable to create backup.",
        variant: "destructive",
      });
    } finally {
      setLoadingBackups(false);
    }
  };

  // Mobile backup functions
  const loadMobileBackups = async () => {
    if (!isNative) return;
    setLoadingMobileBackups(true);
    try {
      const backupList = await listMobileBackups();
      setMobileBackups(backupList);
      if (backupList.length > 0 && !selectedMobileBackup) {
        setSelectedMobileBackup(backupList[0].filename);
      }
    } catch (error: any) {
      toast({
        title: "Failed to load backups",
        description: error?.message || "Unable to fetch backup list.",
        variant: "destructive",
      });
    } finally {
      setLoadingMobileBackups(false);
    }
  };

  const handleCreateMobileBackup = async () => {
    setCreatingMobileBackup(true);
    try {
      await createMobileBackup();
      toast({
        title: "Backup created",
        description: "Database backup created successfully.",
      });
      await loadMobileBackups();
    } catch (error: any) {
      toast({
        title: "Backup failed",
        description: error?.message || "Unable to create backup.",
        variant: "destructive",
      });
    } finally {
      setCreatingMobileBackup(false);
    }
  };

  const handleExportMobileBackup = async () => {
    setExportingMobileBackup(true);
    try {
      await exportMobileBackup();
      toast({
        title: "Backup exported",
        description: "Backup file is ready to share or save.",
      });
      await loadMobileBackups();
    } catch (error: any) {
      toast({
        title: "Export failed",
        description: error?.message || "Unable to export backup.",
        variant: "destructive",
      });
    } finally {
      setExportingMobileBackup(false);
    }
  };

  const handleRestoreMobileBackup = async () => {
    if (!selectedMobileBackup) {
      toast({
        title: "No backup selected",
        description: "Please select a backup to restore from.",
        variant: "destructive",
      });
      return;
    }

    setRestoring(true);
    try {
      await restoreMobileBackup(selectedMobileBackup);
      toast({
        title: "Database restored",
        description: `Successfully restored from ${selectedMobileBackup}. Please restart the app.`,
      });
      setShowMobileRestoreDialog(false);
      await loadMobileBackups();
    } catch (error: any) {
      toast({
        title: "Restore failed",
        description: error?.message || "Unable to restore database.",
        variant: "destructive",
      });
    } finally {
      setRestoring(false);
    }
  };

  useEffect(() => {
    if (!isNative) {
      loadBackups();
    } else {
      loadMobileBackups();
    }
  }, [isNative]);

  return (
    <div className="p-6 space-y-6 max-w-4xl">
      <div>
        <h1 className="text-3xl font-bold">Settings</h1>
        <p className="text-muted-foreground">Manage your POS system preferences</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Store Information</CardTitle>
          <CardDescription>Used as the header on printed receipts.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1">
            <Label htmlFor="store-name">Store name</Label>
            <Input
              id="store-name"
              placeholder="QuickPOS"
              value={storeName}
              onChange={(e) => setStoreName(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="store-address">Store address</Label>
            <Input
              id="store-address"
              placeholder="123 Main St, City"
              value={storeAddress}
              onChange={(e) => setStoreAddress(e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>POS Features</CardTitle>
          <CardDescription>Enable or disable optional features</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Enable Image Search</Label>
              <div className="text-sm text-muted-foreground">
                Show camera button for product search
              </div>
            </div>
            <Switch
              checked={enableImageSearch}
              onCheckedChange={setEnableImageSearch}
            />
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="discounts">Enable Discounts</Label>
              <p className="text-sm text-muted-foreground">
                Allow cashiers to apply discounts to transactions
              </p>
            </div>
            <Switch
              id="discounts"
              checked={enableDiscounts}
              onCheckedChange={setEnableDiscounts}
            />
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="barcode">Barcode Scanning</Label>
              <p className="text-sm text-muted-foreground">
                Enable barcode scanner support for faster checkout
              </p>
            </div>
            <Switch
              id="barcode"
              checked={enableBarcodeScanning}
              onCheckedChange={setEnableBarcodeScanning}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Bluetooth Printer</CardTitle>
          <CardDescription>Pair your thermal printer for native Android printing</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!isNative ? (
            <p className="text-sm text-muted-foreground">
              Bluetooth printing is available in the Android build. Install the app on a device or
              emulator to scan and bind a printer.
            </p>
          ) : (
            <>
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">Selected printer</p>
                    <p className="text-sm text-muted-foreground">
                      {selectedPrinter
                        ? `${selectedPrinter.name} (${selectedPrinter.address})`
                        : "No printer selected"}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" onClick={handleScanPrinters} disabled={isScanning}>
                      {isScanning ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCcw className="mr-2 h-4 w-4" />}
                      Scan
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => setSelectedPrinter(null)}
                      disabled={!selectedPrinter}
                    >
                      Clear
                    </Button>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button onClick={handleTestPrint} disabled={!selectedPrinter || isTesting}>
                    {isTesting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <PrinterIcon className="mr-2 h-4 w-4" />}
                    Test Print
                  </Button>
                </div>
              </div>
              <Separator />
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Bluetooth className="h-4 w-4" />
                  <span>Paired devices</span>
                </div>
                {availablePrinters.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    {isScanning
                      ? "Scanning for nearby printers..."
                      : "Tap Scan to list already paired printers."}
                  </p>
                ) : (
                  <div className="space-y-2">
                    {availablePrinters.map((device) => {
                      const isSelected = device.address === selectedPrinter?.address;
                      return (
                        <Button
                          key={device.address}
                          variant={isSelected ? "default" : "outline"}
                          className="w-full justify-start"
                          onClick={() => handleSelectPrinter(device)}
                        >
                          <div className="flex flex-col text-left">
                            <span className="font-medium">{device.name}</span>
                            <span className="text-xs text-muted-foreground">{device.address}</span>
                          </div>
                        </Button>
                      );
                    })}
                  </div>
                )}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Receipt Settings</CardTitle>
          <CardDescription>Configure receipt printing options</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="auto-print">Auto-print Receipt</Label>
              <p className="text-sm text-muted-foreground">
                Automatically print receipt after each sale
              </p>
            </div>
            <Switch
              id="auto-print"
              checked={autoPrintReceipt}
              onCheckedChange={setAutoPrintReceipt}
            />
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="show-logo">Show Logo on Receipt</Label>
              <p className="text-sm text-muted-foreground">
                Include business logo on printed receipts
              </p>
            </div>
            <Switch
              id="show-logo"
              checked={showLogoOnReceipt}
              onCheckedChange={setShowLogoOnReceipt}
            />
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="tax-rate">Tax rate (%)</Label>
              <p className="text-sm text-muted-foreground">
                Applied to the net subtotal after discounts. Defaults to 12%.
              </p>
            </div>
            <Input
              id="tax-rate"
              type="number"
              className="w-24"
              min={0}
              max={100}
              value={taxRatePercent}
              onChange={(e) => setTaxRatePercent(Number(e.target.value))}
            />
          </div>
        </CardContent>
      </Card>

      {!isNative && (
        <Card>
          <CardHeader>
            <CardTitle>Data Backup & Restore</CardTitle>
            <CardDescription>Manage database backups and restore from previous backups</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Available Backups</Label>
                <p className="text-sm text-muted-foreground">
                  {backups.length === 0
                    ? "No backups found. Automatic backups run daily at midnight."
                    : `${backups.length} backup(s) available`}
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={loadBackups}
                  disabled={loadingBackups}
                >
                  {loadingBackups ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <RefreshCcw className="mr-2 h-4 w-4" />
                  )}
                  Refresh
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCreateBackup}
                  disabled={loadingBackups}
                >
                  <Download className="mr-2 h-4 w-4" />
                  Create Backup
                </Button>
              </div>
            </div>

            {backups.length > 0 && (
              <>
                <Separator />
                <div className="space-y-2">
                  <Label htmlFor="backup-select">Select Backup to Restore</Label>
                  <Select value={selectedBackup} onValueChange={setSelectedBackup}>
                    <SelectTrigger id="backup-select">
                      <SelectValue placeholder="Select a backup" />
                    </SelectTrigger>
                    <SelectContent>
                      {backups.map((backup) => {
                        const date = new Date(backup.date);
                        const sizeMB = (backup.size / (1024 * 1024)).toFixed(2);
                        return (
                          <SelectItem key={backup.filename} value={backup.filename}>
                            <div className="flex flex-col">
                              <span className="font-medium">{backup.filename}</span>
                              <span className="text-xs text-muted-foreground">
                                {date.toLocaleString()} • {sizeMB} MB
                              </span>
                            </div>
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                </div>

                <Separator />

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Restore Database</Label>
                    <p className="text-sm text-muted-foreground">
                      Restore from a previous backup. A backup of the current database will be created before restoring.
                    </p>
                  </div>
                  <Button
                    variant="destructive"
                    onClick={() => setShowRestoreDialog(true)}
                    disabled={!selectedBackup || restoring}
                  >
                    {restoring ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <RotateCcw className="mr-2 h-4 w-4" />
                    )}
                    Restore
                  </Button>
                </div>
              </>
            )}

            {backups.length === 0 && !loadingBackups && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Database className="h-4 w-4" />
                <span>Automatic backups are scheduled daily at 12:00 AM</span>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {isNative && (
        <Card>
          <CardHeader>
            <CardTitle>Data Backup & Restore</CardTitle>
            <CardDescription>Manage database backups and restore from previous backups</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Available Backups</Label>
                <p className="text-sm text-muted-foreground">
                  {mobileBackups.length === 0
                    ? "No backups found. Create a backup to protect your data."
                    : `${mobileBackups.length} backup(s) available`}
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={loadMobileBackups}
                  disabled={loadingMobileBackups}
                >
                  {loadingMobileBackups ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <RefreshCcw className="mr-2 h-4 w-4" />
                  )}
                  Refresh
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCreateMobileBackup}
                  disabled={creatingMobileBackup || loadingMobileBackups}
                >
                  {creatingMobileBackup ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Download className="mr-2 h-4 w-4" />
                  )}
                  Create Backup
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleExportMobileBackup}
                  disabled={exportingMobileBackup || loadingMobileBackups}
                >
                  {exportingMobileBackup ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Upload className="mr-2 h-4 w-4" />
                  )}
                  Export
                </Button>
              </div>
            </div>

            {mobileBackups.length > 0 && (
              <>
                <Separator />
                <div className="space-y-2">
                  <Label htmlFor="mobile-backup-select">Select Backup to Restore</Label>
                  <Select value={selectedMobileBackup} onValueChange={setSelectedMobileBackup}>
                    <SelectTrigger id="mobile-backup-select">
                      <SelectValue placeholder="Select a backup" />
                    </SelectTrigger>
                    <SelectContent>
                      {mobileBackups.map((backup) => {
                        const sizeMB = (backup.size / (1024 * 1024)).toFixed(2);
                        return (
                          <SelectItem key={backup.filename} value={backup.filename}>
                            <div className="flex flex-col">
                              <span className="font-medium">{backup.filename}</span>
                              <span className="text-xs text-muted-foreground">
                                {backup.date.toLocaleString()} • {sizeMB} MB
                              </span>
                            </div>
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                </div>

                <Separator />

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Restore Database</Label>
                    <p className="text-sm text-muted-foreground">
                      Restore from a previous backup. A backup of the current database will be created before restoring.
                    </p>
                  </div>
                  <Button
                    variant="destructive"
                    onClick={() => setShowMobileRestoreDialog(true)}
                    disabled={!selectedMobileBackup || restoring}
                  >
                    {restoring ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <RotateCcw className="mr-2 h-4 w-4" />
                    )}
                    Restore
                  </Button>
                </div>
              </>
            )}

            {mobileBackups.length === 0 && !loadingMobileBackups && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Database className="h-4 w-4" />
                <span>Create a backup to protect your data. You can export backups to share or store them elsewhere.</span>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <AlertDialog open={showRestoreDialog} onOpenChange={setShowRestoreDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Database Restore</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to restore the database from{" "}
              <strong>{selectedBackup}</strong>? This will replace all current data. A backup of
              the current database will be created automatically before restoring.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleRestore} disabled={restoring}>
              {restoring ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Restoring...
                </>
              ) : (
                "Restore"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={showMobileRestoreDialog} onOpenChange={setShowMobileRestoreDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Database Restore</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to restore the database from{" "}
              <strong>{selectedMobileBackup}</strong>? This will replace all current data. A backup of
              the current database will be created automatically before restoring. You may need to restart the app after restoring.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleRestoreMobileBackup} disabled={restoring}>
              {restoring ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Restoring...
                </>
              ) : (
                "Restore"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Settings;
