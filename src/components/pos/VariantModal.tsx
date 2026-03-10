import { Product, Variant } from "@/types/pos";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { formatCurrency } from "@/lib/currency";

interface VariantModalProps {
  product: Product | null;
  open: boolean;
  onClose: () => void;
  onSelect: (variant: Variant) => void;
}

export const VariantModal = ({ product, open, onClose, onSelect }: VariantModalProps) => {
  const [selectedVariant, setSelectedVariant] = useState<Variant | null>(null);

  if (!product) return null;

  const handleSelect = () => {
    if (selectedVariant) {
      onSelect(selectedVariant);
      onClose();
      setSelectedVariant(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl">Select {product.name}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-4">
          {product.variants?.map((variant) => {
            // Calculate selling price: variant.price is base price, apply margin percentage
            const basePrice = variant.price;
            const marginPercent = product.marginPercentage || 0;
            const sellingPrice = basePrice * (1 + marginPercent / 100);
            const isOutOfStock = (variant.stock ?? 0) <= 0;
            
            return (
              <Button
                key={variant.id}
                variant={selectedVariant?.id === variant.id ? "default" : "outline"}
                disabled={isOutOfStock}
                className="w-full h-auto flex justify-between items-center p-4"
                onClick={() => !isOutOfStock && setSelectedVariant(variant)}
              >
                <div className="text-left">
                  <p className="font-semibold">{variant.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {isOutOfStock ? "Out of Stock" : `Stock: ${variant.stock}`}
                  </p>
                </div>
                <p className={cn("font-bold text-lg", isOutOfStock && "opacity-60")}>
                  {formatCurrency(sellingPrice)}
                </p>
              </Button>
            );
          })}
        </div>
        <Button
          className="w-full h-12 font-bold"
          disabled={!selectedVariant}
          onClick={handleSelect}
        >
          Add to Cart
        </Button>
      </DialogContent>
    </Dialog>
  );
};
