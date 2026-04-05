import { useState, useCallback } from "react";
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
import { useDataLayer } from "@/contexts/DataLayerContext";
import { useStore } from "@/contexts/StoreContext";
import { useEffect } from "react";
import { useSettings } from "@/contexts/SettingsContext";
import { Capacitor } from "@capacitor/core";
import { printerService } from "@/lib/printer";
import { formatCurrency } from "@/lib/currency";
import { changePhpFromCents, phpToCents } from "@/lib/phpMoney";
import { Skeleton } from "@/components/ui/skeleton";
import { QuickScanCard } from "@/components/pos/QuickScanCard";

/** Values to compare against sku / itemCode / barcode (whitespace, leading zeros). */
function scanMatchVariants(raw: string): Set<string> {
  const t = raw.trim().replace(/\s+/g, "");
  const digits = t.replace(/\D/g, "");
  const out = new Set<string>([t]);
  if (digits.length) {
    out.add(digits);
    out.add(digits.replace(/^0+/, "") || "0");
  }
  return out;
}

function fieldMatchesAnyVariant(field: string | undefined | null, variants: Set<string>): boolean {
  if (field == null || field === "") return false;
  const fv = String(field).trim().replace(/\s+/g, "");
  const fvDigits = fv.replace(/\D/g, "");
  for (const v of variants) {
    if (v === fv || v === fvDigits) return true;
    const vd = v.replace(/\D/g, "");
    if (vd && fvDigits && vd === fvDigits) return true;
  }
  return false;
}

function findProductByScan(products: Product[], scannedData: string): Product | undefined {
  const variants = scanMatchVariants(scannedData);
  return products.find(
    (p) =>
      fieldMatchesAnyVariant(p.sku, variants) ||
      fieldMatchesAnyVariant(p.itemCode, variants) ||
      fieldMatchesAnyVariant(p.barcode, variants),
  );
}

