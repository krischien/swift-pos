import { Product } from "@/types/pos";
import { Button } from "@/components/ui/button";
import { Package } from "lucide-react";

interface ProductCardProps {
  product: Product;
  onSelect: (product: Product) => void;
}

export const ProductCard = ({ product, onSelect }: ProductCardProps) => {
  const displayPrice = product.hasVariants
    ? product.variants?.[0]?.price
    : product.price;

  return (
    <Button
      variant="outline"
      className="h-auto flex-col p-4 bg-pos-product hover:bg-accent hover:border-primary transition-all"
      onClick={() => onSelect(product)}
    >
      <div className="w-full aspect-square bg-muted rounded-lg mb-3 flex items-center justify-center">
        <Package className="w-10 h-10 text-muted-foreground" />
      </div>
      <h3 className="font-semibold text-sm mb-1 line-clamp-2 w-full text-center">
        {product.name}
      </h3>
      <p className="text-primary font-bold text-lg">
        ${displayPrice?.toFixed(2)}
        {product.hasVariants && "+"}
      </p>
      {product.hasVariants && (
        <p className="text-xs text-muted-foreground mt-1">
          {product.variants?.length} variants
        </p>
      )}
    </Button>
  );
};
