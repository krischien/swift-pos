import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { CategoryTabs } from "@/components/pos/CategoryTabs";
import { ProductCard } from "@/components/pos/ProductCard";
import { Cart } from "@/components/pos/Cart";
import { VariantModal } from "@/components/pos/VariantModal";
import { CheckoutModal } from "@/components/pos/CheckoutModal";
import { CartItem, Product, Variant, Category } from "@/types/pos";
import { useAuth } from "@/contexts/AuthContext";
import { Search, Calendar, ShoppingCart } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { api } from "@/lib/api";
import { useEffect } from "react";
import { useSettings } from "@/contexts/SettingsContext";
import { Capacitor } from "@capacitor/core";
import { printerService } from "@/lib/printer";
import { formatCurrency } from "@/lib/currency";

const POS = () => {
  const { user } = useAuth();
  const {
    storeName,
    storeAddress,
    autoPrintReceipt,
    showLogoOnReceipt,
    enableDiscounts,
    taxRatePercent,
    selectedPrinter,
  } = useSettings();
  const { toast } = useToast();
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [showVariantModal, setShowVariantModal] = useState(false);
  const [showCheckoutModal, setShowCheckoutModal] = useState(false);
  const [showCartSheet, setShowCartSheet] = useState(false);
  const [ticketNumber, setTicketNumber] = useState<string | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [discountPercent, setDiscountPercent] = useState(0);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        setError(null);
        const [cats, prods] = await Promise.all([
          api.getCategories(),
          api.getProducts(),
        ]);
        setCategories(cats as Category[]);
        setProducts(prods as Product[]);
      } catch (e: any) {
        setError(e.message ?? "Failed to load products");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const filteredProducts = products.filter((product) => {
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
    // Calculate selling price
    let price: number;
    if (variant) {
      // For variants: variant.price is base price, calculate selling price with margin percentage
      const basePrice = variant.price;
      const marginPercent = product.marginPercentage || 0;
      price = basePrice * (1 + marginPercent / 100);
    } else {
      // For regular products: use product.price (which is already calculated with margin)
      price = product.price || 0;
    }

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
    const code = `T-${Date.now().toString(36).toUpperCase()}-${Math.floor(
      Math.random() * 999,
    )
      .toString()
      .padStart(3, "0")}`;
    setTicketNumber(code);
    setShowCheckoutModal(true);
  };

  type ReceiptFallbackTotals = {
    total: number;
    amountReceived: number;
    change: number;
    subtotal?: number;
    tax?: number;
    discount?: number;
  };

  const getReceiptItems = (sale: any, fallbackItems: CartItem[]) => {
    if (Array.isArray(sale?.items) && sale.items.length) {
      return sale.items.map((item: any) => ({
            name: item.productName,
            variant: item.variantName,
            quantity: item.quantity,
            price: item.price,
            subtotal: item.subtotal,
      }));
    }
    return fallbackItems.map((item) => ({
            name: item.name,
            variant: item.variantName,
            quantity: item.quantity,
            price: item.price,
            subtotal: item.subtotal,
          }));
  };

  const buildReceiptHtml = (
    sale: any,
    fallbackItems: CartItem[],
    fallbackTotals: ReceiptFallbackTotals,
  ) => {
    const receiptItems = getReceiptItems(sale, fallbackItems);

    const itemsRows = receiptItems
      .map(
        (item) => `
        <tr>
          <td>${item.name}${item.variant ? ` (${item.variant})` : ""}</td>
          <td style="text-align:right;">${item.quantity}</td>
          <td style="text-align:right;">${formatCurrency(item.price ?? 0)}</td>
          <td style="text-align:right;">${formatCurrency(item.subtotal ?? 0)}</td>
        </tr>`,
      )
      .join("") || `<tr><td colspan="4" style="text-align:center;padding:8px 0;">No items</td></tr>`;

    const headerName = storeName || "Quick Brew Receipt";
    const headerAddress = storeAddress || "";
    const createdAt = new Date(sale?.createdAt ?? Date.now());
    const totalDisplay = typeof sale?.total === "number" ? sale.total : fallbackTotals.total;
    const amountReceivedDisplay =
      typeof sale?.amountReceived === "number" ? sale.amountReceived : fallbackTotals.amountReceived;
    const changeDisplay = typeof sale?.change === "number" ? sale.change : fallbackTotals.change;

    return `<!doctype html>
    <html>
      <head>
        <meta charset="utf-8" />
        <title>Receipt</title>
        <style>
          body { font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; margin: 16px; color: #111827; }
          h1 { font-size: 18px; margin: 0 0 8px; text-align: center; }
          .meta { font-size: 12px; margin-bottom: 12px; text-align: center; }
          table { width: 100%; border-collapse: collapse; font-size: 12px; }
          th, td { padding: 4px 0; }
          th { border-bottom: 1px solid #ddd; text-align: left; }
          tfoot td { border-top: 1px solid #ddd; font-weight: bold; }
        </style>
      </head>
      <body>
        ${
          showLogoOnReceipt
            ? `<div style="text-align:center;margin-bottom:4px;font-weight:bold;">${headerName}</div>`
            : ""
        }
        <h1>${headerName}</h1>
        <div class="meta">
          ${headerAddress ? `<div>${headerAddress}</div>` : ""}
          <div>Ticket: <strong>${sale?.ticketNumber ?? ticketNumber ?? ""}</strong></div>
          <div>Date: ${createdAt.toLocaleString()}</div>
          <div>Cashier: ${sale?.cashierName ?? user?.name ?? ""}</div>
        </div>
        <table>
          <thead>
            <tr>
              <th>Item</th>
              <th style="text-align:right;">Qty</th>
              <th style="text-align:right;">Price</th>
              <th style="text-align:right;">Subtotal</th>
            </tr>
          </thead>
          <tbody>
            ${itemsRows}
          </tbody>
          <tfoot>
            <tr>
              <td colspan="3">Total</td>
              <td style="text-align:right;">${formatCurrency(totalDisplay ?? 0)}</td>
            </tr>
            <tr>
              <td colspan="3">Amount Received</td>
              <td style="text-align:right;">${formatCurrency(amountReceivedDisplay ?? 0)}</td>
            </tr>
            <tr>
              <td colspan="3">Change</td>
              <td style="text-align:right;">${formatCurrency(changeDisplay ?? 0)}</td>
            </tr>
          </tfoot>
        </table>
        <div style="text-align:center;font-size:12px;margin-top:12px;">This is not an Official Receipt</div>
      </body>
    </html>`;
  };

  const printReceipt = async (
    sale: any,
    fallbackItems: CartItem[],
    fallbackTotals: ReceiptFallbackTotals,
  ) => {
    const receiptItems = getReceiptItems(sale, fallbackItems);
    const totalDisplay = typeof sale?.total === "number" ? sale.total : fallbackTotals.total;
    const amountReceivedDisplay =
      typeof sale?.amountReceived === "number" ? sale.amountReceived : fallbackTotals.amountReceived;
    const changeDisplay =
      typeof sale?.change === "number" ? sale.change : fallbackTotals.change;

    if (Capacitor.isNativePlatform() && selectedPrinter) {
      try {
        await printerService.print(selectedPrinter.address, {
          storeName,
          storeAddress,
          cashierName: sale?.cashierName ?? user?.name ?? "",
          ticketNumber: sale?.ticketNumber ?? ticketNumber ?? "",
          createdAt: sale?.createdAt ?? new Date().toISOString(),
          items: receiptItems.map((item) => ({
            name: item.name,
            variantName: item.variant,
            quantity: item.quantity,
            price: item.price,
            subtotal: item.subtotal,
          })),
          totals: {
            total: Number(totalDisplay ?? 0),
            amountReceived: Number(amountReceivedDisplay ?? 0),
            change: Number(changeDisplay ?? 0),
            subtotal: fallbackTotals.subtotal,
            tax: fallbackTotals.tax,
            discount: fallbackTotals.discount,
          },
        });
        return;
      } catch (error) {
        console.error("Bluetooth printing failed, falling back to browser print.", error);
        toast({
          title: "Native printing failed",
          description: (error as Error)?.message ?? "Falling back to browser print.",
        });
      }
    }

    // Remove existing print frame if any
    const existingFrame = document.getElementById("receipt-print-frame");
    if (existingFrame) {
      document.body.removeChild(existingFrame);
    }

    const iframe = document.createElement("iframe");
    iframe.id = "receipt-print-frame";
    iframe.style.display = "none";
    document.body.appendChild(iframe);

    const receiptHtml = buildReceiptHtml(sale, fallbackItems, fallbackTotals);
    const doc = iframe.contentWindow?.document;

    if (doc) {
      doc.open();
      doc.write(receiptHtml);
      doc.close();

      // Wait for content to load then print
      if (iframe.contentWindow) {
        iframe.contentWindow.onload = () => {
          try {
            iframe.contentWindow?.print();
          } catch (e) {
            console.error("Print failed", e);
          }
        };
      }
    }
  };

  const handleCompleteCheckout = async (amountReceived: number) => {
    const cartSnapshot = cart.map((item) => ({ ...item }));
    const subtotal = cart.reduce((sum, item) => sum + item.subtotal, 0);
    const taxRate = (typeof taxRatePercent === "number" ? taxRatePercent : 12) / 100;
    const effectiveDiscount = enableDiscounts ? discountPercent : 0;
    const discountAmount = subtotal * (effectiveDiscount / 100);
    const netSubtotal = Math.max(0, subtotal - discountAmount);
    const taxAmount = netSubtotal * taxRate;
    const total = netSubtotal + taxAmount;
    const change = amountReceived - total;

    try {
      if (!user) {
        throw new Error("No logged-in user");
      }

      const sale = await api.createSale({
        cartItems: cart,
        cashierId: user.id,
        cashierName: user.name,
        paymentMethod: "cash",
        amountReceived,
        taxRate,
        discountPercent: effectiveDiscount,
        ticketNumber: ticketNumber ?? undefined,
      });

      toast({
        title: "Sale completed",
        description: `Total: ${formatCurrency(total)} | Change: ${formatCurrency(change)}`,
      });

      if (autoPrintReceipt) {
        try {
          await printReceipt(sale, cartSnapshot, {
            total,
            amountReceived,
            change,
            subtotal: netSubtotal,
            tax: taxAmount,
            discount: discountAmount,
          });
          // Auto-close checkout modal on mobile after successful print
          if (Capacitor.isNativePlatform()) {
            setShowCheckoutModal(false);
          }
        } catch (err: any) {
          console.error("Receipt print failed:", err);
          toast({
            title: "Receipt not printed",
            description: err.message ?? "Printing failed",
          });
        }
      }

      setCart([]);
      setTicketNumber(null);
      
      // Auto-close checkout modal on mobile after sale completes (even if printing is disabled)
      if (Capacitor.isNativePlatform() && !autoPrintReceipt) {
        setShowCheckoutModal(false);
      }
    } catch (e: any) {
      toast({
        variant: "destructive",
        title: "Failed to record sale",
        description: e.message ?? "Please try again",
      });
    }
  };

  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header - desktop/tablet only */}
      <header className="bg-card border-b p-4 items-center justify-between hidden md:flex">
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

      <div className="flex-1 flex flex-col md:flex-row md:overflow-hidden md:h-[calc(100vh-96px)] md:max-h-[calc(100vh-96px)]">
        {/* Products Section */}
        <div className="flex-1 flex flex-col md:overflow-hidden">
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
              categories={categories}
              selectedCategory={selectedCategory}
              onSelectCategory={setSelectedCategory}
            />
          </div>

          <div className="flex-1 overflow-auto p-4">
            {loading && <p className="text-sm text-muted-foreground">Loading products...</p>}
            {error && !loading && (
              <p className="text-sm text-destructive">Failed to load: {error}</p>
            )}
            {!loading && !error && (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                {filteredProducts.map((product) => (
                  <ProductCard
                    key={product.id}
                    product={product}
                    onSelect={handleProductSelect}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Cart Section - desktop/tablet */}
        <div className="hidden md:flex md:flex-col md:w-96 lg:w-[420px] md:h-full">
          <Cart
            items={cart}
            onUpdateQuantity={handleUpdateQuantity}
            onRemoveItem={handleRemoveItem}
            onCheckout={handleCheckout}
            discountsEnabled={enableDiscounts}
            discountPercent={discountPercent}
            onDiscountChange={setDiscountPercent}
            taxRatePercent={taxRatePercent}
          />
        </div>
      </div>

      {/* Floating Cart Button & Sheet - mobile */}
      <Sheet open={showCartSheet} onOpenChange={setShowCartSheet}>
        <Button
          className="md:hidden fixed bottom-20 right-4 z-40 rounded-full w-14 h-14 shadow-lg bg-primary text-primary-foreground flex items-center justify-center"
          onClick={() => setShowCartSheet(true)}
        >
          <div className="relative flex items-center justify-center w-full h-full">
            <ShoppingCart className="w-6 h-6" />
            {cart.length > 0 && (
              <span className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
                {cart.length}
              </span>
            )}
          </div>
        </Button>
        <SheetContent side="bottom" className="md:hidden h-[75vh] p-0">
          <Cart
            items={cart}
            onUpdateQuantity={handleUpdateQuantity}
            onRemoveItem={handleRemoveItem}
            onCheckout={handleCheckout}
            discountsEnabled={enableDiscounts}
            discountPercent={discountPercent}
            onDiscountChange={setDiscountPercent}
            taxRatePercent={taxRatePercent}
          />
        </SheetContent>
      </Sheet>

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
        total={
          (() => {
            const subtotal = cart.reduce((sum, item) => sum + item.subtotal, 0);
            const taxRate = (typeof taxRatePercent === "number" ? taxRatePercent : 12) / 100;
            const effectiveDiscount = enableDiscounts ? discountPercent : 0;
            const discountAmount = subtotal * (effectiveDiscount / 100);
            const netSubtotal = Math.max(0, subtotal - discountAmount);
            return netSubtotal * (1 + taxRate);
          })()
        }
        ticketNumber={ticketNumber ?? undefined}
        onComplete={handleCompleteCheckout}
      />
    </div>
  );
};

export default POS;
