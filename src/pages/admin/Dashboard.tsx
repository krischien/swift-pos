import { useQuery } from "@tanstack/react-query";
import { adminApi } from "@/lib/saasAdminApi";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Building2,
  Users,
  Store,
  Calendar,
  Gift,
  Zap,
  Building,
  Ban,
  AlertTriangle,
} from "lucide-react";
import { format } from "date-fns";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";

const Dashboard = () => {
  const { data, isLoading, error } = useQuery({
    queryKey: ["admin", "overview"],
    queryFn: () => adminApi.getOverview(),
    staleTime: 0,
  });

  if (isLoading) return <div className="text-muted-foreground">Loading...</div>;
  if (error) return <div className="text-destructive">Failed to load: {(error as Error).message}</div>;
  if (!data) return null;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Dashboard</h1>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card
          className="border-l-4 border-l-blue-500 bg-blue-50/70 dark:border-l-blue-400 dark:bg-blue-950/35"
        >
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-blue-950/90 dark:text-blue-100/90">
              Organizations
            </CardTitle>
            <Building2 className="h-4 w-4 text-blue-600 dark:text-blue-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold tabular-nums text-blue-700 dark:text-blue-200">
              {data.orgCount}
            </div>
          </CardContent>
        </Card>
        <Card
          className="border-l-4 border-l-emerald-500 bg-emerald-50/70 dark:border-l-emerald-400 dark:bg-emerald-950/35"
        >
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-emerald-950/90 dark:text-emerald-100/90">
              Users
            </CardTitle>
            <Users className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold tabular-nums text-emerald-700 dark:text-emerald-200">
              {data.userCount}
            </div>
          </CardContent>
        </Card>
        <Card
          className="border-l-4 border-l-amber-500 bg-amber-50/70 dark:border-l-amber-400 dark:bg-amber-950/35"
        >
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-amber-950/90 dark:text-amber-100/90">
              Stores
            </CardTitle>
            <Store className="h-4 w-4 text-amber-600 dark:text-amber-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold tabular-nums text-amber-800 dark:text-amber-200">
              {data.storeCount}
            </div>
          </CardContent>
        </Card>
        <Card
          className={cn(
            "border-l-4 bg-orange-50/70 dark:bg-orange-950/35",
            (data.overdueBillingCount ?? 0) > 0
              ? "border-l-destructive bg-destructive/5 dark:border-l-destructive dark:bg-destructive/15"
              : "border-l-orange-500 dark:border-l-orange-400",
          )}
        >
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle
              className={cn(
                "text-sm font-medium",
                (data.overdueBillingCount ?? 0) > 0
                  ? "text-destructive dark:text-red-300"
                  : "text-orange-950/90 dark:text-orange-100/90",
              )}
            >
              Overdue billing
            </CardTitle>
            <AlertTriangle
              className={cn(
                "h-4 w-4",
                (data.overdueBillingCount ?? 0) > 0
                  ? "text-destructive"
                  : "text-orange-600 dark:text-orange-400",
              )}
            />
          </CardHeader>
          <CardContent className="space-y-1">
            <div
              className={cn(
                "text-2xl font-bold tabular-nums",
                (data.overdueBillingCount ?? 0) > 0
                  ? "text-destructive"
                  : "text-orange-800 dark:text-orange-200",
              )}
            >
              {data.overdueBillingCount ?? 0}
            </div>
            <p className="text-xs text-muted-foreground">Orgs with a billing due date before today</p>
            {(data.overdueBillingCount ?? 0) > 0 && (
              <Link
                to="/admin/payment-monitoring"
                className="inline-block text-xs font-medium text-primary hover:underline"
              >
                View in payment monitoring →
              </Link>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card
          className="border-l-4 border-l-sky-500 bg-sky-50/70 dark:border-l-sky-400 dark:bg-sky-950/35"
        >
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-sky-950/90 dark:text-sky-100/90">
              Tindahan
            </CardTitle>
            <Gift className="h-4 w-4 text-sky-600 dark:text-sky-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold tabular-nums text-sky-800 dark:text-sky-200">
              {data.tindahanCount ?? data.freeCount ?? 0}
            </div>
          </CardContent>
        </Card>
        <Card
          className="border-l-4 border-l-violet-500 bg-violet-50/70 dark:border-l-violet-400 dark:bg-violet-950/35"
        >
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-violet-950/90 dark:text-violet-100/90">
              Negosyo
            </CardTitle>
            <Zap className="h-4 w-4 text-violet-600 dark:text-violet-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold tabular-nums text-violet-800 dark:text-violet-200">
              {data.negosyoCount ?? data.proCount ?? 0}
            </div>
          </CardContent>
        </Card>
        <Card
          className="border-l-4 border-l-indigo-500 bg-indigo-50/70 dark:border-l-indigo-400 dark:bg-indigo-950/35"
        >
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-indigo-950/90 dark:text-indigo-100/90">
              Kumpanya
            </CardTitle>
            <Building className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold tabular-nums text-indigo-800 dark:text-indigo-200">
              {data.kumpanyaCount ?? data.enterpriseCount ?? 0}
            </div>
          </CardContent>
        </Card>
        <Card
          className="border-l-4 border-l-rose-500 bg-rose-50/70 dark:border-l-rose-400 dark:bg-rose-950/35"
        >
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-rose-950/90 dark:text-rose-100/90">
              Suspended
            </CardTitle>
            <Ban className="h-4 w-4 text-rose-600 dark:text-rose-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold tabular-nums text-rose-800 dark:text-rose-200">
              {data.suspendedCount ?? 0}
            </div>
          </CardContent>
        </Card>
      </div>

      {data.billingDueSoon && data.billingDueSoon.length > 0 && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Billing due soon</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {data.billingDueSoon.map((org) => (
                <Link
                  key={org.id}
                  to={`/admin/organizations/${org.id}`}
                  className="flex items-center justify-between p-3 rounded-lg border hover:bg-accent transition-colors"
                >
                  <div>
                    <p className="font-medium">{org.name}</p>
                    <p className="text-sm text-muted-foreground">{org.plan}</p>
                  </div>
                  <span className="text-sm font-medium">
                    {org.billingDueDate
                      ? format(new Date(org.billingDueDate), "MMM d, yyyy")
                      : "—"}
                  </span>
                </Link>
              ))}
            </div>
            <Link
              to="/admin/payment-monitoring"
              className="mt-4 inline-block text-sm font-medium text-primary hover:underline"
            >
              Open payment monitoring →
            </Link>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Recent organizations</CardTitle>
        </CardHeader>
        <CardContent>
          {data.recentOrgs.length === 0 ? (
            <p className="text-muted-foreground">No organizations yet</p>
          ) : (
            <div className="space-y-3">
              {data.recentOrgs.map((org) => (
                <Link
                  key={org.id}
                  to={`/admin/organizations/${org.id}`}
                  className="flex items-center justify-between p-3 rounded-lg border hover:bg-accent transition-colors"
                >
                  <div>
                    <p className="font-medium">{org.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {org.storeCount} stores · {org.userCount} users · {org.plan}
                    </p>
                  </div>
                  <span className="text-sm text-muted-foreground">
                    {format(new Date(org.createdAt), "MMM d, yyyy")}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Dashboard;
