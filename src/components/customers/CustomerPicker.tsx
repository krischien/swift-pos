import { useEffect, useMemo, useState } from "react";
import { QrCode, Search, UserPlus, X } from "lucide-react";
import { useDataLayer } from "@/contexts/DataLayerContext";
import { useStore } from "@/contexts/StoreContext";
import type { Customer, CylinderLoan } from "@/types/pos";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";

interface CustomerPickerProps {
  selected: Customer | null;
  onSelect: (customer: Customer | null) => void;
  required?: boolean;
}

export function CustomerPicker({ selected, onSelect, required = false }: CustomerPickerProps) {
  const dataService = useDataLayer();
  const { activeStoreId } = useStore();
  const storeId = activeStoreId === "default" ? undefined : activeStoreId;
  const [query, setQuery] = useState("");
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loans, setLoans] = useState<CylinderLoan[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [qrToken, setQrToken] = useState("");

  useEffect(() => {
    if (!dataService.getCylinderLoans) return;
    void dataService.getCylinderLoans({ status: "all" }, storeId)
      .then(setLoans)
      .catch(() => setLoans([]));
  }, [dataService, storeId]);

  useEffect(() => {
    if (!dataService.getCustomers || !dataService.getRecentCustomers) {
      setError("Customer lookup is unavailable on this device.");
      return;
    }
    const timer = window.setTimeout(() => {
      setLoading(true);
      setError(null);
      const request = query.trim()
        ? dataService.getCustomers!({ search: query.trim(), pageSize: 12 }, storeId).then((r) => r.items)
        : dataService.getRecentCustomers!(12, storeId);
      void request
        .then(setCustomers)
        .catch((e) => setError(e instanceof Error ? e.message : "Customer lookup failed"))
        .finally(() => setLoading(false));
    }, query.trim() ? 300 : 0);
    return () => window.clearTimeout(timer);
  }, [dataService, query, storeId]);

  const outstandingByCustomer = useMemo(() => {
    const result = new Map<string, number>();
    loans.forEach((loan) => {
      if (!loan.customerId || !["out", "partial"].includes(loan.status)) return;
      result.set(
        loan.customerId,
        (result.get(loan.customerId) ?? 0) + Math.max(0, loan.quantity - loan.returnedQuantity),
      );
    });
    return result;
  }, [loans]);

  const create = async () => {
    if (!name.trim() || !dataService.createCustomer) return;
    setLoading(true);
    setError(null);
    try {
      const customer = await dataService.createCustomer(
        { name: name.trim(), phone: phone.trim() || null },
        storeId,
      );
      onSelect(customer);
      setCreating(false);
      setName("");
      setPhone("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not create customer");
    } finally {
      setLoading(false);
    }
  };

  const lookupQr = async () => {
    if (!qrToken.trim() || !dataService.getCustomerByQr) return;
    setLoading(true);
    setError(null);
    try {
      onSelect(await dataService.getCustomerByQr(qrToken.trim(), storeId));
      setQrToken("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "QR customer not found");
    } finally {
      setLoading(false);
    }
  };

  if (selected) {
    const outstanding = outstandingByCustomer.get(selected.id) ?? 0;
    return (
      <div className="flex items-center justify-between gap-3 rounded-lg border bg-muted/40 p-3">
        <div className="min-w-0">
          <p className="truncate font-medium">{selected.name}</p>
          <p className="truncate text-xs text-muted-foreground">
            {[selected.nickname, selected.phone, selected.address].filter(Boolean).join(" · ") || "Customer profile"}
          </p>
          {outstanding > 0 && <Badge variant="secondary" className="mt-1">{outstanding} outstanding</Badge>}
        </div>
        <Button type="button" variant="ghost" size="icon" onClick={() => onSelect(null)} aria-label="Clear customer">
          <X className="h-4 w-4" />
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-3 rounded-lg border p-3">
      <div>
        <p className="text-sm font-medium">Customer {required ? "(required)" : "(optional)"}</p>
        <p className="text-xs text-muted-foreground">
          {required ? "Select a customer because canisters remain out." : "A full exchange can be completed without one."}
        </p>
      </div>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search name, phone, nickname, address"
          className="pl-9"
        />
      </div>
      <div className="max-h-40 space-y-1 overflow-y-auto">
        {customers.map((customer) => (
          <button
            key={customer.id}
            type="button"
            onClick={() => onSelect(customer)}
            className="flex w-full items-center justify-between rounded-md border px-3 py-2 text-left hover:bg-accent"
          >
            <span className="min-w-0">
              <span className="block truncate text-sm font-medium">{customer.name}</span>
              <span className="block truncate text-xs text-muted-foreground">
                {[customer.nickname, customer.phone, customer.address].filter(Boolean).join(" · ") || "No contact details"}
              </span>
            </span>
            {(outstandingByCustomer.get(customer.id) ?? 0) > 0 && (
              <Badge variant="secondary">{outstandingByCustomer.get(customer.id)} out</Badge>
            )}
          </button>
        ))}
        {!loading && customers.length === 0 && <p className="py-2 text-center text-xs text-muted-foreground">No customers found</p>}
      </div>
      {creating ? (
        <div className="space-y-2 rounded-md bg-muted/50 p-2">
          <Label htmlFor="new-customer-name">Name</Label>
          <Input id="new-customer-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Customer name" />
          <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Phone (optional)" />
          <div className="flex gap-2">
            <Button type="button" size="sm" onClick={() => void create()} disabled={!name.trim() || loading}>Create & select</Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => setCreating(false)}>Cancel</Button>
          </div>
        </div>
      ) : (
        <Button type="button" variant="outline" size="sm" onClick={() => setCreating(true)}>
          <UserPlus className="mr-2 h-4 w-4" /> New customer
        </Button>
      )}
      <div className="flex gap-2">
        <Input value={qrToken} onChange={(e) => setQrToken(e.target.value)} placeholder="Paste or scan customer QR token" />
        <Button type="button" variant="outline" size="icon" onClick={() => void lookupQr()} disabled={!qrToken.trim() || loading} aria-label="Lookup QR">
          <QrCode className="h-4 w-4" />
        </Button>
      </div>
      {loading && <p className="text-xs text-muted-foreground">Loading…</p>}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
