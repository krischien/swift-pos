import { useState, useEffect, useMemo } from "react";
import { format, subDays, startOfDay, endOfDay, isSameDay } from "date-fns";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Calendar as CalendarIcon, TrendingUp, DollarSign, Package, PieChart, AlertTriangle } from "lucide-react";
import { DateRange } from "react-day-picker";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { api } from "@/lib/api";
import { formatCurrency } from "@/lib/currency";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  PieChart as RePieChart,
  Pie,
  Cell,
} from "recharts";
import { cn } from "@/lib/utils";

const Reports = () => {
  const [date, setDate] = useState<DateRange | undefined>({
    from: subDays(new Date(), 30),
    to: new Date(),
  });
  const [sales, setSales] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [reportType, setReportType] = useState("sales");
  const [rangeType, setRangeType] = useState("monthly");

  const handleRangeChange = (value: string) => {
    setRangeType(value);
    const now = new Date();
    let from = new Date();
    
    switch (value) {
      case "weekly":
        from = subDays(now, 7);
        break;
      case "monthly":
        from = subDays(now, 30);
        break;
      case "annual":
        from = subDays(now, 365);
        break;
      default:
        from = subDays(now, 30);
    }
    
    setDate({ from, to: now });
  };

  useEffect(() => {
    const loadData = async () => {
      if (!date?.from) return;
      
      setLoading(true);
      try {
        const from = startOfDay(date.from).toISOString();
        const to = date.to ? endOfDay(date.to).toISOString() : endOfDay(date.from).toISOString();
        
        const [salesData, productsData] = await Promise.all([
          api.getSales({ from, to }),
          api.getProducts(), // Fetch products for stock/margin analysis
        ]);
        
        setSales(salesData as any[]);
        setProducts(productsData as any[]);
      } catch (error) {
        console.error("Failed to load report data:", error);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [date]);

  // Process data for charts
  const chartData = useMemo(() => {
    if (!sales.length) return [];

    // Group by date
    const grouped = sales.reduce((acc: any, sale: any) => {
      const dateObj = new Date(sale.createdAt);
      const dateKey = format(dateObj, "MMM dd");
      if (!acc[dateKey]) {
        acc[dateKey] = { 
          date: dateKey, 
          total: 0, 
          count: 0, 
          profit: 0,
          timestamp: dateObj.getTime()
        };
      }
      acc[dateKey].total += sale.total;
      acc[dateKey].count += 1;
      
      // Calculate profit (rough estimate if basePrice not available in sale items, 
      // but ideally should come from backend or be calculated precisely)
      // For now using total as placeholder for profit visualization structure
      return acc;
    }, {});

    return Object.values(grouped).sort((a: any, b: any) => a.timestamp - b.timestamp);
  }, [sales]);

  const categoryData = useMemo(() => {
    if (!sales.length) return [];
    
    const grouped = sales.reduce((acc: any, sale: any) => {
      sale.items?.forEach((item: any) => {
        // We might not have category name directly in sale item, 
        // would need to join with products or store category name in sale item
        // Assuming item.productName for now as a proxy grouping if category missing
        const key = item.productName || "Unknown"; 
        if (!acc[key]) {
          acc[key] = { name: key, value: 0 };
        }
        acc[key].value += item.subtotal || 0;
      });
      return acc;
    }, {});

    // Sort and take top 5, filter out items with 0 value
    return Object.values(grouped)
      .filter((item: any) => item.value > 0) // Only include items with revenue > 0
      .sort((a: any, b: any) => b.value - a.value)
      .slice(0, 5);
  }, [sales]);

  const peakHoursData = useMemo(() => {
    if (!sales.length) return [];

    // Group by hour
    const grouped = sales.reduce((acc: any, sale: any) => {
      const date = new Date(sale.createdAt);
      // Format hour as "1 PM", "2 PM", etc.
      const hour = format(date, "h a");
      
      if (!acc[hour]) {
        acc[hour] = { name: hour, value: 0 };
      }
      acc[hour].value += 1; // Count transactions
      return acc;
    }, {});

    // Sort by transaction count and take top 5
    return Object.values(grouped)
      .sort((a: any, b: any) => b.value - a.value)
      .slice(0, 5);
  }, [sales]);

  // Low Stock Items (Variant-aware) - excludes zero stock items
  const lowStockProducts = useMemo(() => {
    const alerts: any[] = [];

    products.forEach(p => {
      if (p.status !== "active") return;

      if (p.hasVariants && p.variants) {
        // Check each variant - must be > 0 and <= threshold
        p.variants.forEach((v: any) => {
          if (v.stock > 0 && v.stock <= p.lowStockThreshold) {
            alerts.push({
              id: `${p.id}-${v.id}`,
              name: `${p.name} (${v.name})`,
              stock: v.stock,
              lowStockThreshold: p.lowStockThreshold
            });
          }
        });
      } else {
        // Check main product - must be > 0 and <= threshold
        const stock = p.stock || 0;
        if (stock > 0 && stock <= p.lowStockThreshold) {
          alerts.push({
            id: p.id,
            name: p.name,
            stock: stock,
            lowStockThreshold: p.lowStockThreshold
          });
        }
      }
    });

    return alerts.sort((a, b) => a.stock - b.stock);
  }, [products]);

  // Zero Stock Items (Variant-aware)
  const zeroStockProducts = useMemo(() => {
    const alerts: any[] = [];

    products.forEach(p => {
      if (p.status !== "active") return;

      if (p.hasVariants && p.variants) {
        // Check each variant
        p.variants.forEach((v: any) => {
          if (v.stock === 0) {
            alerts.push({
              id: `${p.id}-${v.id}`,
              name: `${p.name} (${v.name})`,
              stock: 0,
              lowStockThreshold: p.lowStockThreshold
            });
          }
        });
      } else {
        // Check main product
        if ((p.stock || 0) === 0) {
          alerts.push({
            id: p.id,
            name: p.name,
            stock: 0,
            lowStockThreshold: p.lowStockThreshold
          });
        }
      }
    });

    return alerts.sort((a, b) => a.name.localeCompare(b.name));
  }, [products]);

  // Payment Methods Breakdown
  const paymentMethodData = useMemo(() => {
    if (!sales.length) return [];
    
    const grouped = sales.reduce((acc: any, sale: any) => {
      const method = sale.paymentMethod || "Cash";
      // Normalize method names if needed
      const key = method.charAt(0).toUpperCase() + method.slice(1);
      
      if (!acc[key]) {
        acc[key] = { name: key, value: 0 };
      }
      acc[key].value += sale.total;
      return acc;
    }, {});

    return Object.values(grouped).sort((a: any, b: any) => b.value - a.value);
  }, [sales]);

  // Profit Margins
  const profitMarginData = useMemo(() => {
    return products
      .filter(p => p.price && p.basePrice && p.status === "active")
      .map(p => {
        const price = p.price || 0;
        const cost = p.basePrice || 0;
        const margin = price > 0 ? ((price - cost) / price) * 100 : 0;
        return {
          ...p,
          margin
        };
      })
      .sort((a, b) => b.margin - a.margin)
      .slice(0, 10); // Top 10 highest margins
  }, [products]);

  const COLORS = [
    "#0088FE", "#00C49F", "#FFBB28", "#FF8042", "#8884d8",
    "#82ca9d", "#ffc658", "#8dd1e1", "#a4de6c", "#d0ed57"
  ];

  const stats = useMemo(() => {
    const totalSales = sales.reduce((sum, s) => sum + s.total, 0);
    const totalTxns = sales.length;
    const avgSale = totalTxns ? totalSales / totalTxns : 0;
    
    return {
      totalSales,
      totalTxns,
      avgSale
    };
  }, [sales]);

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Reports</h1>
          <p className="text-muted-foreground">Analyze your business performance</p>
        </div>
        
        <div className="flex items-center gap-2">
          <Select value={rangeType} onValueChange={handleRangeChange}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Select range" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="weekly">Last 7 Days</SelectItem>
              <SelectItem value="monthly">Last 30 Days</SelectItem>
              <SelectItem value="annual">Last Year</SelectItem>
            </SelectContent>
          </Select>

          <Popover>
            <PopoverTrigger asChild>
              <Button
                id="date"
                variant={"outline"}
                className={cn(
                  "w-[300px] justify-start text-left font-normal",
                  !date && "text-muted-foreground"
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {date?.from ? (
                  date.to ? (
                    <>
                      {format(date.from, "LLL dd, y")} -{" "}
                      {format(date.to, "LLL dd, y")}
                    </>
                  ) : (
                    format(date.from, "LLL dd, y")
                  )
                ) : (
                  <span>Pick a date</span>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="end">
              <Calendar
                initialFocus
                mode="range"
                defaultMonth={date?.from}
                selected={date}
                onSelect={setDate}
                numberOfMonths={2}
              />
            </PopoverContent>
          </Popover>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Sales</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(stats.totalSales)}</div>
            <p className="text-xs text-muted-foreground">
              For selected period
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Transactions</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalTxns}</div>
            <p className="text-xs text-muted-foreground">
              Total orders processed
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Average Sale</CardTitle>
            <PieChart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(stats.avgSale)}</div>
            <p className="text-xs text-muted-foreground">
              Per transaction
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Sales Overview</CardTitle>
          </CardHeader>
          <CardContent className="pl-2">
            <div className="h-[350px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis 
                    dataKey="date" 
                    stroke="#888888"
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    stroke="#888888"
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(value) => `₱${value}`}
                  />
                  <Tooltip 
                    formatter={(value: number) => formatCurrency(value)}
                    cursor={{ fill: 'transparent' }}
                  />
                  <Bar dataKey="total" fill="#15803d" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Transaction Count</CardTitle>
          </CardHeader>
          <CardContent className="pl-2">
            <div className="h-[350px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis 
                    dataKey="date" 
                    stroke="#888888"
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    stroke="#888888"
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip />
                  <Line type="monotone" dataKey="count" stroke="#8884d8" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Average Order Value</CardTitle>
          </CardHeader>
          <CardContent className="pl-2">
            <div className="h-[350px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis 
                    dataKey="date" 
                    stroke="#888888"
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    stroke="#888888"
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(value) => `₱${value}`}
                  />
                  <Tooltip formatter={(value: number) => formatCurrency(value)} />
                  <Line type="monotone" dataKey="aov" stroke="#ff7300" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card className="col-span-1">
          <CardHeader>
            <CardTitle>Top Products</CardTitle>
            <CardDescription>
              Highest revenue generating items
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[350px]">
              {categoryData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <RePieChart>
                    <Pie
                      data={categoryData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {categoryData.map((entry: any, index: number) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value: number) => formatCurrency(value)} />
                    <Legend />
                  </RePieChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-full text-muted-foreground">
                  No sales data available
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="col-span-1">
          <CardHeader>
            <CardTitle>Peak Hours</CardTitle>
            <CardDescription>
              Busiest times by transaction count
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[350px]">
              <ResponsiveContainer width="100%" height="100%">
                <RePieChart>
                  <Pie
                    data={peakHoursData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    outerRadius={80}
                    fill="#82ca9d"
                    dataKey="value"
                  >
                    {peakHoursData.map((entry: any, index: number) => (
                      <Cell key={`cell-${index}`} fill={COLORS[(index + 5) % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </RePieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="col-span-1">
          <CardHeader>
            <CardTitle>Payment Methods</CardTitle>
            <CardDescription>
              Sales by payment type
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[350px]">
              <ResponsiveContainer width="100%" height="100%">
                <RePieChart>
                  <Pie
                    data={paymentMethodData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    outerRadius={80}
                    fill="#0088FE"
                    dataKey="value"
                  >
                    {paymentMethodData.map((entry: any, index: number) => (
                      <Cell key={`cell-${index}`} fill={COLORS[(index + 2) % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: number) => formatCurrency(value)} />
                  <Legend />
                </RePieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Low Stock Alerts
            </CardTitle>
            <CardDescription>Items below stock threshold</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product</TableHead>
                  <TableHead>Stock</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {lowStockProducts.slice(0, 5).map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium">{item.name}</TableCell>
                    <TableCell>
                      <span className="text-destructive font-bold">
                        {item.stock}
                      </span>
                      <span className="text-xs text-muted-foreground ml-1">
                         / {item.lowStockThreshold}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Badge variant="destructive">Low Stock</Badge>
                    </TableCell>
                  </TableRow>
                ))}
                {lowStockProducts.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center text-muted-foreground">
                      No low stock items
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5 text-destructive" />
              Out of Stock Items
            </CardTitle>
            <CardDescription>Items with zero stock</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product</TableHead>
                  <TableHead>Stock</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {zeroStockProducts.slice(0, 10).map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium">{item.name}</TableCell>
                    <TableCell>
                      <span className="text-destructive font-bold">0</span>
                    </TableCell>
                    <TableCell>
                      <Badge className="bg-gray-500 hover:bg-gray-600 text-white">Disabled</Badge>
                    </TableCell>
                  </TableRow>
                ))}
                {zeroStockProducts.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center text-muted-foreground">
                      No out of stock items
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Highest Margin Products</CardTitle>
            <CardDescription>Top 5 most profitable items</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product</TableHead>
                  <TableHead>Price</TableHead>
                  <TableHead>Margin</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {profitMarginData.slice(0, 5).map((product: any) => (
                  <TableRow key={product.id}>
                    <TableCell className="font-medium">{product.name}</TableCell>
                    <TableCell>{formatCurrency(product.price)}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                        {product.margin.toFixed(1)}%
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Reports;

