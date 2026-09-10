import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { getSubscription } from "@/lib/saasSubscriptionApi";
import { getOrgStores } from "@/lib/saasOrgStoresApi";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Building2 } from "lucide-react";

/**
 * Kumpanya-only centralized HQ overview (cross-store list).
 * Detailed sales still live on Reports; this is the gated entry overview.
 */
const HQDashboard = () => {
  const { data: sub, isLoading: subLoading } = useQuery({
    queryKey: ["subscription"],
    queryFn: getSubscription,
  });
  const { data: stores = [], isLoading: storesLoading } = useQuery({
    queryKey: ["org-stores"],
    queryFn: getOrgStores,
    enabled: !!sub?.features.hqDashboard,
  });

  if (subLoading) {
    return <div className="p-6 text-muted-foreground">Loading…</div>;
  }

  if (!sub?.features.hqDashboard) {
    return (
      <div className="p-6 max-w-lg mx-auto space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>HQ Dashboard</CardTitle>
            <CardDescription>
              Available sa Kumpanya plan. Mag-upgrade para sa centralized cross-store overview.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild>
              <Link to="/pricing">Mag-upgrade sa Kumpanya</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-4xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Building2 className="h-6 w-6" />
          HQ Dashboard
        </h1>
        <p className="text-muted-foreground text-sm">
          Centralized overview — {sub.usage.storeCount} branches · {sub.usage.userCount} users
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Branches</CardTitle>
          </CardHeader>
          <CardContent className="text-3xl font-bold">{sub.usage.storeCount}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Users</CardTitle>
          </CardHeader>
          <CardContent className="text-3xl font-bold">{sub.usage.userCount}</CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">All stores</CardTitle>
          <CardDescription>Kumpanya cross-store directory</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {storesLoading && <p className="text-sm text-muted-foreground">Loading stores…</p>}
          {!storesLoading && stores.length === 0 && (
            <p className="text-sm text-muted-foreground">No stores yet.</p>
          )}
          {stores.map((s) => (
            <div
              key={s.id}
              className="flex items-center justify-between border rounded-lg px-3 py-2 text-sm"
            >
              <div>
                <p className="font-medium">{s.name}</p>
                <p className="text-muted-foreground text-xs">
                  {s.businessMode === "fnb" ? "F&B" : "Retail"}
                  {s.address ? ` · ${s.address}` : ""}
                </p>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Button asChild variant="outline">
        <Link to="/reports">Open multi-branch reports</Link>
      </Button>
    </div>
  );
};

export default HQDashboard;
