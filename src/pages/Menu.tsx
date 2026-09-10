import { useCallback, useEffect, useMemo, useState } from "react";
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
import { Plus, Search, Trash2, Edit, BookOpen } from "lucide-react";
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
import { useToast } from "@/hooks/use-toast";
import { isSaaS } from "@/config/appMode";
import { useDataLayer } from "@/contexts/DataLayerContext";
import { useStore } from "@/contexts/StoreContext";
import type { Ingredient, MenuCategory, MenuItem } from "@/types/pos";
import { formatCurrency } from "@/lib/currency";
import { cn } from "@/lib/utils";

const Menu = () => {
  const dataService = useDataLayer();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { activeStoreId, stores, storesLoading } = useStore();
  const isFnb = isSaaS() && stores.find((s) => s.id === activeStoreId)?.businessMode === "fnb";
  const sid = activeStoreId !== "default" ? activeStoreId : undefined;

  const [categories, setCategories] = useState<MenuCategory[]>([]);
  const [items, setItems] = useState<MenuItem[]>([]);
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);

  const [catDialogOpen, setCatDialogOpen] = useState(false);
  const [editingCat, setEditingCat] = useState<MenuCategory | null>(null);
  const [catName, setCatName] = useState("");
  const [catSaving, setCatSaving] = useState(false);

  const [itemDialogOpen, setItemDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);
  const [itemCategoryId, setItemCategoryId] = useState("");
  const [itemName, setItemName] = useState("");
  const [itemPrice, setItemPrice] = useState("");
  const [itemBarcode, setItemBarcode] = useState("");
  const [itemStatus, setItemStatus] = useState("active");
  const [itemSaving, setItemSaving] = useState(false);
  const [itemError, setItemError] = useState<string | null>(null);

  const [recipeOpen, setRecipeOpen] = useState(false);
  const [recipeItem, setRecipeItem] = useState<MenuItem | null>(null);
  const [recipeLines, setRecipeLines] = useState<
    Array<{ ingredientId: string; quantity: string; wastagePercent: string }>
  >([]);
  const [recipeSaving, setRecipeSaving] = useState(false);

  const [deletingItem, setDeletingItem] = useState<MenuItem | null>(null);
  const [deletingCat, setDeletingCat] = useState<MenuCategory | null>(null);

  const refresh = useCallback(async () => {
    const [cats, allItems, ings] = await Promise.all([
      dataService.getMenuCategories(sid),
      dataService.getMenuItems(undefined, sid),
      dataService.getIngredients(sid),
    ]);
    setCategories(cats as MenuCategory[]);
    setItems(allItems as MenuItem[]);
    setIngredients(ings as Ingredient[]);
  }, [dataService, sid]);

  useEffect(() => {
    if (!isSaaS()) return;
    if (storesLoading) return;
    if (!isFnb) {
      navigate("/categories", { replace: true });
      return;
    }
    const load = async () => {
      try {
        setLoading(true);
        await refresh();
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : "Failed to load menu";
        toast({ variant: "destructive", title: "Error", description: msg });
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, [isFnb, navigate, refresh, storesLoading, toast]);

  const filteredItems = useMemo(() => {
    let list = items;
    if (selectedCategoryId) {
      list = list.filter((m) => m.menuCategoryId === selectedCategoryId);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((m) => m.name.toLowerCase().includes(q));
    }
    return list;
  }, [items, search, selectedCategoryId]);

  const openNewCategory = () => {
    setEditingCat(null);
    setCatName("");
    setCatDialogOpen(true);
  };

  const saveCategory = async () => {
    if (!catName.trim()) {
      toast({ variant: "destructive", title: "Name required" });
      return;
    }
    try {
      setCatSaving(true);
      if (editingCat) {
        await dataService.updateMenuCategory(editingCat.id, { name: catName.trim() }, sid);
        toast({ title: "Category updated" });
      } else {
        await dataService.createMenuCategory({ name: catName.trim() }, sid);
        toast({ title: "Category created" });
      }
      setCatDialogOpen(false);
      await refresh();
    } catch (e: unknown) {
      toast({
        variant: "destructive",
        title: "Error",
        description: e instanceof Error ? e.message : "Failed",
      });
    } finally {
      setCatSaving(false);
    }
  };

  const openNewItem = () => {
    setEditingItem(null);
    setItemCategoryId(categories[0]?.id ?? "");
    setItemName("");
    setItemPrice("");
    setItemBarcode("");
    setItemStatus("active");
    setItemError(null);
    setItemDialogOpen(true);
  };

  const openEditItem = (m: MenuItem) => {
    setEditingItem(m);
    setItemCategoryId(m.menuCategoryId);
    setItemName(m.name);
    setItemPrice(String(m.price));
    setItemBarcode(m.barcode ?? "");
    setItemStatus(m.status);
    setItemError(null);
    setItemDialogOpen(true);
  };

  const saveItem = async () => {
    if (!itemName.trim()) {
      setItemError("Name is required");
      return;
    }
    if (!itemCategoryId) {
      setItemError("Category is required");
      return;
    }
    const price = Number.parseFloat(itemPrice);
    if (Number.isNaN(price) || price < 0) {
      setItemError("Valid price required");
      return;
    }
    try {
      setItemSaving(true);
      setItemError(null);
      if (editingItem) {
        await dataService.updateMenuItem(
          editingItem.id,
          {
            menuCategoryId: itemCategoryId,
            name: itemName.trim(),
            price,
            barcode: itemBarcode.trim() || null,
            status: itemStatus,
          },
          sid,
        );
        toast({ title: "Menu item updated" });
      } else {
        await dataService.createMenuItem(
          {
            menuCategoryId: itemCategoryId,
            name: itemName.trim(),
            price,
            barcode: itemBarcode.trim() || undefined,
            status: itemStatus,
          },
          sid,
        );
        toast({ title: "Menu item created" });
      }
      setItemDialogOpen(false);
      await refresh();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Save failed";
      setItemError(msg);
      toast({ variant: "destructive", title: "Error", description: msg });
    } finally {
      setItemSaving(false);
    }
  };

  const openRecipe = (m: MenuItem) => {
    setRecipeItem(m);
    const lines = (m.recipeLines ?? []).map((l) => ({
      ingredientId: l.ingredientId,
      quantity: String(l.quantity),
      wastagePercent: l.wastagePercent != null ? String(l.wastagePercent) : "",
    }));
    setRecipeLines(lines.length ? lines : [{ ingredientId: "", quantity: "", wastagePercent: "" }]);
    setRecipeOpen(true);
  };

  const saveRecipe = async () => {
    if (!recipeItem) return;
    const parsed: Array<{ ingredientId: string; quantity: number; wastagePercent?: number }> = [];
    const seen = new Set<string>();
    for (const row of recipeLines) {
      if (!row.ingredientId.trim()) continue;
      if (seen.has(row.ingredientId)) {
        toast({ variant: "destructive", title: "Duplicate ingredient in recipe" });
        return;
      }
      seen.add(row.ingredientId);
      const qty = Number.parseFloat(row.quantity);
      if (Number.isNaN(qty) || qty < 0) {
        toast({ variant: "destructive", title: "Invalid quantity" });
        return;
      }
      const w = row.wastagePercent.trim()
        ? Number.parseFloat(row.wastagePercent)
        : undefined;
      if (w !== undefined && (Number.isNaN(w) || w < 0)) {
        toast({ variant: "destructive", title: "Invalid wastage %" });
        return;
      }
      parsed.push({
        ingredientId: row.ingredientId,
        quantity: qty,
        ...(w !== undefined ? { wastagePercent: w } : {}),
      });
    }
    try {
      setRecipeSaving(true);
      await dataService.replaceMenuItemRecipe(recipeItem.id, { lines: parsed }, sid);
      toast({ title: "Recipe saved" });
      setRecipeOpen(false);
      setRecipeItem(null);
      await refresh();
    } catch (e: unknown) {
      toast({
        variant: "destructive",
        title: "Error",
        description: e instanceof Error ? e.message : "Failed to save recipe",
      });
    } finally {
      setRecipeSaving(false);
    }
  };

  const deleteItem = async () => {
    if (!deletingItem) return;
    try {
      await dataService.deleteMenuItem(deletingItem.id, sid);
      toast({ title: "Menu item deleted" });
      setDeletingItem(null);
      await refresh();
    } catch (e: unknown) {
      toast({
        variant: "destructive",
        title: "Error",
        description: e instanceof Error ? e.message : "Delete failed",
      });
    }
  };

  const deleteCategory = async () => {
    if (!deletingCat) return;
    try {
      await dataService.deleteMenuCategory(deletingCat.id, sid);
      toast({ title: "Category deleted" });
      setDeletingCat(null);
      if (selectedCategoryId === deletingCat.id) setSelectedCategoryId(null);
      await refresh();
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
        <h1 className="text-3xl font-bold">Menu</h1>
        <p className="text-muted-foreground mt-2">Available in SaaS mode only.</p>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col lg:flex-row gap-6">
        <aside className="w-full lg:w-56 shrink-0 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">Categories</h2>
            <Button variant="outline" size="sm" onClick={openNewCategory}>
              <Plus className="h-4 w-4" />
            </Button>
          </div>
          <div className="border rounded-lg divide-y max-h-[420px] overflow-y-auto">
            <button
              type="button"
              className={cn(
                "w-full text-left px-3 py-2 text-sm hover:bg-muted/80 transition-colors",
                !selectedCategoryId && "bg-muted font-medium",
              )}
              onClick={() => setSelectedCategoryId(null)}
            >
              All items
            </button>
            {categories.map((c) => (
              <div
                key={c.id}
                className={cn(
                  "flex items-center gap-1 px-2 py-1",
                  selectedCategoryId === c.id && "bg-muted",
                )}
              >
                <button
                  type="button"
                  className="flex-1 text-left px-1 py-1.5 text-sm rounded hover:bg-muted/60"
                  onClick={() => setSelectedCategoryId(c.id)}
                >
                  {c.name}
                </button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 shrink-0"
                  onClick={() => {
                    setEditingCat(c);
                    setCatName(c.name);
                    setCatDialogOpen(true);
                  }}
                >
                  <Edit className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 shrink-0 text-destructive"
                  onClick={() => setDeletingCat(c)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
          </div>
        </aside>

        <div className="flex-1 min-w-0 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h1 className="text-3xl font-bold">Menu</h1>
              <p className="text-muted-foreground text-sm">Items sold on POS and linked to ingredient recipes</p>
            </div>
            <Button onClick={openNewItem} disabled={!categories.length}>
              <Plus className="mr-2 h-4 w-4" />
              Add menu item
            </Button>
          </div>

          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <Input
              placeholder="Search menu items..."
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
                    <TableHead>Price</TableHead>
                    <TableHead>Recipe</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell>
                        <Skeleton className="h-4 w-36" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-4 w-16" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-4 w-24" />
                      </TableCell>
                      <TableCell className="text-right">
                        <Skeleton className="h-8 w-24 ml-auto" />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground border rounded-lg">
              {!categories.length
                ? "Create a category first, then add menu items."
                : "No items in this view."}
            </div>
          ) : (
            <div className="border rounded-lg overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Price</TableHead>
                    <TableHead>Recipe lines</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredItems.map((m) => (
                    <TableRow key={m.id}>
                      <TableCell className="font-medium">{m.name}</TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {m.menuCategory?.name ?? categories.find((c) => c.id === m.menuCategoryId)?.name ?? "—"}
                      </TableCell>
                      <TableCell>{formatCurrency(m.price)}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {(m.recipeLines ?? []).length} ingredient
                        {(m.recipeLines ?? []).length === 1 ? "" : "s"}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1 flex-wrap">
                          <Button variant="outline" size="sm" onClick={() => openRecipe(m)}>
                            <BookOpen className="h-3.5 w-3.5 mr-1" />
                            Recipe
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => openEditItem(m)}>
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => setDeletingItem(m)}>
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
        </div>
      </div>

      <Dialog open={catDialogOpen} onOpenChange={setCatDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingCat ? "Edit category" : "New category"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label>Name</Label>
            <Input value={catName} onChange={(e) => setCatName(e.target.value)} />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setCatDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => void saveCategory()} disabled={catSaving}>
              {catSaving ? "Saving…" : "Save"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={itemDialogOpen} onOpenChange={setItemDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingItem ? "Edit menu item" : "New menu item"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            {itemError && (
              <div className="text-sm text-destructive bg-destructive/10 p-2 rounded">{itemError}</div>
            )}
            <div className="space-y-1">
              <Label>Category</Label>
              <Select value={itemCategoryId} onValueChange={setItemCategoryId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Name</Label>
              <Input value={itemName} onChange={(e) => setItemName(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Price</Label>
              <Input value={itemPrice} onChange={(e) => setItemPrice(e.target.value)} inputMode="decimal" />
            </div>
            <div className="space-y-1">
              <Label>Barcode (optional)</Label>
              <Input value={itemBarcode} onChange={(e) => setItemBarcode(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Status</Label>
              <Input value={itemStatus} onChange={(e) => setItemStatus(e.target.value)} placeholder="active" />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setItemDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => void saveItem()} disabled={itemSaving}>
              {itemSaving ? "Saving…" : "Save"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={recipeOpen} onOpenChange={setRecipeOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Recipe: {recipeItem?.name}</DialogTitle>
          </DialogHeader>
          <p className="text-xs text-muted-foreground">
            Quantities use the same units as ingredients (e.g. grams). POS deducts stock when the item is sold.
          </p>
          <div className="space-y-3 py-2">
            {recipeLines.map((row, idx) => (
              <div key={idx} className="grid grid-cols-12 gap-2 items-end">
                <div className="col-span-12 sm:col-span-5 space-y-1">
                  <Label className="text-xs">Ingredient</Label>
                  <Select
                    value={row.ingredientId || "__none__"}
                    onValueChange={(v) => {
                      const next = [...recipeLines];
                      next[idx] = { ...next[idx], ingredientId: v === "__none__" ? "" : v };
                      setRecipeLines(next);
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">—</SelectItem>
                      {ingredients.map((ing) => (
                        <SelectItem key={ing.id} value={ing.id}>
                          {ing.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="col-span-5 sm:col-span-3 space-y-1">
                  <Label className="text-xs">Qty</Label>
                  <Input
                    value={row.quantity}
                    onChange={(e) => {
                      const next = [...recipeLines];
                      next[idx] = { ...next[idx], quantity: e.target.value };
                      setRecipeLines(next);
                    }}
                    inputMode="decimal"
                  />
                </div>
                <div className="col-span-5 sm:col-span-3 space-y-1">
                  <Label className="text-xs">Wastage %</Label>
                  <Input
                    value={row.wastagePercent}
                    onChange={(e) => {
                      const next = [...recipeLines];
                      next[idx] = { ...next[idx], wastagePercent: e.target.value };
                      setRecipeLines(next);
                    }}
                    inputMode="decimal"
                    placeholder="optional"
                  />
                </div>
                <div className="col-span-2 sm:col-span-1 flex justify-end">
                  <Button
                    variant="ghost"
                    size="icon"
                    type="button"
                    onClick={() => setRecipeLines(recipeLines.filter((_, i) => i !== idx))}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() =>
                setRecipeLines([...recipeLines, { ingredientId: "", quantity: "", wastagePercent: "" }])
              }
            >
              <Plus className="h-4 w-4 mr-1" />
              Add line
            </Button>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setRecipeOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => void saveRecipe()} disabled={recipeSaving || !ingredients.length}>
              {recipeSaving ? "Saving…" : "Save recipe"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deletingItem} onOpenChange={() => setDeletingItem(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete menu item?</AlertDialogTitle>
            <AlertDialogDescription>
              Permanently remove &quot;{deletingItem?.name}&quot; and its recipe.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => void deleteItem()}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!deletingCat} onOpenChange={() => setDeletingCat(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete category?</AlertDialogTitle>
            <AlertDialogDescription>
              Remove &quot;{deletingCat?.name}&quot;? Delete or move menu items first if the operation fails.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => void deleteCategory()}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Menu;
