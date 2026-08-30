import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { adminApi } from "@/lib/saasAdminApi";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ArrowLeft, Trash2, Plus, UserMinus, Pencil, Bell, Banknote } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { formatCurrency } from "@/lib/currency";

const OrgDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [addUserOpen, setAddUserOpen] = useState(false);
  const [addUserForm, setAddUserForm] = useState({
    name: "",
    email: "",
    password: "",
    role: "cashier" as string,
    storeIds: [] as string[],
  });
  const [editUserOpen, setEditUserOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<{
    id: string;
    name: string;
    email: string;
    role: string;
    storeIds: string[];
  } | null>(null);
  const [editUserForm, setEditUserForm] = useState({
    name: "",
    email: "",
    password: "",
    role: "cashier" as string,
    storeIds: [] as string[],
  });
  const [notificationOpen, setNotificationOpen] = useState(false);
  const [notificationForm, setNotificationForm] = useState({
    message: "",
    type: "info" as "info" | "warning" | "urgent",
    expiresAt: "",
  });
  const [addStoreOpen, setAddStoreOpen] = useState(false);
  const [addStoreForm, setAddStoreForm] = useState({ name: "", address: "" });
  const [editStoreOpen, setEditStoreOpen] = useState(false);
  const [editingStore, setEditingStore] = useState<{
    id: string;
    name: string;
    address?: string | null;
  } | null>(null);
  const [editStoreForm, setEditStoreForm] = useState({ name: "", address: "" });
  const [billingPaymentOpen, setBillingPaymentOpen] = useState(false);
  const [billingPaymentForm, setBillingPaymentForm] = useState({
    period: format(new Date(), "yyyy-MM"),
    amount: "",
    method: "",
    note: "",
  });
  const [deletingStore, setDeletingStore] = useState<{ id: string; name: string } | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ["admin", "organization", id],
    queryFn: () => adminApi.getOrganization(id!),
    enabled: !!id,
  });

  const { data: billingPayments = [] } = useQuery({
    queryKey: ["admin", "organization", id, "billing-payments"],
    queryFn: () => adminApi.getOrganizationBillingPayments(id!),
    enabled: !!id,
  });

  const updateMutation = useMutation({
    mutationFn: (data: {
      name?: string;
      plan?: string;
      phone?: string;
      email?: string;
      address?: string;
      billingDueDate?: string | null;
      suspended?: boolean;
      activateTier?: string;
      setupFeePaid?: boolean;
      extendTrialDays?: number;
      subscriptionStatus?: string;
    }) => adminApi.updateOrganization(id!, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "organization", id] });
      queryClient.invalidateQueries({ queryKey: ["admin", "organizations"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "overview"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "payment-monitoring"] });
      toast({ title: "Organization updated" });
    },
    onError: (err: Error) => {
      toast({ variant: "destructive", title: "Update failed", description: err.message });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => adminApi.deleteOrganization(id!),
    onSuccess: () => {
      toast({ title: "Organization deleted" });
      navigate("/admin/organizations");
    },
    onError: (err: Error) => {
      toast({ variant: "destructive", title: "Delete failed", description: err.message });
    },
  });

  const addUserMutation = useMutation({
    mutationFn: (payload: typeof addUserForm) =>
      adminApi.createOrganizationUser(id!, {
        name: payload.name,
        email: payload.email,
        password: payload.password,
        role: payload.role,
        storeIds: payload.storeIds.length ? payload.storeIds : undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "organization", id] });
      queryClient.invalidateQueries({ queryKey: ["admin", "organizations"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "overview"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "payment-monitoring"] });
      setAddUserOpen(false);
      setAddUserForm({ name: "", email: "", password: "", role: "cashier", storeIds: [] });
      toast({ title: "User added" });
    },
    onError: (err: Error) => {
      toast({ variant: "destructive", title: "Add user failed", description: err.message });
    },
  });

  const deleteUserMutation = useMutation({
    mutationFn: (userId: string) => adminApi.deleteOrganizationUser(id!, userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "organization", id] });
      queryClient.invalidateQueries({ queryKey: ["admin", "organizations"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "overview"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "payment-monitoring"] });
      toast({ title: "User removed" });
    },
    onError: (err: Error) => {
      toast({ variant: "destructive", title: "Remove failed", description: err.message });
    },
  });

  const updateUserMutation = useMutation({
    mutationFn: (payload: typeof editUserForm) =>
      adminApi.updateOrganizationUser(id!, editingUser!.id, {
        name: payload.name,
        email: payload.email,
        password: payload.password || undefined,
        role: payload.role,
        storeIds: payload.storeIds,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "organization", id] });
      queryClient.invalidateQueries({ queryKey: ["admin", "organizations"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "overview"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "payment-monitoring"] });
      setEditUserOpen(false);
      setEditingUser(null);
      setEditUserForm({ name: "", email: "", password: "", role: "cashier", storeIds: [] });
      toast({ title: "User updated" });
    },
    onError: (err: Error) => {
      toast({ variant: "destructive", title: "Update failed", description: err.message });
    },
  });

  const handleAddUser = (e: React.FormEvent) => {
    e.preventDefault();
    if (!addUserForm.name.trim() || !addUserForm.email.trim() || !addUserForm.password) {
      toast({ variant: "destructive", title: "Name, email, and password are required" });
      return;
    }
    addUserMutation.mutate(addUserForm);
  };

  const toggleStore = (storeId: string) => {
    setAddUserForm((f) => ({
      ...f,
      storeIds: f.storeIds.includes(storeId)
        ? f.storeIds.filter((s) => s !== storeId)
        : [...f.storeIds, storeId],
    }));
  };

  const toggleEditStore = (storeId: string) => {
    setEditUserForm((f) => ({
      ...f,
      storeIds: f.storeIds.includes(storeId)
        ? f.storeIds.filter((s) => s !== storeId)
        : [...f.storeIds, storeId],
    }));
  };

  const openEditUser = (u: {
    id: string;
    name: string;
    email: string;
    role: string;
    storeIds?: string[];
  }) => {
    setEditingUser({
      id: u.id,
      name: u.name,
      email: u.email,
      role: u.role,
      storeIds: u.storeIds ?? [],
    });
    setEditUserForm({
      name: u.name,
      email: u.email,
      password: "",
      role: u.role,
      storeIds: u.storeIds ?? [],
    });
    setEditUserOpen(true);
  };

  const handleEditUser = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    if (!editUserForm.name.trim() || !editUserForm.email.trim()) {
      toast({ variant: "destructive", title: "Name and email are required" });
      return;
    }
    updateUserMutation.mutate(editUserForm);
  };

  const sendNotificationMutation = useMutation({
    mutationFn: () =>
      adminApi.createOrganizationNotification(id!, {
        message: notificationForm.message.trim(),
        type: notificationForm.type,
        expiresAt: notificationForm.expiresAt || undefined,
      }),
    onSuccess: () => {
      setNotificationOpen(false);
      setNotificationForm({ message: "", type: "info", expiresAt: "" });
      queryClient.invalidateQueries({ queryKey: ["admin", "payment-monitoring"] });
      toast({ title: "Notification sent" });
    },
    onError: (err: Error) => {
      toast({ variant: "destructive", title: "Failed to send", description: err.message });
    },
  });

  const handleSendNotification = (e: React.FormEvent) => {
    e.preventDefault();
    if (!notificationForm.message.trim()) {
      toast({ variant: "destructive", title: "Message is required" });
      return;
    }
    sendNotificationMutation.mutate();
  };

  const recordBillingPaymentMutation = useMutation({
    mutationFn: () => {
      const amountTrim = billingPaymentForm.amount.trim();
      let amountCents: number | null | undefined;
      if (amountTrim) {
        const n = Number.parseFloat(amountTrim);
        if (!Number.isFinite(n) || n < 0) {
          throw new Error("Amount must be a valid non-negative number");
        }
        amountCents = Math.round(n * 100);
      } else {
        amountCents = null;
      }
      return adminApi.recordOrganizationBillingPayment(id!, {
        period: billingPaymentForm.period,
        amountCents: amountCents ?? null,
        method: billingPaymentForm.method.trim() || undefined,
        note: billingPaymentForm.note.trim() || undefined,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "organization", id] });
      queryClient.invalidateQueries({ queryKey: ["admin", "organization", id, "billing-payments"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "organizations"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "overview"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "payment-monitoring"] });
      setBillingPaymentOpen(false);
      setBillingPaymentForm({
        period: format(new Date(), "yyyy-MM"),
        amount: "",
        method: "",
        note: "",
      });
      toast({ title: "Payment recorded", description: "Billing due date updated and reminders expired." });
    },
    onError: (err: Error) => {
      toast({ variant: "destructive", title: "Could not record payment", description: err.message });
    },
  });

  const handleRecordBillingPayment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!billingPaymentForm.period) {
      toast({ variant: "destructive", title: "Select a month" });
      return;
    }
    recordBillingPaymentMutation.mutate();
  };

  const addStoreMutation = useMutation({
    mutationFn: () =>
      adminApi.createOrganizationStore(id!, {
        name: addStoreForm.name.trim(),
        address: addStoreForm.address.trim() || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "organization", id] });
      queryClient.invalidateQueries({ queryKey: ["admin", "organizations"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "overview"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "payment-monitoring"] });
      setAddStoreOpen(false);
      setAddStoreForm({ name: "", address: "" });
      toast({ title: "Store added" });
    },
    onError: (err: Error) => {
      toast({ variant: "destructive", title: "Add store failed", description: err.message });
    },
  });

  const updateStoreMutation = useMutation({
    mutationFn: () =>
      adminApi.updateOrganizationStore(id!, editingStore!.id, {
        name: editStoreForm.name.trim(),
        address: editStoreForm.address.trim() || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "organization", id] });
      queryClient.invalidateQueries({ queryKey: ["admin", "organizations"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "overview"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "payment-monitoring"] });
      setEditStoreOpen(false);
      setEditingStore(null);
      setEditStoreForm({ name: "", address: "" });
      toast({ title: "Store updated" });
    },
    onError: (err: Error) => {
      toast({ variant: "destructive", title: "Update failed", description: err.message });
    },
  });

  const deleteStoreMutation = useMutation({
    mutationFn: (storeId: string) => adminApi.deleteOrganizationStore(id!, storeId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "organization", id] });
      queryClient.invalidateQueries({ queryKey: ["admin", "organizations"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "overview"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "payment-monitoring"] });
      setDeletingStore(null);
      toast({ title: "Store deleted" });
    },
    onError: (err: Error) => {
      toast({ variant: "destructive", title: "Delete failed", description: err.message });
    },
  });

  const openEditStore = (s: { id: string; name: string; address?: string | null }) => {
    setEditingStore(s);
    setEditStoreForm({ name: s.name, address: s.address ?? "" });
    setEditStoreOpen(true);
  };

  if (isLoading) return <div className="text-muted-foreground">Loading...</div>;
  if (error) return <div className="text-destructive">Failed to load: {(error as Error).message}</div>;
  if (!data) return null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <Button variant="ghost" onClick={() => navigate("/admin/organizations")} className="gap-2">
            <ArrowLeft className="w-4 h-4" />
            Back
          </Button>
          <h1 className="text-2xl font-bold">{data.name}</h1>
        </div>
        <Dialog open={notificationOpen} onOpenChange={setNotificationOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm" className="gap-2">
              <Bell className="w-4 h-4" />
              Send notification
            </Button>
          </DialogTrigger>
          <DialogContent>
            <form onSubmit={handleSendNotification}>
              <DialogHeader>
                <DialogTitle>Send notification</DialogTitle>
                <DialogDescription>
                  This message will appear as a banner for all users in this organization.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="notification-message">Message *</Label>
                  <Textarea
                    id="notification-message"
                    value={notificationForm.message}
                    onChange={(e) =>
                      setNotificationForm((f) => ({ ...f, message: e.target.value }))
                    }
                    placeholder="e.g. Scheduled maintenance on Sunday 2pm–4pm"
                    rows={3}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>Type</Label>
                  <Select
                    value={notificationForm.type}
                    onValueChange={(v) =>
                      setNotificationForm((f) => ({
                        ...f,
                        type: v as "info" | "warning" | "urgent",
                      }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="info">Info</SelectItem>
                      <SelectItem value="warning">Warning</SelectItem>
                      <SelectItem value="urgent">Urgent</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="notification-expires">Expires at (optional)</Label>
                  <Input
                    id="notification-expires"
                    type="datetime-local"
                    value={notificationForm.expiresAt}
                    onChange={(e) =>
                      setNotificationForm((f) => ({ ...f, expiresAt: e.target.value }))
                    }
                  />
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setNotificationOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={sendNotificationMutation.isPending}>
                  {sendNotificationMutation.isPending ? "Sending..." : "Send"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm text-muted-foreground">ID</p>
              <p className="font-mono text-sm">{data.id}</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="org-name">Name</Label>
              <Input
                id="org-name"
                defaultValue={data.name}
                onBlur={(e) => {
                  const v = e.target.value.trim();
                  if (v && v !== data.name) updateMutation.mutate({ name: v });
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.currentTarget.blur();
                  }
                }}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="org-phone">Phone</Label>
              <Input
                id="org-phone"
                defaultValue={data.phone ?? ""}
                placeholder="+63 912 345 6789"
                onBlur={(e) => {
                  const v = e.target.value.trim();
                  if (v !== (data.phone ?? "")) updateMutation.mutate({ phone: v || undefined });
                }}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="org-email">Email</Label>
              <Input
                id="org-email"
                type="email"
                defaultValue={data.email ?? ""}
                placeholder="contact@example.com"
                onBlur={(e) => {
                  const v = e.target.value.trim();
                  if (v !== (data.email ?? "")) updateMutation.mutate({ email: v || undefined });
                }}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="org-address">Address</Label>
              <Input
                id="org-address"
                defaultValue={data.address ?? ""}
                placeholder="123 Main St, City"
                onBlur={(e) => {
                  const v = e.target.value.trim();
                  if (v !== (data.address ?? "")) updateMutation.mutate({ address: v || undefined });
                }}
              />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Plan</p>
              <Select
                value={data.plan === "suspended" ? "suspended" : data.plan}
                onValueChange={(v) => {
                  if (v === "suspended") {
                    updateMutation.mutate({ suspended: true });
                  } else {
                    updateMutation.mutate({ activateTier: v, plan: v });
                  }
                }}
                disabled={updateMutation.isPending}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="tindahan">Tindahan</SelectItem>
                  <SelectItem value="negosyo">Negosyo</SelectItem>
                  <SelectItem value="kumpanya">Kumpanya</SelectItem>
                  <SelectItem value="suspended">Suspended</SelectItem>
                </SelectContent>
              </Select>
              {data.subscription && (
                <p className="text-xs text-muted-foreground mt-1">
                  Status: {data.subscription.status}
                  {data.subscription.requestedTier
                    ? ` · Requested: ${data.subscription.requestedTier}`
                    : ""}
                  {data.subscription.setupFeePaid ? " · Setup fee paid" : " · Setup fee unpaid"}
                </p>
              )}
              <div className="flex flex-wrap gap-2 mt-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={updateMutation.isPending}
                  onClick={() =>
                    updateMutation.mutate({
                      activateTier: data.subscription?.requestedTier || data.plan || "tindahan",
                      setupFeePaid: true,
                    })
                  }
                >
                  Activate + mark setup paid
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={updateMutation.isPending}
                  onClick={() => updateMutation.mutate({ extendTrialDays: 7 })}
                >
                  Extend trial 7d
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={updateMutation.isPending}
                  onClick={() =>
                    updateMutation.mutate({
                      setupFeePaid: !data.subscription?.setupFeePaid,
                    })
                  }
                >
                  Toggle setup fee
                </Button>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="org-billing-due">Billing due date</Label>
              <Input
                id="org-billing-due"
                type="date"
                value={
                  data.billingDueDate
                    ? new Date(data.billingDueDate).toISOString().slice(0, 10)
                    : ""
                }
                onBlur={(e) => {
                  const v = e.target.value.trim();
                  const current = data.billingDueDate
                    ? new Date(data.billingDueDate).toISOString().slice(0, 10)
                    : "";
                  if (v !== current)
                    updateMutation.mutate({ billingDueDate: v ? `${v}T12:00:00Z` : null });
                }}
              />
            </div>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" className="gap-2">
                  <Trash2 className="w-4 h-4" />
                  Delete organization
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete organization?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will permanently delete the organization, all stores, products, sales, and
                    users. This action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => deleteMutation.mutate()}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    Delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Stores ({data.stores.length})</CardTitle>
            <Dialog open={addStoreOpen} onOpenChange={setAddStoreOpen}>
              <DialogTrigger asChild>
                <Button size="sm" className="gap-2">
                  <Plus className="w-4 h-4" />
                  Add store
                </Button>
              </DialogTrigger>
              <DialogContent>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (addStoreForm.name.trim()) addStoreMutation.mutate();
                  }}
                >
                  <DialogHeader>
                    <DialogTitle>Add store</DialogTitle>
                    <DialogDescription>
                      Create a new store for this organization.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="grid gap-4 py-4">
                    <div className="space-y-2">
                      <Label htmlFor="store-name">Name *</Label>
                      <Input
                        id="store-name"
                        value={addStoreForm.name}
                        onChange={(e) => setAddStoreForm((f) => ({ ...f, name: e.target.value }))}
                        placeholder="Main Store"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="store-address">Address</Label>
                      <Input
                        id="store-address"
                        value={addStoreForm.address}
                        onChange={(e) => setAddStoreForm((f) => ({ ...f, address: e.target.value }))}
                        placeholder="123 Main St"
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button type="button" variant="outline" onClick={() => setAddStoreOpen(false)}>
                      Cancel
                    </Button>
                    <Button type="submit" disabled={addStoreMutation.isPending || !addStoreForm.name.trim()}>
                      {addStoreMutation.isPending ? "Adding..." : "Add"}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </CardHeader>
          <CardContent>
            {data.stores.length === 0 ? (
              <p className="text-muted-foreground">No stores. Click &quot;Add store&quot; to create one.</p>
            ) : (
              <ul className="space-y-3">
                {data.stores.map((s) => (
                  <li
                    key={s.id}
                    className="flex items-center justify-between p-3 rounded-lg border gap-2"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="font-medium">{s.name}</p>
                      {s.address && (
                        <p className="text-sm text-muted-foreground truncate">{s.address}</p>
                      )}
                      <p className="text-xs text-muted-foreground font-mono mt-1">{s.id}</p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => openEditStore(s)}
                      >
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <AlertDialog
                        open={deletingStore?.id === s.id}
                        onOpenChange={(open) => !open && setDeletingStore(null)}
                      >
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive"
                          onClick={() => setDeletingStore({ id: s.id, name: s.name })}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete store?</AlertDialogTitle>
                            <AlertDialogDescription>
                              &quot;{s.name}&quot; will be permanently deleted. All products, sales,
                              and categories in this store will be removed. This cannot be undone.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => deleteStoreMutation.mutate(s.id)}
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            >
                              Delete
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Dialog open={editStoreOpen} onOpenChange={setEditStoreOpen}>
          <DialogContent>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (editingStore && editStoreForm.name.trim()) updateStoreMutation.mutate();
              }}
            >
              <DialogHeader>
                <DialogTitle>Edit store</DialogTitle>
                <DialogDescription>
                  Update store name and address.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-store-name">Name *</Label>
                  <Input
                    id="edit-store-name"
                    value={editStoreForm.name}
                    onChange={(e) => setEditStoreForm((f) => ({ ...f, name: e.target.value }))}
                    placeholder="Main Store"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-store-address">Address</Label>
                  <Input
                    id="edit-store-address"
                    value={editStoreForm.address}
                    onChange={(e) => setEditStoreForm((f) => ({ ...f, address: e.target.value }))}
                    placeholder="123 Main St"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setEditStoreOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={updateStoreMutation.isPending || !editStoreForm.name.trim()}>
                  {updateStoreMutation.isPending ? "Saving..." : "Save"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1.5">
            <CardTitle className="flex items-center gap-2 text-xl">
              <Banknote className="h-5 w-5" />
              Billing payments
            </CardTitle>
            <CardDescription>
              Record payment for a calendar month. Sets the next billing due date to the last day of the
              month after the paid month, and expires billing-related in-app notifications (warning/urgent
              and info banners matching payment or billing keywords).
            </CardDescription>
          </div>
          <Dialog
            open={billingPaymentOpen}
            onOpenChange={(open) => {
              setBillingPaymentOpen(open);
              if (open) {
                setBillingPaymentForm((f) => ({ ...f, period: format(new Date(), "yyyy-MM") }));
              }
            }}
          >
            <DialogTrigger asChild>
              <Button size="sm" className="gap-2 shrink-0">
                <Banknote className="h-4 w-4" />
                Record payment
              </Button>
            </DialogTrigger>
            <DialogContent>
              <form onSubmit={handleRecordBillingPayment}>
                <DialogHeader>
                  <DialogTitle>Record billing payment</DialogTitle>
                  <DialogDescription>
                    One entry per organization per month (YYYY-MM). Duplicates return an error.
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="bill-period">Paid month</Label>
                    <Input
                      id="bill-period"
                      type="month"
                      value={billingPaymentForm.period}
                      onChange={(e) =>
                        setBillingPaymentForm((f) => ({ ...f, period: e.target.value }))
                      }
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="bill-amount">Amount (₱, optional)</Label>
                    <Input
                      id="bill-amount"
                      type="number"
                      step="0.01"
                      min={0}
                      inputMode="decimal"
                      placeholder="0.00"
                      value={billingPaymentForm.amount}
                      onChange={(e) =>
                        setBillingPaymentForm((f) => ({ ...f, amount: e.target.value }))
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="bill-method">Method (optional)</Label>
                    <Input
                      id="bill-method"
                      placeholder="GCash, bank transfer, card…"
                      value={billingPaymentForm.method}
                      onChange={(e) =>
                        setBillingPaymentForm((f) => ({ ...f, method: e.target.value }))
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="bill-note">Note (optional)</Label>
                    <Textarea
                      id="bill-note"
                      rows={2}
                      placeholder="Reference number, internal note…"
                      value={billingPaymentForm.note}
                      onChange={(e) =>
                        setBillingPaymentForm((f) => ({ ...f, note: e.target.value }))
                      }
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setBillingPaymentOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={recordBillingPaymentMutation.isPending}>
                    {recordBillingPaymentMutation.isPending ? "Saving…" : "Save"}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          {billingPayments.length === 0 ? (
            <p className="text-sm text-muted-foreground">No payments recorded yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Month paid</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Method</TableHead>
                  <TableHead>Recorded</TableHead>
                  <TableHead>By</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {billingPayments.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="font-medium">
                      {format(new Date(`${row.period}-01T12:00:00Z`), "MMMM yyyy")}
                    </TableCell>
                    <TableCell>
                      {row.amountCents != null ? formatCurrency(row.amountCents / 100) : "—"}
                    </TableCell>
                    <TableCell>{row.method ?? "—"}</TableCell>
                    <TableCell className="text-muted-foreground text-sm whitespace-nowrap">
                      {format(new Date(row.createdAt), "MMM d, yyyy HH:mm")}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {row.recordedBy?.email ?? "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Users ({data.users.length})</CardTitle>
          <Dialog open={addUserOpen} onOpenChange={setAddUserOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-2">
                <Plus className="w-4 h-4" />
                Add user
              </Button>
            </DialogTrigger>
            <DialogContent>
              <form onSubmit={handleAddUser}>
                <DialogHeader>
                  <DialogTitle>Add user</DialogTitle>
                  <DialogDescription>
                    Add a new user to this organization. They can access stores you assign.
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="user-name">Name *</Label>
                    <Input
                      id="user-name"
                      value={addUserForm.name}
                      onChange={(e) => setAddUserForm((f) => ({ ...f, name: e.target.value }))}
                      placeholder="John Doe"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="user-email">Email *</Label>
                    <Input
                      id="user-email"
                      type="email"
                      value={addUserForm.email}
                      onChange={(e) => setAddUserForm((f) => ({ ...f, email: e.target.value }))}
                      placeholder="john@example.com"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="user-password">Password *</Label>
                    <Input
                      id="user-password"
                      type="password"
                      value={addUserForm.password}
                      onChange={(e) => setAddUserForm((f) => ({ ...f, password: e.target.value }))}
                      placeholder="Min 6 characters"
                      required
                      minLength={6}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Role</Label>
                    <Select
                      value={addUserForm.role}
                      onValueChange={(v) => setAddUserForm((f) => ({ ...f, role: v }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="owner">Owner</SelectItem>
                        <SelectItem value="admin">Admin</SelectItem>
                        <SelectItem value="cashier">Cashier</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {data.stores.length > 0 && (
                    <div className="space-y-2">
                      <Label>Store access</Label>
                      <p className="text-xs text-muted-foreground">
                        Leave unchecked to grant access to all stores
                      </p>
                      <div className="space-y-2 pt-2">
                        {data.stores.map((s) => (
                          <div key={s.id} className="flex items-center space-x-2">
                            <Checkbox
                              id={`store-${s.id}`}
                              checked={addUserForm.storeIds.includes(s.id)}
                              onCheckedChange={() => toggleStore(s.id)}
                            />
                            <label
                              htmlFor={`store-${s.id}`}
                              className="text-sm font-medium leading-none cursor-pointer"
                            >
                              {s.name}
                            </label>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setAddUserOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={addUserMutation.isPending}>
                    {addUserMutation.isPending ? "Adding..." : "Add user"}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          {data.users.length === 0 ? (
            <p className="text-muted-foreground">No users. Click &quot;Add user&quot; to add one.</p>
          ) : (
            <div className="space-y-3">
              {data.users.map((u) => (
                <div
                  key={u.id}
                  className="flex items-center justify-between p-3 rounded-lg border gap-2"
                >
                  <div>
                    <p className="font-medium">{u.name}</p>
                    <p className="text-sm text-muted-foreground">{u.email}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm">{u.role}</span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground"
                      onClick={() => openEditUser(u)}
                    >
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground">
                          <UserMinus className="w-4 h-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Remove user?</AlertDialogTitle>
                          <AlertDialogDescription>
                            {u.name} will lose access to this organization. They will need to be
                            re-added to log in again.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => deleteUserMutation.mutate(u.id)}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >
                            Remove
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog
        open={editUserOpen}
        onOpenChange={(open) => {
          setEditUserOpen(open);
          if (!open) setEditingUser(null);
        }}
      >
        <DialogContent>
          <form onSubmit={handleEditUser}>
            <DialogHeader>
              <DialogTitle>Edit user</DialogTitle>
              <DialogDescription>
                Update user details. Leave password blank to keep the current password.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="edit-user-name">Name *</Label>
                <Input
                  id="edit-user-name"
                  value={editUserForm.name}
                  onChange={(e) => setEditUserForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="John Doe"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-user-email">Email *</Label>
                <Input
                  id="edit-user-email"
                  type="email"
                  value={editUserForm.email}
                  onChange={(e) => setEditUserForm((f) => ({ ...f, email: e.target.value }))}
                  placeholder="john@example.com"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-user-password">New password (optional)</Label>
                <Input
                  id="edit-user-password"
                  type="password"
                  value={editUserForm.password}
                  onChange={(e) => setEditUserForm((f) => ({ ...f, password: e.target.value }))}
                  placeholder="Leave blank to keep current"
                  minLength={6}
                />
              </div>
              <div className="space-y-2">
                <Label>Role</Label>
                <Select
                  value={editUserForm.role}
                  onValueChange={(v) => setEditUserForm((f) => ({ ...f, role: v }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="owner">Owner</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                    <SelectItem value="cashier">Cashier</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {data.stores.length > 0 && (
                <div className="space-y-2">
                  <Label>Store access</Label>
                  <p className="text-xs text-muted-foreground">
                    Leave unchecked to grant access to all stores
                  </p>
                  <div className="space-y-2 pt-2">
                    {data.stores.map((s) => (
                      <div key={s.id} className="flex items-center space-x-2">
                        <Checkbox
                          id={`edit-store-${s.id}`}
                          checked={editUserForm.storeIds.includes(s.id)}
                          onCheckedChange={() => toggleEditStore(s.id)}
                        />
                        <label
                          htmlFor={`edit-store-${s.id}`}
                          className="text-sm font-medium leading-none cursor-pointer"
                        >
                          {s.name}
                        </label>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditUserOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={updateUserMutation.isPending}>
                {updateUserMutation.isPending ? "Saving..." : "Save changes"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default OrgDetail;
