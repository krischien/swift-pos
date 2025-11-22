import { useState } from "react";
import { Input } from "@/components/ui/input";
import { CategoryTabs } from "@/components/pos/CategoryTabs";
import { ProductCard } from "@/components/pos/ProductCard";
import { Cart } from "@/components/pos/Cart";
import { VariantModal } from "@/components/pos/VariantModal";
import { CheckoutModal } from "@/components/pos/CheckoutModal";
import { mockCategories, mockProducts } from "@/lib/mockData";
import { CartItem, Product, Variant } from "@/types/pos";
import { useAuth } from "@/contexts/AuthContext";
import { Search, Calendar } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const POS = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [showVariantModal, setShowVariantModal] = useState(false);
  const [showCheckoutModal, setShowCheckoutModal] = useState(false);

  const filteredProducts = mockProducts.filter((product) => {
    const matchesCategory = !selectedCategory || product.categoryId === selectedCategory;
    const matchesSearch = product.name.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch && product.status === "active";
  });

  const handleProductSelect = (product: Product) => {
    if (product.hasVariants) {
      setSelectedProduct(product);
      setShowVariantModal(true);
    } else {
      addToCart(product);
    }
  };

  const handleVariantSelect = (variant: Variant) => {
    if (selectedProduct) {
      addToCart(selectedProduct, variant);
    }
  };

  const addToCart = (product: Product, variant?: Variant) => {
    const price = variant?.price || product.price || 0;
    const existingItemId = variant
      ? `${product.id}-${variant.id}`
      : product.id;
    
    const existingItem = cart.find((item) => item.id === existingItemId);

    if (existingItem) {
      setCart(
        cart.map((item) =>
          item.id === existingItemId
            ? {
                ...item,
                quantity: item.quantity + 1,
                subtotal: (item.quantity + 1) * item.price,
              }
            : item
        )
      );
    } else {
      const newItem: CartItem = {
        id: existingItemId,
        productId: product.id,
        variantId: variant?.id,
        name: product.name,
        variantName: variant?.name,
        price,
        quantity: 1,
        subtotal: price,
      };
      setCart([...cart, newItem]);
    }
  };

  const handleUpdateQuantity = (itemId: string, quantity: number) => {
    if (quantity < 1) {
      handleRemoveItem(itemId);
      return;
    }
    setCart(
      cart.map((item) =>
        item.id === itemId
          ? { ...item, quantity, subtotal: quantity * item.price }
          : item
      )
    );
  };

  const handleRemoveItem = (itemId: string) => {
    setCart(cart.filter((item) => item.id !== itemId));
  };

  const handleCheckout = () => {
    setShowCheckoutModal(true);
  };

  const handleCompleteCheckout = (amountReceived: number) => {
    const total = cart.reduce((sum, item) => sum + item.subtotal, 0) * 1.1; // Including tax
    const change = amountReceived - total;
    
    toast({
      title: "Sale completed",
      description: `Total: $${total.toFixed(2)} | Change: $${change.toFixed(2)}`,
    });
    
    setCart([]);
  };

  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <div className="h-screen flex flex-col">
      {/* Header */}
      <header className="bg-card border-b p-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold">Point of Sale</h1>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Calendar className="w-4 h-4" />
              <span>{today}</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <p className="text-sm text-muted-foreground">Cashier</p>
            <p className="font-semibold">{user?.name}</p>
          </div>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        {/* Products Section */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="p-4 space-y-4 border-b bg-background">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
              <Input
                placeholder="Search products..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 h-12 text-base"
              />
            </div>
            <CategoryTabs
              categories={mockCategories}
              selectedCategory={selectedCategory}
              onSelectCategory={setSelectedCategory}
            />
          </div>

          <div className="flex-1 overflow-auto p-4">
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
              {filteredProducts.map((product) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  onSelect={handleProductSelect}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Cart Section */}
        <div className="w-full sm:w-96 lg:w-[420px]">
          <Cart
            items={cart}
            onUpdateQuantity={handleUpdateQuantity}
            onRemoveItem={handleRemoveItem}
            onCheckout={handleCheckout}
          />
        </div>
      </div>

      {/* Modals */}
      <VariantModal
        product={selectedProduct}
        open={showVariantModal}
        onClose={() => {
          setShowVariantModal(false);
          setSelectedProduct(null);
        }}
        onSelect={handleVariantSelect}
      />

      <CheckoutModal
        open={showCheckoutModal}
        onClose={() => setShowCheckoutModal(false)}
        total={cart.reduce((sum, item) => sum + item.subtotal, 0) * 1.1}
        onComplete={handleCompleteCheckout}
      />
    </div>
  );
};

export default POS;