const POS = () => {
  const dataService = useDataLayer();
  const { user } = useAuth();
  const {
    storeName,
    storeAddress,
    autoPrintReceipt,
    showLogoOnReceipt,
    receiptLogoUrl,
    enableDiscounts,
    enableTax,
    taxRatePercent,
    selectedPrinter,
    enablePerKiloPurchase,
    enableBarcodeScanning,
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
  const [productBrowseExpanded, setProductBrowseExpanded] = useState(false);

  /** Shown when camera/USB scan decodes but no product matches (or catalog empty). */
  const toastScanNotRecognized = useCallback(
    (scannedCode: string) => {
      const label = scannedCode.trim().length > 0 ? scannedCode.trim() : "(empty)";
      toast({
        variant: "destructive",
        title: "Barcode not recognized",
        description:
          products.length === 0
            ? "No products loaded for this store. Select a store or wait for the catalog to finish loading."
            : `No results for "${label}". In Inventory, set Item code, SKU, or Barcode to match this scan.`,
      });
    },
    [products.length, toast],
  );

  const { activeStoreId, stores, storesLoading } = useStore();

  useEffect(() => {
    if (enableBarcodeScanning) {
      setProductBrowseExpanded(false);
    }
  }, [enableBarcodeScanning]);
  useEffect(() => {
    if (storesLoading) return;
    setCart([]); // Clear cart when switching stores
    // Wait for a valid store - cashiers need explicit storeId to load correct products
    const isValidStore =
      activeStoreId &&
      activeStoreId !== "default" &&
      stores.some((s) => s.id === activeStoreId);
    if (!isValidStore) {
      setCategories([]);
      setProducts([]);
      setError(
        storesLoading || stores.length === 0
          ? null
          : "Select a store to load products"
      );
      return;
    }
    const load = async () => {
      try {
        setLoading(true);
        setError(null);
        const [cats, prods] = await Promise.all([
          dataService.getCategories(activeStoreId),
          dataService.getProducts(undefined, activeStoreId),
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
  }, [activeStoreId, stores, dataService, storesLoading]);

  const filteredProducts = products.filter((product) => {
    const matchesCategory = !selectedCategory || product.categoryId === selectedCategory;
    const matchesSearch = product.name.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch && product.status === "active";
  });

  const isProductOutOfStock = (product: Product): boolean => {
    if (product.hasVariants && product.variants?.length) {
      const totalStock = product.variants.reduce((sum, v) => sum + (v.stock ?? 0), 0);
      return totalStock <= 0;
    }
    return (product.stock ?? 0) <= 0;
  };

  const handleProductSelect = (product: Product) => {
    if (isProductOutOfStock(product)) {
      toast({
        variant: "destructive",
        title: "Out of stock",
        description: `${product.name} is currently out of stock.`,
      });
      return;
    }
    if (product.hasVariants) {
      setSelectedProduct(product);
      setShowVariantModal(true);
    } else {
      addToCart(product);
    }
  };

  const handleVariantSelect = (variant: Variant) => {
    if (selectedProduct && (variant.stock ?? 0) > 0) {
      addToCart(selectedProduct, variant);
    }
  };

  const addToCart = (product: Product, variant?: Variant) => {
    let price: number;
    if (variant) {
      const basePrice = variant.price;
      const marginPercent = product.marginPercentage || 0;
      price = basePrice * (1 + marginPercent / 100);
    } else {
      price = product.price || 0;
    }

    const existingItemId = variant
      ? `${product.id}-${variant.id}`
      : product.id;

    const incrementAmount = enablePerKiloPurchase ? 0.1 : 1;

    setCart((prev) => {
      const existingItem = prev.find((item) => item.id === existingItemId);
      if (existingItem) {
        const newQuantity = existingItem.quantity + incrementAmount;
        return prev.map((item) =>
          item.id === existingItemId
            ? {
                ...item,
                quantity: newQuantity,
                subtotal: newQuantity * item.price,
              }
            : item,
        );
      }
      const initialQuantity = enablePerKiloPurchase ? 0.1 : 1;
      const newItem: CartItem = {
        id: existingItemId,
        productId: product.id,
        variantId: variant?.id,
        name: product.name,
        variantName: variant?.name,
        price,
        quantity: initialQuantity,
        subtotal: initialQuantity * price,
      };
      return [...prev, newItem];
    });
  };

  // Handle scanned weighted item sticker (from barcode/QR code)
  const handleScannedWeightedItem = (scannedData: string) => {
    const applyScanToProduct = (product: Product) => {
      if (isProductOutOfStock(product)) {
        toast({
          variant: "destructive",
          title: "Out of stock",
          description: `${product.name} is currently out of stock.`,
        });
        return;
      }
      if (product.hasVariants) {
        setSelectedProduct(product);
        setShowVariantModal(true);
        toast({
          title: "Select variant",
          description: `Choose options for ${product.name}`,
        });
      } else {
        addToCart(product);
        toast({
          title: "Added to cart",
          description: product.name,
        });
      }
    };

    try {
      const data = JSON.parse(scannedData);

      if (
        data &&
        typeof data === "object" &&
        data.sku &&
        typeof data.weight === "number" &&
        typeof data.price === "number"
      ) {
        const product = findProductByScan(products, String(data.sku));

        if (!product) {
          toastScanNotRecognized(String(data.sku));
          return;
        }

        const weightedItemId = `weighted-${product.id}-${Date.now()}`;

        const newItem: CartItem = {
          id: weightedItemId,
          productId: product.id,
          name: product.name,
          variantName: data.productName ? undefined : `${data.weight} kg`,
          price: data.price,
          quantity: data.weight,
          subtotal: data.price,
        };

        setCart((prev) => [...prev, newItem]);

        toast({
          title: "Item added",
          description: `${product.name} (${data.weight} kg) added to cart`,
        });
      } else if (
        data &&
        typeof data === "object" &&
        data.sku != null &&
        String(data.sku).length > 0 &&
        typeof data.price === "number" &&
        typeof data.weight !== "number"
      ) {
        // Sticker generator without per-kilo: { sku, price } only
        const product = findProductByScan(products, String(data.sku));
        if (!product) {
          toastScanNotRecognized(String(data.sku));
          return;
        }
        if (isProductOutOfStock(product)) {
          toast({
            variant: "destructive",
            title: "Out of stock",
            description: `${product.name} is currently out of stock.`,
          });
          return;
        }
        if (product.hasVariants) {
          setSelectedProduct(product);
          setShowVariantModal(true);
          toast({
            title: "Select variant",
            description: `Choose options for ${product.name}`,
          });
          return;
        }
        const unitId = `sticker-unit-${product.id}-${Date.now()}`;
        setCart((prev) => [
          ...prev,
          {
            id: unitId,
            productId: product.id,
            name: product.name,
            price: data.price,
            quantity: 1,
            subtotal: data.price,
          },
        ]);
        toast({
          title: "Item added",
          description: `${product.name} added to cart`,
        });
      } else {
        const product = findProductByScan(products, scannedData);
        if (product) {
          applyScanToProduct(product);
        } else {
          toastScanNotRecognized(scannedData);
        }
      }
    } catch {
      const product = findProductByScan(products, scannedData);
      if (product) {
        applyScanToProduct(product);
      } else {
        toastScanNotRecognized(scannedData);
      }
    }
  };

  const handleUpdateQuantity = (itemId: string, quantity: number) => {
    const minQuantity = enablePerKiloPurchase ? 0.1 : 1;
    if (quantity < minQuantity) {
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

    const headerName = storeName || "QuickScale";
    const headerAddress = storeAddress || "";
    const showLogo = showLogoOnReceipt && receiptLogoUrl;
    const totalDisplay = typeof sale?.total === "number" ? sale.total : fallbackTotals.total;
    const amountReceivedDisplay =
      typeof sale?.amountReceived === "number" ? sale.amountReceived : fallbackTotals.amountReceived;
    const changeDisplay = typeof sale?.change === "number" ? sale.change : fallbackTotals.change;

    return `<!doctype html>
    <html>
      <head>
        <meta charset="utf-8" />
        <title></title>
        <style>
          @page { margin: 0; size: auto; }
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
        ${showLogo ? `<div style="text-align:center;margin-bottom:8px;"><img src="${receiptLogoUrl}" alt="Logo" style="max-width:120px;max-height:80px;object-fit:contain;" /></div>` : ""}
        <h1>${headerName}</h1>
        <div class="meta">
          ${headerAddress ? `<div>${headerAddress}</div>` : ""}
          <div>Ticket: <strong>${sale?.ticketNumber ?? ticketNumber ?? ""}</strong></div>
          <div>Cashier: ${sale?.cashierName ?? user?.name ?? ""}</div>
          <div>Payment: ${(sale?.paymentMethod ?? "cash").toString().toUpperCase()}</div>
          ${String(sale?.paymentMethod ?? "cash").toLowerCase() === "gcash" ? `<div>GCash Txn ID: ${sale?.gcashTransactionId ?? "—"}</div>` : ""}
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

  const handleCompleteCheckout = async (result: { amountReceived: number; paymentMethod: string; gcashTransactionId?: string }) => {
    const { amountReceived, paymentMethod, gcashTransactionId } = result;
    const cartSnapshot = cart.map((item) => ({ ...item }));
    const subtotal = cart.reduce((sum, item) => sum + item.subtotal, 0);
    const taxRate = enableTax ? (typeof taxRatePercent === "number" ? taxRatePercent : 12) / 100 : 0;
    const effectiveDiscount = enableDiscounts ? discountPercent : 0;
    const discountAmount = subtotal * (effectiveDiscount / 100);
    const netSubtotal = Math.max(0, subtotal - discountAmount);
    const taxAmount = netSubtotal * taxRate;
    const total = netSubtotal + taxAmount;
    const change = changePhpFromCents(phpToCents(amountReceived), phpToCents(total));

    try {
      if (!user) {
        throw new Error("No logged-in user");
      }

      const sale = await dataService.createSale(
        {
          cartItems: cart,
          cashierId: user.id,
          cashierName: user.name,
          paymentMethod: paymentMethod === "gcash" ? "gcash" : "cash",
          amountReceived,
          taxRate,
          discountPercent: effectiveDiscount,
          ticketNumber: ticketNumber ?? undefined,
          gcashTransactionId: paymentMethod === "gcash" ? gcashTransactionId || undefined : undefined,
        },
        activeStoreId !== "default" ? activeStoreId : undefined,
      );

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
    <div className="flex flex-1 flex-col min-h-0 overflow-hidden">
      {/* Header - desktop/tablet only */}
      <header className="bg-card border-b p-4 items-center justify-between hidden md:flex shrink-0">
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

      <div className="flex flex-1 min-h-0 flex-col md:flex-row md:overflow-hidden">
        {/* Main column ~2/3 — scan / search / products */}
        <div className="flex-1 flex flex-col min-h-0 md:min-w-0 md:flex-[2_1_0%] md:overflow-hidden bg-background">
          {enableBarcodeScanning ? (
            <>
              <div className="shrink-0 p-4 md:p-5 space-y-4 border-b border-border bg-background">
                <QuickScanCard
                  onScan={handleScannedWeightedItem}
                  browseExpanded={productBrowseExpanded}
                  onBrowseProducts={() => setProductBrowseExpanded(true)}
                  onBackToScan={() => setProductBrowseExpanded(false)}
                  inlineCollapsedHint={false}
                />
                {!productBrowseExpanded && (
                  <p className="md:hidden px-1 text-center text-xs leading-relaxed text-muted-foreground">
                    Scan to add items. Tap Browse products above to search or pick from the grid.
                  </p>
                )}
                {productBrowseExpanded && (
                  <>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                      <Input
                        placeholder="Search products..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-10 h-12 text-base border-primary/40 focus-visible:ring-primary/30"
                      />
                    </div>
                    <CategoryTabs
                      categories={categories}
                      selectedCategory={selectedCategory}
                      onSelectCategory={setSelectedCategory}
                    />
                  </>
                )}
              </div>

              {!productBrowseExpanded ? (
                <div className="hidden md:flex flex-1 min-h-[8rem] items-center justify-center px-8 py-12 bg-background">
                  <p className="max-w-md text-center text-xs leading-relaxed text-muted-foreground">
                    Scan to add items. Tap Browse products above to search or pick from the grid.
                  </p>
                </div>
              ) : (
                <div className="flex-1 overflow-auto p-4 md:p-5 min-h-0">
                  {loading ? (
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                      {Array.from({ length: 10 }).map((_, i) => (
                        <div
                          key={i}
                          className="h-auto flex flex-col p-4 bg-pos-product rounded-lg border"
                        >
                          <Skeleton className="w-full aspect-square mb-3 rounded-lg" />
                          <Skeleton className="h-4 w-3/4 mb-2" />
                          <Skeleton className="h-4 w-1/2" />
                        </div>
                      ))}
                    </div>
                  ) : error ? (
                    <p className="text-sm text-destructive">Failed to load: {error}</p>
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                      {filteredProducts.map((product) => (
                        <ProductCard
                          key={product.id}
                          product={product}
                          onSelect={handleProductSelect}
                          isOutOfStock={isProductOutOfStock(product)}
                        />
                      ))}
                    </div>
                  )}
                </div>
              )}
            </>
          ) : (
            <>
              <div className="shrink-0 p-4 md:p-5 space-y-4 border-b border-border bg-background">
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

              <div className="flex-1 overflow-auto p-4 md:p-5 min-h-0">
                {loading && (
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                    {Array.from({ length: 10 }).map((_, i) => (
                      <div
                        key={i}
                        className="h-auto flex flex-col p-4 bg-pos-product rounded-lg border"
                      >
                        <Skeleton className="w-full aspect-square mb-3 rounded-lg" />
                        <Skeleton className="h-4 w-3/4 mb-2" />
                        <Skeleton className="h-4 w-1/2" />
                      </div>
                    ))}
                  </div>
                )}
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
                        isOutOfStock={isProductOutOfStock(product)}
                      />
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Cart column ~1/3 — full viewport height beside products */}
        <div className="hidden min-h-0 min-w-[280px] max-w-[min(440px,36%)] shrink-0 flex flex-col border-l border-border bg-pos-cart md:flex md:h-full md:max-h-full md:self-stretch">
          <Cart
            variant="sidebar"
            items={cart}
            onUpdateQuantity={handleUpdateQuantity}
            onRemoveItem={handleRemoveItem}
            onCheckout={handleCheckout}
            discountsEnabled={enableDiscounts}
            discountPercent={discountPercent}
            onDiscountChange={setDiscountPercent}
            taxRatePercent={taxRatePercent}
            enableTax={enableTax}
            enablePerKiloPurchase={enablePerKiloPurchase}
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
            enableTax={enableTax}
            enablePerKiloPurchase={enablePerKiloPurchase}
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
            const effectiveDiscount = enableDiscounts ? discountPercent : 0;
            const discountAmount = subtotal * (effectiveDiscount / 100);
            const netSubtotal = Math.max(0, subtotal - discountAmount);
            const taxRate = enableTax ? (typeof taxRatePercent === "number" ? taxRatePercent : 12) / 100 : 0;
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
