import { Product } from "@/types/pos";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Package } from "lucide-react";
import { formatCurrency } from "@/lib/currency";
import { cn } from "@/lib/utils";

interface ProductCardProps {
  product: Product;
  onSelect: (product: Product) => void;
  isOutOfStock?: boolean;
}

export const ProductCard = ({ product, onSelect, isOutOfStock }: ProductCardProps) => {
  let displayPrice: number | undefined;
  
  if (product.hasVariants) {
    // For variants: variant.price is base price, calculate selling price with margin percentage
    const variant = product.variants?.[0];
    if (variant) {
      const basePrice = variant.price;
      const marginPercent = product.marginPercentage || 0;
      displayPrice = basePrice * (1 + marginPercent / 100);
    }
  } else {
    // For regular products: use product.price (which is already calculated with margin)
    displayPrice = product.price;
  }

  return (
    <Button
      variant="outline"
      disabled={isOutOfStock}
      data-testid="product-card"
      data-product-name={product.name}
      className={cn(
        "h-auto flex-col p-4 bg-pos-product hover:bg-accent hover:border-primary transition-all relative",
        isOutOfStock && "opacity-70 cursor-not-allowed"
      )}
      onClick={() => onSelect(product)}
    >
      <div className="w-full aspect-square bg-muted rounded-lg mb-3 flex items-center justify-center overflow-hidden">
        {product.image ? (
          <img
            src={product.image}
            alt={product.name}
            className="w-full h-full object-cover"
          />
        ) : (
          <Package className="w-10 h-10 text-muted-foreground" />
        )}
      </div>
      <h3 className="font-semibold text-sm mb-1 line-clamp-2 w-full text-center">
        {product.name}
      </h3>
      <p className="text-primary font-bold text-lg">
        {displayPrice ? formatCurrency(displayPrice) : "₱0.00"}
        {product.hasVariants && "+"}
      </p>
      <p className="text-xs text-muted-foreground mt-1 h-4">
        {product.hasVariants ? `${product.variants?.length} variants` : "\u00a0"}
      </p>
      {isOutOfStock && (
        <Badge className="absolute inset-0 m-auto w-fit h-fit bg-slate-500 text-white border-slate-500 pointer-events-none">
          Out of Stock
        </Badge>
      )}
    </Button>
  );
};
