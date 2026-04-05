import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DollarSign, Receipt, Smartphone } from "lucide-react";
import { formatCurrency } from "@/lib/currency";
import { centsToPhp, phpToCents } from "@/lib/phpMoney";

export type PaymentMethod = "cash" | "gcash";

export interface CheckoutResult {
  amountReceived: number;
  paymentMethod: PaymentMethod;
  gcashTransactionId?: string;
}

interface CheckoutModalProps {
  open: boolean;
  onClose: () => void;
  total: number;
  ticketNumber?: string;
  onComplete: (result: CheckoutResult) => void;
}

export const CheckoutModal = ({
  open,
  onClose,
  total,
  ticketNumber,
  onComplete,
}: CheckoutModalProps) => {
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("cash");
  const [amountReceived, setAmountReceived] = useState<string>("");
  const [gcashTransactionId, setGcashTransactionId] = useState<string>("");
  const amountReceivedCents = phpToCents(parseFloat(amountReceived || "0"));
  const totalCents = phpToCents(total);
  const changeCents = amountReceivedCents - totalCents;
  const changeDisplayPhp =
    changeCents >= 0 ? centsToPhp(changeCents) : centsToPhp(-changeCents);

  useEffect(() => {
    if (open) {
      setPaymentMethod("cash");
      setAmountReceived("");
      setGcashTransactionId("");
    }
  }, [open]);

  useEffect(() => {
    if (paymentMethod === "gcash") {
      setAmountReceived(total.toFixed(2));
    }
  }, [paymentMethod, total]);

  const handleComplete = () => {
    const amt = parseFloat(amountReceived || "0");
    if (paymentMethod === "gcash" && !gcashTransactionId.trim()) {
      return;
    }
    if (paymentMethod === "cash" && phpToCents(amt) < totalCents) {
      return;
    }
    if (paymentMethod === "gcash" && phpToCents(amt) < totalCents) {
      return;
    }
    const result: CheckoutResult = {
      amountReceived:
        paymentMethod === "gcash"
          ? centsToPhp(totalCents)
          : centsToPhp(phpToCents(amt)),
      paymentMethod,
      gcashTransactionId: paymentMethod === "gcash" ? gcashTransactionId.trim() : undefined,
    };
    onComplete(result);
    setAmountReceived("");
    setGcashTransactionId("");
    onClose();
  };

  const canComplete =
    paymentMethod === "cash"
      ? amountReceivedCents >= totalCents && !!amountReceived
      : paymentMethod === "gcash"
      ? amountReceivedCents >= totalCents && !!gcashTransactionId.trim()
      : false;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl flex items-center gap-2">
            <Receipt className="w-5 h-5" />
            Complete Payment
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-6 py-4">
          {ticketNumber && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Ticket Number</span>
              <span className="font-mono font-semibold">{ticketNumber}</span>
            </div>
          )}
          <div className="bg-primary/10 rounded-lg p-4 text-center">
            <p className="text-sm text-muted-foreground mb-1">Total Amount</p>
            <p className="text-3xl font-bold text-primary">{formatCurrency(total)}</p>
          </div>

          <div className="space-y-2">
            <Label>Payment Method</Label>
            <div className="grid grid-cols-2 gap-2">
              <Button
                type="button"
                variant={paymentMethod === "cash" ? "default" : "outline"}
                onClick={() => setPaymentMethod("cash")}
                className="h-12"
              >
                <DollarSign className="w-4 h-4 mr-2" />
                Cash
              </Button>
              <Button
                type="button"
                variant={paymentMethod === "gcash" ? "default" : "outline"}
                onClick={() => setPaymentMethod("gcash")}
                className="h-12"
              >
                <Smartphone className="w-4 h-4 mr-2" />
                GCash
              </Button>
            </div>
          </div>

          {paymentMethod === "gcash" && (
            <div className="space-y-2">
              <Label htmlFor="gcash-txn">GCash Transaction ID</Label>
              <Input
                id="gcash-txn"
                type="text"
                placeholder="Enter transaction ID"
                value={gcashTransactionId}
                onChange={(e) => setGcashTransactionId(e.target.value)}
                className="h-12"
              />
              <p className="text-xs text-muted-foreground">
                Required for GCash payments. Find it in the GCash app or SMS confirmation.
              </p>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="amount">Amount Received</Label>
            <div className="relative">
              <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
              <Input
                id="amount"
                type="number"
                step="0.01"
                placeholder="0.00"
                value={amountReceived}
                onChange={(e) => setAmountReceived(e.target.value)}
                className="pl-10 h-12 text-lg"
                autoFocus={paymentMethod === "cash"}
                readOnly={paymentMethod === "gcash"}
              />
            </div>
          </div>

          {amountReceived && (
            <div className="bg-success/10 rounded-lg p-4 text-center border border-success/20">
              <p className="text-sm text-muted-foreground mb-1">Change</p>
              <p className={`text-2xl font-bold ${changeCents >= 0 ? "text-success" : "text-destructive"}`}>
                {formatCurrency(changeDisplayPhp)}
              </p>
              {changeCents < 0 && paymentMethod === "cash" && (
                <p className="text-xs text-destructive mt-1">Insufficient amount</p>
              )}
            </div>
          )}

          {paymentMethod === "cash" && (
            <div className="grid grid-cols-3 gap-2">
              {[5, 10, 20, 50, 100].map((amount) => (
                <Button
                  key={amount}
                  variant="outline"
                  onClick={() => setAmountReceived(amount.toString())}
                  className="h-12"
                >
                  {formatCurrency(amount)}
                </Button>
              ))}
              <Button
                variant="outline"
                onClick={() => setAmountReceived(total.toString())}
                className="h-12"
              >
                Exact
              </Button>
            </div>
          )}
        </div>

        <Button
          className="w-full h-12 text-base font-bold"
          disabled={!canComplete}
          onClick={handleComplete}
        >
          Complete Sale
        </Button>
      </DialogContent>
    </Dialog>
  );
};
