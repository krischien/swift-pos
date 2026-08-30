import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { adminApi } from "@/lib/saasAdminApi";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { format } from "date-fns";
import { Link } from "react-router-dom";
import { Search, Plus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const PLAN_FILTERS = [
  { value: "all", label: "All" },
  { value: "tindahan", label: "Tindahan" },
  { value: "negosyo", label: "Negosyo" },
  { value: "kumpanya", label: "Kumpanya" },
  { value: "suspended", label: "Suspended" },
] as const;

const Organizations = () => {
  const [search, setSearch] = useState("");
  const [planFilter, setPlanFilter] = useState<string>("all");
  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState({
    name: "",
    storeName: "",
    ownerEmail: "",
    ownerPassword: "",
    ownerName: "",
    phone: "",
    email: "",
    address: "",
  });
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data, isLoading, error } = useQuery({
    queryKey: ["admin", "organizations", search, planFilter],
    queryFn: () =>
      adminApi.getOrganizations(search || undefined, planFilter === "all" ? undefined : planFilter),
  });

  const createMutation = useMutation({
    mutationFn: (payload: {
      name: string;
      storeName?: string;
      ownerEmail?: string;
      ownerPassword?: string;
      ownerName?: string;
      phone?: string;
      email?: string;
      address?: string;
    }) =>
      adminApi.createOrganization({
        name: payload.name,
        storeName: payload.storeName || undefined,
        ownerEmail: payload.ownerEmail || undefined,
        ownerPassword: payload.ownerPassword || undefined,
        ownerName: payload.ownerName || undefined,
        phone: payload.phone || undefined,
        email: payload.email || undefined,
        address: payload.address || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "organizations"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "overview"] });
      setCreateOpen(false);
      setCreateForm({
        name: "",
        storeName: "",
        ownerEmail: "",
        ownerPassword: "",
        ownerName: "",
        phone: "",
        email: "",
        address: "",
      });
      toast({ title: "Organization created" });
    },
    onError: (err: Error) => {
      toast({ variant: "destructive", title: "Create failed", description: err.message });
    },
  });

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!createForm.name.trim()) {
      toast({ variant: "destructive", title: "Organization name is required" });
      return;
    }
    if (createForm.ownerEmail && !createForm.ownerPassword) {
      toast({ variant: "destructive", title: "Password required when adding owner" });
      return;
    }
    createMutation.mutate({
      name: createForm.name,
      storeName: createForm.storeName,
      ownerEmail: createForm.ownerEmail,
      ownerPassword: createForm.ownerPassword,
      ownerName: createForm.ownerName,
      phone: createForm.phone || undefined,
      email: createForm.email || undefined,
      address: createForm.address || undefined,
    });
  };

  if (isLoading) return <div className="text-muted-foreground">Loading...</div>;
  if (error) return <div className="text-destructive">Failed to load: {(error as Error).message}</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Organizations</h1>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="w-4 h-4" />
              Add organization
            </Button>
          </DialogTrigger>
          <DialogContent>
            <form onSubmit={handleCreate}>
              <DialogHeader>
                <DialogTitle>Create organization</DialogTitle>
                <DialogDescription>
                  Create a new organization. Optionally add a store and owner.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="org-name">Organization name *</Label>
                  <Input
                    id="org-name"
                    value={createForm.name}
                    onChange={(e) => setCreateForm((f) => ({ ...f, name: e.target.value }))}
                    placeholder="Acme Inc"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="store-name">First store name (optional)</Label>
                  <Input
                    id="store-name"
                    value={createForm.storeName}
                    onChange={(e) => setCreateForm((f) => ({ ...f, storeName: e.target.value }))}
                    placeholder="Main Store"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="org-phone">Phone (optional)</Label>
                  <Input
                    id="org-phone"
                    value={createForm.phone}
                    onChange={(e) => setCreateForm((f) => ({ ...f, phone: e.target.value }))}
                    placeholder="+63 912 345 6789"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="org-email">Organization email (optional)</Label>
                  <Input
                    id="org-email"
                    type="email"
                    value={createForm.email}
                    onChange={(e) => setCreateForm((f) => ({ ...f, email: e.target.value }))}
                    placeholder="contact@example.com"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="org-address">Address (optional)</Label>
                  <Input
                    id="org-address"
                    value={createForm.address}
                    onChange={(e) => setCreateForm((f) => ({ ...f, address: e.target.value }))}
                    placeholder="123 Main St, City"
                  />
                </div>
                <div className="border-t pt-4 space-y-2">
                  <p className="text-sm font-medium text-muted-foreground">Owner (optional)</p>
                  <div className="grid gap-2">
                    <Input
                      placeholder="Owner name"
                      value={createForm.ownerName}
                      onChange={(e) => setCreateForm((f) => ({ ...f, ownerName: e.target.value }))}
                    />
                    <Input
                      type="email"
                      placeholder="Owner email"
                      value={createForm.ownerEmail}
                      onChange={(e) => setCreateForm((f) => ({ ...f, ownerEmail: e.target.value }))}
                    />
                    <Input
                      type="password"
                      placeholder="Owner password"
                      value={createForm.ownerPassword}
                      onChange={(e) => setCreateForm((f) => ({ ...f, ownerPassword: e.target.value }))}
                    />
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={createMutation.isPending}>
                  {createMutation.isPending ? "Creating..." : "Create"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name or ID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          {PLAN_FILTERS.map((f) => (
            <Button
              key={f.value}
              variant={planFilter === f.value ? "default" : "outline"}
              size="sm"
              onClick={() => setPlanFilter(f.value)}
            >
              {f.label}
            </Button>
          ))}
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All organizations</CardTitle>
        </CardHeader>
        <CardContent>
          {!data?.length ? (
            <p className="text-muted-foreground">No organizations found</p>
          ) : (
            <div className="space-y-2">
              {data.map((org) => (
                <Link
                  key={org.id}
                  to={`/admin/organizations/${org.id}`}
                  className="flex items-center justify-between p-4 rounded-lg border hover:bg-accent transition-colors"
                >
                  <div>
                    <p className="font-medium">{org.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {org.storeCount} stores · {org.userCount} users · Plan: {org.plan}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-muted-foreground">{org.id}</p>
                    <p className="text-sm text-muted-foreground">
                      {format(new Date(org.createdAt), "MMM d, yyyy")}
                    </p>
                  </div>
                  <Button variant="ghost" size="sm" asChild>
                    <span>View</span>
                  </Button>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Organizations;
