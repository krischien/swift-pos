import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
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
import { Plus, Search, Trash2, Edit } from "lucide-react";
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
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { isSaaS } from "@/config/appMode";
import { useDataLayer } from "@/contexts/DataLayerContext";
import { useStore } from "@/contexts/StoreContext";
import type { Ingredient } from "@/types/pos";

const Ingredients = () => {
  const dataService = useDataLayer();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { activeStoreId, stores, storesLoading } = useStore();
  const isFnb = isSaaS() && stores.find((s) => s.id === activeStoreId)?.businessMode === "fnb";

  const [rows, setRows] = useState<Ingredient[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Ingredient | null>(null);
  const [formName, setFormName] = useState("");
  const [formSku, setFormSku] = useState("");
  const [formBarcode, setFormBarcode] = useState("");
  const [formStock, setFormStock] = useState("0");
  const [formLow, setFormLow] = useState("0");
  const [formUom, setFormUom] = useState("PCS");
  const [formStatus, setFormStatus] = useState("active");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<Ingredient | null>(null);

  useEffect(() => {
    if (!isSaaS()) return;
    if (storesLoading) return;
    if (!isFnb) {
      navigate("/inventory", { replace: true });
      return;
    }
    const load = async () => {
      try {
        setLoading(true);
        const list = await dataService.getIngredients(
          activeStoreId !== "default" ? activeStoreId : undefined,
        );
        setRows(list as Ingredient[]);
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : "Failed to load ingredients";
        toast({ variant: "destructive", title: "Error", description: msg });
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, [activeStoreId, dataService, isFnb, navigate, storesLoading, toast]);

  const openCreate = () => {
    setEditing(null);
    setFormName("");
    setFormSku("");
    setFormBarcode("");
    setFormStock("0");
    setFormLow("0");
    setFormUom("PCS");
    setFormStatus("active");
    setFormError(null);
    setFormOpen(true);
  };

  const openEdit = (ing: Ingredient) => {
    setEditing(ing);
    setFormName(ing.name);
    setFormSku(ing.sku ?? "");
    setFormBarcode(ing.barcode ?? "");
    setFormStock(String(ing.stock));
    setFormLow(String(ing.lowStockThreshold));
    setFormUom(ing.unitOfMeasure ?? "PCS");
    setFormStatus(ing.status);
    setFormError(null);
    setFormOpen(true);
  };

  const handleSave = async () => {
    if (!formName.trim()) {
      setFormError("Name is required");
      return;
    }
    const stock = Number.parseInt(formStock, 10);
    const low = Number.parseInt(formLow, 10);
    if (Number.isNaN(stock) || stock < 0) {
      setFormError("Stock must be a non-negative whole number");
      return;
    }
    if (Number.isNaN(low) || low < 0) {
      setFormError("Low stock threshold must be a non-negative whole number");
      return;
    }
    try {
      setSaving(true);
      setFormError(null);
      const sid = activeStoreId !== "default" ? activeStoreId : undefined;
      if (editing) {
        await dataService.updateIngredient(
          editing.id,
          {
            name: formName.trim(),
            sku: formSku.trim() || null,
            barcode: formBarcode.trim() || null,
            stock,
            lowStockThreshold: low,
            unitOfMeasure: formUom.trim() || "PCS",
            status: formStatus,
          },
          sid,
        );
        toast({ title: "Ingredient updated" });
      } else {
        await dataService.createIngredient(
          {
            name: formName.trim(),
            sku: formSku.trim() || undefined,
            barcode: formBarcode.trim() || undefined,
            stock,
            lowStockThreshold: low,
            unitOfMeasure: formUom.trim() || "PCS",
            status: formStatus,
          },
          sid,
        );
        toast({ title: "Ingredient created" });
      }
      setFormOpen(false);
      const list = await dataService.getIngredients(sid);
      setRows(list as Ingredient[]);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Save failed";
      setFormError(msg);
      toast({ variant: "destructive", title: "Error", description: msg });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleting) return;
    try {
      await dataService.deleteIngredient(
        deleting.id,
        activeStoreId !== "default" ? activeStoreId : undefined,
      );
      toast({ title: "Ingredient deleted" });
      setDeleting(null);
      const list = await dataService.getIngredients(
        activeStoreId !== "default" ? activeStoreId : undefined,
      );
      setRows(list as Ingredient[]);
    } catch (e: unknown) {
      toast({
        variant: "destructive",
        title: "Error",
        description: e instanceof Error ? e.message : "Delete failed",
      });
    }
  };

  if (!isSaaS()) {
    return (
      <div className="p-6">
        <h1 className="text-3xl font-bold">Ingredients</h1>
        <p className="text-muted-foreground mt-2">Available in SaaS mode only.</p>
      </div>
    );
  }

  const filtered = rows.filter(
    (r) =>
      r.name.toLowerCase().includes(search.toLowerCase()) ||
      (r.sku ?? "").toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Ingredients</h1>
          <p className="text-muted-foreground">Stock for F&amp;B recipes (not sold directly on POS)</p>
        </div>
        <Button onClick={openCreate} className="w-full md:w-auto">
          <Plus className="mr-2 h-4 w-4" />
          Add ingredient
        </Button>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
        <Input
          placeholder="Search by name or SKU..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10"
        />
      </div>

      {loading ? (
        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Stock</TableHead>
                <TableHead>UOM</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {Array.from({ length: 6 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell>
                    <Skeleton className="h-4 w-40" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-4 w-12" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-4 w-16" />
                  </TableCell>
                  <TableCell className="text-right">
                    <Skeleton className="h-8 w-20 ml-auto" />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground border rounded-lg">
          {search ? "No matching ingredients" : "No ingredients yet. Add one to build menu recipes."}
        </div>
      ) : (
        <div className="border rounded-lg overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>SKU</TableHead>
                <TableHead>Stock</TableHead>
                <TableHead>Low</TableHead>
                <TableHead>UOM</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">{r.name}</TableCell>
                  <TableCell className="text-muted-foreground text-sm">{r.sku ?? "—"}</TableCell>
                  <TableCell>{r.stock}</TableCell>
                  <TableCell>{r.lowStockThreshold}</TableCell>
                  <TableCell>{r.unitOfMeasure ?? "—"}</TableCell>
                  <TableCell className="capitalize text-sm">{r.status}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(r)}>
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => setDeleting(r)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit ingredient" : "New ingredient"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            {formError && (
              <div className="text-sm text-destructive bg-destructive/10 p-2 rounded">{formError}</div>
            )}
            <div className="space-y-1">
              <Label>Name *</Label>
              <Input value={formName} onChange={(e) => setFormName(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label>Stock (int)</Label>
                <Input value={formStock} onChange={(e) => setFormStock(e.target.value)} inputMode="numeric" />
              </div>
              <div className="space-y-1">
                <Label>Low threshold</Label>
                <Input value={formLow} onChange={(e) => setFormLow(e.target.value)} inputMode="numeric" />
              </div>
            </div>
            <div className="space-y-1">
              <Label>Unit of measure</Label>
              <Input value={formUom} onChange={(e) => setFormUom(e.target.value)} placeholder="g, ml, PCS…" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label>SKU</Label>
                <Input value={formSku} onChange={(e) => setFormSku(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label>Barcode</Label>
                <Input value={formBarcode} onChange={(e) => setFormBarcode(e.target.value)} />
              </div>
            </div>
            <div className="space-y-1">
              <Label>Status</Label>
              <Input value={formStatus} onChange={(e) => setFormStatus(e.target.value)} placeholder="active" />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setFormOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => void handleSave()} disabled={saving}>
              {saving ? "Saving…" : editing ? "Update" : "Create"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleting} onOpenChange={() => setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete ingredient?</AlertDialogTitle>
            <AlertDialogDescription>
              Remove &quot;{deleting?.name}&quot;? Recipe lines referencing it must be updated first.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => void handleDelete()}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Ingredients;
