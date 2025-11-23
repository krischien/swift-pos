import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DollarSign, Receipt } from "lucide-react";

interface CheckoutModalProps {
  open: boolean;
  onClose: () => void;
  total: number;
  ticketNumber?: string;
  onComplete: (amountReceived: number) => void;
}

export const CheckoutModal = ({
  open,
  onClose,
  total,
  ticketNumber,
  onComplete,
}: CheckoutModalProps) => {
  const [amountReceived, setAmountReceived] = useState<string>("");
  const change = parseFloat(amountReceived || "0") - total;

  const handleComplete = () => {
    if (change >= 0) {
      onComplete(parseFloat(amountReceived));
      setAmountReceived("");
      onClose();
    }
  };

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
            <p className="text-3xl font-bold text-primary">${total.toFixed(2)}</p>
          </div>

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
                autoFocus
              />
            </div>
          </div>

          {amountReceived && (
            <div className="bg-success/10 rounded-lg p-4 text-center border border-success/20">
              <p className="text-sm text-muted-foreground mb-1">Change</p>
              <p className={`text-2xl font-bold ${change >= 0 ? 'text-success' : 'text-destructive'}`}>
                ${Math.abs(change).toFixed(2)}
              </p>
              {change < 0 && (
                <p className="text-xs text-destructive mt-1">Insufficient amount</p>
              )}
            </div>
          )}

          <div className="grid grid-cols-3 gap-2">
            {[5, 10, 20, 50, 100].map((amount) => (
              <Button
                key={amount}
                variant="outline"
                onClick={() => setAmountReceived(amount.toString())}
                className="h-12"
              >
                ${amount}
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
        </div>

        <Button
          className="w-full h-12 text-base font-bold"
          disabled={change < 0 || !amountReceived}
          onClick={handleComplete}
        >
          Complete Sale
        </Button>
      </DialogContent>
    </Dialog>
  );
};
