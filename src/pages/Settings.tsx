import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { useSettings } from "@/contexts/SettingsContext";

const Settings = () => {
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
    setEnableDiscounts,
    setEnableBarcodeScanning,
  } = useSettings();

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
    </div>
  );
};

export default Settings;
