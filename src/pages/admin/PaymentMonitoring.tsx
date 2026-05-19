import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { adminApi } from "@/lib/saasAdminApi";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { CreditCard, Bell } from "lucide-react";
import { format } from "date-fns";

type StatusFilter = "all" | "overdue" | "due_within_7" | "due_within_30" | "due_within_90";

const statusLabel: Record<string, string> = {
  overdue: "Overdue",
  due_within_7: "Due in 7 days",
  due_within_30: "Due in 30 days",
  due_within_90: "Due in 90 days",
};

const statusVariant: Record<string, "destructive" | "default" | "secondary" | "outline"> = {
  overdue: "destructive",
  due_within_7: "destructive",
  due_within_30: "default",
  due_within_90: "secondary",
};

function looksBillingRelated(message: string) {
  return /payment|billing|due|invoice|renew|subscription|plan/i.test(message);
}

const PaymentMonitoring = () => {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  const { data, isLoading, error } = useQuery({
    queryKey: ["admin", "payment-monitoring"],
    queryFn: () => adminApi.getPaymentMonitoring(),
  });

  const filteredItems = useMemo(() => {
    if (!data?.items) return [];
    if (statusFilter === "all") return data.items;
    return data.items.filter((r) => r.status === statusFilter);
  }, [data?.items, statusFilter]);

  if (isLoading) return <div className="text-muted-foreground">Loading…</div>;
  if (error) return <div className="text-destructive">{(error as Error).message}</div>;
  if (!data) return null;

  const now = new Date();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Payment monitoring</h1>
        <p className="text-muted-foreground mt-1">
          Organizations with a billing due date in the next 90 days or overdue, plus recent in-app
          notifications tied to each org. Send reminders from an organization’s detail page (“Notify
          organization”).
        </p>
        <p className="text-xs text-muted-foreground mt-2">
          Snapshot: {format(new Date(data.asOf), "PPpp")}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2">
          <CreditCard className="h-4 w-4 text-muted-foreground" />
          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
            <SelectTrigger className="w-[200px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="overdue">Overdue</SelectItem>
              <SelectItem value="due_within_7">Due within 7 days</SelectItem>
              <SelectItem value="due_within_30">Due within 30 days</SelectItem>
              <SelectItem value="due_within_90">Due within 90 days</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            Billing timeline
          </CardTitle>
          <CardDescription>
            {filteredItems.length} organization{filteredItems.length !== 1 ? "s" : ""} in view
            {statusFilter !== "all" ? ` · filter: ${statusLabel[statusFilter] ?? statusFilter}` : ""}.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {filteredItems.length === 0 ? (
            <p className="text-muted-foreground py-8 text-center">
              No organizations in this view. Either no billing due dates fall in the 90-day window,
              or adjust the filter.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Organization</TableHead>
                  <TableHead>Plan</TableHead>
                  <TableHead>Due date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="min-w-[240px]">Recent notifications</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredItems.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell>
                      <Link
                        to={`/admin/organizations/${row.id}`}
                        className="font-medium text-primary hover:underline"
                      >
                        {row.name}
                      </Link>
                      {row.email && (
                        <p className="text-xs text-muted-foreground truncate max-w-[200px]">
                          {row.email}
                        </p>
                      )}
                    </TableCell>
                    <TableCell className="capitalize">{row.plan}</TableCell>
                    <TableCell>
                      {row.billingDueDate
                        ? format(new Date(row.billingDueDate), "MMM d, yyyy")
                        : "—"}
                      <span className="block text-xs text-muted-foreground">
                        {row.daysUntilDue < 0
                          ? `${Math.abs(row.daysUntilDue)}d overdue`
                          : row.daysUntilDue === 0
                            ? "Due today"
                            : `In ${row.daysUntilDue}d`}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Badge variant={statusVariant[row.status] ?? "outline"}>
                        {statusLabel[row.status] ?? row.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="align-top">
                      {row.recentNotifications.length === 0 ? (
                        <span className="text-sm text-muted-foreground">None</span>
                      ) : (
                        <ul className="space-y-2 text-sm">
                          {row.recentNotifications.map((n) => {
                            const expired = n.expiresAt && new Date(n.expiresAt) < now;
                            const billingHint = looksBillingRelated(n.message);
                            return (
                              <li
                                key={n.id}
                                className={`rounded-md border p-2 ${expired ? "opacity-60" : ""}`}
                              >
                                <div className="flex flex-wrap items-center gap-1 mb-1">
                                  <Bell className="h-3 w-3 text-muted-foreground shrink-0" />
                                  <Badge variant="outline" className="text-xs capitalize">
                                    {n.type}
                                  </Badge>
                                  {billingHint && (
                                    <Badge variant="secondary" className="text-xs">
                                      Billing-related
                                    </Badge>
                                  )}
                                  <span className="text-xs text-muted-foreground">
                                    {format(new Date(n.createdAt), "MMM d, yyyy")}
                                  </span>
                                  {n.expiresAt && (
                                    <span className="text-xs text-muted-foreground">
                                      · expires {format(new Date(n.expiresAt), "MMM d")}
                                    </span>
                                  )}
                                </div>
                                <p className="text-xs leading-snug line-clamp-3">{n.message}</p>
                              </li>
                            );
                          })}
                        </ul>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {data.missingBillingDate && data.missingBillingDate.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Paid plans without billing due date</CardTitle>
            <CardDescription>
              Set a billing due date on each organization so deadlines and reminders stay aligned.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm">
              {data.missingBillingDate.map((o) => (
                <li key={o.id}>
                  <Link
                    to={`/admin/organizations/${o.id}`}
                    className="font-medium text-primary hover:underline"
                  >
                    {o.name}
                  </Link>
                  <span className="text-muted-foreground capitalize"> · {o.plan}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default PaymentMonitoring;
