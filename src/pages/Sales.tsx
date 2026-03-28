import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Receipt, TrendingUp, Calendar, Download, DollarSign, Printer, Ban, Search, ChevronLeft, ChevronRight } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";
import { useEffect, useMemo, useState } from "react";
import { useDataLayer } from "@/contexts/DataLayerContext";
import { useStore } from "@/contexts/StoreContext";
import { formatCurrency } from "@/lib/currency";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  eachDayOfInterval,
  eachHourOfInterval,
  eachMonthOfInterval,
  endOfDay,
  endOfMonth,
  endOfQuarter,
  endOfWeek,
  endOfYear,
  format,
  startOfDay,
  startOfMonth,
  startOfQuarter,
  startOfWeek,
  startOfYear,
  subDays,
  subMonths,
  subYears,
} from "date-fns";

const ITEMS_PER_PAGE = 10;

const isVoidedSale = (s: { status?: string }) => (s?.status ?? "") === "void";

// Custom Peso Icon Component
const PesoIcon = ({ className }: { className?: string }) => (
  <span className={className} style={{ fontFamily: 'system-ui, sans-serif', fontWeight: 'bold' }}>
    ₱
  </span>
);

const Sales = () => {
  const dataService = useDataLayer();
  const { activeStoreId } = useStore();
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
  const [voiding, setVoiding] = useState(false);
  const [voidConfirmOpen, setVoidConfirmOpen] = useState(false);
  const [saleToVoid, setSaleToVoid] = useState<any | null>(null);
  const [tableSearch, setTableSearch] = useState("");
  const [paymentFilter, setPaymentFilter] = useState<"all" | "cash" | "gcash">("all");
  const [voidStatusFilter, setVoidStatusFilter] = useState<"all" | "active" | "voided">("all");
  const [currentPage, setCurrentPage] = useState(1);

  type ExportRange = "today" | "weekly" | "monthly" | "quarterly" | "annual";
  type QuickRange = "all" | "today" | "week" | "month" | "year" | "custom";
  const [quickRange, setQuickRange] = useState<QuickRange>("all");

  const loadSales = async (from?: string, to?: string) => {
    try {
      setLoading(true);
      setError(null);
      const [salesData, productsData] = await Promise.all([
        dataService.getSales({ from, to, voidFilter: "all" }),
        dataService.getProducts(),
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
  }, [activeStoreId]);

  useEffect(() => {
    setCurrentPage(1);
  }, [tableSearch, paymentFilter, voidStatusFilter]);

  const salesForMetrics = useMemo(
    () => sales.filter((s) => !isVoidedSale(s)),
    [sales],
  );

  const filteredSales = useMemo(() => {
    const q = tableSearch.trim().toLowerCase();
    return sales.filter((sale) => {
      const idShort = String(sale.id).slice(-6).padStart(6, "0").toLowerCase();
      const idFull = String(sale.id).toLowerCase();
      const qNorm = q.replace(/^#/, "");
      const matchesSearch =
        !q ||
        idShort.includes(qNorm) ||
        idFull.includes(q) ||
        (sale.cashierName ?? "").toLowerCase().includes(q);

      const pm = String(sale.paymentMethod ?? "").toLowerCase();
      const matchesPayment =
        paymentFilter === "all" ||
        (paymentFilter === "cash" && pm === "cash") ||
        (paymentFilter === "gcash" && pm === "gcash");

      const voided = isVoidedSale(sale);
      const matchesVoid =
        voidStatusFilter === "all" ||
        (voidStatusFilter === "voided" && voided) ||
        (voidStatusFilter === "active" && !voided);

      return matchesSearch && matchesPayment && matchesVoid;
    });
  }, [sales, tableSearch, paymentFilter, voidStatusFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredSales.length / ITEMS_PER_PAGE) || 1);

  const paginatedSales = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredSales.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredSales, currentPage]);

  useEffect(() => {
    setCurrentPage((p) => Math.min(p, totalPages));
  }, [totalPages]);

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

  const getQuickRangeBounds = (range: QuickRange) => {
    const now = new Date();
    let from: Date | undefined;
    let to: Date | undefined;
    let label = "All time";

    switch (range) {
      case "today":
        from = startOfDay(now);
        to = endOfDay(now);
        label = "Today";
        break;
      case "week":
        from = startOfWeek(now, { weekStartsOn: 1 });
        to = endOfWeek(now, { weekStartsOn: 1 });
        label = "This Week";
        break;
      case "month":
        from = startOfMonth(now);
        to = endOfMonth(now);
        label = "This Month";
        break;
      case "year":
        from = startOfYear(now);
        to = endOfYear(now);
        label = "This Year";
        break;
      case "custom":
        label = "Custom";
        break;
      case "all":
      default:
        from = undefined;
        to = undefined;
        label = "All time";
        break;
    }

    return { from, to, label };
  };

  const applyQuickRange = (range: QuickRange) => {
    if (range === "custom") {
      return;
    }
    const { from, to, label } = getQuickRangeBounds(range);
    setQuickRange(range);
    setFromDate("");
    setToDate("");
    setActiveRangeLabel(label);
    void loadSales(from?.toISOString(), to?.toISOString());
  };

  const handleExport = async (range: ExportRange) => {
    try {
      setExporting(true);
      const { fromISO, toISO, label } = getRangeForExport(range);

      const [salesData, productsData] = await Promise.all([
        dataService.getSales({ from: fromISO, to: toISO }),
        dataService.getProducts(),
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
          };
          existing.quantitySold += item.quantity;
          existing.salesAmount += item.subtotal;
          rowsMap.set(key, existing);
        }
      }

      const rows: any[] = [];

      rowsMap.forEach((value) => {
        const product = productsArr.find((p) => p.id === value.productId);
        if (!product) return;
        const variant =
          value.variantId && product.variants
            ? product.variants.find((v: any) => v.id === value.variantId)
            : null;

        const currentStock = variant ? variant.stock : product.stock ?? 0;
        const openingStockApprox = currentStock + value.quantitySold;

        rows.push({
          ItemCode: product.itemCode,
          ProductName: product.name,
          VariantName: variant?.name ?? "",
          Category: product.category?.name ?? "",
          DateRange: label,
          QuantitySold: value.quantitySold,
          SalesAmount: value.salesAmount,
          ApproxOpeningStock: openingStockApprox,
          ClosingStock: currentStock,
        });
      });

      if (!rows.length) {
        alert("No sales found for the selected period.");
        return;
      }

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
    if (!salesForMetrics.length) {
      return [
        { title: "Today's Sales", value: formatCurrency(0), icon: PesoIcon, trend: "" },
        { title: "Transactions", value: "0", icon: Receipt, trend: "" },
        { title: "Average Sale", value: formatCurrency(0), icon: TrendingUp, trend: "" },
        { title: "Total Profit", value: formatCurrency(0), icon: DollarSign, trend: "" },
      ];
    }

    const total = salesForMetrics.reduce((sum, s) => sum + s.total, 0);
    const count = salesForMetrics.length;
    const avg = total / count;

    // Calculate total profit using actual selling prices from sale items
    let totalProfit = 0;
    console.log(`[PROFIT] Starting calculation. Sales: ${salesForMetrics.length}, Products: ${products.length}`);
    
    // Log first sale for debugging
    if (salesForMetrics.length > 0 && salesForMetrics[0].items) {
      console.log(`[PROFIT] Sample sale item:`, salesForMetrics[0].items[0]);
    }
    
    for (const sale of salesForMetrics) {
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
  }, [salesForMetrics, products]);

  const comparativeSales = useMemo(() => {
    const now = new Date();
    const sumRange = (from: Date, to: Date) =>
      salesForMetrics.reduce((sum, sale) => {
        const createdAt = new Date(sale.createdAt);
        if (createdAt >= from && createdAt <= to) {
          return sum + sale.total;
        }
        return sum;
      }, 0);

    const todayStart = startOfDay(now);
    const todayEnd = endOfDay(now);
    const yesterday = subDays(now, 1);
    const yesterdayStart = startOfDay(yesterday);
    const yesterdayEnd = endOfDay(yesterday);

    const thisMonthStart = startOfMonth(now);
    const thisMonthEnd = endOfMonth(now);
    const lastMonthDate = subMonths(now, 1);
    const lastMonthStart = startOfMonth(lastMonthDate);
    const lastMonthEnd = endOfMonth(lastMonthDate);

    const thisYearStart = startOfYear(now);
    const thisYearEnd = endOfYear(now);
    const lastYearDate = subYears(now, 1);
    const lastYearStart = startOfYear(lastYearDate);
    const lastYearEnd = endOfYear(lastYearDate);

    return {
      today: sumRange(todayStart, todayEnd),
      yesterday: sumRange(yesterdayStart, yesterdayEnd),
      thisMonth: sumRange(thisMonthStart, thisMonthEnd),
      lastMonth: sumRange(lastMonthStart, lastMonthEnd),
      thisYear: sumRange(thisYearStart, thisYearEnd),
      lastYear: sumRange(lastYearStart, lastYearEnd),
    };
  }, [salesForMetrics]);

  const topSalesData = useMemo(() => {
    const rowsMap = new Map<
      string,
      { name: string; salesAmount: number; quantitySold: number }
    >();

    for (const sale of salesForMetrics) {
      for (const item of sale.items ?? []) {
        const product = products.find((p) => p.id === item.productId);
        const baseName = item.productName || product?.name || "Unknown Item";
        const variantName = item.variantName ? ` - ${item.variantName}` : "";
        const name = `${baseName}${variantName}`;
        const key = `${item.productId}-${item.variantId || "base"}`;
        const current = rowsMap.get(key) ?? { name, salesAmount: 0, quantitySold: 0 };
        current.salesAmount += item.subtotal ?? item.price * item.quantity;
        current.quantitySold += item.quantity ?? 0;
        rowsMap.set(key, current);
      }
    }

    return Array.from(rowsMap.values())
      .sort((a, b) => b.salesAmount - a.salesAmount)
      .slice(0, 5);
  }, [salesForMetrics, products]);

  const topSalesChartConfig = {
    salesAmount: {
      label: "Sales",
      color: "hsl(var(--primary))",
    },
  } as const;

  const salesOverTimeData = useMemo(() => {
    if (!salesForMetrics.length) {
      return [];
    }

    const customFrom = fromDate ? new Date(fromDate) : undefined;
    const customTo = toDate ? new Date(toDate) : undefined;
    const { from: quickFrom, to: quickTo } = getQuickRangeBounds(quickRange);

    let from = quickFrom;
    let to = quickTo;

    if (quickRange === "custom" && (customFrom || customTo)) {
      from = customFrom ?? customTo;
      to = customTo ?? customFrom;
    }

    if (!from || !to) {
      const timestamps = salesForMetrics
        .map((sale) => new Date(sale.createdAt).getTime())
        .filter((value) => Number.isFinite(value));
      if (!timestamps.length) {
        return [];
      }
      from = new Date(Math.min(...timestamps));
      to = new Date(Math.max(...timestamps));
    }

    if (from > to) {
      [from, to] = [to, from];
    }

    const getBucketKey = (date: Date) => {
      if (quickRange === "today") {
        return format(date, "yyyy-MM-dd HH");
      }
      if (quickRange === "year") {
        return format(date, "yyyy-MM");
      }
      return format(date, "yyyy-MM-dd");
    };

    const getLabel = (date: Date) => {
      if (quickRange === "today") {
        return format(date, "ha");
      }
      if (quickRange === "year") {
        return format(date, "MMM");
      }
      return format(date, "MMM d");
    };

    const ticks =
      quickRange === "today"
        ? eachHourOfInterval({ start: from, end: to })
        : quickRange === "year"
        ? eachMonthOfInterval({ start: from, end: to })
        : eachDayOfInterval({ start: from, end: to });

    const totals = new Map<string, number>();
    for (const tick of ticks) {
      totals.set(getBucketKey(tick), 0);
    }

    for (const sale of salesForMetrics) {
      const createdAt = new Date(sale.createdAt);
      if (createdAt < from || createdAt > to) {
        continue;
      }
      const key = getBucketKey(createdAt);
      totals.set(key, (totals.get(key) ?? 0) + (sale.total ?? 0));
    }

    return ticks.map((tick) => ({
      label: getLabel(tick),
      total: totals.get(getBucketKey(tick)) ?? 0,
    }));
  }, [salesForMetrics, quickRange, fromDate, toDate]);

  const salesOverTimeChartConfig = {
    total: {
      label: "Sales",
      color: "hsl(var(--primary))",
    },
  } as const;

  const formatComparison = (current: number, previous: number) => {
    const diff = current - previous;
    if (previous <= 0) {
      return {
        diff,
        percentLabel: "—",
        diffClass: diff >= 0 ? "text-success" : "text-destructive",
      };
    }
    const percent = (diff / previous) * 100;
    const sign = percent > 0 ? "+" : "";
    return {
      diff,
      percentLabel: `${sign}${percent.toFixed(1)}%`,
      diffClass: diff >= 0 ? "text-success" : "text-destructive",
    };
  };

  const openSaleDetails = (sale: any) => {
    setDetailsSale(sale);
    setDetailsOpen(true);
  };

  const confirmVoid = (sale: any) => {
    setSaleToVoid(sale);
    setVoidConfirmOpen(true);
  };

  const handleVoid = async () => {
    if (!saleToVoid || !dataService.voidSale) return;
    try {
      setVoiding(true);
      await dataService.voidSale(saleToVoid.id, (saleToVoid as { storeId?: string }).storeId);
      setVoidConfirmOpen(false);
      setSaleToVoid(null);
      if (detailsSale?.id === saleToVoid.id) {
        setDetailsOpen(false);
        setDetailsSale(null);
      }
      const { from, to } = getQuickRangeBounds(quickRange);
      const fromStr = quickRange === "custom" && fromDate ? new Date(fromDate).toISOString() : from?.toISOString();
      const toStr = quickRange === "custom" && toDate ? new Date(toDate).toISOString() : to?.toISOString();
      void loadSales(fromStr, toStr);
    } catch (e: any) {
      setError(e.message ?? "Failed to void transaction");
    } finally {
      setVoiding(false);
    }
  };

  const handlePrint = () => {
    const esc = (s: string) =>
      String(s ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
    const rows = filteredSales
      .map(
        (sale) => `
      <tr>
        <td>#${String(sale.id).slice(-6).padStart(6, "0")}</td>
        <td>${esc(sale.cashierName ?? "")}</td>
        <td>${sale.items?.length ?? 0}</td>
        <td>${String(sale.paymentMethod ?? "cash").toUpperCase()}</td>
        <td>${new Date(sale.createdAt).toLocaleString()}</td>
        <td style="text-align:right;">${formatCurrency(sale.total)}</td>
      </tr>`
      )
      .join("");
    const totalAmount = filteredSales.reduce((sum, s) => sum + (s.total ?? 0), 0);
    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Sales History</title>
  <style>
    body { font-family: system-ui, sans-serif; margin: 20px; font-size: 12px; }
    h1 { font-size: 18px; margin-bottom: 4px; }
    .meta { color: #666; font-size: 11px; margin-bottom: 16px; }
    table { width: 100%; border-collapse: collapse; }
    th, td { border: 1px solid #333; padding: 8px; text-align: left; }
    th { background: #f0f0f0; font-weight: 600; }
    .total-row { font-weight: bold; background: #f5f5f5; }
    .total-row td { border-top: 2px solid #333; }
    @media print { body { margin: 0; } }
  </style>
</head>
<body>
  <h1>Sales History</h1>
  <div class="meta">${activeRangeLabel ? `Period: ${activeRangeLabel}` : "All time"} | Generated: ${new Date().toLocaleString()} | ${filteredSales.length} transaction(s)</div>
  <table>
    <thead>
      <tr>
        <th>Transaction ID</th>
        <th>Cashier</th>
        <th>Items</th>
        <th>Payment</th>
        <th>Date & Time</th>
        <th style="text-align:right;">Total</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
    <tfoot>
      <tr class="total-row">
        <td colspan="5">Total</td>
        <td style="text-align:right;">${formatCurrency(totalAmount)}</td>
      </tr>
    </tfoot>
  </table>
</body>
</html>`;
    const win = window.open("", "_blank");
    if (win) {
      win.document.write(html);
      win.document.close();
      win.focus();
      setTimeout(() => {
        win.print();
        win.close();
      }, 250);
    }
  };

  const truncateLabel = (value: string, maxLength = 12) =>
    value.length > maxLength ? `${value.slice(0, maxLength)}...` : value;

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold">Sales History</h1>
          <p className="text-muted-foreground">
            View and manage your sales transactions{activeRangeLabel ? ` (${activeRangeLabel})` : ""}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            className="gap-2 flex-1 md:flex-none"
            disabled={filteredSales.length === 0}
            onClick={handlePrint}
          >
            <Printer className="w-4 h-4" />
            Print
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="gap-2 flex-1 md:flex-none" disabled={exporting}>
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
          <Dialog open={filterOpen} onOpenChange={setFilterOpen}>
            <Button
              variant="outline"
              className="gap-2 w-full md:w-auto"
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
                      setQuickRange("all");
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
                      setQuickRange("custom");
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

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {(() => {
          const comparison = formatComparison(
            comparativeSales.today,
            comparativeSales.yesterday
          );
          return (
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Today vs Yesterday
                </CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {formatCurrency(comparativeSales.today)}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  vs {formatCurrency(comparativeSales.yesterday)}
                </p>
                <p className={`text-xs mt-1 ${comparison.diffClass}`}>
                  {formatCurrency(comparison.diff)} ({comparison.percentLabel})
                </p>
              </CardContent>
            </Card>
          );
        })()}
        {(() => {
          const comparison = formatComparison(
            comparativeSales.thisMonth,
            comparativeSales.lastMonth
          );
          return (
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  This Month vs Last Month
                </CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {formatCurrency(comparativeSales.thisMonth)}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  vs {formatCurrency(comparativeSales.lastMonth)}
                </p>
                <p className={`text-xs mt-1 ${comparison.diffClass}`}>
                  {formatCurrency(comparison.diff)} ({comparison.percentLabel})
                </p>
              </CardContent>
            </Card>
          );
        })()}
        {(() => {
          const comparison = formatComparison(
            comparativeSales.thisYear,
            comparativeSales.lastYear
          );
          return (
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  This Year vs Last Year
                </CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {formatCurrency(comparativeSales.thisYear)}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  vs {formatCurrency(comparativeSales.lastYear)}
                </p>
                <p className={`text-xs mt-1 ${comparison.diffClass}`}>
                  {formatCurrency(comparison.diff)} ({comparison.percentLabel})
                </p>
              </CardContent>
            </Card>
          );
        })()}
      </div>

      <Card>
        <CardHeader className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Sales Over Time
          </CardTitle>
          <div className="flex flex-wrap gap-2">
            <Button
              variant={quickRange === "today" ? "default" : "outline"}
              size="sm"
              onClick={() => applyQuickRange("today")}
            >
              Today
            </Button>
            <Button
              variant={quickRange === "week" ? "default" : "outline"}
              size="sm"
              onClick={() => applyQuickRange("week")}
            >
              Week
            </Button>
            <Button
              variant={quickRange === "month" ? "default" : "outline"}
              size="sm"
              onClick={() => applyQuickRange("month")}
            >
              Month
            </Button>
            <Button
              variant={quickRange === "year" ? "default" : "outline"}
              size="sm"
              onClick={() => applyQuickRange("year")}
            >
              Year
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {salesOverTimeData.length ? (
            <ChartContainer config={salesOverTimeChartConfig} className="h-64 w-full">
              <LineChart data={salesOverTimeData} margin={{ left: 12, right: 12 }}>
                <CartesianGrid vertical={false} />
                <XAxis
                  dataKey="label"
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                  interval="preserveStartEnd"
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                  tickFormatter={(value) => formatCurrency(Number(value))}
                />
                <ChartTooltip
                  cursor={false}
                  content={
                    <ChartTooltipContent
                      labelKey="label"
                      formatter={(value) => formatCurrency(Number(value))}
                    />
                  }
                />
                <Line
                  dataKey="total"
                  type="monotone"
                  stroke="var(--color-total)"
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ChartContainer>
          ) : (
            <p className="text-sm text-muted-foreground">No sales data available yet.</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Top Sales
          </CardTitle>
          <div className="flex flex-wrap gap-2">
            <Button
              variant={quickRange === "today" ? "default" : "outline"}
              size="sm"
              onClick={() => applyQuickRange("today")}
            >
              Today
            </Button>
            <Button
              variant={quickRange === "week" ? "default" : "outline"}
              size="sm"
              onClick={() => applyQuickRange("week")}
            >
              Week
            </Button>
            <Button
              variant={quickRange === "month" ? "default" : "outline"}
              size="sm"
              onClick={() => applyQuickRange("month")}
            >
              Month
            </Button>
            <Button
              variant={quickRange === "year" ? "default" : "outline"}
              size="sm"
              onClick={() => applyQuickRange("year")}
            >
              Year
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {topSalesData.length ? (
            <ChartContainer config={topSalesChartConfig} className="h-64 w-full">
              <BarChart data={topSalesData} margin={{ left: 12, right: 12 }}>
                <XAxis
                  dataKey="name"
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                  interval={0}
                  tickFormatter={(value) => truncateLabel(String(value))}
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                  tickFormatter={(value) => formatCurrency(Number(value))}
                />
                <ChartTooltip
                  cursor={false}
                  content={
                    <ChartTooltipContent
                      labelKey="name"
                      formatter={(value) => formatCurrency(Number(value))}
                    />
                  }
                />
                <Bar dataKey="salesAmount" fill="var(--color-salesAmount)" radius={6} />
              </BarChart>
            </ChartContainer>
          ) : (
            <p className="text-sm text-muted-foreground">No sales data available yet.</p>
          )}
        </CardContent>
      </Card>

      <div className="space-y-4">
        {loading && <p className="text-sm text-muted-foreground">Loading sales...</p>}
        {error && !loading && (
          <p className="text-sm text-destructive">Failed to load: {error}</p>
        )}
        {!loading && !error && (
          <>
            <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
              <div className="flex-1 min-w-[200px] space-y-1.5">
                <Label htmlFor="sales-table-search" className="text-xs text-muted-foreground">
                  Search
                </Label>
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="sales-table-search"
                    placeholder="Transaction ID or cashier"
                    value={tableSearch}
                    onChange={(e) => setTableSearch(e.target.value)}
                    className="pl-9"
                  />
                </div>
              </div>
              <div className="w-full sm:w-[160px] space-y-1.5">
                <Label className="text-xs text-muted-foreground">Payment</Label>
                <Select value={paymentFilter} onValueChange={(v) => setPaymentFilter(v as "all" | "cash" | "gcash")}>
                  <SelectTrigger>
                    <SelectValue placeholder="Payment" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All methods</SelectItem>
                    <SelectItem value="cash">Cash</SelectItem>
                    <SelectItem value="gcash">GCash</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="w-full sm:w-[180px] space-y-1.5">
                <Label className="text-xs text-muted-foreground">Status</Label>
                <Select
                  value={voidStatusFilter}
                  onValueChange={(v) => setVoidStatusFilter(v as "all" | "active" | "voided")}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All transactions</SelectItem>
                    <SelectItem value="active">Non-voided</SelectItem>
                    <SelectItem value="voided">Voided</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            {filteredSales.length > 0 && (
              <p className="text-xs text-muted-foreground">
                Showing {(currentPage - 1) * ITEMS_PER_PAGE + 1}–
                {Math.min(currentPage * ITEMS_PER_PAGE, filteredSales.length)} of {filteredSales.length}
              </p>
            )}

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
                  {filteredSales.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                        No transactions match your filters
                      </TableCell>
                    </TableRow>
                  ) : (
                    paginatedSales.map((sale) => (
                      <TableRow key={sale.id}>
                        <TableCell className="font-mono">
                          <div className="flex items-center gap-2 flex-wrap">
                            #{String(sale.id).slice(-6).padStart(6, "0")}
                            {isVoidedSale(sale) && (
                              <Badge variant="secondary" className="text-xs">
                                Voided
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>{sale.cashierName}</TableCell>
                        <TableCell>{sale.items?.length ?? 0} items</TableCell>
                        <TableCell className="capitalize">{sale.paymentMethod}</TableCell>
                        <TableCell>
                          {new Date(sale.createdAt).toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right font-bold">
                          {formatCurrency(sale.total)}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1 flex-wrap">
                            <Button variant="ghost" size="sm" onClick={() => openSaleDetails(sale)}>
                              View Details
                            </Button>
                            {dataService.voidSale && !isVoidedSale(sale) && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-destructive hover:text-destructive"
                                onClick={() => confirmVoid(sale)}
                              >
                                Void
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>

            {filteredSales.length > 0 && (
              <div className="hidden md:flex items-center justify-center gap-2 py-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={currentPage <= 1}
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-sm text-muted-foreground px-2">
                  Page {currentPage} of {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={currentPage >= totalPages}
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            )}

            {/* Mobile View */}
            <div className="grid grid-cols-1 gap-4 md:hidden">
              {filteredSales.length === 0 ? (
                <p className="text-center py-8 text-muted-foreground rounded-lg border bg-card">
                  No transactions match your filters
                </p>
              ) : (
                paginatedSales.map((sale) => (
                  <div key={sale.id} className="bg-card rounded-lg border p-4 space-y-3 shadow-sm">
                    <div className="flex justify-between items-center gap-2">
                      <div>
                        <p className="font-mono text-sm font-bold flex items-center gap-2 flex-wrap">
                          #{String(sale.id).slice(-6).padStart(6, "0")}
                          {isVoidedSale(sale) && (
                            <Badge variant="secondary" className="text-[10px]">
                              Voided
                            </Badge>
                          )}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(sale.createdAt).toLocaleString()}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
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

                    <div className="flex justify-end gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1"
                        onClick={() => openSaleDetails(sale)}
                      >
                        View Details
                      </Button>
                      {dataService.voidSale && !isVoidedSale(sale) && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1 text-destructive border-destructive hover:bg-destructive/10"
                          onClick={() => confirmVoid(sale)}
                        >
                          Void
                        </Button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>

            {filteredSales.length > 0 && (
              <div className="flex md:hidden items-center justify-center gap-2 py-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={currentPage <= 1}
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-sm text-muted-foreground px-2">
                  Page {currentPage} of {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={currentPage >= totalPages}
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            )}
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
                {(detailsSale.paymentMethod ?? "").toLowerCase() === "gcash" && detailsSale.gcashTransactionId && (
                  <div>
                    <p className="text-muted-foreground text-xs">GCash Transaction ID</p>
                    <p className="font-semibold font-mono text-sm">{detailsSale.gcashTransactionId}</p>
                  </div>
                )}
                <div>
                  <p className="text-muted-foreground text-xs">Total</p>
                  <p className="font-semibold">{formatCurrency(detailsSale.total)}</p>
                </div>
                {isVoidedSale(detailsSale) && (
                  <div>
                    <p className="text-muted-foreground text-xs">Status</p>
                    <Badge variant="secondary">Voided</Badge>
                  </div>
                )}
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
              {dataService.voidSale && !isVoidedSale(detailsSale) && (
                <div className="flex justify-end pt-4">
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => {
                      setDetailsOpen(false);
                      confirmVoid(detailsSale);
                    }}
                  >
                    <Ban className="w-4 h-4 mr-2" />
                    Void Transaction
                  </Button>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={voidConfirmOpen} onOpenChange={setVoidConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Void transaction?</AlertDialogTitle>
            <AlertDialogDescription>
              This will cancel the transaction and restore inventory. This action cannot be undone.
              {saleToVoid && (
                <span className="block mt-2 font-medium">
                  Transaction #{String(saleToVoid.id).slice(-6).padStart(6, "0")} - {formatCurrency(saleToVoid.total)}
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={voiding}>Cancel</AlertDialogCancel>
            <Button
              variant="destructive"
              onClick={() => void handleVoid()}
              disabled={voiding}
            >
              {voiding ? "Voiding..." : "Void"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Sales;
