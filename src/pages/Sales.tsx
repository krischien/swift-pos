import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Receipt, TrendingUp, Calendar, Printer, Download, DollarSign } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import { formatCurrency } from "@/lib/currency";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  endOfDay,
  endOfMonth,
  endOfQuarter,
  endOfWeek,
  endOfYear,
  isSameDay,
  startOfDay,
  startOfMonth,
  startOfQuarter,
  startOfWeek,
  startOfYear,
} from "date-fns";

// Custom Peso Icon Component
const PesoIcon = ({ className }: { className?: string }) => (
  <span className={className} style={{ fontFamily: 'system-ui, sans-serif', fontWeight: 'bold' }}>
    ₱
  </span>
);

const Sales = () => {
  const [sales, setSales] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filterOpen, setFilterOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [detailsSale, setDetailsSale] = useState<any | null>(null);
  const [fromDate, setFromDate] = useState<string>("");
  const [toDate, setToDate] = useState<string>("");
  const [activeRangeLabel, setActiveRangeLabel] = useState<string>("All time");
  const [exporting, setExporting] = useState(false);

  type ExportRange = "today" | "weekly" | "monthly" | "quarterly" | "annual";

  const loadSales = async (from?: string, to?: string) => {
    try {
      setLoading(true);
      setError(null);
      const [salesData, productsData] = await Promise.all([
        api.getSales({ from, to }),
        api.getProducts(), // This should return all products on server, but may filter on mobile
      ]);
      const salesArray = salesData as any[];
      const productsArray = productsData as any[];
      setSales(salesArray);
      setProducts(productsArray);
      console.log(`[SALES] Loaded ${salesArray.length} sales and ${productsArray.length} products`);
    } catch (e: any) {
      setError(e.message ?? "Failed to load sales");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadSales();
  }, []);

  const getRangeForExport = (range: ExportRange) => {
    const now = new Date();
    let from: Date;
    let to: Date;
    let label: string;

    switch (range) {
      case "today":
        from = startOfDay(now);
        to = endOfDay(now);
        label = "Today";
        break;
      case "weekly":
        from = startOfWeek(now, { weekStartsOn: 1 });
        to = endOfWeek(now, { weekStartsOn: 1 });
        label = "This Week";
        break;
      case "monthly":
        from = startOfMonth(now);
        to = endOfMonth(now);
        label = "This Month";
        break;
      case "quarterly":
        from = startOfQuarter(now);
        to = endOfQuarter(now);
        label = "This Quarter";
        break;
      case "annual":
      default:
        from = startOfYear(now);
        to = endOfYear(now);
        label = "This Year";
        break;
    }

    return {
      fromISO: from.toISOString(),
      toISO: to.toISOString(),
      label,
    };
  };

  const handleExport = async (range: ExportRange) => {
    try {
      setExporting(true);
      const { fromISO, toISO, label } = getRangeForExport(range);

      const [salesData, productsData] = await Promise.all([
        api.getSales({ from: fromISO, to: toISO }),
        api.getProducts(),
      ]);

      const salesArr = salesData as any[];
      const productsArr = productsData as any[];

      const rowsMap = new Map<string, any>();

      for (const sale of salesArr) {
        for (const item of sale.items ?? []) {
          const key = `${item.productId}-${item.variantId || "base"}`;
          const existing = rowsMap.get(key) || {
            productId: item.productId,
            variantId: item.variantId,
            quantitySold: 0,
            salesAmount: 0,
            totalProfit: 0,
          };
          existing.quantitySold += item.quantity;
          existing.salesAmount += item.subtotal;
          
          // Calculate profit for this item using the same formula as stats
          const product = productsArr.find((p) => p.id === item.productId);
          if (product) {
            const marginPercent = product.marginPercentage ?? 0;
            if (marginPercent > 0 && item.price > 0) {
              // Calculate base price from selling price
              // sellingPrice = basePrice × (1 + marginPercent/100)
              // basePrice = sellingPrice / (1 + marginPercent/100)
              const basePrice = item.price / (1 + marginPercent / 100);
              // Profit = basePrice × marginPercent/100 × quantity
              const profitPerUnit = (basePrice * marginPercent) / 100;
              const profitForItem = profitPerUnit * item.quantity;
              existing.totalProfit += profitForItem;
            }
          }
          
          rowsMap.set(key, existing);
        }
      }

      const rows: any[] = [];
      // Calculate grand totals from actual sale totals (includes tax/discounts) to match Sales History page
      let grandTotalSales = salesArr.reduce((sum, sale) => sum + (sale.total || 0), 0);
      let grandTotalProfit = 0;

      rowsMap.forEach((value) => {
        const product = productsArr.find((p) => p.id === value.productId);
        if (!product) return;
        const variant =
          value.variantId && product.variants
            ? product.variants.find((v: any) => v.id === value.variantId)
            : null;

        const currentStock = variant ? variant.stock : product.stock ?? 0;
        const openingStockApprox = currentStock + value.quantitySold;

        grandTotalProfit += value.totalProfit || 0;

        // Calculate profit margin percentage
        const profitMarginPercent = value.salesAmount > 0 
          ? ((value.totalProfit || 0) / value.salesAmount) * 100 
          : 0;

        rows.push({
          ItemCode: product.itemCode,
          ProductName: product.name,
          VariantName: variant?.name ?? "",
          Category: product.category?.name ?? "",
          DateRange: label,
          ApproxOpeningStock: openingStockApprox,
          ClosingStock: currentStock,
          QuantitySold: value.quantitySold,
          ProfitMarginPercentage: profitMarginPercent,
          SalesAmount: value.salesAmount,
          TotalSales: value.salesAmount,
          TotalProfit: value.totalProfit || 0,
        });
      });

      if (!rows.length) {
        alert("No sales found for the selected period.");
        return;
      }

      // Calculate grand total profit margin percentage
      const grandTotalProfitMarginPercent = grandTotalSales > 0 
        ? (grandTotalProfit / grandTotalSales) * 100 
        : 0;

      // Add grand total row
      rows.push({
        ItemCode: "",
        ProductName: "GRAND TOTAL",
        VariantName: "",
        Category: "",
        DateRange: "",
        ApproxOpeningStock: "",
        ClosingStock: "",
        QuantitySold: "",
        ProfitMarginPercentage: grandTotalProfitMarginPercent,
        SalesAmount: "",
        TotalSales: grandTotalSales,
        TotalProfit: grandTotalProfit,
      });

      const XLSX = await import("xlsx");
      const ws = XLSX.utils.json_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Sales vs Inventory");
      const wbout = XLSX.write(wb, { bookType: "xlsx", type: "array" });
      const blob = new Blob([wbout], { type: "application/octet-stream" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `sales-inventory-${range}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e: any) {
      alert(e.message ?? "Failed to export report");
    } finally {
      setExporting(false);
    }
  };

  const stats = useMemo(() => {
    // Filter sales for today
    const today = new Date();
    const todaySales = sales.filter(s => isSameDay(new Date(s.createdAt), today));

    if (!todaySales.length) {
      return [
        { title: "Today's Sales", value: formatCurrency(0), icon: PesoIcon, trend: "" },
        { title: "Transactions", value: "0", icon: Receipt, trend: "" },
        { title: "Average Sale", value: formatCurrency(0), icon: TrendingUp, trend: "" },
        { title: "Total Profit", value: formatCurrency(0), icon: DollarSign, trend: "" },
      ];
    }

    const total = todaySales.reduce((sum, s) => sum + s.total, 0);
    const count = todaySales.length;
    const avg = total / count;

    // Calculate total profit using actual selling prices from sale items
    let totalProfit = 0;
    
    for (const sale of todaySales) {
      if (!sale.items || sale.items.length === 0) {
        console.warn(`[PROFIT] Sale ${sale.id} has no items`);
        continue;
      }
      
      for (const item of sale.items) {
        // Get margin percentage from product (we still need this)
        const product = products.find((p) => p.id === item.productId);
        if (!product) {
          console.warn(`[PROFIT] Product not found for sale item: ${item.productId}, Item: ${item.productName}`);
          continue;
        }

        const marginPercent = product.marginPercentage ?? 0;
        if (marginPercent === 0 || marginPercent === null || marginPercent === undefined) {
          console.warn(`[PROFIT] Product "${product.name}" has no margin percentage set (value: ${product.marginPercentage})`);
          continue;
        }

        // Use the actual selling price from the sale item (this is what was sold at)
        const sellingPrice = item.price;
        
        if (!sellingPrice || sellingPrice <= 0) {
          console.warn(`[PROFIT] Invalid selling price for item: ${item.productName}, price: ${sellingPrice}`);
          continue;
        }
        
        // Calculate base price from selling price
        // sellingPrice = basePrice × (1 + marginPercent/100)
        // basePrice = sellingPrice / (1 + marginPercent/100)
        const basePrice = sellingPrice / (1 + marginPercent / 100);
        
        // Profit = basePrice × marginPercent/100 × quantity
        const profitPerUnit = (basePrice * marginPercent) / 100;
        const profitForItem = profitPerUnit * item.quantity;
        totalProfit += profitForItem;
        
        console.log(`[PROFIT] Item: ${item.productName || product.name}, Selling Price: ${sellingPrice}, Margin: ${marginPercent}%, Base: ${basePrice.toFixed(2)}, Qty: ${item.quantity}, Profit: ${profitForItem.toFixed(2)}`);
      }
    }
    
    console.log(`[PROFIT] Total profit calculated: ${totalProfit.toFixed(2)}`);

    return [
      { title: "Today's Sales", value: formatCurrency(total), icon: PesoIcon, trend: "" },
      { title: "Transactions", value: `${count}`, icon: Receipt, trend: "" },
      { title: "Average Sale", value: formatCurrency(avg), icon: TrendingUp, trend: "" },
      { title: "Total Profit", value: formatCurrency(totalProfit), icon: DollarSign, trend: "" },
    ];
  }, [sales, products]);

  const openSaleDetails = (sale: any) => {
    setDetailsSale(sale);
    setDetailsOpen(true);
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col gap-4 tablet-landscape:flex-row tablet-landscape:items-center tablet-landscape:justify-between lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-3xl font-bold">Sales History</h1>
          <p className="text-muted-foreground">
            View and manage your sales transactions{activeRangeLabel ? ` (${activeRangeLabel})` : ""}
          </p>
        </div>
        <div className="flex flex-col tablet-portrait:flex-row tablet-portrait:justify-end tablet-landscape:flex-row lg:flex-row gap-2 w-full tablet-landscape:w-auto tablet-landscape:justify-end lg:w-auto lg:justify-end">
          {/* Row 1 on mobile, all buttons in one row on tablet/desktop */}
          <div className="flex flex-row gap-2 w-full tablet-portrait:w-auto tablet-landscape:w-auto">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="gap-2 flex-1 tablet-portrait:flex-none tablet-portrait:w-auto tablet-landscape:flex-none tablet-landscape:w-auto lg:flex-none lg:w-auto" disabled={exporting}>
                  <Download className="w-4 h-4" />
                  Export
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => handleExport("today")}>
                  Today
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleExport("weekly")}>
                  This Week
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleExport("monthly")}>
                  This Month
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleExport("quarterly")}>
                  This Quarter
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleExport("annual")}>
                  This Year
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button
              variant="outline"
              className="gap-2 flex-1 tablet-portrait:flex-none tablet-portrait:w-auto tablet-landscape:flex-none tablet-landscape:w-auto lg:flex-none lg:w-auto"
              onClick={() => window.print()}
            >
              <Printer className="w-4 h-4" />
              Print
            </Button>
          </div>
          {/* Row 2 on mobile, continues in same row on tablet/desktop */}
          <div className="flex flex-row gap-2 w-full tablet-portrait:w-auto tablet-landscape:w-auto">
            <Dialog open={filterOpen} onOpenChange={setFilterOpen}>
              <Button
                variant="outline"
                className="gap-2 flex-1 tablet-portrait:flex-none tablet-portrait:w-auto tablet-landscape:flex-none tablet-landscape:w-auto lg:flex-none lg:w-auto"
                onClick={() => setFilterOpen(true)}
              >
                <Calendar className="w-4 h-4" />
                Filter by Date
              </Button>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Filter by Date</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <p className="text-sm font-medium">From</p>
                    <input
                      type="date"
                      className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                      value={fromDate}
                      onChange={(e) => setFromDate(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm font-medium">To</p>
                    <input
                      type="date"
                      className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                      value={toDate}
                      onChange={(e) => setToDate(e.target.value)}
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setFromDate("");
                      setToDate("");
                      setActiveRangeLabel("All time");
                      void loadSales();
                      setFilterOpen(false);
                    }}
                  >
                    Clear
                  </Button>
                  <Button
                    onClick={() => {
                      const from = fromDate ? new Date(fromDate).toISOString() : undefined;
                      const to = toDate ? new Date(toDate).toISOString() : undefined;
                      void loadSales(from, to);
                      const label =
                        fromDate || toDate
                          ? `${fromDate || "…"} – ${toDate || "…"}`
                          : "All time";
                      setActiveRangeLabel(label);
                      setFilterOpen(false);
                    }}
                  >
                    Apply
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <Card key={stat.title}>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {stat.title}
                </CardTitle>
                <Icon className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stat.value}</div>
                <p className="text-xs text-success mt-1">{stat.trend} from yesterday</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="space-y-4">
        {loading && <p className="text-sm text-muted-foreground">Loading sales...</p>}
        {error && !loading && (
          <p className="text-sm text-destructive">Failed to load: {error}</p>
        )}
        {!loading && !error && (
          <>
            {/* Desktop View */}
            <div className="hidden md:block rounded-lg border bg-card">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Transaction ID</TableHead>
                    <TableHead>Cashier</TableHead>
                    <TableHead>Items</TableHead>
                    <TableHead>Payment</TableHead>
                    <TableHead>Date & Time</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sales.map((sale) => (
                    <TableRow key={sale.id}>
                      <TableCell className="font-mono">
                        #{String(sale.id).slice(-6).padStart(6, "0")}
                      </TableCell>
                      <TableCell>{sale.cashierName}</TableCell>
                      <TableCell>{sale.items?.length ?? 0} items</TableCell>
                      <TableCell>{sale.paymentMethod}</TableCell>
                      <TableCell>
                        {new Date(sale.createdAt).toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right font-bold">
                        {formatCurrency(sale.total)}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm" onClick={() => openSaleDetails(sale)}>
                          View Details
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Mobile View */}
            <div className="grid grid-cols-1 gap-4 md:hidden">
              {sales.map((sale) => (
                <div key={sale.id} className="bg-card rounded-lg border p-4 space-y-3 shadow-sm">
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="font-mono text-sm font-bold">
                        #{String(sale.id).slice(-6).padStart(6, "0")}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(sale.createdAt).toLocaleString()}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-lg">{formatCurrency(sale.total)}</p>
                      <p className="text-xs text-muted-foreground capitalize">{sale.paymentMethod}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 text-sm border-t pt-3 border-b pb-3">
                    <div>
                      <p className="text-muted-foreground text-xs">Cashier</p>
                      <p className="font-medium">{sale.cashierName}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-muted-foreground text-xs">Items</p>
                      <p className="font-medium">{sale.items?.length ?? 0}</p>
                    </div>
                  </div>

                  <div className="flex justify-end">
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full"
                      onClick={() => openSaleDetails(sale)}
                    >
                      View Details
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      <Dialog
        open={detailsOpen}
        onOpenChange={(open) => {
          setDetailsOpen(open);
          if (!open) setDetailsSale(null);
        }}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Sale Details</DialogTitle>
          </DialogHeader>
          {detailsSale && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground text-xs">Transaction</p>
                  <p className="font-mono font-semibold">
                    #{String(detailsSale.id).slice(-6).padStart(6, "0")}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">Ticket</p>
                  <p className="font-semibold">{detailsSale.ticketNumber || "—"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">Cashier</p>
                  <p className="font-semibold">{detailsSale.cashierName}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">Date</p>
                  <p className="font-semibold">
                    {new Date(detailsSale.createdAt).toLocaleString()}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">Payment</p>
                  <p className="font-semibold capitalize">{detailsSale.paymentMethod}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">Total</p>
                  <p className="font-semibold">{formatCurrency(detailsSale.total)}</p>
                </div>
              </div>
              <div className="rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Item</TableHead>
                      <TableHead className="text-right">Qty</TableHead>
                      <TableHead className="text-right">Price</TableHead>
                      <TableHead className="text-right">Subtotal</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(detailsSale.items ?? []).map((item: any) => (
                      <TableRow key={item.id}>
                        <TableCell>
                          <p className="font-medium">{item.productName}</p>
                          {item.variantName && (
                            <p className="text-xs text-muted-foreground">{item.variantName}</p>
                          )}
                        </TableCell>
                        <TableCell className="text-right">{item.quantity}</TableCell>
                        <TableCell className="text-right">{formatCurrency(item.price)}</TableCell>
                        <TableCell className="text-right font-semibold">
                          {formatCurrency(item.subtotal)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Sales;
