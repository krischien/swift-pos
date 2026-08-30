import { Button } from "@/components/ui/button";
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
import {
  Receipt,
  TrendingUp,
  Calendar as CalendarIcon,
  Download,
  DollarSign,
  Printer,
  Ban,
  Search,
  Filter,
  ChevronLeft,
  ChevronRight,
  Users,
  Clock3,
  Package,
  Wallet,
} from "lucide-react";
import { Bar, BarChart, CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useDataLayer } from "@/contexts/DataLayerContext";
import { useStore } from "@/contexts/StoreContext";
import { isSaaS } from "@/config/appMode";
import { getSubscription } from "@/lib/saasSubscriptionApi";
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
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { DateRange } from "react-day-picker";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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

// Custom Peso Icon Component
const PesoIcon = ({ className }: { className?: string }) => (
  <span className={className} style={{ fontFamily: 'system-ui, sans-serif', fontWeight: 'bold' }}>
    ₱
  </span>
);

function escapeCsvCell(value: string | number | null | undefined): string {
  const s = value === null || value === undefined ? "" : String(value);
  if (/[",\r\n]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function downloadFilteredSalesCsv(rows: any[]) {
  const header = [
    "Transaction ID",
    "Ticket",
    "Cashier",
    "Payment",
    "Date & Time",
    "Sale Total",
    "Status",
    "Item",
    "Variant",
    "Qty",
    "Unit Price",
    "Line Subtotal",
  ];
  const bodyLines: string[] = [];
  for (const sale of rows) {
    const voided = (sale.status ?? "").toLowerCase() === "void";
    const txnDisplay = `#${String(sale.id).slice(-6).padStart(6, "0")}`;
    const base = [
      escapeCsvCell(txnDisplay),
      escapeCsvCell(sale.ticketNumber ?? ""),
      escapeCsvCell(sale.cashierName ?? ""),
      escapeCsvCell((sale.paymentMethod ?? "cash").toString()),
      escapeCsvCell(new Date(sale.createdAt).toLocaleString()),
      escapeCsvCell(formatCurrency(sale.total ?? 0)),
      escapeCsvCell(voided ? "Voided" : "Active"),
    ];
    const items = Array.isArray(sale.items) ? sale.items : [];
    if (items.length === 0) {
      bodyLines.push(
        [...base, escapeCsvCell(""), escapeCsvCell(""), escapeCsvCell(""), escapeCsvCell(""), escapeCsvCell("")].join(
          ",",
        ),
      );
      continue;
    }
    for (const item of items) {
      bodyLines.push(
        [
          ...base,
          escapeCsvCell(item.productName ?? ""),
          escapeCsvCell(item.variantName ?? ""),
          escapeCsvCell(item.quantity ?? ""),
          escapeCsvCell(formatCurrency(item.price ?? 0)),
          escapeCsvCell(formatCurrency(item.subtotal ?? 0)),
        ].join(","),
      );
    }
  }
  const lines = [header.map((h) => escapeCsvCell(h)).join(","), ...bodyLines];
  const stamp = format(new Date(), "yyyy-MM-dd-HHmm");
  const blob = new Blob(["\uFEFF" + lines.join("\r\n")], {
    type: "text/csv;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `sales-transactions-${stamp}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

const Sales = () => {
  const dataService = useDataLayer();
  const { activeStoreId } = useStore();
  const { data: subscription } = useQuery({
    queryKey: ["subscription"],
    queryFn: getSubscription,
    enabled: isSaaS(),
    staleTime: 60_000,
  });
  const canExcel = !isSaaS() || !!subscription?.features.excelExport;
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
  const [searchQuery, setSearchQuery] = useState("");
  const [paymentFilter, setPaymentFilter] = useState<string>("all");
  type SaleVoidFilter = "active" | "voided" | "all";
  const [voidFilter, setVoidFilter] = useState<SaleVoidFilter>("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(25);
  const [txnRangeOpen, setTxnRangeOpen] = useState(false);
  const [calendarRange, setCalendarRange] = useState<DateRange | undefined>();

  type ExportRange = "today" | "weekly" | "monthly" | "quarterly" | "annual";
  type QuickRange = "all" | "today" | "week" | "month" | "year" | "custom";
  const [quickRange, setQuickRange] = useState<QuickRange>("all");

  const loadSales = async (from?: string, to?: string) => {
    try {
      setLoading(true);
      setError(null);
      const [salesData, productsData] = await Promise.all([
        dataService.getSales({ from, to, voidFilter }),
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

  const getCurrentSalesRangeParams = (): { from?: string; to?: string } => {
    if (quickRange === "custom") {
      return {
        from: fromDate ? new Date(fromDate).toISOString() : undefined,
        to: toDate ? new Date(toDate).toISOString() : undefined,
      };
    }
    const { from, to } = getQuickRangeBounds(quickRange);
    return { from: from?.toISOString(), to: to?.toISOString() };
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

  const applyCustomDateRange = (opts?: { fromDateStr: string; toDateStr: string }) => {
    const f = opts?.fromDateStr ?? fromDate;
    const t = opts?.toDateStr ?? toDate;
    const from = f ? new Date(f).toISOString() : undefined;
    const to = t ? new Date(t).toISOString() : undefined;
    setQuickRange("custom");
    if (opts) {
      setFromDate(opts.fromDateStr);
      setToDate(opts.toDateStr);
    }
    void loadSales(from, to);
    setActiveRangeLabel(f || t ? `${f || "…"} – ${t || "…"}` : "All time");
  };

  const clearDateRangeFilter = () => {
    setFromDate("");
    setToDate("");
    setQuickRange("all");
    setActiveRangeLabel("All time");
    setCalendarRange(undefined);
    void loadSales();
  };

  const handleTxnRangeOpenChange = (open: boolean) => {
    setTxnRangeOpen(open);
    if (open) {
      setCalendarRange({
        from: fromDate ? new Date(`${fromDate}T12:00:00`) : undefined,
        to: toDate ? new Date(`${toDate}T12:00:00`) : undefined,
      });
    }
  };

  const handleApplyTxnCalendarRange = () => {
    if (!calendarRange?.from) {
      setTxnRangeOpen(false);
      return;
    }
    const fromStr = format(calendarRange.from, "yyyy-MM-dd");
    const toStr = calendarRange.to ? format(calendarRange.to, "yyyy-MM-dd") : fromStr;
    applyCustomDateRange({ fromDateStr: fromStr, toDateStr: toStr });
    setTxnRangeOpen(false);
  };

  const txnRangeButtonLabel = useMemo(() => {
    if (quickRange === "custom" && fromDate && toDate) {
      return `${format(new Date(`${fromDate}T12:00:00`), "MMM d, yyyy")} – ${format(new Date(`${toDate}T12:00:00`), "MMM d, yyyy")}`;
    }
    if (activeRangeLabel && activeRangeLabel !== "All time") return activeRangeLabel;
    return "Select date range";
  }, [quickRange, fromDate, toDate, activeRangeLabel]);

  const handleExport = async (range: ExportRange) => {
    try {
      setExporting(true);
      const { fromISO, toISO, label } = getRangeForExport(range);

      const [salesData, productsData] = await Promise.all([
        dataService.getSales({ from: fromISO, to: toISO, voidFilter: "active" }),
        dataService.getProducts(),
      ]);

      const salesArr = salesData as any[];
      const productsArr = productsData as any[];

      const rowsMap = new Map<string, any>();

      for (const sale of salesArr) {
        for (const item of sale.items ?? []) {
          if (item.menuItemId) {
            const key = `menu-${item.menuItemId}-${item.variantId || "base"}`;
            const existing = rowsMap.get(key) || {
              kind: "menu" as const,
              menuItemId: item.menuItemId,
              label: item.productName ?? "",
              quantitySold: 0,
              salesAmount: 0,
            };
            existing.quantitySold += item.quantity;
            existing.salesAmount += item.subtotal;
            if (!existing.label && item.productName) existing.label = item.productName;
            rowsMap.set(key, existing);
            continue;
          }
          if (!item.productId) continue;
          const key = `${item.productId}-${item.variantId || "base"}`;
          const existing = rowsMap.get(key) || {
            kind: "product" as const,
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
        if (value.kind === "menu") {
          rows.push({
            ItemCode: "",
            ProductName: value.label || "Menu item",
            VariantName: "",
            Category: "Menu",
            DateRange: label,
            QuantitySold: value.quantitySold,
            SalesAmount: value.salesAmount,
            ApproxOpeningStock: "",
            ClosingStock: "",
          });
          return;
        }
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

  /** Non-voided sales only — used for dashboard metrics & charts (voided excluded). */
  const salesNonVoid = useMemo(
    () => sales.filter((s) => (s.status ?? "").toLowerCase() !== "void"),
    [sales],
  );

  /** Top KPI row is labeled “Today’s …” — must use calendar today only, not all loaded rows (load can be all-time). */
  const salesTodayNonVoid = useMemo(() => {
    const now = new Date();
    const from = startOfDay(now);
    const to = endOfDay(now);
    return salesNonVoid.filter((s) => {
      const d = new Date(s.createdAt);
      return d >= from && d <= to;
    });
  }, [salesNonVoid]);

  const stats = useMemo(() => {
    if (!salesTodayNonVoid.length) {
      return [
        { title: "Today's Sales", value: formatCurrency(0), icon: PesoIcon, trend: "" },
        { title: "Transactions", value: "0", icon: Receipt, trend: "" },
        { title: "Average Sale", value: formatCurrency(0), icon: TrendingUp, trend: "" },
        { title: "Total Profit", value: formatCurrency(0), icon: DollarSign, trend: "" },
      ];
    }

    const total = salesTodayNonVoid.reduce((sum, s) => sum + s.total, 0);
    const count = salesTodayNonVoid.length;
    const avg = total / count;

    let totalProfit = 0;
    for (const sale of salesTodayNonVoid) {
      if (!sale.items || sale.items.length === 0) continue;

      for (const item of sale.items) {
        if (!item.productId || item.menuItemId) continue;
        const product = products.find((p) => p.id === item.productId);
        if (!product) continue;

        const marginPercent = product.marginPercentage ?? 0;
        if (marginPercent === 0 || marginPercent === null || marginPercent === undefined) continue;

        const sellingPrice = item.price;
        if (!sellingPrice || sellingPrice <= 0) continue;

        const basePrice = sellingPrice / (1 + marginPercent / 100);
        const profitPerUnit = (basePrice * marginPercent) / 100;
        totalProfit += profitPerUnit * item.quantity;
      }
    }

    return [
      { title: "Today's Sales", value: formatCurrency(total), icon: PesoIcon, trend: "" },
      { title: "Transactions", value: `${count}`, icon: Receipt, trend: "" },
      { title: "Average Sale", value: formatCurrency(avg), icon: TrendingUp, trend: "" },
      { title: "Total Profit", value: formatCurrency(totalProfit), icon: DollarSign, trend: "" },
    ];
  }, [salesTodayNonVoid, products]);

  const dailyOperationalInsights = useMemo(() => {
    const totalItemsSold = salesTodayNonVoid.reduce((sum, sale) => {
      const qty = (sale.items ?? []).reduce(
        (itemSum: number, item: { quantity?: number }) => itemSum + (item.quantity ?? 0),
        0,
      );
      return sum + qty;
    }, 0);

    const paymentTotals = new Map<string, number>();
    for (const sale of salesTodayNonVoid) {
      const method = (sale.paymentMethod || "cash").toString().toLowerCase();
      paymentTotals.set(method, (paymentTotals.get(method) ?? 0) + (sale.total ?? 0));
    }
    const paymentEntries = Array.from(paymentTotals.entries()).sort((a, b) => b[1] - a[1]);
    const topPaymentMethod = paymentEntries[0];

    const cashierTotals = new Map<string, number>();
    for (const sale of salesTodayNonVoid) {
      const cashier = (sale.cashierName ?? "Unknown cashier").toString();
      cashierTotals.set(cashier, (cashierTotals.get(cashier) ?? 0) + (sale.total ?? 0));
    }
    const topCashierEntry = Array.from(cashierTotals.entries()).sort((a, b) => b[1] - a[1])[0];

    const hourlyCounts = new Map<string, number>();
    for (const sale of salesTodayNonVoid) {
      const hourLabel = format(new Date(sale.createdAt), "ha");
      hourlyCounts.set(hourLabel, (hourlyCounts.get(hourLabel) ?? 0) + 1);
    }
    const peakHourEntry = Array.from(hourlyCounts.entries()).sort((a, b) => b[1] - a[1])[0];

    return [
      {
        title: "Items Sold Today",
        value: `${totalItemsSold}`,
        helper: `${salesTodayNonVoid.length} sale(s)`,
        icon: Package,
      },
      {
        title: "Top Payment Method",
        value: topPaymentMethod ? topPaymentMethod[0].toUpperCase() : "—",
        helper: topPaymentMethod ? formatCurrency(topPaymentMethod[1]) : formatCurrency(0),
        icon: Wallet,
      },
      {
        title: "Top Cashier Today",
        value: topCashierEntry ? topCashierEntry[0] : "—",
        helper: topCashierEntry ? formatCurrency(topCashierEntry[1]) : formatCurrency(0),
        icon: Users,
      },
      {
        title: "Peak Hour Today",
        value: peakHourEntry ? peakHourEntry[0] : "—",
        helper: peakHourEntry ? `${peakHourEntry[1]} transaction(s)` : "No transactions yet",
        icon: Clock3,
      },
    ];
  }, [salesTodayNonVoid]);

  const comparativeSales = useMemo(() => {
    const now = new Date();
    const sumRange = (from: Date, to: Date) =>
      salesNonVoid.reduce((sum, sale) => {
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
  }, [salesNonVoid]);

  const topSalesData = useMemo(() => {
    const rowsMap = new Map<
      string,
      { name: string; salesAmount: number; quantitySold: number }
    >();

    for (const sale of salesNonVoid) {
      for (const item of sale.items ?? []) {
        const product = item.productId ? products.find((p) => p.id === item.productId) : undefined;
        const baseName = item.productName || product?.name || "Unknown Item";
        const variantName = item.variantName ? ` - ${item.variantName}` : "";
        const name = `${baseName}${variantName}`;
        const key = item.menuItemId
          ? `menu-${item.menuItemId}-${item.variantId || "base"}`
          : `${item.productId}-${item.variantId || "base"}`;
        const current = rowsMap.get(key) ?? { name, salesAmount: 0, quantitySold: 0 };
        current.salesAmount += item.subtotal ?? item.price * item.quantity;
        current.quantitySold += item.quantity ?? 0;
        rowsMap.set(key, current);
      }
    }

    return Array.from(rowsMap.values())
      .sort((a, b) => b.salesAmount - a.salesAmount)
      .slice(0, 5);
  }, [salesNonVoid, products]);

  const topSalesChartConfig = {
    salesAmount: {
      label: "Sales",
      color: "hsl(var(--primary))",
    },
  } as const;

  const paymentMethods = useMemo(() => {
    const methods = new Set<string>(["cash", "gcash"]);
    for (const sale of sales) {
      const m = (sale.paymentMethod || "cash").toString().toLowerCase();
      if (m) methods.add(m);
    }
    return Array.from(methods).sort((a, b) => (a === "cash" ? -1 : b === "cash" ? 1 : a.localeCompare(b)));
  }, [sales]);

  const filteredSales = useMemo(() => {
    let result = sales;

    if (paymentFilter && paymentFilter !== "all") {
      result = result.filter((s) => (s.paymentMethod || "cash").toString().toLowerCase() === paymentFilter.toLowerCase());
    }

    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      const digitsOnly = q.replace(/\D/g, "");
      result = result.filter((sale) => {
        const cashier = (sale.cashierName ?? "").toLowerCase();
        const ticket = (sale.ticketNumber ?? "").toLowerCase();
        const txnId = String(sale.id).slice(-6).padStart(6, "0");
        const fullId = String(sale.id).toLowerCase();
        const amountStr = String(sale.total ?? 0);
        const matchesTxn = fullId.includes(q) || txnId.includes(digitsOnly) || txnId.includes(q);
        const matchesAmount = amountStr.includes(q) || amountStr.includes(digitsOnly);
        const matchesCashier = cashier.includes(q);
        const matchesTicket = ticket.includes(q);
        return matchesTxn || matchesAmount || matchesCashier || matchesTicket;
      });
    }

    return result;
  }, [sales, searchQuery, paymentFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredSales.length / itemsPerPage));
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedSales = filteredSales.slice(startIndex, startIndex + itemsPerPage);

  useEffect(() => {
    if (currentPage > totalPages && totalPages > 0) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const salesOverTimeData = useMemo(() => {
    if (!salesNonVoid.length) {
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
      const timestamps = salesNonVoid
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

    for (const sale of salesNonVoid) {
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
  }, [salesNonVoid, quickRange, fromDate, toDate]);

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
      const { from, to } = getCurrentSalesRangeParams();
      void loadSales(from, to);
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
    const toPrint = searchQuery || paymentFilter !== "all" ? filteredSales : sales;
    const rows = toPrint
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
    const totalAmount = toPrint.reduce((sum, s) => sum + (s.total ?? 0), 0);
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
  <div class="meta">${activeRangeLabel ? `Period: ${activeRangeLabel}` : "All time"} | Generated: ${new Date().toLocaleString()} | ${toPrint.length} transaction(s)</div>
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
          <p className="text-xs text-muted-foreground mt-1">
            Dashboard metrics and charts exclude voided sales. The table can show all, non-voided, or voided only.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            className="gap-2 flex-1 md:flex-none"
            disabled={sales.length === 0}
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
              <DropdownMenuItem
                disabled={!canExcel}
                onClick={() => canExcel && handleExport("today")}
              >
                Today{!canExcel ? " (Negosyo+)" : ""}
              </DropdownMenuItem>
              <DropdownMenuItem
                disabled={!canExcel}
                onClick={() => canExcel && handleExport("weekly")}
              >
                This Week{!canExcel ? " (Negosyo+)" : ""}
              </DropdownMenuItem>
              <DropdownMenuItem
                disabled={!canExcel}
                onClick={() => canExcel && handleExport("monthly")}
              >
                This Month{!canExcel ? " (Negosyo+)" : ""}
              </DropdownMenuItem>
              <DropdownMenuItem
                disabled={!canExcel}
                onClick={() => canExcel && handleExport("quarterly")}
              >
                This Quarter{!canExcel ? " (Negosyo+)" : ""}
              </DropdownMenuItem>
              <DropdownMenuItem
                disabled={!canExcel}
                onClick={() => canExcel && handleExport("annual")}
              >
                This Year{!canExcel ? " (Negosyo+)" : ""}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Dialog open={filterOpen} onOpenChange={setFilterOpen}>
            <Button
              variant="outline"
              className="gap-2 w-full md:w-auto"
              onClick={() => setFilterOpen(true)}
            >
              <CalendarIcon className="w-4 h-4" />
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
                      clearDateRangeFilter();
                      setFilterOpen(false);
                    }}
                  >
                    Clear
                  </Button>
                  <Button
                    onClick={() => {
                      applyCustomDateRange();
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
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-4" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-20 mb-2" />
                <Skeleton className="h-3 w-28" />
              </CardContent>
            </Card>
          ))
        ) : (
          stats.map((stat) => {
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
          })
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <Card key={`daily-op-${i}`}>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-4 w-4" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-7 w-24 mb-2" />
                <Skeleton className="h-3 w-32" />
              </CardContent>
            </Card>
          ))
        ) : (
          dailyOperationalInsights.map((insight) => {
            const Icon = insight.icon;
            return (
              <Card key={insight.title}>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    {insight.title}
                  </CardTitle>
                  <Icon className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{insight.value}</div>
                  <p className="text-xs text-muted-foreground mt-1">{insight.helper}</p>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {loading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <Card key={i}>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <Skeleton className="h-4 w-36" />
                <Skeleton className="h-4 w-4" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-24 mb-2" />
                <Skeleton className="h-3 w-28 mb-1" />
                <Skeleton className="h-3 w-20" />
              </CardContent>
            </Card>
          ))
        ) : (
        <>
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
        </>
        )}
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
        {!error && (
          <div className="flex flex-wrap items-center gap-2 justify-between">
            <Popover open={txnRangeOpen} onOpenChange={handleTxnRangeOpenChange}>
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-2 max-w-[min(100vw-2rem,320px)]"
                  disabled={loading}
                >
                  <CalendarIcon className="h-4 w-4 shrink-0" />
                  <span className="truncate">{txnRangeButtonLabel}</span>
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto max-w-[calc(100vw-1.5rem)] p-0" align="start">
                <Calendar
                  mode="range"
                  defaultMonth={calendarRange?.from ?? calendarRange?.to ?? new Date()}
                  selected={calendarRange}
                  onSelect={setCalendarRange}
                  numberOfMonths={2}
                  className="p-2 sm:p-3"
                />
                <div className="flex flex-wrap justify-end gap-2 border-t p-3">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      clearDateRangeFilter();
                      setTxnRangeOpen(false);
                    }}
                  >
                    Clear
                  </Button>
                  <Button type="button" size="sm" onClick={handleApplyTxnCalendarRange}>
                    Apply
                  </Button>
                </div>
              </PopoverContent>
            </Popover>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-2 shrink-0"
              disabled={loading || filteredSales.length === 0}
              onClick={() => downloadFilteredSalesCsv(filteredSales)}
            >
              <Download className="h-4 w-4" />
              Export to CSV
            </Button>
          </div>
        )}
        {!loading && !error && (
          <div className="flex flex-col gap-3 lg:flex-row lg:flex-wrap lg:items-end">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Search by transaction ID, ticket, cashier, or amount..."
                value={searchQuery}
                onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
                className="pl-9"
              />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground shrink-0 hidden sm:block" />
              <Select value={paymentFilter} onValueChange={(v) => { setPaymentFilter(v); setCurrentPage(1); }}>
                <SelectTrigger className="w-[min(100vw-2rem,180px)] sm:w-[160px]">
                  <SelectValue placeholder="Payment" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All payments</SelectItem>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="gcash">GCash</SelectItem>
                  {paymentMethods
                    .filter((m) => m !== "cash" && m !== "gcash")
                    .map((m) => (
                      <SelectItem key={m} value={m}>
                        {m.charAt(0).toUpperCase() + m.slice(1)}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
              <Select
                value={voidFilter}
                onValueChange={(v) => {
                  setVoidFilter(v as SaleVoidFilter);
                  setCurrentPage(1);
                  const { from, to } = getCurrentSalesRangeParams();
                  void loadSales(from, to);
                }}
              >
                <SelectTrigger className="w-[min(100vw-2rem,200px)] sm:w-[200px]">
                  <SelectValue placeholder="Void status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All (incl. voided)</SelectItem>
                  <SelectItem value="active">Non-voided only</SelectItem>
                  <SelectItem value="voided">Voided only</SelectItem>
                </SelectContent>
              </Select>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground whitespace-nowrap">Per page</span>
                <Select value={String(itemsPerPage)} onValueChange={(v) => { setItemsPerPage(Number(v)); setCurrentPage(1); }}>
                  <SelectTrigger className="w-20 h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[5, 10, 25, 50, 100].map((n) => (
                      <SelectItem key={n} value={String(n)}>{n}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        )}
        {loading && (
          <>
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
                  {Array.from({ length: 10 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-14" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-36" /></TableCell>
                      <TableCell className="text-right"><Skeleton className="h-4 w-16 ml-auto" /></TableCell>
                      <TableCell className="text-right"><Skeleton className="h-8 w-24 ml-auto" /></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <div className="grid grid-cols-1 gap-4 md:hidden">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="bg-card rounded-lg border p-4 space-y-3 shadow-sm">
                  <div className="flex justify-between items-center">
                    <div className="space-y-2">
                      <Skeleton className="h-4 w-20" />
                      <Skeleton className="h-3 w-32" />
                    </div>
                    <div className="space-y-1 text-right">
                      <Skeleton className="h-5 w-16 ml-auto" />
                      <Skeleton className="h-3 w-12 ml-auto" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4 pt-3 border-t">
                    <div className="space-y-1">
                      <Skeleton className="h-3 w-12" />
                      <Skeleton className="h-4 w-20" />
                    </div>
                    <div className="space-y-1 text-right">
                      <Skeleton className="h-3 w-12 ml-auto" />
                      <Skeleton className="h-4 w-8 ml-auto" />
                    </div>
                  </div>
                  <div className="flex justify-end gap-2 pt-2 border-t">
                    <Skeleton className="h-8 flex-1" />
                    <Skeleton className="h-8 flex-1" />
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
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
                  {filteredSales.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                        {sales.length === 0 ? "No transactions yet" : "No transactions match your search or filter"}
                      </TableCell>
                    </TableRow>
                  ) : (
                  paginatedSales.map((sale) => {
                    const voided = (sale.status ?? "").toLowerCase() === "void";
                    return (
                    <TableRow key={sale.id} className={voided ? "opacity-80" : undefined}>
                      <TableCell className="font-mono">
                        <div className="flex flex-wrap items-center gap-2">
                          <span>#{String(sale.id).slice(-6).padStart(6, "0")}</span>
                          {voided && <Badge variant="destructive">Voided</Badge>}
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
                          {dataService.voidSale && !voided && (
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
                    );
                  })
                  )}
                </TableBody>
              </Table>
            </div>

            {filteredSales.length > 0 && (
              <div className="hidden md:flex items-center justify-center gap-2 py-4">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={currentPage <= 1}
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <div className="flex items-center gap-1 flex-wrap justify-center">
                  {Array.from({ length: totalPages }, (_, i) => i + 1)
                    .filter((p) => p === 1 || p === totalPages || (p >= currentPage - 2 && p <= currentPage + 2))
                    .map((p, idx, arr) => (
                      <span key={p} className="flex items-center gap-1">
                        {idx > 0 && arr[idx - 1] !== p - 1 && <span className="px-1">…</span>}
                        <Button
                          variant={currentPage === p ? "default" : "outline"}
                          size="sm"
                          className="min-w-8 h-8 p-0"
                          onClick={() => setCurrentPage(p)}
                        >
                          {p}
                        </Button>
                      </span>
                    ))}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={currentPage >= totalPages}
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
                <span className="text-sm text-muted-foreground ml-2">
                  Page {currentPage} of {totalPages}
                </span>
              </div>
            )}

            {/* Mobile View */}
            <div className="grid grid-cols-1 gap-4 md:hidden">
              {filteredSales.length === 0 ? (
                <div className="text-center text-muted-foreground py-8 rounded-lg border bg-card">
                  {sales.length === 0 ? "No transactions yet" : "No transactions match your search or filter"}
                </div>
              ) : (
              paginatedSales.map((sale) => {
                const voided = (sale.status ?? "").toLowerCase() === "void";
                return (
                <div key={sale.id} className={`bg-card rounded-lg border p-4 space-y-3 shadow-sm ${voided ? "opacity-90" : ""}`}>
                  <div className="flex justify-between items-start gap-2">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-mono text-sm font-bold">
                          #{String(sale.id).slice(-6).padStart(6, "0")}
                        </p>
                        {voided && <Badge variant="destructive">Voided</Badge>}
                      </div>
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
                    {dataService.voidSale && !voided && (
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
                );
              })
              )}
            </div>

            {filteredSales.length > 0 && (
              <div className="flex md:hidden items-center justify-center gap-2 py-4 flex-wrap">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={currentPage <= 1}
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <div className="flex items-center gap-1 flex-wrap justify-center">
                  {Array.from({ length: totalPages }, (_, i) => i + 1)
                    .filter((p) => p === 1 || p === totalPages || (p >= currentPage - 2 && p <= currentPage + 2))
                    .map((p, idx, arr) => (
                      <span key={p} className="flex items-center gap-1">
                        {idx > 0 && arr[idx - 1] !== p - 1 && <span className="px-1">…</span>}
                        <Button
                          variant={currentPage === p ? "default" : "outline"}
                          size="sm"
                          className="min-w-8 h-8 p-0"
                          onClick={() => setCurrentPage(p)}
                        >
                          {p}
                        </Button>
                      </span>
                    ))}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={currentPage >= totalPages}
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
                <span className="text-sm text-muted-foreground w-full text-center">
                  Page {currentPage} of {totalPages}
                </span>
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
                <div>
                  <p className="text-muted-foreground text-xs">Status</p>
                  <p className="font-semibold">
                    {(detailsSale.status ?? "").toLowerCase() === "void" ? (
                      <Badge variant="destructive">Voided</Badge>
                    ) : (
                      "Active"
                    )}
                  </p>
                </div>
              </div>
              <div className="rounded-lg border">
                <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Item</TableHead>
                        <TableHead>Variant</TableHead>
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
                          </TableCell>
                          <TableCell className="text-muted-foreground text-sm">
                            {item.variantName ?? "—"}
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
              {dataService.voidSale && (detailsSale.status ?? "").toLowerCase() !== "void" && (
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
