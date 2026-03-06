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
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useDataLayer } from "@/contexts/DataLayerContext";
import { useStore } from "@/contexts/StoreContext";
import { isSaaS } from "@/config/appMode";
import { getOrgStores } from "@/lib/saasOrgStoresApi";
import { formatCurrency } from "@/lib/currency";
import { Product } from "@/types/pos";
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
  const { stores, storesLoading, activeStoreId } = useStore();
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

  const showStoreFilter = isSaaS();
  const storesToUse = reportStores.length > 0 ? reportStores : stores;
  const isMultiStoreView = showStoreFilter && reportStoreId === "all" && storesToUse.length > 1;

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
  }, [showStoreFilter, stores]);

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
          for (const store of storesToUse) {
            try {
              const [s, p] = await Promise.all([
                dataService.getSales(params, store.id),
                dataService.getProducts(undefined, store.id),
              ]);
              allSales.push(...((s as any[]) || []));
              allProducts.push(...((p as Product[]) || []));
            } catch (err) {
              console.warn(`Failed to fetch data for store ${store.name}:`, err);
            }
          }
          return { sales: allSales, products: allProducts };
        }
        const storeId = showStoreFilter && reportStoreId !== "all" ? reportStoreId : undefined;
        const [s, p] = await Promise.all([
          dataService.getSales(params, storeId),
          dataService.getProducts(undefined, storeId),
        ]);
        return { sales: (s as any[]) || [], products: (p as Product[]) || [] };
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

      const [main, voidCountResult, todaySales, yesterdaySales, thisMonthSales, lastMonthSales, thisYearSales, lastYearSales] =
        await Promise.all([
          mainFetch(),
          fetchVoidCount(),
          fetchSalesForRange(startOfDay(now), endOfDay(now)),
          fetchSalesForRange(startOfDay(yesterday), endOfDay(yesterday)),
          fetchSalesForRange(startOfMonth(now), endOfDay(now)),
          fetchSalesForRange(startOfMonth(lastMonth), endOfMonth(lastMonth)),
          fetchSalesForRange(startOfYear(now), endOfDay(now)),
          fetchSalesForRange(startOfYear(lastYear), endOfYear(lastYear)),
        ]);

      setSales(main.sales);
      setProducts(main.products);
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
  }, [datePreset, fromDate, toDate, reportStoreId, reportStores, stores, activeStoreId]);

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
    return products.flatMap((p) => {
      if (p.hasVariants && p.variants?.length) {
        return p.variants
          .filter((v) => (v.stock ?? 0) <= (p.lowStockThreshold ?? 0) && (v.stock ?? 0) > 0)
          .map((v) => ({ id: `${p.id}-${v.id}`, name: `${p.name} - ${v.name}`, stock: v.stock ?? 0, status: "Low" }));
      }
      const stock = p.stock ?? 0;
      if (stock <= (p.lowStockThreshold ?? 0) && stock > 0) {
        return [{ id: `${p.id}-base`, name: p.name, stock, status: "Low" }];
      }
      return [];
    });
  }, [products]);

  const outOfStockItems = useMemo(() => {
    return products.flatMap((p) => {
      if (p.hasVariants && p.variants?.length) {
        return p.variants
          .filter((v) => (v.stock ?? 0) === 0)
          .map((v) => ({ id: `${p.id}-${v.id}`, name: `${p.name} - ${v.name}`, stock: 0, status: "Out of Stock" }));
      }
      if ((p.stock ?? 0) === 0) {
        return [{ id: `${p.id}-base`, name: p.name, stock: 0, status: "Out of Stock" }];
      }
      return [];
    });
  }, [products]);

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
          XLSX.utils.json_to_sheet(outOfStockItems.map((x) => ({ Product: x.name, Stock: 0, Status: x.status }))),
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
        <div className="flex items-center justify-center py-12 text-muted-foreground">Loading...</div>
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
                <CardDescription>Items below stock threshold</CardDescription>
              </CardHeader>
              <CardContent>
                {lowStockItems.length ? (
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
                <CardDescription>Items with zero stock</CardDescription>
              </CardHeader>
              <CardContent>
                {outOfStockItems.length ? (
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
                          <TableCell className="text-center">0</TableCell>
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
        </>
      )}
    </div>
  );
};

export default Reports;
