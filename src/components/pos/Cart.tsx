import { CartItem } from "@/types/pos";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Minus, Plus, X, ShoppingCart } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { formatCurrency } from "@/lib/currency";
import { cn } from "@/lib/utils";

interface CartProps {
  items: CartItem[];
  onUpdateQuantity: (itemId: string, quantity: number) => void;
  onRemoveItem: (itemId: string) => void;
  onCheckout: () => void;
  discountsEnabled?: boolean;
  discountPercent?: number;
  onDiscountChange?: (percent: number) => void;
  taxRatePercent?: number;
  enableTax?: boolean;
  enablePerKiloPurchase?: boolean;
  /** Fills parent column: scroll area grows between header and totals (desktop sidebar). */
  variant?: "sheet" | "sidebar";
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
  enableTax = true,
  enablePerKiloPurchase = false,
  variant = "sheet",
}: CartProps) => {
  const isSidebar = variant === "sidebar";
  const subtotal = items.reduce((sum, item) => sum + item.subtotal, 0);
  const effectiveDiscount = discountsEnabled ? discountPercent : 0;
  const discountAmount = subtotal * (effectiveDiscount / 100);
  const netSubtotal = Math.max(0, subtotal - discountAmount);
  const taxRate = enableTax ? taxRatePercent / 100 : 0;
  const tax = netSubtotal * taxRate;
  const total = netSubtotal + tax;

  const itemNodes = (
    <div className="space-y-3">
      {items.map((item) => (
        <div key={item.id} className="rounded-lg border bg-card p-3">
          <div className="mb-2 flex items-start justify-between">
            <div className="flex-1">
              <h3 className="text-sm font-semibold">{item.name}</h3>
              {item.variantName && <p className="text-xs text-muted-foreground">{item.variantName}</p>}
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="-mr-1 -mt-1 h-6 w-6"
              onClick={() => onRemoveItem(item.id)}
            >
              <X className="h-4 w-4" />
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
                <Minus className="h-3 w-3" />
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
                className="h-8 w-16 text-center"
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
                <Plus className="h-3 w-3" />
              </Button>
            </div>
            <div className="text-right">
              <p className="text-xs text-muted-foreground">{formatCurrency(item.price)} each</p>
              <p className="font-bold text-primary">{formatCurrency(item.subtotal)}</p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );

  const emptyState = (
    <div className="flex flex-col items-center justify-center gap-2 text-muted-foreground">
      <ShoppingCart className="h-16 w-16 shrink-0 opacity-20" />
      <p>Cart is empty</p>
    </div>
  );

  return (
    <div
      className={
        isSidebar
          ? "flex h-full min-h-0 w-full flex-1 flex-col bg-pos-cart overflow-hidden"
          : "flex h-full min-h-0 flex-col bg-pos-cart overflow-hidden border-l shadow-sm md:rounded-none"
      }
    >
      <div className="p-4 border-b border-border bg-background flex-shrink-0">
        <div className="flex items-center gap-2">
          <ShoppingCart className="w-6 h-6 text-primary shrink-0" />
          <h2 className="font-bold text-lg tracking-tight">Cart</h2>
          <span className="ml-auto bg-primary text-primary-foreground rounded-full min-w-[1.5rem] h-6 px-1.5 flex items-center justify-center text-sm font-bold">
            {items.length}
          </span>
        </div>
      </div>

      <div
        className={
          isSidebar
            ? "flex min-h-0 flex-1 flex-col overflow-hidden border-b border-border"
            : "relative h-[min(400px,50vh)] min-h-[240px] overflow-hidden border-b"
        }
      >
        {isSidebar ? (
          <div className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain p-4">
            {items.length === 0 ? (
              <div className="flex min-h-0 flex-1 flex-col items-center justify-center">{emptyState}</div>
            ) : (
              itemNodes
            )}
          </div>
        ) : (
          <ScrollArea className="h-full p-4">
            {items.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center">{emptyState}</div>
            ) : (
              itemNodes
            )}
          </ScrollArea>
        )}
      </div>

      <div
        className={cn(
          "p-4 pt-5 border-t border-border space-y-3 flex-shrink-0",
          isSidebar ? "bg-background" : "bg-card",
        )}
      >
        <div className="space-y-2.5 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Subtotal</span>
            <span className="font-semibold tabular-nums">{formatCurrency(subtotal)}</span>
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
          {enableTax && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Tax ({taxRatePercent}%)</span>
              <span className="font-semibold tabular-nums">{formatCurrency(tax)}</span>
            </div>
          )}
          <Separator className="my-1" />
          <div className="flex justify-between text-lg pt-0.5">
            <span className="font-bold">Total</span>
            <span className="font-bold text-primary tabular-nums">{formatCurrency(total)}</span>
          </div>
        </div>
        <Button
          className="w-full h-12 text-base font-bold shadow-sm"
          disabled={items.length === 0}
          onClick={onCheckout}
          data-testid="pos-checkout"
        >
          Checkout
        </Button>
      </div>
    </div>
  );
};
