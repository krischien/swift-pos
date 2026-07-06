import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Receipt,
  TrendingUp,
  AlertTriangle,
  Package,
  Calendar,
  Download,
  FileSpreadsheet,
  FileText,
  Loader2,
  ArrowUpRight,
  DollarSign,
  Ban,
  Search,
  Banknote,
  Smartphone,
  Building2,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useDataLayer } from "@/contexts/DataLayerContext";
import { useStore } from "@/contexts/StoreContext";
import { isSaaS } from "@/config/appMode";
import { getOrgStores } from "@/lib/saasOrgStoresApi";
import { formatCurrency } from "@/lib/currency";
import { PHP_DENOMINATIONS } from "@/lib/cashDenominations";
import { Product } from "@/types/pos";
import {
  buildAggregatedStockAlertLines,
  buildLowStockLineItems,
  buildOutOfStockLineItems,
  type StoreCatalogSlice,
} from "@/lib/inventoryStockStatus";
import { Input } from "@/components/ui/input";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  XAxis,
  YAxis,
} from "recharts";
import {
  eachDayOfInterval,
  endOfDay,
  endOfMonth,
  endOfYear,
  format,
  startOfDay,
  startOfMonth,
  startOfYear,
  subDays,
  subMonths,
  subYears,
} from "date-fns";

const PesoIcon = ({ className }: { className?: string }) => (
  <span className={className} style={{ fontFamily: "system-ui, sans-serif", fontWeight: "bold" }}>
    ₱
  </span>
);

const CHART_COLORS = [
  "hsl(var(--chart-1))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
  "hsl(var(--chart-6))",
  "hsl(var(--chart-7))",
  "hsl(var(--chart-8))",
  "hsl(var(--chart-9))",
  "hsl(var(--chart-10))",
];

type DateRangePreset = "today" | "7" | "30" | "90" | "all";

