import { CartItem } from "@/types/pos";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Minus, Plus, X, ShoppingCart } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";

interface CartProps {
  items: CartItem[];
  onUpdateQuantity: (itemId: string, quantity: number) => void;
  onRemoveItem: (itemId: string) => void;
  onCheckout: () => void;
  discountsEnabled?: boolean;
  discountPercent?: number;
  onDiscountChange?: (percent: number) => void;
  taxRatePercent?: number;
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
      <div className="p-4 border-b bg-card">
        <div className="flex items-center gap-2 pr-10">
          <ShoppingCart className="w-5 h-5 text-primary" />
          <h2 className="font-bold text-lg">Cart</h2>
          <span className="ml-auto bg-primary text-primary-foreground rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold">
            {items.length}
          </span>
        </div>
      </div>

      <div className="h-[500px] relative border-b">
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
                      onClick={() => onUpdateQuantity(item.id, item.quantity - 1)}
                    >
                      <Minus className="w-3 h-3" />
                    </Button>
                    <Input
                      type="number"
                      value={item.quantity}
                      onChange={(e) =>
                        onUpdateQuantity(item.id, parseInt(e.target.value) || 1)
                      }
                      className="w-16 h-8 text-center"
                      min="1"
                    />
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => onUpdateQuantity(item.id, item.quantity + 1)}
                    >
                      <Plus className="w-3 h-3" />
                    </Button>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground">
                      ${item.price.toFixed(2)} each
                    </p>
                    <p className="font-bold text-primary">${item.subtotal.toFixed(2)}</p>
                  </div>
                </div>
              </div>
            ))}
            </div>
          )}
        </ScrollArea>
      </div>

      <div className="p-4 pt-6 border-t bg-card space-y-3">
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Subtotal</span>
            <span className="font-semibold">${subtotal.toFixed(2)}</span>
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
                -${discountAmount.toFixed(2)}
              </span>
            </div>
          )}
          <div className="flex justify-between">
            <span className="text-muted-foreground">Tax ({taxRatePercent}%)</span>
            <span className="font-semibold">${tax.toFixed(2)}</span>
          </div>
          <Separator />
          <div className="flex justify-between text-lg">
            <span className="font-bold">Total</span>
            <span className="font-bold text-primary">${total.toFixed(2)}</span>
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
