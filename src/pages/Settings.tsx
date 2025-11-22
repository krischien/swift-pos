import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";

const Settings = () => {
  return (
    <div className="p-6 space-y-6 max-w-4xl">
      <div>
        <h1 className="text-3xl font-bold">Settings</h1>
        <p className="text-muted-foreground">Manage your POS system preferences</p>
      </div>

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
            <Switch id="discounts" defaultChecked />
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="barcode">Barcode Scanning</Label>
              <p className="text-sm text-muted-foreground">
                Enable barcode scanner support for faster checkout
              </p>
            </div>
            <Switch id="barcode" />
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
            <Switch id="auto-print" defaultChecked />
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="show-logo">Show Logo on Receipt</Label>
              <p className="text-sm text-muted-foreground">
                Include business logo on printed receipts
              </p>
            </div>
            <Switch id="show-logo" defaultChecked />
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Settings;
