import { useCallback, useEffect, useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import { format, formatDistanceToNow } from "date-fns";
import { Capacitor } from "@capacitor/core";
import QRCode from "qrcode";
import {
  AlertCircle,
  Banknote,
  CheckCircle2,
  History,
  Package,
  QrCode,
  RotateCcw,
  Search,
  Star,
  Users,
} from "lucide-react";
import { useDataLayer } from "@/contexts/DataLayerContext";
import { useSettings } from "@/contexts/SettingsContext";
import { useStore } from "@/contexts/StoreContext";
import { useAuth } from "@/contexts/AuthContext";
import { isSaaS } from "@/config/appMode";
import type { Customer, CustomerDetail, CylinderLoan, CylinderStats } from "@/types/pos";
import { formatCurrency } from "@/lib/currency";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { printerService } from "@/lib/printer";
import { isInactiveSuki, rankReliableCustomers, rankSukiCandidates } from "@/lib/customerInsights";

const remaining = (loan: CylinderLoan) => Math.max(0, loan.quantity - loan.returnedQuantity);
const escapeHtml = (value: unknown) =>
  String(value ?? "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  })[character]!);

export default function CanisterMonitoring() {
  const dataService = useDataLayer();
  const {
    enableCylinderTracking,
    collectCylinderDeposits,
    autoPrintReceipt,
    selectedPrinter,
    storeName,
    storeAddress,
  } = useSettings();
  const { activeStoreId, stores } = useStore();
  const { user } = useAuth();
  const { toast } = useToast();
  const storeId = activeStoreId === "default" ? undefined : activeStoreId;
  const [storeScope, setStoreScope] = useState<"selected" | "all">("selected");
  const [loans, setLoans] = useState<CylinderLoan[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [details, setDetails] = useState<CustomerDetail[]>([]);
  const [stats, setStats] = useState<CylinderStats | null>(null);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [returnLoan, setReturnLoan] = useState<CylinderLoan | null>(null);
  const [returnQty, setReturnQty] = useState("1");
  const [refund, setRefund] = useState("0");
  const [returnNote, setReturnNote] = useState("");
  const [returning, setReturning] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerDetail | null>(null);
  const [sukiNote, setSukiNote] = useState("");

  const canManage = user?.role === "owner" || user?.role === "admin";
  const canAssignSuki = user?.role === "owner" || (!isSaaS() && user?.role === "admin");

  const load = useCallback(async () => {
    if (!dataService.getCylinderLoans || !dataService.getCustomers) {
      setError("Canister monitoring is not supported by this data provider.");
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const targetStoreIds = storeScope === "all" && isSaaS()
        ? stores.filter((store) => store.enableCylinderTracking).map((store) => store.id)
        : [storeId];
      const [loanPages, customerPages] = await Promise.all([
        Promise.all(targetStoreIds.map((id) => dataService.getCylinderLoans!({ status: "all" }, id))),
        Promise.all(targetStoreIds.map((id) => dataService.getCustomers!({ pageSize: 100 }, id))),
      ]);
      const loanRows = loanPages.flat();
      const customerRows = customerPages.flatMap((page) => page.items);
      setLoans(loanRows);
      setCustomers(customerRows);
      if (dataService.getCylinderStats) {
        try {
          const rows = await Promise.all(targetStoreIds.map((id) => dataService.getCylinderStats!(id)));
          setStats(rows.reduce<CylinderStats>((total, row) => ({
            filledOnHand: total.filledOnHand + row.filledOnHand,
            onCustomer: total.onCustomer + row.onCustomer,
            emptyOnHand: total.emptyOnHand + row.emptyOnHand,
            depositLiability: total.depositLiability + row.depositLiability,
            lowFilledCount: total.lowFilledCount + row.lowFilledCount,
            outOfFilledCount: total.outOfFilledCount + row.outOfFilledCount,
            lowEmptyCount: total.lowEmptyCount + row.lowEmptyCount,
            outOfEmptyCount: total.outOfEmptyCount + row.outOfEmptyCount,
          }), {
            filledOnHand: 0, onCustomer: 0, emptyOnHand: 0, depositLiability: 0,
            lowFilledCount: 0, outOfFilledCount: 0, lowEmptyCount: 0, outOfEmptyCount: 0,
          }));
        } catch {
          setStats(null);
        }
      }
      if (dataService.getCustomer) {
        const detailRows = await Promise.all(
          customerRows.map((customer) =>
            dataService.getCustomer!(customer.id, customer.storeId === "solo" ? storeId : customer.storeId).catch(() => null),
          ),
        );
        setDetails(detailRows.filter(Boolean) as CustomerDetail[]);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to load canister records");
    } finally {
      setLoading(false);
    }
  }, [dataService, storeId, storeScope, stores]);

  useEffect(() => {
    void load();
  }, [load]);

  const localStats = useMemo(() => ({
    onCustomer: loans.filter((l) => ["out", "partial"].includes(l.status)).reduce((sum, l) => sum + remaining(l), 0),
    depositLiability: loans
      .filter((l) => ["out", "partial"].includes(l.status))
      .reduce((sum, l) => sum + Math.max(0, l.depositAmount - (l.returns ?? []).reduce((r, e) => r + e.refundAmount, 0)), 0),
  }), [loans]);

  const filteredLoans = useMemo(() => {
    const q = query.trim().toLowerCase();
    return loans.filter((loan) => {
      const statusOk = statusFilter === "all" || loan.status === statusFilter;
      const text = [
        loan.customer?.name,
        loan.customerName,
        loan.customerPhone,
        loan.product?.name,
        loan.sale?.ticketNumber,
      ].filter(Boolean).join(" ").toLowerCase();
      return statusOk && (!q || text.includes(q));
    });
  }, [loans, query, statusFilter]);

  const filteredCustomers = useMemo(() => {
    const q = query.trim().toLowerCase();
    return customers.filter((customer) =>
      !q || [customer.name, customer.nickname, customer.phone, customer.address]
        .filter(Boolean).join(" ").toLowerCase().includes(q),
    );
  }, [customers, query]);

  const reliable = useMemo(() => rankReliableCustomers(details), [details]);

  const candidates = useMemo(() => rankSukiCandidates(details), [details]);

  const suki = useMemo(() =>
    details.filter((d) => d.isSuki).sort((a, b) =>
      new Date(b.sukiAssignedAt ?? 0).getTime() - new Date(a.sukiAssignedAt ?? 0).getTime(),
    ), [details]);

  const openReturn = (loan: CylinderLoan) => {
    const qty = remaining(loan);
    const refunded = (loan.returns ?? []).reduce((sum, item) => sum + item.refundAmount, 0);
    const refundable = Math.max(0, loan.depositAmount - refunded);
    setReturnLoan(loan);
    setReturnQty(String(qty));
    setRefund(String(collectCylinderDeposits ? refundable : 0));
    setReturnNote("");
  };

  const printReturnReceipt = async (loan: CylinderLoan, quantity: number, refundAmount: number) => {
    const customerName = loan.customer?.name ?? loan.customerName ?? "Customer";
    const qrToken = loan.customer?.qrToken;
    if (Capacitor.isNativePlatform() && selectedPrinter) {
      await printerService.print(selectedPrinter.address, {
        storeName,
        storeAddress,
        cashierName: user?.name,
        ticketNumber: `RETURN-${loan.sale?.ticketNumber ?? loan.saleId}`,
        customerName,
        customerQrToken: qrToken,
        items: [{
          name: `${loan.product?.name ?? "Canister"} return`,
          quantity,
          price: 0,
          subtotal: 0,
        }],
        totals: { total: 0, amountReceived: 0, change: 0, depositRefunded: refundAmount },
        footerNote: "Canister return acknowledgement",
      });
      return;
    }
    const qrImage = qrToken ? await QRCode.toDataURL(qrToken, { width: 140, margin: 1 }) : null;
    const frame = document.createElement("iframe");
    frame.style.display = "none";
    document.body.appendChild(frame);
    const doc = frame.contentWindow?.document;
    if (!doc) return;
    doc.open();
    doc.write(`<!doctype html><html><body style="font-family:system-ui;margin:18px;text-align:center">
      <h2>${escapeHtml(storeName || "SwiftPOS")}</h2><p>${escapeHtml(storeAddress)}</p><hr/>
      <h3>Canister Return</h3><p>Customer: ${escapeHtml(customerName)}</p>
      <p>${escapeHtml(loan.product?.name ?? "Canister")}: ${quantity} returned</p>
      <p><strong>Deposit refunded: ${formatCurrency(refundAmount)}</strong></p>
      ${qrImage ? `<img src="${qrImage}" width="110" height="110"/><p>Customer return QR</p>` : ""}
      <p>${format(new Date(), "MMM d, yyyy h:mm a")}</p></body></html>`);
    doc.close();
    frame.contentWindow?.addEventListener("afterprint", () => frame.remove(), { once: true });
    window.setTimeout(() => frame.contentWindow?.print(), 150);
  };

  const printCustomerQr = async (customer: Customer) => {
    const qrImage = await QRCode.toDataURL(customer.qrToken, { width: 220, margin: 2 });
    const frame = document.createElement("iframe");
    frame.style.display = "none";
    document.body.appendChild(frame);
    const doc = frame.contentWindow?.document;
    if (!doc) {
      frame.remove();
      throw new Error("Print window unavailable");
    }
    doc.open();
    doc.write(`<!doctype html><html><body style="font-family:system-ui;margin:18px;text-align:center">
      <h2>${escapeHtml(storeName || "SwiftPOS")}</h2>
      <h3>Canister Customer Card</h3>
      <p><strong>${escapeHtml(customer.name)}</strong></p>
      <img src="${qrImage}" width="190" height="190" alt="Customer QR"/>
      <p style="font-size:11px">Scan to find this customer. This code contains no personal information.</p>
      </body></html>`);
    doc.close();
    frame.contentWindow?.addEventListener("afterprint", () => frame.remove(), { once: true });
    window.setTimeout(() => frame.contentWindow?.print(), 150);
  };

  const submitReturn = async () => {
    if (!returnLoan || !dataService.returnCylinderLoan) return;
    const quantity = Math.floor(Number(returnQty));
    if (quantity < 1 || quantity > remaining(returnLoan)) return;
    setReturning(true);
    try {
      const refundAmount = Math.max(0, Number(refund) || 0);
      await dataService.returnCylinderLoan(
        returnLoan.id,
        { quantity, refundAmount, note: returnNote.trim() || undefined },
        returnLoan.storeId === "solo" ? storeId : returnLoan.storeId,
      );
      if (autoPrintReceipt) {
        try {
          await printReturnReceipt(returnLoan, quantity, refundAmount);
        } catch (printError) {
          toast({ title: "Return saved; receipt not printed", description: printError instanceof Error ? printError.message : "Printing failed" });
        }
      }
      toast({ title: "Canister return recorded", description: `${quantity} empty canister${quantity === 1 ? "" : "s"} received.` });
      setReturnLoan(null);
      await load();
    } catch (e) {
      toast({ variant: "destructive", title: "Return failed", description: e instanceof Error ? e.message : "Try again" });
    } finally {
      setReturning(false);
    }
  };

  const changeReturnQuantity = (value: string) => {
    setReturnQty(value);
    if (!returnLoan || !collectCylinderDeposits) return;
    const quantity = Math.min(remaining(returnLoan), Math.max(0, Math.floor(Number(value) || 0)));
    const refunded = (returnLoan.returns ?? []).reduce((sum, item) => sum + item.refundAmount, 0);
    const refundable = Math.max(0, returnLoan.depositAmount - refunded);
    setRefund(String(Math.min(refundable, returnLoan.depositAmount * quantity / returnLoan.quantity)));
  };

  const openCustomer = async (customer: Customer) => {
    const detail = details.find((item) => item.id === customer.id);
    if (detail) {
      setSelectedCustomer(detail);
      setSukiNote(detail.sukiNote ?? "");
      return;
    }
    if (!dataService.getCustomer) return;
    try {
      const loaded = await dataService.getCustomer(
        customer.id,
        customer.storeId === "solo" ? storeId : customer.storeId,
      );
      setSelectedCustomer(loaded);
      setSukiNote(loaded.sukiNote ?? "");
    } catch (e) {
      toast({ variant: "destructive", title: "Profile unavailable", description: e instanceof Error ? e.message : "Try again" });
    }
  };

  const toggleSuki = async () => {
    if (!selectedCustomer || !dataService.setCustomerSuki || !user || !canAssignSuki) return;
    try {
      await dataService.setCustomerSuki(
        selectedCustomer.id,
        { enabled: !selectedCustomer.isSuki, note: sukiNote.trim() || undefined, actorId: user.id },
        selectedCustomer.storeId === "solo" ? storeId : selectedCustomer.storeId,
      );
      toast({ title: selectedCustomer.isSuki ? "Suki status removed" : "Customer marked as Suki" });
      setSelectedCustomer(null);
      await load();
    } catch (e) {
      toast({ variant: "destructive", title: "Could not update Suki", description: e instanceof Error ? e.message : "Try again" });
    }
  };

  if (!enableCylinderTracking) return <Navigate to="/pos" replace />;

  const evidenceCard = (customer: CustomerDetail & { insightScore?: number }, rank?: number) => {
    const inactive = isInactiveSuki(customer);
    return (
      <button key={customer.id} onClick={() => void openCustomer(customer)} className="w-full rounded-lg border p-3 text-left hover:bg-accent">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="font-medium">{rank ? `${rank}. ` : ""}{customer.name}</span>
          <span className="flex gap-1">
            {customer.insightScore != null && <Badge variant="outline">Score {customer.insightScore}</Badge>}
            {customer.isSuki && <Badge><Star className="mr-1 h-3 w-3" />Suki</Badge>}
            {inactive && <Badge variant="destructive">Inactive 90d+</Badge>}
          </span>
        </div>
        <div className="mt-2 grid grid-cols-2 gap-1 text-xs text-muted-foreground sm:grid-cols-4">
          <span>180d visits: {customer.evidence.frequency180d}</span>
          <span>180d spend: {formatCurrency(customer.evidence.monetary180d)}</span>
          <span>Return rate: {customer.evidence.returnRate == null ? "—" : `${Math.round(customer.evidence.returnRate * 100)}%`}</span>
          <span>Avg return: {customer.evidence.avgReturnDays == null ? "—" : `${customer.evidence.avgReturnDays.toFixed(1)}d`}</span>
          <span>Out now: {customer.evidence.openQuantity}</span>
          <span>Completed: {customer.evidence.completedOutcomes}</span>
          <span>Write-offs: {customer.evidence.writeoffs ?? customer.cylinderLoans?.filter((l) => l.status === "written_off").length ?? 0}</span>
          <span>Last visit: {customer.evidence.lastPurchaseAt ? formatDistanceToNow(new Date(customer.evidence.lastPurchaseAt), { addSuffix: true }) : "Never"}</span>
        </div>
      </button>
    );
  };

  return (
    <div className="space-y-5 p-4 md:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold md:text-3xl">Canister Monitoring</h1>
          <p className="text-sm text-muted-foreground">Track exchanges, outstanding canisters, returns, and customer evidence.</p>
        </div>
        {isSaaS() && stores.filter((store) => store.enableCylinderTracking).length > 1 && canManage && (
          <label className="text-sm">
            <span className="mb-1 block text-xs text-muted-foreground">Store scope</span>
            <select value={storeScope} onChange={(event) => setStoreScope(event.target.value as "selected" | "all")} className="h-10 rounded-md border bg-background px-3">
              <option value="selected">Selected store</option>
              <option value="all">All tracked stores</option>
            </select>
          </label>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          ["Filled on hand", stats?.filledOnHand ?? "—", Package],
          ["On customers", stats?.onCustomer ?? localStats.onCustomer, Users],
          ["Empty on hand", stats?.emptyOnHand ?? "—", RotateCcw],
          ["Deposit liability", formatCurrency(stats?.depositLiability ?? localStats.depositLiability), Banknote],
        ].map(([title, value, Icon]) => (
          <Card key={String(title)}>
            <CardHeader className="flex flex-row items-center justify-between p-4 pb-1">
              <CardTitle className="text-xs font-medium text-muted-foreground">{String(title)}</CardTitle>
              <Icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent className="p-4 pt-1 text-2xl font-bold">{String(value)}</CardContent>
          </Card>
        ))}
      </div>
      {stats && (stats.lowFilledCount + stats.outOfFilledCount + stats.lowEmptyCount + stats.outOfEmptyCount > 0) && (
        <div className="flex gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            Stock warnings: {stats.outOfFilledCount} filled out, {stats.lowFilledCount} filled low,
            {" "}{stats.outOfEmptyCount} empty out, and {stats.lowEmptyCount} empty low.
          </span>
        </div>
      )}

      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search customer, phone, ticket, canister" className="pl-9" />
        </div>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="h-10 rounded-md border bg-background px-3 text-sm">
          <option value="all">All statuses</option>
          <option value="out">Outstanding</option>
          <option value="partial">Partially returned</option>
          <option value="returned">Returned</option>
          <option value="written_off">Written off</option>
        </select>
      </div>

      {error && <div className="flex gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive"><AlertCircle className="h-4 w-4" />{error}</div>}
      {loading ? <p className="py-8 text-center text-muted-foreground">Loading canister records…</p> : (
        <Tabs defaultValue="outstanding">
          <TabsList className="h-auto w-full justify-start overflow-x-auto">
            <TabsTrigger value="outstanding">Outstanding</TabsTrigger>
            <TabsTrigger value="history">Return History</TabsTrigger>
            <TabsTrigger value="customers">Customers</TabsTrigger>
            {canManage && <TabsTrigger value="reliable">Top Reliable</TabsTrigger>}
            {canManage && <TabsTrigger value="suki">Suki</TabsTrigger>}
            {canManage && <TabsTrigger value="candidates">Suki Candidates</TabsTrigger>}
          </TabsList>

          <TabsContent value="outstanding" className="space-y-2">
            {filteredLoans.filter((l) => ["out", "partial"].includes(l.status)).map((loan) => (
              <div key={loan.id} className="flex flex-col gap-3 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-medium">{loan.customer?.name ?? loan.customerName ?? "Unlinked customer"}</p>
                  <p className="text-sm text-muted-foreground">{loan.product?.name ?? "Canister"} · {remaining(loan)} of {loan.quantity} out</p>
                  <p className="text-xs text-muted-foreground">{loan.sale?.ticketNumber ?? loan.saleId} · {format(new Date(loan.outAt), "MMM d, yyyy h:mm a")}</p>
                </div>
                <Button onClick={() => openReturn(loan)}><RotateCcw className="mr-2 h-4 w-4" />Record return</Button>
              </div>
            ))}
            {!filteredLoans.some((l) => ["out", "partial"].includes(l.status)) && <p className="py-8 text-center text-muted-foreground">No outstanding canisters</p>}
          </TabsContent>

          <TabsContent value="history" className="space-y-2">
            {filteredLoans.filter((l) => l.status === "returned" || (l.returns?.length ?? 0) > 0).map((loan) => (
              <div key={loan.id} className="rounded-lg border p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-medium">{loan.customer?.name ?? loan.customerName ?? "Customer"} · {loan.product?.name ?? "Canister"}</p>
                  <Badge variant={loan.status === "returned" ? "default" : "secondary"}>{loan.status}</Badge>
                </div>
                {(loan.returns ?? []).map((event) => (
                  <p key={event.id} className="mt-1 text-xs text-muted-foreground">
                    {format(new Date(event.returnedAt), "MMM d, yyyy h:mm a")} · {event.quantity} returned · {formatCurrency(event.refundAmount)} refund{event.note ? ` · ${event.note}` : ""}
                  </p>
                ))}
              </div>
            ))}
            {!filteredLoans.some((l) => l.status === "returned" || (l.returns?.length ?? 0) > 0) && <p className="py-8 text-center text-muted-foreground">No return history</p>}
          </TabsContent>

          <TabsContent value="customers" className="space-y-2">
            {filteredCustomers.map((customer) => (
              <button key={customer.id} onClick={() => void openCustomer(customer)} className="flex w-full items-center justify-between rounded-lg border p-3 text-left hover:bg-accent">
                <span>
                  <span className="block font-medium">{customer.name}</span>
                  <span className="block text-xs text-muted-foreground">{[customer.nickname, customer.phone, customer.address].filter(Boolean).join(" · ") || "No contact details"}</span>
                </span>
                {customer.isSuki && <Badge><Star className="mr-1 h-3 w-3" />Suki</Badge>}
              </button>
            ))}
          </TabsContent>
          <TabsContent value="reliable" className="space-y-2">
            <p className="text-xs text-muted-foreground">Requires at least 3 completed return or write-off outcomes. Rankings use return rate, return speed, and recent frequency.</p>
            {reliable.map((customer, index) => evidenceCard(customer, index + 1))}
            {!reliable.length && <p className="py-8 text-center text-muted-foreground">No customers have 3 completed outcomes yet</p>}
          </TabsContent>
          <TabsContent value="suki" className="space-y-2">
            <p className="text-xs text-muted-foreground">Suki is assigned manually. Customers with no purchase for 90 days are marked inactive.</p>
            {suki.map((customer) => evidenceCard(customer))}
            {!suki.length && <p className="py-8 text-center text-muted-foreground">No Suki customers assigned</p>}
          </TabsContent>
          <TabsContent value="candidates" className="space-y-2">
            <p className="text-xs text-muted-foreground">Candidates use store-relative 1–3 Recency, Frequency, and Monetary bands (maximum score 9). Return evidence is shown separately. Assignment is never automatic.</p>
            {candidates.map((customer, index) => evidenceCard(customer, index + 1))}
          </TabsContent>
        </Tabs>
      )}

      <Dialog open={Boolean(returnLoan)} onOpenChange={(open) => !open && setReturnLoan(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Record canister return</DialogTitle></DialogHeader>
          {returnLoan && <div className="space-y-4">
            <p className="text-sm text-muted-foreground">{returnLoan.customer?.name ?? returnLoan.customerName ?? "Customer"} · {remaining(returnLoan)} remaining</p>
            <div className="space-y-2"><Label>Quantity</Label><Input type="number" min={1} max={remaining(returnLoan)} value={returnQty} onChange={(e) => changeReturnQuantity(e.target.value)} /></div>
            <div className="space-y-2"><Label>Deposit refund</Label><Input type="number" min={0} step="0.01" value={refund} onChange={(e) => setRefund(e.target.value)} disabled={!collectCylinderDeposits} /></div>
            <div className="space-y-2"><Label>Note (optional)</Label><Textarea value={returnNote} onChange={(e) => setReturnNote(e.target.value)} placeholder="Condition, partial return, or other note" /></div>
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button variant="outline" onClick={() => setReturnLoan(null)}>Cancel</Button>
              <Button onClick={() => void submitReturn()} disabled={returning || Number(returnQty) < 1 || Number(returnQty) > remaining(returnLoan)}>
                {returning ? "Saving…" : Number(returnQty) === remaining(returnLoan) ? "Complete return" : "Partial return"}
              </Button>
            </div>
          </div>}
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(selectedCustomer)} onOpenChange={(open) => !open && setSelectedCustomer(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader><DialogTitle>Customer profile</DialogTitle></DialogHeader>
          {selectedCustomer && <div className="space-y-4">
            <div>
              <div className="flex flex-wrap items-center gap-2"><h2 className="text-xl font-bold">{selectedCustomer.name}</h2>{selectedCustomer.isSuki && <Badge><Star className="mr-1 h-3 w-3" />Suki</Badge>}</div>
              <p className="text-sm text-muted-foreground">{[selectedCustomer.nickname, selectedCustomer.phone, selectedCustomer.address].filter(Boolean).join(" · ") || "No contact details"}</p>
              <Button className="mt-3" variant="outline" size="sm" onClick={() => void printCustomerQr(selectedCustomer)}>
                <QrCode className="mr-2 h-4 w-4" />Print customer QR
              </Button>
            </div>
            {evidenceCard(selectedCustomer)}
            <div>
              <h3 className="mb-2 font-semibold">Timeline</h3>
              <div className="space-y-2">
                {[...(selectedCustomer.sales ?? []).map((sale) => ({ at: sale.createdAt, label: `Purchase ${formatCurrency(sale.amountDue ?? sale.total)}`, icon: CheckCircle2 })),
                  ...(selectedCustomer.cylinderLoans ?? []).flatMap((loan) => [
                    { at: loan.outAt, label: `${loan.quantity} ${loan.product?.name ?? "canister"} out`, icon: Package },
                    ...(loan.returns ?? []).map((event) => ({ at: event.returnedAt, label: `${event.quantity} returned · ${formatCurrency(event.refundAmount)} refund`, icon: RotateCcw })),
                  ])]
                  .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
                  .map((item, index) => <div key={`${String(item.at)}-${index}`} className="flex gap-2 text-sm"><History className="mt-0.5 h-4 w-4 text-muted-foreground" /><span>{format(new Date(item.at), "MMM d, yyyy")} · {item.label}</span></div>)}
              </div>
            </div>
            {canAssignSuki && <div className="space-y-2 rounded-lg border p-3">
              <Label>Manual Suki note</Label>
              <Textarea value={sukiNote} onChange={(e) => setSukiNote(e.target.value)} placeholder="Why this customer is being assigned" />
              <Button variant={selectedCustomer.isSuki ? "destructive" : "default"} onClick={() => void toggleSuki()}>
                {selectedCustomer.isSuki ? "Remove Suki status" : "Assign Suki manually"}
              </Button>
            </div>}
          </div>}
        </DialogContent>
      </Dialog>
    </div>
  );
}
