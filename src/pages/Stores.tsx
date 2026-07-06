import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Plus, Search, Trash2, Edit, Store as StoreIcon, ChevronLeft, ChevronRight } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
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
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useToast } from "@/hooks/use-toast";
import { isSaaS } from "@/config/appMode";
import {
  getOrgStores,
  createOrgStore,
  updateOrgStore,
  deleteOrgStore,
  type OrgStore,
} from "@/lib/saasOrgStoresApi";
import { useStore, type StoreSummary } from "@/contexts/StoreContext";

const Stores = () => {
  const { setStores, activeStoreId, setActiveStoreId } = useStore();
  const { toast } = useToast();
  const [stores, setStoresState] = useState<OrgStore[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editingStore, setEditingStore] = useState<OrgStore | null>(null);
  const [formName, setFormName] = useState("");
  const [formAddress, setFormAddress] = useState("");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [deletingStore, setDeletingStore] = useState<OrgStore | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(25);
  const [formBusinessMode, setFormBusinessMode] = useState<"retail" | "fnb">("retail");

  const load = async () => {
    if (!isSaaS()) return;
    try {
      setLoading(true);
      setError(null);
      const list = await getOrgStores();
      setStoresState(list);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Failed to load stores";
      setError(msg);
      toast({ variant: "destructive", title: "Error", description: msg });
    } finally {
      setLoading(false);
    }
  };

  const refreshStoreContext = (list: OrgStore[]) => {
    const mapped: StoreSummary[] = list.map((s) => ({
      id: s.id,
      name: s.name,
      businessMode: s.businessMode === "fnb" ? "fnb" : "retail",
    }));
    setStores(mapped);
  };

  useEffect(() => {
    void load();
  }, []);

  const filtered = stores.filter(
    (s) =>
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      (s.address ?? "").toLowerCase().includes(search.toLowerCase())
  );
  const totalPages = Math.max(1, Math.ceil(filtered.length / itemsPerPage));
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedStores = filtered.slice(startIndex, startIndex + itemsPerPage);
  const isEditing = !!editingStore;

  useEffect(() => {
    if (currentPage > totalPages && totalPages > 0) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const openAddDialog = () => {
    setEditingStore(null);
    setFormName("");
    setFormAddress("");
    setFormBusinessMode("retail");
    setFormError(null);
    setFormOpen(true);
  };

  const openEditDialog = (store: OrgStore) => {
    setEditingStore(store);
    setFormName(store.name);
    setFormAddress(store.address ?? "");
    setFormError(null);
    setFormOpen(true);
  };

  const handleSave = async () => {
    if (!formName.trim()) {
      setFormError("Store name is required");
      return;
    }

    try {
      setSaving(true);
      setFormError(null);

      if (isEditing && editingStore) {
        await updateOrgStore(editingStore.id, {
          name: formName.trim(),
          address: formAddress.trim() || undefined,
        });
        toast({ title: "Store updated", description: `${formName} has been updated.` });
      } else {
        await createOrgStore({
          name: formName.trim(),
          address: formAddress.trim() || undefined,
          businessMode: formBusinessMode,
        });
        toast({ title: "Store created", description: `${formName} has been added.` });
      }

      setFormOpen(false);
      const list = await getOrgStores();
      setStoresState(list);
      refreshStoreContext(list);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Failed to save store";
      setFormError(msg);
      toast({ variant: "destructive", title: "Error", description: msg });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingStore) return;

    try {
      await deleteOrgStore(deletingStore.id);
      const deletedId = deletingStore.id;
      toast({ title: "Store deleted", description: `${deletingStore.name} has been deleted.` });
      setDeletingStore(null);
      const list = await getOrgStores();
      setStoresState(list);
      refreshStoreContext(list);
      if (activeStoreId === deletedId && list.length > 0) {
        setActiveStoreId(list[0].id);
      }
    } catch (e: unknown) {
      toast({
        variant: "destructive",
        title: "Error",
        description: e instanceof Error ? e.message : "Failed to delete store",
      });
    }
  };

  if (!isSaaS()) {
    return (
      <div className="p-6">
        <h1 className="text-3xl font-bold">Stores</h1>
        <p className="text-muted-foreground mt-2">
          Store management is available in SaaS mode only.
        </p>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Stores</h1>
          <p className="text-muted-foreground">Manage stores in your organization</p>
        </div>
        <Button onClick={openAddDialog} className="w-full md:w-auto" data-testid="stores-add">
          <Plus className="mr-2 h-4 w-4" />
          Add Store
        </Button>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
          <Input
            placeholder="Search stores by name or address..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); }}
            className="pl-10"
          />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Per page:</span>
          <Select value={String(itemsPerPage)} onValueChange={(v) => { setItemsPerPage(Number(v)); setCurrentPage(1); }}>
            <SelectTrigger className="w-20 h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[5, 10, 25, 50, 100].map((n) => (
                <SelectItem key={n} value={String(n)}>{n}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {error && (
        <div className="bg-destructive/10 text-destructive p-4 rounded-lg">{error}</div>
      )}

      {loading ? (
        <>
          <div className="hidden md:block border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Address</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {Array.from({ length: 8 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-48" /></TableCell>
                    <TableCell className="text-right"><Skeleton className="h-8 w-24 ml-auto" /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <div className="grid grid-cols-1 gap-4 md:hidden">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="bg-card rounded-lg border p-4 space-y-3 shadow-sm">
                <div className="flex justify-between items-start">
                  <div className="space-y-2 flex-1">
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-3 w-1/2" />
                  </div>
                </div>
                <div className="flex justify-end gap-2 pt-2 border-t">
                  <Skeleton className="h-8 w-14" />
                  <Skeleton className="h-8 w-16" />
                </div>
              </div>
            ))}
          </div>
        </>
      ) : filtered.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground border rounded-lg">
          {search ? "No stores found matching your search" : "No stores yet. Add your first store."}
        </div>
      ) : (
        <>
          <div className="hidden md:block border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Address</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedStores.map((store) => (
                  <TableRow key={store.id}>
                    <TableCell className="font-medium">{store.name}</TableCell>
                    <TableCell>
                      <Badge variant={store.businessMode === "fnb" ? "default" : "secondary"}>
                        {store.businessMode === "fnb" ? "F&B" : "Retail"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {store.address || "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openEditDialog(store)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setDeletingStore(store)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <div className="grid grid-cols-1 gap-4 md:hidden">
            {paginatedStores.map((store) => (
              <div
                key={store.id}
                className="bg-card rounded-lg border p-4 space-y-3 shadow-sm"
              >
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <h3 className="font-semibold flex items-center gap-2 flex-wrap">
                      <StoreIcon className="h-4 w-4 text-muted-foreground" />
                      {store.name}
                      <Badge variant={store.businessMode === "fnb" ? "default" : "secondary"} className="text-xs">
                        {store.businessMode === "fnb" ? "F&B" : "Retail"}
                      </Badge>
                    </h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      {store.address || "No address"}
                    </p>
                  </div>
                </div>
                <div className="flex items-center justify-end gap-2 pt-2 border-t">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8"
                    onClick={() => openEditDialog(store)}
                  >
                    <Edit className="w-4 h-4 mr-2" />
                    Edit
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 text-destructive"
                    onClick={() => setDeletingStore(store)}
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Delete
                  </Button>
                </div>
              </div>
            ))}
          </div>

          {filtered.length > 0 && (
            <div className="flex items-center justify-center gap-2 py-4">
              <Button
                variant="outline"
                size="sm"
                disabled={currentPage <= 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <div className="flex items-center gap-1">
                {Array.from({ length: totalPages }, (_, i) => i + 1)
                  .filter((p) => p === 1 || p === totalPages || (p >= currentPage - 2 && p <= currentPage + 2))
                  .map((p, idx, arr) => (
                    <span key={p} className="flex items-center gap-1">
                      {idx > 0 && arr[idx - 1] !== p - 1 && <span className="px-1">…</span>}
                      <Button
                        variant={currentPage === p ? "default" : "outline"}
                        size="sm"
                        className="min-w-8 h-8 p-0"
                        onClick={() => setCurrentPage(p)}
                      >
                        {p}
                      </Button>
                    </span>
                  ))}
              </div>
              <Button
                variant="outline"
                size="sm"
                disabled={currentPage >= totalPages}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}
        </>
      )}

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>{isEditing ? "Edit Store" : "Add New Store"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {formError && (
              <div className="bg-destructive/10 text-destructive p-3 rounded-lg text-sm">
                {formError}
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="store-name">Store name *</Label>
              <Input
                id="store-name"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="Main Store"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="store-address">Address (optional)</Label>
              <Input
                id="store-address"
                value={formAddress}
                onChange={(e) => setFormAddress(e.target.value)}
                placeholder="123 Main St, City"
              />
            </div>
            {!isEditing && (
              <div className="space-y-2">
                <Label>Store type</Label>
                <p className="text-xs text-muted-foreground">
                  Cannot be changed after creation. Create a new store if you need a different type.
                </p>
                <RadioGroup
                  value={formBusinessMode}
                  onValueChange={(v) => setFormBusinessMode(v as "retail" | "fnb")}
                  className="flex flex-col gap-2"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="retail" id="bm-retail" />
                    <Label htmlFor="bm-retail" className="font-normal cursor-pointer">
                      Retail (products & variants)
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="fnb" id="bm-fnb" />
                    <Label htmlFor="bm-fnb" className="font-normal cursor-pointer">
                      Food &amp; beverage (ingredients, menu, recipes)
                    </Label>
                  </div>
                </RadioGroup>
              </div>
            )}
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setFormOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Saving..." : isEditing ? "Update" : "Create"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deletingStore} onOpenChange={() => setDeletingStore(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete store?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete &quot;{deletingStore?.name}&quot; and all its products,
              categories, and sales data. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Stores;
