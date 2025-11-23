import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, Search, AlertTriangle, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Category, Product, Variant } from "@/types/pos";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const Inventory = () => {
  const [search, setSearch] = useState("");
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [formName, setFormName] = useState("");
  const [formCategoryId, setFormCategoryId] = useState<string | undefined>();
  const [formPrice, setFormPrice] = useState("");
  const [formStock, setFormStock] = useState("");
  const [formLowStock, setFormLowStock] = useState("");
  const [formItemCode, setFormItemCode] = useState("");
  const [formImage, setFormImage] = useState("");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [variantDialogOpen, setVariantDialogOpen] = useState(false);
  const [variantProduct, setVariantProduct] = useState<Product | null>(null);
  const [variantRows, setVariantRows] = useState<(Variant & { isNew?: boolean })[]>([]);
  const [variantSavingId, setVariantSavingId] = useState<string | null>(null);

  const load = async () => {
    try {
      setLoading(true);
      setError(null);
      const [cats, prods] = await Promise.all([
        api.getCategories(),
        api.getProducts(),
      ]);
      setCategories(cats as Category[]);
      setProducts(prods as Product[]);
    } catch (e: any) {
      setError(e.message ?? "Failed to load inventory");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const filtered = products.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase()),
  );
  const isEditing = !!editingProduct;

  const openAddDialog = () => {
    setEditingProduct(null);
    setFormName("");
    setFormCategoryId(undefined);
    setFormPrice("");
    setFormStock("");
    setFormLowStock("");
    setFormImage("");
    // Generate a simple item code we can later use for QR codes
    const code = `ITM-${Date.now().toString(36).toUpperCase().slice(-6)}`;
    setFormItemCode(code);
    setFormError(null);
    setFormOpen(true);
  };

  const openEditDialog = (product: Product) => {
    setEditingProduct(product);
    setFormName(product.name);
    setFormCategoryId(product.categoryId);
    setFormPrice(
      product.hasVariants
        ? product.variants?.[0]?.price?.toString() ?? ""
        : product.price?.toString() ?? "",
    );
    setFormStock(product.stock?.toString() ?? "");
    setFormLowStock(product.lowStockThreshold?.toString() ?? "");
    setFormItemCode(product.itemCode);
    setFormImage(product.image ?? "");
    setFormError(null);
    setFormOpen(true);
  };

  const handleSaveProduct = async () => {
    if (!formName.trim() || !formCategoryId) {
      setFormError("Name and category are required");
      return;
    }

    setFormError(null);

    try {
      setSaving(true);

      const basePayload = {
        name: formName.trim(),
        categoryId: formCategoryId,
        itemCode: formItemCode,
        price: formPrice ? parseFloat(formPrice) : undefined,
        stock: formStock ? parseInt(formStock, 10) : undefined,
        lowStockThreshold: formLowStock ? parseInt(formLowStock, 10) : undefined,
        image: formImage || undefined,
      };

      if (isEditing && editingProduct) {
        await api.updateProduct(editingProduct.id, basePayload);
      } else {
        await api.createProduct({
          ...basePayload,
          hasVariants: false,
          status: "active",
        });
      }

      setFormOpen(false);
      setEditingProduct(null);
      setFormName("");
      setFormCategoryId(undefined);
      setFormPrice("");
      setFormStock("");
      setFormLowStock("");
      setFormItemCode("");
      setFormImage("");

      await load();
    } catch (e: any) {
      setFormError(e.message ?? "Failed to create product");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteProduct = async (product: Product) => {
    const confirmed = window.confirm(
      `Delete product "${product.name}"? This cannot be undone.`,
    );
    if (!confirmed) return;

    try {
      setDeletingId(product.id);
      await api.deleteProduct(product.id);
      // Optimistically update table so the row disappears immediately
      setProducts((prev) => prev.filter((p) => p.id !== product.id));
      // Optionally re-load from server in background to stay in sync
      void load();
    } catch (e: any) {
      alert(e.message ?? "Failed to delete product");
    } finally {
      setDeletingId(null);
    }
  };

  const openVariantDialog = async (product: Product) => {
    setVariantProduct(product);
    setVariantDialogOpen(true);
    try {
      const variants = (await api.getVariants(product.id)) as Variant[];
      setVariantRows(variants);
    } catch (_e) {
      // Fallback to existing variants on product if API fails
      setVariantRows((product.variants as Variant[]) || []);
    }
  };

  const handleVariantFieldChange = (
    id: string,
    field: "name" | "price" | "stock",
    value: string,
  ) => {
    setVariantRows((rows) =>
      rows.map((row) =>
        row.id === id
          ? {
              ...row,
              [field]:
                field === "name" ? value : value === "" ? 0 : Number(value),
            }
          : row,
      ),
    );
  };

  const handleSaveVariant = async (row: Variant & { isNew?: boolean }) => {
    if (!variantProduct) return;
    if (!row.name.trim()) {
      alert("Variant name is required");
      return;
    }

    try {
      setVariantSavingId(row.id);
      if (row.isNew) {
        const created = (await api.createVariant(variantProduct.id, {
          name: row.name,
          price: row.price,
          stock: row.stock,
        })) as Variant;
        setVariantRows((rows) =>
          rows.map((r) => (r.id === row.id ? { ...created } : r)),
        );
      } else {
        const updated = (await api.updateVariant(row.id, {
          name: row.name,
          price: row.price,
          stock: row.stock,
        })) as Variant;
        setVariantRows((rows) =>
          rows.map((r) => (r.id === row.id ? { ...updated } : r)),
        );
      }
      // Refresh main list so POS / inventory gets latest variants
      void load();
    } catch (e: any) {
      alert(e.message ?? "Failed to save variant");
    } finally {
      setVariantSavingId(null);
    }
  };

  const handleDeleteVariant = async (row: Variant & { isNew?: boolean }) => {
    if (row.isNew) {
      setVariantRows((rows) => rows.filter((r) => r.id !== row.id));
      return;
    }
    const confirmed = window.confirm(
      `Delete variant "${row.name}"? This cannot be undone.`,
    );
    if (!confirmed) return;

    try {
      setVariantSavingId(row.id);
      await api.deleteVariant(row.id);
      setVariantRows((rows) => rows.filter((r) => r.id !== row.id));
      void load();
    } catch (e: any) {
      alert(e.message ?? "Failed to delete variant");
    } finally {
      setVariantSavingId(null);
    }
  };

  const handleAddVariantRow = () => {
    const tempId = `temp-${Date.now()}`;
    setVariantRows((rows) => [
      ...rows,
      { id: tempId, productId: variantProduct?.id ?? "", name: "", price: 0, stock: 0, isNew: true },
    ]);
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Inventory Management</h1>
          <p className="text-muted-foreground">Manage your products and stock levels</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={async () => {
            const XLSX = await import("xlsx");
            const rows: any[] = [];
            products.forEach((product) => {
              const category = categories.find((c) => c.id === product.categoryId);
              if (product.hasVariants && product.variants?.length) {
                product.variants.forEach((variant) => {
                  rows.push({
                    ItemCode: product.itemCode,
                    ProductName: product.name,
                    Category: category?.name ?? "",
                    Status: product.status,
                    HasVariants: product.hasVariants ? "Yes" : "No",
                    VariantName: variant.name,
                    VariantPrice: variant.price,
                    VariantStock: variant.stock,
                    BasePrice: "",
                    BaseStock: "",
                    LowStockThreshold: product.lowStockThreshold,
                  });
                });
              } else {
                rows.push({
                  ItemCode: product.itemCode,
                  ProductName: product.name,
                  Category: category?.name ?? "",
                  Status: product.status,
                  HasVariants: product.hasVariants ? "Yes" : "No",
                  VariantName: "",
                  VariantPrice: "",
                  VariantStock: "",
                  BasePrice: product.price ?? "",
                  BaseStock: product.stock ?? "",
                  LowStockThreshold: product.lowStockThreshold,
                });
              }
            });
            const ws = XLSX.utils.json_to_sheet(rows);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, "Items");
            const wbout = XLSX.write(wb, { bookType: "xlsx", type: "array" });
            const blob = new Blob([wbout], { type: "application/octet-stream" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = "inventory-items.xlsx";
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
          }}>
            Export
          </Button>
          <Dialog open={formOpen} onOpenChange={setFormOpen}>
            <Button className="gap-2" onClick={openAddDialog}>
              <Plus className="w-4 h-4" />
              Add Product
            </Button>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{isEditing ? "Edit Product" : "Add Product"}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-1">
                  <p className="text-sm font-medium">Item Code</p>
                  <Input
                    value={formItemCode}
                    readOnly
                    className="bg-muted/50"
                  />
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-medium">Name</p>
                  <Input
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    placeholder="Product name"
                    autoFocus
                  />
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-medium">Image (optional)</p>
                  <Input
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (!file) {
                        setFormImage("");
                        return;
                      }
                      const reader = new FileReader();
                      reader.onload = () => {
                        setFormImage(reader.result as string);
                      };
                      reader.readAsDataURL(file);
                    }}
                  />
                  {formImage && (
                    <img
                      src={formImage}
                      alt="Preview"
                      className="mt-2 h-20 w-20 rounded-md object-cover border"
                    />
                  )}
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-medium">Category</p>
                  <Select value={formCategoryId} onValueChange={setFormCategoryId}>
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
                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <p className="text-sm font-medium">Price</p>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={formPrice}
                      onChange={(e) => setFormPrice(e.target.value)}
                      placeholder="0.00"
                    />
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm font-medium">Stock</p>
                    <Input
                      type="number"
                      min="0"
                      value={formStock}
                      onChange={(e) => setFormStock(e.target.value)}
                      placeholder="0"
                    />
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm font-medium">Low stock</p>
                    <Input
                      type="number"
                      min="0"
                      value={formLowStock}
                      onChange={(e) => setFormLowStock(e.target.value)}
                      placeholder="0"
                    />
                  </div>
                </div>
                {formError && (
                  <p className="text-sm text-destructive">{formError}</p>
                )}
                <div className="flex justify-end gap-2 pt-2">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setFormOpen(false);
                      setEditingProduct(null);
                    }}
                  >
                    Cancel
                  </Button>
                  <Button onClick={handleSaveProduct} disabled={saving}>
                    {saving ? "Saving..." : isEditing ? "Save Changes" : "Save Product"}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="flex gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
          <Input
            placeholder="Search products..."
            className="pl-10"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="rounded-lg border bg-card">
        {loading && <p className="p-4 text-sm text-muted-foreground">Loading inventory...</p>}
        {error && !loading && (
          <p className="p-4 text-sm text-destructive">Failed to load: {error}</p>
        )}
        {!loading && !error && (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Product Name</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Variants</TableHead>
                <TableHead>Stock</TableHead>
                <TableHead>Price</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((product) => {
                const category = categories.find((c) => c.id === product.categoryId);
                const totalStock = product.hasVariants
                  ? product.variants?.reduce((sum, v) => sum + v.stock, 0)
                  : product.stock;
                const isLowStock = (totalStock || 0) <= product.lowStockThreshold;

                return (
                  <TableRow key={product.id}>
                    <TableCell className="font-medium">{product.name}</TableCell>
                    <TableCell>{category?.name}</TableCell>
                    <TableCell>
                      {product.hasVariants ? (
                        <Badge variant="outline">{product.variants?.length} variants</Badge>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {isLowStock && (
                          <AlertTriangle className="w-4 h-4 text-destructive" />
                        )}
                        <span className={isLowStock ? "text-destructive font-semibold" : ""}>
                          {totalStock}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      ${product.hasVariants ? product.variants?.[0]?.price : product.price}
                      {product.hasVariants && "+"}
                    </TableCell>
                    <TableCell>
                      <Badge variant={product.status === "active" ? "default" : "secondary"}>
                        {product.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right space-x-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openEditDialog(product)}
                      >
                        Edit
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openVariantDialog(product)}
                      >
                        Variants
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive"
                        onClick={() => handleDeleteProduct(product)}
                        disabled={deletingId === product.id}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </div>
      <Dialog open={variantDialogOpen} onOpenChange={setVariantDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Manage Variants{variantProduct ? ` - ${variantProduct.name}` : ""}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {variantRows.map((row) => (
              <div key={row.id} className="flex flex-wrap items-end gap-2">
                <div className="space-y-1 flex-1 min-w-[120px]">
                  <p className="text-xs font-medium">Name</p>
                  <Input
                    value={row.name}
                    onChange={(e) =>
                      handleVariantFieldChange(row.id, "name", e.target.value)
                    }
                    placeholder="Variant name"
                  />
                </div>
                <div className="space-y-1 flex-1 min-w-[80px] max-w-[140px]">
                  <p className="text-xs font-medium">Price</p>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={row.price}
                    onChange={(e) =>
                      handleVariantFieldChange(row.id, "price", e.target.value)
                    }
                  />
                </div>
                <div className="space-y-1 w-20">
                  <p className="text-xs font-medium">Stock</p>
                  <Input
                    type="number"
                    min="0"
                    value={row.stock}
                    onChange={(e) =>
                      handleVariantFieldChange(row.id, "stock", e.target.value)
                    }
                  />
                </div>
                <div className="flex gap-2 ml-auto">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleSaveVariant(row)}
                    disabled={variantSavingId === row.id}
                  >
                    Save
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive"
                    onClick={() => handleDeleteVariant(row)}
                    disabled={variantSavingId === row.id}
                  >
                    Delete
                  </Button>
                </div>
              </div>
            ))}
            <Button variant="outline" size="sm" onClick={handleAddVariantRow}>
              Add Variant
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Inventory;
