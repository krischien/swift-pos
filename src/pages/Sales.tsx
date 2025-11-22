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
import { DollarSign, Receipt, TrendingUp, Calendar } from "lucide-react";

const Sales = () => {
  const mockSales = [
    {
      id: "1",
      cashier: "John Doe",
      total: 45.50,
      items: 5,
      date: new Date(),
      paymentMethod: "Cash",
    },
    {
      id: "2",
      cashier: "John Doe",
      total: 23.80,
      items: 3,
      date: new Date(Date.now() - 3600000),
      paymentMethod: "Cash",
    },
  ];

  const stats = [
    {
      title: "Today's Sales",
      value: "$1,234.50",
      icon: DollarSign,
      trend: "+12.5%",
    },
    {
      title: "Transactions",
      value: "45",
      icon: Receipt,
      trend: "+8.2%",
    },
    {
      title: "Average Sale",
      value: "$27.43",
      icon: TrendingUp,
      trend: "+4.1%",
    },
  ];

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Sales History</h1>
          <p className="text-muted-foreground">View and manage your sales transactions</p>
        </div>
        <Button variant="outline" className="gap-2">
          <Calendar className="w-4 h-4" />
          Filter by Date
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
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

      <div className="rounded-lg border bg-card">
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
            {mockSales.map((sale) => (
              <TableRow key={sale.id}>
                <TableCell className="font-mono">#{sale.id.padStart(6, "0")}</TableCell>
                <TableCell>{sale.cashier}</TableCell>
                <TableCell>{sale.items} items</TableCell>
                <TableCell>{sale.paymentMethod}</TableCell>
                <TableCell>
                  {sale.date.toLocaleString()}
                </TableCell>
                <TableCell className="text-right font-bold">
                  ${sale.total.toFixed(2)}
                </TableCell>
                <TableCell className="text-right">
                  <Button variant="ghost" size="sm">
                    View Details
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};

export default Sales;
