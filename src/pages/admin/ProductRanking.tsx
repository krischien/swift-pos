import { Fragment, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { adminApi } from "@/lib/saasAdminApi";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Trophy, Store, Calendar, Eye } from "lucide-react";
import { format, subDays, subYears, startOfDay, endOfDay } from "date-fns";
import { formatCurrency } from "@/lib/currency";

type DatePreset = "today" | "7" | "30" | "90" | "all";

type ExpandedRow = { productId: string; variantId: string | null } | null;

const ProductRanking = () => {
  const [datePreset, setDatePreset] = useState<DatePreset>("30");
  const [storeId, setStoreId] = useState<string>("all");
  const [expandedRow, setExpandedRow] = useState<ExpandedRow>(null);

  const handleStoreChange = (value: string) => {
    setStoreId(value);
    if (value !== "all") setExpandedRow(null);
  };

  const { from, to } = useMemo(() => {
    const now = new Date();
    switch (datePreset) {
      case "today":
        return { from: startOfDay(now), to: endOfDay(now) };
      case "7":
        return { from: startOfDay(subDays(now, 7)), to: endOfDay(now) };
      case "30":
        return { from: startOfDay(subDays(now, 30)), to: endOfDay(now) };
      case "90":
        return { from: startOfDay(subDays(now, 90)), to: endOfDay(now) };
      case "all":
      default:
        return { from: startOfDay(subYears(now, 1)), to: endOfDay(now) };
    }
  }, [datePreset]);

  const { data: stores, isLoading: storesLoading } = useQuery({
    queryKey: ["admin", "stores"],
    queryFn: () => adminApi.getStores(),
  });

  const { data: ranking, isLoading: rankingLoading } = useQuery({
    queryKey: ["admin", "product-ranking", storeId, from.toISOString(), to.toISOString()],
    queryFn: () => adminApi.getProductRanking(storeId, from.toISOString(), to.toISOString()),
  });

  const { data: drilldown, isLoading: drilldownLoading } = useQuery({
    queryKey: [
      "admin",
      "product-ranking-drilldown",
      expandedRow?.productId,
      expandedRow?.variantId,
      from.toISOString(),
      to.toISOString(),
    ],
    queryFn: () =>
      adminApi.getProductRankingDrilldown(
        expandedRow!.productId,
        expandedRow!.variantId,
        from.toISOString(),
        to.toISOString()
      ),
    enabled: !!expandedRow && storeId === "all",
  });

  const isLoading = storesLoading || rankingLoading;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Product Ranking</h1>
      <p className="text-muted-foreground">
        Products ranked by units sold (highest to lowest). Filter by store and date range.
      </p>

      <div className="flex flex-wrap gap-4">
        <div className="flex items-center gap-2">
          <Store className="h-4 w-4 text-muted-foreground" />
          <Select value={storeId} onValueChange={handleStoreChange}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Select store" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All stores</SelectItem>
              {stores?.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-muted-foreground" />
          <Select value={datePreset} onValueChange={(v) => setDatePreset(v as DatePreset)}>
            <SelectTrigger className="w-[160px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="today">Today</SelectItem>
              <SelectItem value="7">Last 7 days</SelectItem>
              <SelectItem value="30">Last 30 days</SelectItem>
              <SelectItem value="90">Last 90 days</SelectItem>
              <SelectItem value="all">Last year</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trophy className="h-5 w-5" />
            Top Products by Units Sold
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            {format(from, "MMM d, yyyy")} – {format(to, "MMM d, yyyy")}
            {storeId !== "all" && stores?.find((s) => s.id === storeId) && (
              <> · {stores.find((s) => s.id === storeId)?.name}</>
            )}
          </p>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-muted-foreground py-8 text-center">Loading...</div>
          ) : !ranking || ranking.length === 0 ? (
            <div className="text-muted-foreground py-8 text-center">
              No data for selected period
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  {storeId === "all" && <TableHead className="w-12" />}
                  <TableHead className="w-16">Rank</TableHead>
                  <TableHead>Product</TableHead>
                  <TableHead className="text-right">Quantity Sold</TableHead>
                  <TableHead className="text-right">Revenue</TableHead>
                  {storeId === "all" && <TableHead className="w-20">Actions</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {ranking.map((r) => {
                  const rowKey = `${r.productId}:${r.variantId ?? "base"}`;
                  const isExpanded =
                    expandedRow?.productId === r.productId &&
                    (expandedRow?.variantId ?? "base") === (r.variantId ?? "base");

                  return (
                    <Fragment key={rowKey}>
                      <TableRow>
                        {storeId === "all" && <TableCell className="w-12" />}
                        <TableCell className="font-medium">{r.rank}</TableCell>
                        <TableCell>
                          {r.productName}
                          {r.variantName && (
                            <span className="text-muted-foreground ml-1">({r.variantName})</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">{r.quantity.toLocaleString()}</TableCell>
                        <TableCell className="text-right">{formatCurrency(r.revenue)}</TableCell>
                        {storeId === "all" && (
                          <TableCell className="w-20 py-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 gap-1"
                              onClick={() =>
                                setExpandedRow(
                                  isExpanded ? null : { productId: r.productId, variantId: r.variantId }
                                )
                              }
                            >
                              <Eye className="h-4 w-4" />
                              View
                            </Button>
                          </TableCell>
                        )}
                      </TableRow>
                      {storeId === "all" && isExpanded && (
                        <TableRow key={`${rowKey}-drilldown`}>
                          <TableCell colSpan={6} className="bg-muted/30 p-0">
                            <div className="px-4 py-3">
                              {drilldownLoading ? (
                                <div className="text-sm text-muted-foreground py-2">
                                  Loading store breakdown...
                                </div>
                              ) : drilldown && drilldown.length > 0 ? (
                                <Table>
                                  <TableHeader>
                                    <TableRow>
                                      <TableHead className="w-16">Rank</TableHead>
                                      <TableHead>Store</TableHead>
                                      <TableHead className="text-right">Quantity</TableHead>
                                      <TableHead className="text-right">Revenue</TableHead>
                                    </TableRow>
                                  </TableHeader>
                                  <TableBody>
                                    {drilldown.map((d) => (
                                      <TableRow key={d.storeId}>
                                        <TableCell className="font-medium">{d.rank}</TableCell>
                                        <TableCell>{d.storeName}</TableCell>
                                        <TableCell className="text-right">
                                          {d.quantity.toLocaleString()}
                                        </TableCell>
                                        <TableCell className="text-right">
                                          {formatCurrency(d.revenue)}
                                        </TableCell>
                                      </TableRow>
                                    ))}
                                  </TableBody>
                                </Table>
                              ) : (
                                <div className="text-sm text-muted-foreground py-2">
                                  No store data
                                </div>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </Fragment>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default ProductRanking;
