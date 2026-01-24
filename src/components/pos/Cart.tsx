import { CartItem } from "@/types/pos";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Minus, Plus, X, ShoppingCart } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { formatCurrency } from "@/lib/currency";

interface CartProps {
  items: CartItem[];
  onUpdateQuantity: (itemId: string, quantity: number) => void;
  onRemoveItem: (itemId: string) => void;
  onCheckout: () => void;
  discountsEnabled?: boolean;
  discountPercent?: number;
  onDiscountChange?: (percent: number) => void;
  taxRatePercent?: number;
  enablePerKiloPurchase?: boolean;
}

export const Cart = ({
  items,
  onUpdateQuantity,
  onRemoveItem,
  onCheckout,
  discountsEnabled,
  discountPercent = 0,
  onDiscountChange,
  taxRatePercent = 12,
  enablePerKiloPurchase = false,
}: CartProps) => {
  const subtotal = items.reduce((sum, item) => sum + item.subtotal, 0);
  const effectiveDiscount = discountsEnabled ? discountPercent : 0;
  const discountAmount = subtotal * (effectiveDiscount / 100);
  const netSubtotal = Math.max(0, subtotal - discountAmount);
  const taxRate = taxRatePercent / 100;
  const tax = netSubtotal * taxRate;
  const total = netSubtotal + tax;

  return (
    <div className="flex flex-col h-full bg-pos-cart border-l shadow-sm md:rounded-none overflow-hidden">
      <div className="p-4 border-b bg-card flex-shrink-0">
        <div className="flex items-center gap-2 pr-10">
          <ShoppingCart className="w-5 h-5 text-primary" />
          <h2 className="font-bold text-lg">Cart</h2>
          <span className="ml-auto bg-primary text-primary-foreground rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold">
            {items.length}
          </span>
        </div>
      </div>

      <div className="h-[400px] relative border-b overflow-hidden">
        <ScrollArea className="h-full p-4">
          {items.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
              <ShoppingCart className="w-16 h-16 mb-4 opacity-20" />
              <p>Cart is empty</p>
            </div>
          ) : (
            <div className="space-y-3">
            {items.map((item) => (
              <div key={item.id} className="bg-card rounded-lg p-3 border">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1">
                    <h3 className="font-semibold text-sm">{item.name}</h3>
                    {item.variantName && (
                      <p className="text-xs text-muted-foreground">{item.variantName}</p>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 -mt-1 -mr-1"
                    onClick={() => onRemoveItem(item.id)}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => {
                        const step = enablePerKiloPurchase ? 0.1 : 1;
                        const minQty = enablePerKiloPurchase ? 0.1 : 1;
                        const newQuantity = Math.max(minQty, item.quantity - step);
                        onUpdateQuantity(item.id, enablePerKiloPurchase ? newQuantity : Math.floor(newQuantity));
                      }}
                    >
                      <Minus className="w-3 h-3" />
                    </Button>
                    <Input
                      type="number"
                      value={item.quantity}
                      onChange={(e) => {
                        const value = enablePerKiloPurchase 
                          ? parseFloat(e.target.value) || 0.1
                          : parseInt(e.target.value) || 1;
                        onUpdateQuantity(item.id, Math.max(enablePerKiloPurchase ? 0.1 : 1, value));
                      }}
                      className="w-16 h-8 text-center"
                      min={enablePerKiloPurchase ? "0.1" : "1"}
                      step={enablePerKiloPurchase ? "0.1" : "1"}
                    />
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => {
                        const step = enablePerKiloPurchase ? 0.1 : 1;
                        onUpdateQuantity(item.id, item.quantity + step);
                      }}
                    >
                      <Plus className="w-3 h-3" />
                    </Button>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground">
                      {formatCurrency(item.price)} each
                    </p>
                    <p className="font-bold text-primary">{formatCurrency(item.subtotal)}</p>
                  </div>
                </div>
              </div>
            ))}
            </div>
          )}
        </ScrollArea>
      </div>

      <div className="p-4 pt-6 border-t bg-card space-y-3 flex-shrink-0">
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Subtotal</span>
            <span className="font-semibold">{formatCurrency(subtotal)}</span>
          </div>
          {discountsEnabled && (
            <div className="flex items-center justify-between gap-2">
              <span className="text-muted-foreground flex-1">Discount (%)</span>
              <div className="flex items-center gap-1">
                <Input
                  type="number"
                  min={0}
                  max={100}
                  value={discountPercent}
                  onChange={(e) => {
                    const val = Number(e.target.value);
                    if (Number.isNaN(val)) {
                      onDiscountChange?.(0);
                    } else {
                      const clamped = Math.max(0, Math.min(100, val));
                      onDiscountChange?.(clamped);
                    }
                  }}
                  className="w-16 h-8 text-right text-xs"
                />
                <span className="text-xs text-muted-foreground mr-1">%</span>
              </div>
            </div>
          )}
          {discountsEnabled && discountAmount > 0 && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Discount</span>
              <span className="font-semibold text-destructive">
                -{formatCurrency(discountAmount)}
              </span>
            </div>
          )}
          <div className="flex justify-between">
            <span className="text-muted-foreground">Tax ({taxRatePercent}%)</span>
            <span className="font-semibold">{formatCurrency(tax)}</span>
          </div>
          <Separator />
          <div className="flex justify-between text-lg">
            <span className="font-bold">Total</span>
            <span className="font-bold text-primary">{formatCurrency(total)}</span>
          </div>
        </div>
        <Button
          className="w-full h-12 text-base font-bold"
          disabled={items.length === 0}
          onClick={onCheckout}
        >
          Checkout
        </Button>
      </div>
    </div>
  );
};