const Reports = () => {
  const dataService = useDataLayer();
  const { stores, storesLoading } = useStore();
  const [reportStores, setReportStores] = useState<Array<{ id: string; name: string }>>([]);
  const [reportStoresLoading, setReportStoresLoading] = useState(false);
  const [sales, setSales] = useState<any[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [datePreset, setDatePreset] = useState<DateRangePreset>("30");
  const [fromDate, setFromDate] = useState<string>("");
  const [toDate, setToDate] = useState<string>("");
  const [reportStoreId, setReportStoreId] = useState<string>("all");
  const [exporting, setExporting] = useState(false);
  const [voidCount, setVoidCount] = useState(0);
  const [comparisonSales, setComparisonSales] = useState<{
    today: number;
    yesterday: number;
    thisMonth: number;
    lastMonth: number;
    thisYear: number;
    lastYear: number;
  }>({
    today: 0,
    yesterday: 0,
    thisMonth: 0,
    lastMonth: 0,
    thisYear: 0,
    lastYear: 0,
  });
  const [denominationCounts, setDenominationCounts] = useState<Record<string, number>>({});
  const [gcashTransactionSearch, setGcashTransactionSearch] = useState("");
  const [allStoresCatalogs, setAllStoresCatalogs] = useState<StoreCatalogSlice[]>([]);

  const showStoreFilter = isSaaS();
  const storesToUse = reportStores.length > 0 ? reportStores : stores;
  const isMultiStoreView = showStoreFilter && reportStoreId === "all" && storesToUse.length > 1;
  const storeScopeKey = useMemo(
    () => storesToUse.map((s) => s.id).sort().join(","),
    [reportStores, stores],
  );

  // Fetch store list for filter: owners get all org stores, cashiers get their assigned stores
  useEffect(() => {
    if (!isSaaS() || !showStoreFilter) return;
    let cancelled = false;
    setReportStoresLoading(true);
    getOrgStores()
      .then((list) => {
        if (!cancelled) setReportStores(list.map((s) => ({ id: s.id, name: s.name })));
      })
      .catch(() => {
        if (!cancelled) setReportStores(stores);
      })
      .finally(() => {
        if (!cancelled) setReportStoresLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [showStoreFilter, storeScopeKey]);

  const getDateRange = useMemo(() => {
    const now = new Date();
    let from: Date;
    let to: Date;

    if (fromDate && toDate) {
      from = startOfDay(new Date(fromDate));
      to = endOfDay(new Date(toDate));
    } else {
      switch (datePreset) {
        case "today":
          from = startOfDay(now);
          to = endOfDay(now);
          break;
        case "7":
          from = startOfDay(subDays(now, 7));
          to = endOfDay(now);
          break;
        case "30":
          from = startOfDay(subDays(now, 30));
          to = endOfDay(now);
          break;
        case "90":
          from = startOfDay(subDays(now, 90));
          to = endOfDay(now);
          break;
        case "all":
        default:
          from = startOfDay(subYears(now, 1));
          to = endOfDay(now);
          break;
      }
    }

    return { from, to };
  }, [datePreset, fromDate, toDate]);

  const fetchSalesForRange = async (from: Date, to: Date): Promise<any[]> => {
    const params = { from: from.toISOString(), to: to.toISOString() };
    if (showStoreFilter && reportStoreId === "all" && storesToUse.length > 0) {
      const allSales: any[] = [];
      for (const store of storesToUse) {
        try {
          const salesData = await dataService.getSales(params, store.id);
          allSales.push(...((salesData as any[]) || []));
        } catch (err) {
          console.warn(`Failed to fetch sales for store ${store.name}:`, err);
        }
      }
      return allSales;
    }
    const storeId = showStoreFilter && reportStoreId !== "all" ? reportStoreId : undefined;
    const salesData = await dataService.getSales(params, storeId);
    return (salesData as any[]) || [];
  };

  const sumSales = (list: any[]) =>
    list.reduce((sum, s) => sum + (s.total ?? 0), 0);

  const loadData = async () => {
    try {
      setLoading(true);
      const { from, to } = getDateRange;
      const params = { from: from.toISOString(), to: to.toISOString() };

      const now = new Date();
      const yesterday = subDays(now, 1);
      const lastMonth = subMonths(now, 1);
      const lastYear = subYears(now, 1);

      const mainFetch = async () => {
        if (showStoreFilter && reportStoreId === "all" && storesToUse.length > 0) {
          const allSales: any[] = [];
          const allProducts: Product[] = [];
          const catalogs: StoreCatalogSlice[] = [];
          for (const store of storesToUse) {
            try {
              const [s, p] = await Promise.all([
                dataService.getSales(params, store.id),
                dataService.getProducts(undefined, store.id),
              ]);
              const list = (p as Product[]) || [];
              allSales.push(...((s as any[]) || []));
              allProducts.push(...list);
              catalogs.push({ storeId: store.id, storeName: store.name, products: list });
            } catch (err) {
              console.warn(`Failed to fetch data for store ${store.name}:`, err);
            }
          }
          return { sales: allSales, products: allProducts, allStoresCatalogs: catalogs };
        }
        const storeId = showStoreFilter && reportStoreId !== "all" ? reportStoreId : undefined;
        const [s, p] = await Promise.all([
          dataService.getSales(params, storeId),
          dataService.getProducts(undefined, storeId),
        ]);
        return { sales: (s as any[]) || [], products: (p as Product[]) || [], allStoresCatalogs: [] as StoreCatalogSlice[] };
      };

      const fetchVoidCount = async (): Promise<number> => {
        if (!dataService.getVoidCount) return 0;
        if (showStoreFilter && reportStoreId === "all" && storesToUse.length > 0) {
          let total = 0;
          for (const store of storesToUse) {
            try {
              total += await dataService.getVoidCount(params, store.id);
            } catch {
              /* ignore */
            }
          }
          return total;
        }
        const storeId = showStoreFilter && reportStoreId !== "all" ? reportStoreId : undefined;
        return dataService.getVoidCount(params, storeId) ?? 0;
      };

      const [main, voidCountResult] = await Promise.all([mainFetch(), fetchVoidCount()]);

      // Sequential comparison fetches — avoids dozens of concurrent SQLite reads in dev.
      const todaySales = await fetchSalesForRange(startOfDay(now), endOfDay(now));
      const yesterdaySales = await fetchSalesForRange(startOfDay(yesterday), endOfDay(yesterday));
      const thisMonthSales = await fetchSalesForRange(startOfMonth(now), endOfDay(now));
      const lastMonthSales = await fetchSalesForRange(startOfMonth(lastMonth), endOfMonth(lastMonth));
      const thisYearSales = await fetchSalesForRange(startOfYear(now), endOfDay(now));
      const lastYearSales = await fetchSalesForRange(startOfYear(lastYear), endOfYear(lastYear));

      setSales(main.sales);
      setProducts(main.products);
      setAllStoresCatalogs(main.allStoresCatalogs ?? []);
      setVoidCount(voidCountResult);
      setComparisonSales({
        today: sumSales(todaySales),
        yesterday: sumSales(yesterdaySales),
        thisMonth: sumSales(thisMonthSales),
        lastMonth: sumSales(lastMonthSales),
        thisYear: sumSales(thisYearSales),
        lastYear: sumSales(lastYearSales),
      });
    } catch (e: unknown) {
      console.error("Failed to load reports:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, [datePreset, fromDate, toDate, reportStoreId, storeScopeKey]);

  const stats = useMemo(() => {
    const total = sales.reduce((sum, s) => sum + (s.total ?? 0), 0);
    const count = sales.length;
    const avg = count > 0 ? total / count : 0;
    let profit = 0;
    for (const sale of sales) {
      for (const item of sale.items ?? []) {
        const product = products.find((p) => p.id === item.productId);
        const marginPercent = product?.marginPercentage ?? 0;
        if (marginPercent <= 0) continue;
        const subtotal = item.subtotal ?? item.price * item.quantity;
        profit += subtotal * (marginPercent / (100 + marginPercent));
      }
    }
    return [
      { title: "Total Sales", value: formatCurrency(total), desc: "For selected period", icon: PesoIcon },
      { title: "Net Profit", value: formatCurrency(profit), desc: "Profit for selected period", icon: DollarSign },
      { title: "Transactions", value: `${count}`, desc: "Total orders processed", icon: Receipt },
      { title: "Void Count", value: `${voidCount}`, desc: "Voided transactions", icon: Ban },
      { title: "Average Sale", value: formatCurrency(avg), desc: "Per transaction", icon: TrendingUp },
    ];
  }, [sales, products, voidCount]);

  const totalProfit = useMemo(() => {
    let profit = 0;
    for (const sale of sales) {
      for (const item of sale.items ?? []) {
        const product = products.find((p) => p.id === item.productId);
        const marginPercent = product?.marginPercentage ?? 0;
        if (marginPercent <= 0) continue;
        const subtotal = item.subtotal ?? item.price * item.quantity;
        profit += subtotal * (marginPercent / (100 + marginPercent));
      }
    }
    return profit;
  }, [sales, products]);

  const comparisonStats = useMemo(() => {
    const { today, yesterday, thisMonth, lastMonth, thisYear, lastYear } = comparisonSales;
    const diff = (curr: number, prev: number) => curr - prev;
    const diffLabel = (curr: number, prev: number) => {
      const d = diff(curr, prev);
      if (d === 0) return `${formatCurrency(d)} (-)`;
      const sign = d > 0 ? "+" : "";
      return `${sign}${formatCurrency(d)} (${d > 0 ? "↑" : "↓"})`;
    };
    return [
      {
        title: "Today vs Yesterday",
        current: today,
        previous: yesterday,
        diff: diff(today, yesterday),
      },
      {
        title: "This Month vs Last Month",
        current: thisMonth,
        previous: lastMonth,
        diff: diff(thisMonth, lastMonth),
      },
      {
        title: "This Year vs Last Year",
        current: thisYear,
        previous: lastYear,
        diff: diff(thisYear, lastYear),
      },
    ].map((s) => ({
      ...s,
      diffLabel: diffLabel(s.current, s.previous),
    }));
  }, [comparisonSales]);

  const topProductsData = useMemo(() => {
    const map = new Map<string, { name: string; value: number }>();
    for (const sale of sales) {
      for (const item of sale.items ?? []) {
        const product = products.find((p) => p.id === item.productId);
        const name = item.productName || product?.name || "Unknown";
        const key = `${item.productId}-${item.variantId || "base"}`;
        const current = map.get(key) ?? { name, value: 0 };
        current.value += item.subtotal ?? item.price * item.quantity;
        map.set(key, current);
      }
    }
    const arr = Array.from(map.values()).sort((a, b) => b.value - a.value).slice(0, 5);
    const total = arr.reduce((s, x) => s + x.value, 0);
    return arr.map((x) => ({ ...x, percent: total > 0 ? Math.round((x.value / total) * 100) : 0 }));
  }, [sales, products]);

  const peakHoursData = useMemo(() => {
    const map = new Map<string, number>();
    for (const sale of sales) {
      const d = new Date(sale.createdAt);
      const hour = format(d, "ha");
      map.set(hour, (map.get(hour) ?? 0) + 1);
    }
    const arr = Array.from(map.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);
    const total = arr.reduce((s, x) => s + x.value, 0);
    return arr.map((x) => ({ ...x, percent: total > 0 ? Math.round((x.value / total) * 100) : 0 }));
  }, [sales]);

  const paymentMethodsData = useMemo(() => {
    const map = new Map<string, number>();
    for (const sale of sales) {
      const method = (sale.paymentMethod || "cash").toString();
      map.set(method, (map.get(method) ?? 0) + sale.total);
    }
    const arr = Array.from(map.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
    const total = arr.reduce((s, x) => s + x.value, 0);
    return arr.map((x) => ({ ...x, percent: total > 0 ? Math.round((x.value / total) * 100) : 0 }));
  }, [sales]);

  const expectedCash = useMemo(() => {
    return sales
      .filter((s) => (s.paymentMethod || "cash").toString().toLowerCase() === "cash")
      .reduce((sum, s) => sum + (s.total ?? 0), 0);
  }, [sales]);

  const expectedCashByStore = useMemo(() => {
    if (!isMultiStoreView) return [];
    const map = new Map<string, number>();
    for (const s of storesToUse) map.set(s.id, 0);
    for (const sale of sales) {
      if ((sale.paymentMethod || "cash").toString().toLowerCase() !== "cash") continue;
      const sid = (sale as { storeId?: string }).storeId;
      if (sid) map.set(sid, (map.get(sid) ?? 0) + (sale.total ?? 0));
    }
    return storesToUse.map((s) => ({ name: s.name, value: map.get(s.id) ?? 0 }));
  }, [sales, isMultiStoreView, storesToUse]);

  const gcashTotal = useMemo(() => {
    return sales
      .filter((s) => (s.paymentMethod || "").toString().toLowerCase() === "gcash")
      .reduce((sum, s) => sum + (s.total ?? 0), 0);
  }, [sales]);

  const gcashTransactions = useMemo(() => {
    return sales
      .filter((s) => (s.paymentMethod || "").toString().toLowerCase() === "gcash")
      .map((s) => ({
        id: s.id,
        amount: s.total ?? 0,
        transactionId: (s as { gcashTransactionId?: string }).gcashTransactionId ?? "—",
        createdAt: s.createdAt,
        storeId: (s as { storeId?: string }).storeId,
      }))
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [sales]);

  const filteredGcashTransactions = useMemo(() => {
    if (!gcashTransactionSearch.trim()) return gcashTransactions;
    const q = gcashTransactionSearch.trim().toLowerCase();
    return gcashTransactions.filter((t) => t.transactionId.toLowerCase().includes(q));
  }, [gcashTransactions, gcashTransactionSearch]);

  const totalActualCash = useMemo(() => {
    return PHP_DENOMINATIONS.reduce((sum, d) => {
      const count = denominationCounts[String(d.value)] ?? 0;
      return sum + count * d.value;
    }, 0);
  }, [denominationCounts]);

  const cashCountVariance = expectedCash - totalActualCash;
  const isCashCountBalanced = Math.abs(cashCountVariance) < 0.01;

  const salesByStoreData = useMemo(() => {
    if (!isMultiStoreView) return [];
    const map = new Map<string, number>();
    for (const s of storesToUse) map.set(s.id, 0);
    for (const sale of sales) {
      const sid = (sale as { storeId?: string }).storeId;
      if (sid) map.set(sid, (map.get(sid) ?? 0) + (sale.total ?? 0));
    }
    const total = Array.from(map.values()).reduce((a, b) => a + b, 0);
    return storesToUse
      .map((s) => ({ name: s.name, value: map.get(s.id) ?? 0 }))
      .filter((x) => x.value > 0)
      .sort((a, b) => b.value - a.value)
      .map((x) => ({ ...x, percent: total > 0 ? Math.round((x.value / total) * 100) : 0 }));
  }, [sales, isMultiStoreView, storesToUse]);

  const storePerformanceRows = useMemo(() => {
    if (!isMultiStoreView) return [];
    const seed = new Map<string, { id: string; name: string; sales: number; transactions: number }>();
    for (const store of storesToUse) {
      seed.set(store.id, {
        id: store.id,
        name: store.name,
        sales: 0,
        transactions: 0,
      });
    }

    for (const sale of sales) {
      const storeId = (sale as { storeId?: string }).storeId;
      if (!storeId || !seed.has(storeId)) continue;
      const row = seed.get(storeId)!;
      row.sales += sale.total ?? 0;
      row.transactions += 1;
    }

    const totalSalesAcrossStores = Array.from(seed.values()).reduce((sum, row) => sum + row.sales, 0);
    return Array.from(seed.values())
      .filter((row) => row.sales > 0 || row.transactions > 0)
      .sort((a, b) => b.sales - a.sales)
      .map((row) => ({
        ...row,
        avgSale: row.transactions > 0 ? row.sales / row.transactions : 0,
        sharePercent: totalSalesAcrossStores > 0 ? (row.sales / totalSalesAcrossStores) * 100 : 0,
      }));
  }, [isMultiStoreView, storesToUse, sales]);

  const highestMarginProducts = useMemo(() => {
    // Most profitable = highest total profit earned from actual sales (not just margin %)
    const profitByProduct = new Map<string, { name: string; profit: number; revenue: number; marginPercent: number }>();
    for (const sale of sales) {
      for (const item of sale.items ?? []) {
        const product = products.find((p) => p.id === item.productId);
        const marginPercent = product?.marginPercentage ?? 0;
        if (marginPercent <= 0) continue;
        const subtotal = item.subtotal ?? item.price * item.quantity;
        const profit = subtotal * (marginPercent / (100 + marginPercent));
        const name = item.productName || product?.name || "Unknown";
        const key = `${item.productId}-${item.variantId || "base"}`;
        const current = profitByProduct.get(key) ?? { name, profit: 0, revenue: 0, marginPercent };
        current.profit += profit;
        current.revenue += subtotal;
        current.marginPercent = marginPercent;
        profitByProduct.set(key, current);
      }
    }
    return Array.from(profitByProduct.values())
      .filter((x) => x.profit > 0)
      .sort((a, b) => b.profit - a.profit)
      .slice(0, 5)
      .map((x) => ({
        name: x.name,
        price: x.revenue > 0 ? x.revenue : 0,
        profit: x.profit,
        margin: x.marginPercent,
      }));
  }, [sales, products]);

  const lowStockItems = useMemo(() => {
    if (showStoreFilter && reportStoreId === "all" && allStoresCatalogs.length > 0) {
      return buildAggregatedStockAlertLines(allStoresCatalogs, buildLowStockLineItems);
    }
    return buildLowStockLineItems(products);
  }, [showStoreFilter, reportStoreId, allStoresCatalogs, products]);

  const outOfStockItems = useMemo(() => {
    if (showStoreFilter && reportStoreId === "all" && allStoresCatalogs.length > 0) {
      return buildAggregatedStockAlertLines(allStoresCatalogs, buildOutOfStockLineItems);
    }
    return buildOutOfStockLineItems(products);
  }, [showStoreFilter, reportStoreId, allStoresCatalogs, products]);

  const storeColorMap = useMemo(() => {
    const map: Record<string, string> = {};
    storesToUse.forEach((s, i) => {
      map[s.id] = CHART_COLORS[i % CHART_COLORS.length];
    });
    return map;
  }, [storesToUse]);

  const salesOverviewData = useMemo(() => {
    const { from, to } = getDateRange;
    const days = eachDayOfInterval({ start: from, end: to });
    if (isMultiStoreView) {
      const perStorePerDay = new Map<string, Map<string, number>>();
      for (const d of days) {
        const key = format(d, "yyyy-MM-dd");
        perStorePerDay.set(key, new Map(storesToUse.map((s) => [s.id, 0])));
      }
      for (const sale of sales) {
        const key = format(new Date(sale.createdAt), "yyyy-MM-dd");
        const sid = (sale as { storeId?: string }).storeId;
        if (perStorePerDay.has(key) && sid) {
          const m = perStorePerDay.get(key)!;
          m.set(sid, (m.get(sid) ?? 0) + (sale.total ?? 0));
        }
      }
      return days.map((d) => {
        const key = format(d, "yyyy-MM-dd");
        const m = perStorePerDay.get(key) ?? new Map();
        const point: Record<string, string | number> = { label: format(d, "MMM d") };
        for (const s of storesToUse) {
          point[s.id] = m.get(s.id) ?? 0;
        }
        return point;
      });
    }
    const map = new Map<string, number>();
    for (const d of days) map.set(format(d, "yyyy-MM-dd"), 0);
    for (const sale of sales) {
      const key = format(new Date(sale.createdAt), "yyyy-MM-dd");
      map.set(key, (map.get(key) ?? 0) + (sale.total ?? 0));
    }
    return days.map((d) => ({
      label: format(d, "MMM d"),
      total: map.get(format(d, "yyyy-MM-dd")) ?? 0,
    }));
  }, [sales, getDateRange, isMultiStoreView, storesToUse]);

  const transactionCountData = useMemo(() => {
    const { from, to } = getDateRange;
    const days = eachDayOfInterval({ start: from, end: to });
    if (isMultiStoreView) {
      const perStorePerDay = new Map<string, Map<string, number>>();
      for (const d of days) {
        const key = format(d, "yyyy-MM-dd");
        perStorePerDay.set(key, new Map(storesToUse.map((s) => [s.id, 0])));
      }
      for (const sale of sales) {
        const key = format(new Date(sale.createdAt), "yyyy-MM-dd");
        const sid = (sale as { storeId?: string }).storeId;
        if (perStorePerDay.has(key) && sid) {
          const m = perStorePerDay.get(key)!;
          m.set(sid, (m.get(sid) ?? 0) + 1);
        }
      }
      return days.map((d) => {
        const key = format(d, "yyyy-MM-dd");
        const m = perStorePerDay.get(key) ?? new Map();
        const point: Record<string, string | number> = { label: format(d, "MMM d") };
        for (const s of storesToUse) {
          point[s.id] = m.get(s.id) ?? 0;
        }
        return point;
      });
    }
    const map = new Map<string, number>();
    for (const d of days) map.set(format(d, "yyyy-MM-dd"), 0);
    for (const sale of sales) {
      const key = format(new Date(sale.createdAt), "yyyy-MM-dd");
      map.set(key, (map.get(key) ?? 0) + 1);
    }
    return days.map((d) => ({
      label: format(d, "MMM d"),
      count: map.get(format(d, "yyyy-MM-dd")) ?? 0,
    }));
  }, [sales, getDateRange, isMultiStoreView, storesToUse]);

  const avgOrderValueData = useMemo(() => {
    const { from, to } = getDateRange;
    const days = eachDayOfInterval({ start: from, end: to });
    if (isMultiStoreView) {
      const totals = new Map<string, Map<string, number>>();
      const counts = new Map<string, Map<string, number>>();
      for (const d of days) {
        const key = format(d, "yyyy-MM-dd");
        totals.set(key, new Map(storesToUse.map((s) => [s.id, 0])));
        counts.set(key, new Map(storesToUse.map((s) => [s.id, 0])));
      }
      for (const sale of sales) {
        const key = format(new Date(sale.createdAt), "yyyy-MM-dd");
        const sid = (sale as { storeId?: string }).storeId;
        if (totals.has(key) && sid) {
          const t = totals.get(key)!;
          const c = counts.get(key)!;
          t.set(sid, (t.get(sid) ?? 0) + (sale.total ?? 0));
          c.set(sid, (c.get(sid) ?? 0) + 1);
        }
      }
      return days.map((d) => {
        const key = format(d, "yyyy-MM-dd");
        const t = totals.get(key) ?? new Map();
        const c = counts.get(key) ?? new Map();
        const point: Record<string, string | number> = { label: format(d, "MMM d") };
        for (const s of storesToUse) {
          const tot = t.get(s.id) ?? 0;
          const cnt = c.get(s.id) ?? 0;
          point[s.id] = cnt > 0 ? tot / cnt : 0;
        }
        return point;
      });
    }
    const totals = new Map<string, number>();
    const counts = new Map<string, number>();
    for (const d of days) {
      const key = format(d, "yyyy-MM-dd");
      totals.set(key, 0);
      counts.set(key, 0);
    }
    for (const sale of sales) {
      const key = format(new Date(sale.createdAt), "yyyy-MM-dd");
      totals.set(key, (totals.get(key) ?? 0) + (sale.total ?? 0));
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return days.map((d) => {
      const key = format(d, "yyyy-MM-dd");
      const t = totals.get(key) ?? 0;
      const c = counts.get(key) ?? 0;
      return { label: format(d, "MMM d"), avg: c > 0 ? t / c : 0 };
    });
  }, [sales, getDateRange, isMultiStoreView, storesToUse]);

  const salesChartConfig = useMemo(() => {
    if (isMultiStoreView) {
      const cfg: Record<string, { label: string; color: string }> = {};
      storesToUse.forEach((s, i) => {
        cfg[s.id] = { label: s.name, color: CHART_COLORS[i % CHART_COLORS.length] };
      });
      return cfg;
    }
    return { total: { label: "Sales", color: "hsl(var(--chart-1))" } } as const;
  }, [isMultiStoreView, storesToUse]);

  const countChartConfig = useMemo(() => {
    if (isMultiStoreView) {
      const cfg: Record<string, { label: string; color: string }> = {};
      storesToUse.forEach((s, i) => {
        cfg[s.id] = { label: s.name, color: CHART_COLORS[i % CHART_COLORS.length] };
      });
      return cfg;
    }
    return { count: { label: "Transactions", color: "hsl(var(--chart-2))" } } as const;
  }, [isMultiStoreView, storesToUse]);

  const avgChartConfig = useMemo(() => {
    if (isMultiStoreView) {
      const cfg: Record<string, { label: string; color: string }> = {};
      storesToUse.forEach((s, i) => {
        cfg[s.id] = { label: s.name, color: CHART_COLORS[i % CHART_COLORS.length] };
      });
      return cfg;
    }
    return { avg: { label: "Avg Order", color: "hsl(var(--chart-3))" } } as const;
  }, [isMultiStoreView, storesToUse]);

  const handleExportExcel = async () => {
    setExporting(true);
    try {
      const XLSX = await import("xlsx");
      const wb = XLSX.utils.book_new();

      const dateLabel = fromDate && toDate
        ? `${format(new Date(fromDate), "yyyy-MM-dd")}_to_${format(new Date(toDate), "yyyy-MM-dd")}`
        : datePreset === "today"
        ? "today"
        : datePreset === "all"
        ? "last_12months"
        : `last_${datePreset}days`;

      const totalSales = sales.reduce((s, x) => s + (x.total ?? 0), 0);
      const summaryData = [
        { Metric: "Total Sales", Value: totalSales },
        { Metric: "Transactions", Value: sales.length },
        { Metric: "Average Sale", Value: sales.length > 0 ? totalSales / sales.length : 0 },
      ];
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(summaryData), "Summary");

      if (topProductsData.length) {
        XLSX.utils.book_append_sheet(
          wb,
          XLSX.utils.json_to_sheet(topProductsData.map((x) => ({ Product: x.name, Revenue: x.value, "Share %": x.percent }))),
          "Top Products"
        );
      }
      if (peakHoursData.length) {
        XLSX.utils.book_append_sheet(
          wb,
          XLSX.utils.json_to_sheet(peakHoursData.map((x) => ({ Hour: x.name, Transactions: x.value, "Share %": x.percent }))),
          "Peak Hours"
        );
      }
      if (paymentMethodsData.length) {
        XLSX.utils.book_append_sheet(
          wb,
          XLSX.utils.json_to_sheet(paymentMethodsData.map((x) => ({ Method: x.name, Amount: x.value, "Share %": x.percent }))),
          "Payment Methods"
        );
      }
      if (highestMarginProducts.length) {
        XLSX.utils.book_append_sheet(
          wb,
          XLSX.utils.json_to_sheet(highestMarginProducts.map((x) => ({ Product: x.name, Profit: x.profit, "Margin %": x.margin }))),
          "Highest Margin"
        );
      }
      if (lowStockItems.length) {
        XLSX.utils.book_append_sheet(
          wb,
          XLSX.utils.json_to_sheet(lowStockItems.map((x) => ({ Product: x.name, Stock: x.stock, Status: x.status }))),
          "Low Stock"
        );
      }
      if (outOfStockItems.length) {
        XLSX.utils.book_append_sheet(
          wb,
          XLSX.utils.json_to_sheet(outOfStockItems.map((x) => ({ Product: x.name, Stock: x.stock, Status: x.status }))),
          "Out of Stock"
        );
      }
      if (salesOverviewData.length) {
        XLSX.utils.book_append_sheet(
          wb,
          XLSX.utils.json_to_sheet(salesOverviewData.map((x) => ({ Date: x.label, Sales: x.total }))),
          "Sales Overview"
        );
      }

      const cashCountRows = PHP_DENOMINATIONS.map((d) => {
        const count = denominationCounts[String(d.value)] ?? 0;
        return { Denomination: d.label, Count: count, Amount: count * d.value };
      });
      const cashCountSummary = [
        { Metric: "Expected Cash (from sales)", Value: expectedCash },
        { Metric: "GCash Total", Value: gcashTotal },
        { Metric: "Total Actual Cash", Value: totalActualCash },
        { Metric: "Variance", Value: isCashCountBalanced ? 0 : cashCountVariance },
      ];
      XLSX.utils.book_append_sheet(
        wb,
        XLSX.utils.json_to_sheet([...cashCountSummary, {}, ...cashCountRows]),
        "Cash Count"
      );
      if (gcashTransactions.length) {
        XLSX.utils.book_append_sheet(
          wb,
          XLSX.utils.json_to_sheet(
            gcashTransactions.map((t) => ({
              Amount: t.amount,
              "Transaction ID": t.transactionId,
              ...(isMultiStoreView && { Store: storesToUse.find((s) => s.id === t.storeId)?.name ?? "—" }),
              Time: format(new Date(t.createdAt), "yyyy-MM-dd HH:mm:ss"),
            }))
          ),
          "GCash Transactions"
        );
      }

      const wbout = XLSX.write(wb, { bookType: "xlsx", type: "array" });
      const blob = new Blob([wbout], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `reports_${dateLabel}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "Failed to export to Excel");
    } finally {
      setExporting(false);
    }
  };

  const handleExportPdf = () => {
    window.print();
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold">Reports</h1>
          <p className="text-muted-foreground">Analyze your business performance</p>
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          {showStoreFilter && (
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground whitespace-nowrap">Store:</span>
              <Select
                value={reportStoreId}
                onValueChange={setReportStoreId}
                disabled={reportStoresLoading}
              >
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder={reportStoresLoading ? "Loading..." : "Select store"} />
                </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Stores</SelectItem>
                {storesToUse.map((store) => (
                  <SelectItem key={store.id} value={store.id}>
                    {store.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            </div>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" disabled={exporting} className="gap-2">
                {exporting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Download className="w-4 h-4" />
                )}
                Export
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={handleExportExcel} disabled={exporting}>
                <FileSpreadsheet className="w-4 h-4 mr-2" />
                Export to Excel
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleExportPdf}>
                <FileText className="w-4 h-4 mr-2" />
                Export to PDF
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Select value={datePreset} onValueChange={(v) => setDatePreset(v as DateRangePreset)}>
            <SelectTrigger className="w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="today">Today</SelectItem>
              <SelectItem value="7">Last 7 Days</SelectItem>
              <SelectItem value="30">Last 30 Days</SelectItem>
              <SelectItem value="90">Last 90 Days</SelectItem>
              <SelectItem value="all">Last 12 Months</SelectItem>
            </SelectContent>
          </Select>
          <div className="flex items-center gap-2 border rounded-md px-3 py-2 text-sm">
            <Calendar className="w-4 h-4 text-muted-foreground" />
            <input
              type="date"
              className="bg-transparent border-none outline-none text-sm w-32"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
            />
            <span className="text-muted-foreground">-</span>
            <input
              type="date"
              className="bg-transparent border-none outline-none text-sm w-32"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
            />
          </div>
        </div>
      </div>

      {loading ? (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <Card key={i}>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-4 w-4" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-8 w-20 mb-2" />
                  <Skeleton className="h-3 w-32" />
                </CardContent>
              </Card>
            ))}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {Array.from({ length: 3 }).map((_, i) => (
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
            ))}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <Card key={i}>
                <CardHeader className="pb-2">
                  <Skeleton className="h-4 w-28" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-48 w-full rounded-lg" />
                </CardContent>
              </Card>
            ))}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <Card key={i}>
                <CardHeader className="pb-2">
                  <Skeleton className="h-4 w-32 mb-1" />
                  <Skeleton className="h-3 w-48" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-48 w-full rounded-lg" />
                </CardContent>
              </Card>
            ))}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <Card key={i}>
                <CardHeader className="pb-2">
                  <Skeleton className="h-4 w-40 mb-1" />
                  <Skeleton className="h-3 w-36" />
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {Array.from({ length: 4 }).map((_, j) => (
                      <div key={j} className="flex gap-4">
                        <Skeleton className="h-4 flex-1" />
                        <Skeleton className="h-4 w-16" />
                        <Skeleton className="h-4 w-14" />
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
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
                    <p className="text-xs text-muted-foreground mt-1">{stat.desc}</p>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {comparisonStats.map((stat) => (
              <Card key={stat.title}>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    {stat.title}
                  </CardTitle>
                  <ArrowUpRight className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{formatCurrency(stat.current)}</div>
                  <p className="text-xs text-muted-foreground mt-1">vs {formatCurrency(stat.previous)}</p>
                  <p
                    className={`text-xs font-medium mt-1 ${
                      stat.diff > 0
                        ? "text-green-600 dark:text-green-400"
                        : stat.diff < 0
                        ? "text-red-600 dark:text-red-400"
                        : "text-muted-foreground"
                    }`}
                  >
                    {stat.diffLabel}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>

          {!isMultiStoreView && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Net Profit
                  </CardTitle>
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className={`text-2xl font-bold ${totalProfit >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
                    {formatCurrency(totalProfit)}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">Profit for selected period (from product margins)</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Void Count
                  </CardTitle>
                  <Ban className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{voidCount}</div>
                  <p className="text-xs text-muted-foreground mt-1">Voided transactions in selected period</p>
                </CardContent>
              </Card>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Sales Overview
                </CardTitle>
              </CardHeader>
              <CardContent>
                {salesOverviewData.length ? (
                  <ChartContainer config={salesChartConfig} className="h-48 w-full">
                    <BarChart data={salesOverviewData} margin={{ left: 12, right: 12 }}>
                      <CartesianGrid vertical={false} />
                      <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} />
                      <YAxis
                        tickLine={false}
                        axisLine={false}
                        tickMargin={8}
                        tickFormatter={(v) => `₱${v}`}
                      />
                      <ChartTooltip
                        content={
                          <ChartTooltipContent
                            labelKey="label"
                            formatter={(v) => formatCurrency(Number(v))}
                          />
                        }
                      />
                      {isMultiStoreView ? (
                        storesToUse.map((s) => (
                          <Bar
                            key={s.id}
                            dataKey={s.id}
                            stackId="sales"
                            fill={storeColorMap[s.id]}
                            radius={4}
                            name={s.name}
                          />
                        ))
                      ) : (
                        <Bar dataKey="total" fill="var(--color-total)" radius={4} />
                      )}
                      {isMultiStoreView && <Legend />}
                    </BarChart>
                  </ChartContainer>
                ) : (
                  <p className="text-sm text-muted-foreground py-8">No sales data</p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Transaction Count
                </CardTitle>
              </CardHeader>
              <CardContent>
                {transactionCountData.length ? (
                  <ChartContainer config={countChartConfig} className="h-48 w-full">
                    <LineChart data={transactionCountData} margin={{ left: 12, right: 12 }}>
                      <CartesianGrid vertical={false} />
                      <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} />
                      <YAxis tickLine={false} axisLine={false} tickMargin={8} />
                      <ChartTooltip
                        content={
                          <ChartTooltipContent labelKey="label" formatter={(v) => String(v)} />
                        }
                      />
                      {isMultiStoreView ? (
                        storesToUse.map((s) => (
                          <Line
                            key={s.id}
                            dataKey={s.id}
                            type="monotone"
                            stroke={storeColorMap[s.id]}
                            strokeWidth={2}
                            dot={false}
                            name={s.name}
                          />
                        ))
                      ) : (
                        <Line
                          dataKey="count"
                          type="monotone"
                          stroke="var(--color-count)"
                          strokeWidth={2}
                          dot={false}
                        />
                      )}
                      {isMultiStoreView && <Legend />}
                    </LineChart>
                  </ChartContainer>
                ) : (
                  <p className="text-sm text-muted-foreground py-8">No data</p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Average Order Value
                </CardTitle>
              </CardHeader>
              <CardContent>
                {avgOrderValueData.length ? (
                  <ChartContainer config={avgChartConfig} className="h-48 w-full">
                    <BarChart data={avgOrderValueData} margin={{ left: 12, right: 12 }}>
                      <CartesianGrid vertical={false} />
                      <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} />
                      <YAxis
                        tickLine={false}
                        axisLine={false}
                        tickMargin={8}
                        tickFormatter={(v) => `₱${v}`}
                      />
                      <ChartTooltip
                        content={
                          <ChartTooltipContent
                            labelKey="label"
                            formatter={(v) => formatCurrency(Number(v))}
                          />
                        }
                      />
                      {isMultiStoreView ? (
                        storesToUse.map((s) => (
                          <Bar
                            key={s.id}
                            dataKey={s.id}
                            fill={storeColorMap[s.id]}
                            radius={4}
                            name={s.name}
                          />
                        ))
                      ) : (
                        <Bar dataKey="avg" fill="var(--color-avg)" radius={4} />
                      )}
                      {isMultiStoreView && <Legend />}
                    </BarChart>
                  </ChartContainer>
                ) : (
                  <p className="text-sm text-muted-foreground py-8">No data</p>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {isMultiStoreView && salesByStoreData.length > 0 && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Sales by Store</CardTitle>
                  <CardDescription>Revenue share per store</CardDescription>
                </CardHeader>
                <CardContent>
                  <ChartContainer
                    config={storesToUse.reduce(
                      (acc, s, i) => ({ ...acc, [s.id]: { label: s.name, color: CHART_COLORS[i % CHART_COLORS.length] } }),
                      {} as Record<string, { label: string; color: string }>
                    )}
                    className="h-48 w-full"
                  >
                    <PieChart>
                      <Pie
                        data={salesByStoreData}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        outerRadius={60}
                        label={({ name, percent }) => `${name} ${percent}%`}
                      >
                        {salesByStoreData.map((_, i) => (
                          <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                        ))}
                      </Pie>
                      <Legend />
                    </PieChart>
                  </ChartContainer>
                </CardContent>
              </Card>
            )}
            {isMultiStoreView && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Building2 className="w-4 h-4" />
                    Store Performance Leaderboard
                  </CardTitle>
                  <CardDescription>
                    Compare branch output in the selected period
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {storePerformanceRows.length ? (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Store</TableHead>
                          <TableHead className="text-right">Sales</TableHead>
                          <TableHead className="text-right">Txn</TableHead>
                          <TableHead className="text-right">Avg Sale</TableHead>
                          <TableHead className="text-right">Share</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {storePerformanceRows.map((row) => (
                          <TableRow key={row.id}>
                            <TableCell className="font-medium">{row.name}</TableCell>
                            <TableCell className="text-right">{formatCurrency(row.sales)}</TableCell>
                            <TableCell className="text-right">{row.transactions}</TableCell>
                            <TableCell className="text-right">{formatCurrency(row.avgSale)}</TableCell>
                            <TableCell className="text-right">{row.sharePercent.toFixed(1)}%</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  ) : (
                    <p className="text-sm text-muted-foreground py-8 text-center">
                      No store sales data yet for this range
                    </p>
                  )}
                </CardContent>
              </Card>
            )}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Top Products</CardTitle>
                <CardDescription>Highest revenue generating items</CardDescription>
              </CardHeader>
              <CardContent>
                {topProductsData.length ? (
                  <ChartContainer config={{ value: { label: "Sales", color: "hsl(var(--chart-1))" } }} className="h-48 w-full">
                    <PieChart>
                      <Pie
                        data={topProductsData}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        outerRadius={60}
                        label={({ name, percent }) => `${name} ${percent}%`}
                      >
                        {topProductsData.map((_, i) => (
                          <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                        ))}
                      </Pie>
                      <Legend />
                    </PieChart>
                  </ChartContainer>
                ) : (
                  <p className="text-sm text-muted-foreground py-8">No sales data</p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Peak Hours</CardTitle>
                <CardDescription>Busiest times by transaction count</CardDescription>
              </CardHeader>
              <CardContent>
                {peakHoursData.length ? (
                  <ChartContainer config={{ value: { label: "Count", color: "hsl(var(--chart-2))" } }} className="h-48 w-full">
                    <PieChart>
                      <Pie
                        data={peakHoursData}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        outerRadius={60}
                        label={({ name, percent }) => `${name} ${percent}%`}
                      >
                        {peakHoursData.map((_, i) => (
                          <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                        ))}
                      </Pie>
                      <Legend />
                    </PieChart>
                  </ChartContainer>
                ) : (
                  <p className="text-sm text-muted-foreground py-8">No data</p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Payment Methods</CardTitle>
                <CardDescription>Sales by payment type</CardDescription>
              </CardHeader>
              <CardContent>
                {paymentMethodsData.length ? (
                  <ChartContainer config={{ value: { label: "Amount", color: "hsl(var(--chart-3))" } }} className="h-48 w-full">
                    <PieChart>
                      <Pie
                        data={paymentMethodsData}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        outerRadius={60}
                        label={({ name, percent }) => `${name} ${percent}%`}
                      >
                        {paymentMethodsData.map((_, i) => (
                          <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                        ))}
                      </Pie>
                      <Legend />
                    </PieChart>
                  </ChartContainer>
                ) : (
                  <p className="text-sm text-muted-foreground py-8">No data</p>
                )}
              </CardContent>
            </Card>
            {isMultiStoreView && (
              <>
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      Net Profit
                    </CardTitle>
                    <DollarSign className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className={`text-2xl font-bold ${totalProfit >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
                      {formatCurrency(totalProfit)}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">Profit for selected period</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      Void Count
                    </CardTitle>
                    <Ban className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{voidCount}</div>
                    <p className="text-xs text-muted-foreground mt-1">Voided transactions</p>
                  </CardContent>
                </Card>
              </>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-destructive" />
                  Highest Margin Products
                </CardTitle>
                <CardDescription>Top 5 most profitable items</CardDescription>
              </CardHeader>
              <CardContent>
                {highestMarginProducts.length ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Product</TableHead>
                        <TableHead className="text-center">Profit</TableHead>
                        <TableHead className="text-center">Margin</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {highestMarginProducts.map((p, i) => (
                        <TableRow key={`${p.name}-${i}`}>
                          <TableCell className="font-medium">{p.name}</TableCell>
                          <TableCell className="text-center">
                            <span className="font-medium text-green-600 dark:text-green-400">
                              {formatCurrency(p.profit)}
                            </span>
                          </TableCell>
                          <TableCell className="text-center">
                            <span className="inline-flex items-center rounded-md bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800 dark:bg-green-900/30 dark:text-green-400">
                              {p.margin.toFixed(1)}%
                            </span>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <p className="text-sm text-muted-foreground py-4">No products with margin data sold in this period</p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-destructive" />
                  Low Stock Alerts
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-8">
                {loading && showStoreFilter && reportStoreId === "all" ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : lowStockItems.length ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Product</TableHead>
                        <TableHead className="text-center">Stock</TableHead>
                        <TableHead className="text-center">Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {lowStockItems.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell className="font-medium">{item.name}</TableCell>
                          <TableCell className="text-center">{item.stock}</TableCell>
                          <TableCell className="text-center">
                            <span className="text-amber-600 dark:text-amber-400">Low</span>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <p className="text-sm text-muted-foreground py-8 text-center">
                    No low stock items
                  </p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Package className="w-4 h-4 text-destructive" />
                  Out of Stock Items
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-8">
                {loading && showStoreFilter && reportStoreId === "all" ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : outOfStockItems.length ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Product</TableHead>
                        <TableHead className="text-center">Stock</TableHead>
                        <TableHead className="text-center">Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {outOfStockItems.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell className="font-medium">{item.name}</TableCell>
                          <TableCell className="text-center">{item.stock}</TableCell>
                          <TableCell className="text-center">
                            <span className="text-destructive">Out of Stock</span>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <p className="text-sm text-muted-foreground py-8 text-center">
                    No out of stock items
                  </p>
                )}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-foreground flex items-center gap-2">
                <Banknote className="h-4 w-4" />
                Cash Count
              </CardTitle>
              <CardDescription>
                Reconcile physical cash count with expected cash from sales. Enter counts per denomination.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="flex justify-between items-center py-2 border-b">
                  <span className="text-sm text-muted-foreground">Expected Cash (from sales)</span>
                  <span className="font-medium">{formatCurrency(expectedCash)}</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b">
                  <span className="text-sm text-muted-foreground">GCash Total</span>
                  <span className="font-medium">{formatCurrency(gcashTotal)}</span>
                </div>
              </div>
              {isMultiStoreView && expectedCashByStore.length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm font-medium">Expected cash by store</p>
                  <div className="space-y-1">
                    {expectedCashByStore.map((s) => (
                      <div key={s.name} className="flex justify-between text-sm">
                        <span className="text-muted-foreground">{s.name}</span>
                        <span>{formatCurrency(s.value)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <div className="space-y-2">
                <p className="text-sm font-medium">Bills/Cash Breakdown</p>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 max-h-48 overflow-y-auto">
                  {PHP_DENOMINATIONS.map((d) => {
                    const count = denominationCounts[String(d.value)] ?? 0;
                    const amount = count * d.value;
                    return (
                      <div key={d.value} className="flex flex-col gap-1">
                        <label className="text-xs text-muted-foreground">{d.label}</label>
                        <div className="flex gap-2 items-center">
                          <Input
                            type="number"
                            min={0}
                            step={1}
                            value={count || ""}
                            onChange={(e) => {
                              const v = e.target.value === "" ? 0 : parseInt(e.target.value, 10);
                              setDenominationCounts((prev) => ({
                                ...prev,
                                [String(d.value)]: isNaN(v) ? 0 : Math.max(0, v),
                              }));
                            }}
                            placeholder="0"
                            className="h-8 w-16"
                          />
                          <span className="text-xs font-medium min-w-[4rem]">{formatCurrency(amount)}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t">
                <div className="flex justify-between items-center py-2">
                  <span className="text-sm font-medium">Total Actual Cash</span>
                  <span className="font-medium">{formatCurrency(totalActualCash)}</span>
                </div>
                <div className="flex justify-between items-center py-2">
                  <span className="text-sm font-medium">Variance</span>
                  <span
                    className={`font-medium ${
                      isCashCountBalanced
                        ? "text-green-600 dark:text-green-400"
                        : "text-red-600 dark:text-red-400"
                    }`}
                  >
                    {formatCurrency(isCashCountBalanced ? 0 : cashCountVariance)}
                    {isCashCountBalanced ? " (match)" : ""}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <CardTitle className="text-sm font-medium text-foreground flex items-center gap-2">
                    <Smartphone className="h-4 w-4" />
                    GCash Transactions (Audit)
                  </CardTitle>
                  <CardDescription>
                    All GCash payments in the selected period for reconciliation
                  </CardDescription>
                </div>
                {gcashTransactions.length > 0 && (
                  <div className="relative w-full sm:w-64">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      type="text"
                      placeholder="Search by transaction ID..."
                      value={gcashTransactionSearch}
                      onChange={(e) => setGcashTransactionSearch(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {gcashTransactions.length === 0 ? (
                <p className="text-sm text-muted-foreground py-6 text-center">No GCash transactions in this period</p>
              ) : filteredGcashTransactions.length === 0 ? (
                <p className="text-sm text-muted-foreground py-6 text-center">No transactions match your search</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Amount</TableHead>
                      <TableHead>Transaction ID</TableHead>
                      {isMultiStoreView && <TableHead>Store</TableHead>}
                      <TableHead className="text-right">Time</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredGcashTransactions.map((txn) => (
                      <TableRow key={txn.id}>
                        <TableCell className="font-medium">{formatCurrency(txn.amount)}</TableCell>
                        <TableCell className="font-mono text-sm">{txn.transactionId}</TableCell>
                        {isMultiStoreView && (
                          <TableCell className="text-muted-foreground">
                            {storesToUse.find((s) => s.id === txn.storeId)?.name ?? "—"}
                          </TableCell>
                        )}
                        <TableCell className="text-right text-muted-foreground">
                          {format(new Date(txn.createdAt), "MMM d, yyyy h:mm a")}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
};

export default Reports;
