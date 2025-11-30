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
import { Plus, Search, AlertTriangle, Trash2, Download, ChevronDown, Barcode, QrCode, FileSpreadsheet } from "lucide-react";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Category, Product, Variant } from "@/types/pos";
import { formatCurrency } from "@/lib/currency";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const Inventory = () => {
  const [search, setSearch] = useState("");
  const [stockFilter, setStockFilter] = useState<"all" | "lowStock">("all");
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [formName, setFormName] = useState("");
  const [formCategoryId, setFormCategoryId] = useState<string | undefined>();
  const [formBasePrice, setFormBasePrice] = useState("");
  const [formPrice, setFormPrice] = useState("");
  const [formStock, setFormStock] = useState("");
  const [formLowStock, setFormLowStock] = useState("");
  const [formItemCode, setFormItemCode] = useState("");
  const [formSku, setFormSku] = useState("");
  const [formMarginPercentage, setFormMarginPercentage] = useState("");
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

  // Auto-calculate selling price from base price and margin percentage
  useEffect(() => {
    if (formBasePrice) {
      const basePrice = parseFloat(formBasePrice);
      const marginPercent = formMarginPercentage ? parseFloat(formMarginPercentage) : 0;
      if (!isNaN(basePrice) && basePrice >= 0 && !isNaN(marginPercent) && marginPercent >= 0) {
        const calculatedPrice = basePrice * (1 + marginPercent / 100);
        setFormPrice(calculatedPrice.toFixed(2));
      }
    } else {
      // If no base price, set selling price to empty or 0
      if (!formPrice || formPrice === "0.00") {
        setFormPrice("");
      }
    }
  }, [formBasePrice, formMarginPercentage]);

  // Helper function to check if product is low in stock
  const isLowStock = (product: Product): boolean => {
    const totalStock = product.hasVariants
      ? product.variants?.reduce((sum, v) => sum + v.stock, 0)
      : product.stock;
    return (totalStock || 0) <= product.lowStockThreshold;
  };

  const filtered = products.filter((p) => {
    // Apply search filter
    const matchesSearch = p.name.toLowerCase().includes(search.toLowerCase());
    if (!matchesSearch) return false;
    
    // Apply stock filter
    if (stockFilter === "lowStock") {
      return isLowStock(p);
    }
    return true; // "all" - show all products
  });
  
  // Calculate low stock count (from all products, not filtered)
  const lowStockCount = products.filter((product) => isLowStock(product)).length;
  
  const isEditing = !!editingProduct;

  const openAddDialog = () => {
    setEditingProduct(null);
    setFormName("");
    setFormCategoryId(undefined);
    setFormBasePrice("");
    setFormPrice("");
    setFormStock("");
    setFormLowStock("");
    setFormMarginPercentage("0");
    setFormImage("");
    // Generate a simple item code we can later use for QR codes
    const code = `ITM-${Date.now().toString(36).toUpperCase().slice(-6)}`;
    setFormItemCode(code);
    // Generate SKU with a different format
    const sku = `SKU-${Date.now().toString(36).toUpperCase().slice(-8)}`;
    setFormSku(sku);
    setFormError(null);
    setFormOpen(true);
  };

  const openEditDialog = (product: Product) => {
    setEditingProduct(product);
    setFormName(product.name);
    setFormCategoryId(product.categoryId);
    setFormBasePrice(product.basePrice?.toString() ?? "");
    setFormPrice(
      product.hasVariants
        ? product.variants?.[0]?.price?.toString() ?? ""
        : product.price?.toString() ?? "",
    );
    setFormStock(product.stock?.toString() ?? "");
    setFormLowStock(product.lowStockThreshold?.toString() ?? "");
    setFormItemCode(product.itemCode);
    setFormSku(product.sku ?? "");
    setFormMarginPercentage(product.marginPercentage?.toString() ?? "0");
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
        sku: formSku.trim() || undefined,
        basePrice: formBasePrice ? parseFloat(formBasePrice) : undefined,
        price: formPrice ? parseFloat(formPrice) : undefined,
        stock: formStock ? parseInt(formStock, 10) : undefined,
        lowStockThreshold: formLowStock ? parseInt(formLowStock, 10) : undefined,
        marginPercentage: formMarginPercentage ? parseFloat(formMarginPercentage) : undefined,
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
      setFormBasePrice("");
      setFormPrice("");
      setFormStock("");
      setFormLowStock("");
      setFormItemCode("");
      setFormSku("");
      setFormMarginPercentage("");
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

  const handleExportProductList = async () => {
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
  };

  const handleExportLowStockList = async () => {
    const XLSX = await import("xlsx");
    
    // Filter products that are low in stock
    const lowStockProducts = products.filter((product) => isLowStock(product));
    
    if (lowStockProducts.length === 0) {
      alert("No low stock items found.");
      return;
    }
    
    const rows: any[] = [];
    lowStockProducts.forEach((product) => {
      // Calculate inventory count (handling variants)
      const inventoryCount = product.hasVariants
        ? product.variants?.reduce((sum, v) => sum + v.stock, 0) || 0
        : product.stock || 0;
      
      rows.push({
        ItemCode: product.itemCode || "",
        SKU: product.sku || "",
        Name: product.name,
        "Inventory Count": inventoryCount,
      });
    });
    
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Low Stock Items");
    const wbout = XLSX.write(wb, { bookType: "xlsx", type: "array" });
    const blob = new Blob([wbout], { type: "application/octet-stream" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "low-stock-items.xlsx";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleExportBarcodeList = async () => {
    // Filter products that have barcodes
    const productsWithBarcodes = products.filter(
      (p) => p.barcode && p.itemCode && p.status === "active"
    );

    if (productsWithBarcodes.length === 0) {
      alert("No products with barcodes found. Please ensure products have Item Codes and barcodes are generated.");
      return;
    }

    try {
      const { Document, Packer, Paragraph, Table, TableRow, TableCell, WidthType, AlignmentType, ImageRun, TextRun } = await import("docx");

      // Helper function to convert data URI to base64 string
      const dataUriToBase64 = (dataUri: string): string => {
        return dataUri.split(",")[1];
      };

      // Helper function to convert base64 to Uint8Array
      const base64ToUint8Array = (base64: string): Uint8Array => {
        const binaryString = atob(base64);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        return bytes;
      };

      // Helper function to get image dimensions from base64
      const getImageDimensions = (base64: string): Promise<{ width: number; height: number }> => {
        return new Promise((resolve) => {
          const img = new Image();
          img.onload = () => {
            // Scale to fit label width (max 120px width, maintain aspect ratio - smaller for price tags)
            const maxWidth = 120;
            const scale = maxWidth / img.width;
            resolve({
              width: Math.round(img.width * scale),
              height: Math.round(img.height * scale),
            });
          };
          img.onerror = () => resolve({ width: 120, height: 60 });
          img.src = `data:image/png;base64,${base64}`;
        });
      };

      // Create table rows with 3 columns each
      const rows = [];
      for (let i = 0; i < productsWithBarcodes.length; i += 3) {
        const rowProducts = productsWithBarcodes.slice(i, i + 3);
        const cells = [];

        for (const product of rowProducts) {
          const base64 = dataUriToBase64(product.barcode!);
          const dimensions = await getImageDimensions(base64);
          const imageData = base64ToUint8Array(base64);
          const priceText = product.price ? formatCurrency(product.price) : "N/A";

          const cellContent = [
            new Paragraph({
              children: [
                new TextRun({
                  text: product.name,
                  bold: true,
                  size: 28, // 14pt - bigger and bolder for product name
                }),
              ],
              alignment: AlignmentType.CENTER,
              spacing: { after: 150 },
            }),
            new Paragraph({
              children: [
                new TextRun({
                  text: priceText,
                  bold: true,
                  size: 32, // 16pt - price
                }),
              ],
              alignment: AlignmentType.CENTER,
              spacing: { after: 150 },
            }),
            new Paragraph({
              children: [
                new ImageRun({
                  data: imageData,
                  transformation: {
                    width: dimensions.width,
                    height: dimensions.height,
                  },
                  type: "png",
                }),
              ],
              alignment: AlignmentType.CENTER,
              spacing: { after: 150 },
            }),
            new Paragraph({
              children: [
                new TextRun({
                  text: product.itemCode || "",
                  bold: false, // Not bold
                  size: 18, // 9pt - smaller
                }),
              ],
              alignment: AlignmentType.CENTER,
            }),
          ];

          cells.push(
            new TableCell({
              children: cellContent,
              width: { size: 33.33, type: WidthType.PERCENTAGE },
              margins: { top: 200, bottom: 200, left: 200, right: 200 },
            })
          );
        }

        // Fill remaining cells if row has less than 3 products
        while (cells.length < 3) {
          cells.push(
            new TableCell({
              children: [],
              width: { size: 33.33, type: WidthType.PERCENTAGE },
            })
          );
        }

        rows.push(new TableRow({ children: cells }));
      }

      const doc = new Document({
        sections: [
          {
            children: [
              new Table({
                rows,
                width: { size: 100, type: WidthType.PERCENTAGE },
              }),
            ],
          },
        ],
      });

      const blob = await Packer.toBlob(doc);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "barcode-list.docx";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Failed to generate barcode list:", error);
      alert("Failed to generate barcode list. Please try again.");
    }
  };

  const handleExportQRList = async () => {
    // Filter products that have QR codes
    const productsWithQRCodes = products.filter(
      (p) => p.qrCode && p.itemCode && p.status === "active"
    );

    if (productsWithQRCodes.length === 0) {
      alert("No products with QR codes found. Please ensure products have Item Codes and QR codes are generated.");
      return;
    }

    try {
      const { Document, Packer, Paragraph, Table, TableRow, TableCell, WidthType, AlignmentType, ImageRun, TextRun } = await import("docx");

      // Helper function to convert data URI to base64 string
      const dataUriToBase64 = (dataUri: string): string => {
        return dataUri.split(",")[1];
      };

      // Helper function to convert base64 to Uint8Array
      const base64ToUint8Array = (base64: string): Uint8Array => {
        const binaryString = atob(base64);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        return bytes;
      };

      // Helper function to get image dimensions from base64
      const getImageDimensions = (base64: string): Promise<{ width: number; height: number }> => {
        return new Promise((resolve) => {
          const img = new Image();
          img.onload = () => {
            // Scale to fit label width (max 120px width, maintain aspect ratio - smaller for price tags)
            const maxWidth = 120;
            const scale = maxWidth / img.width;
            resolve({
              width: Math.round(img.width * scale),
              height: Math.round(img.height * scale),
            });
          };
          img.onerror = () => resolve({ width: 120, height: 120 });
          img.src = `data:image/png;base64,${base64}`;
        });
      };

      // Create table rows with 3 columns each
      const rows = [];
      for (let i = 0; i < productsWithQRCodes.length; i += 3) {
        const rowProducts = productsWithQRCodes.slice(i, i + 3);
        const cells = [];

        for (const product of rowProducts) {
          const base64 = dataUriToBase64(product.qrCode!);
          const dimensions = await getImageDimensions(base64);
          const imageData = base64ToUint8Array(base64);
          const priceText = product.price ? formatCurrency(product.price) : "N/A";

          const cellContent = [
            new Paragraph({
              children: [
                new TextRun({
                  text: product.name,
                  bold: true,
                  size: 28, // 14pt - bigger and bolder for product name
                }),
              ],
              alignment: AlignmentType.CENTER,
              spacing: { after: 150 },
            }),
            new Paragraph({
              children: [
                new TextRun({
                  text: priceText,
                  bold: true,
                  size: 32, // 16pt - price
                }),
              ],
              alignment: AlignmentType.CENTER,
              spacing: { after: 150 },
            }),
            new Paragraph({
              children: [
                new ImageRun({
                  data: imageData,
                  transformation: {
                    width: dimensions.width,
                    height: dimensions.height,
                  },
                  type: "png",
                }),
              ],
              alignment: AlignmentType.CENTER,
              spacing: { after: 150 },
            }),
            new Paragraph({
              children: [
                new TextRun({
                  text: product.itemCode || "",
                  bold: false, // Not bold
                  size: 18, // 9pt - smaller
                }),
              ],
              alignment: AlignmentType.CENTER,
            }),
          ];

          cells.push(
            new TableCell({
              children: cellContent,
              width: { size: 33.33, type: WidthType.PERCENTAGE },
              margins: { top: 200, bottom: 200, left: 200, right: 200 },
            })
          );
        }

        // Fill remaining cells if row has less than 3 products
        while (cells.length < 3) {
          cells.push(
            new TableCell({
              children: [],
              width: { size: 33.33, type: WidthType.PERCENTAGE },
            })
          );
        }

        rows.push(new TableRow({ children: cells }));
      }

      const doc = new Document({
        sections: [
          {
            children: [
              new Table({
                rows,
                width: { size: 100, type: WidthType.PERCENTAGE },
              }),
            ],
          },
        ],
      });

      const blob = await Packer.toBlob(doc);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "qr-code-list.docx";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Failed to generate QR code list:", error);
      alert("Failed to generate QR code list. Please try again.");
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold">Inventory Management</h1>
          <p className="text-muted-foreground">Manage your products and stock levels</p>
        </div>
        <div className="flex gap-2 w-full md:w-auto">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="flex-1 md:flex-none">
                <Download className="w-4 h-4 mr-2" />
                Export
                <ChevronDown className="w-4 h-4 ml-2" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={handleExportProductList}>
                <FileSpreadsheet className="w-4 h-4 mr-2" />
                Product List
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleExportLowStockList}>
                <AlertTriangle className="w-4 h-4 mr-2" />
                Low Stock List
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleExportBarcodeList}>
                <Barcode className="w-4 h-4 mr-2" />
                Barcode List
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleExportQRList}>
                <QrCode className="w-4 h-4 mr-2" />
                QR List
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Dialog open={formOpen} onOpenChange={setFormOpen}>
            <Button className="gap-2 flex-1 md:flex-none" onClick={openAddDialog}>
              <Plus className="w-4 h-4" />
              Add Product
            </Button>
            <DialogContent className="max-h-[90vh] flex flex-col">
              <DialogHeader>
                <DialogTitle>{isEditing ? "Edit Product" : "Add Product"}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 overflow-y-auto flex-1 pr-2">
                <div className="space-y-1">
                  <p className="text-sm font-medium">Item Code</p>
                  <Input
                    value={formItemCode} 
                    className="bg-muted/50"
                  />
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-medium">SKU</p>
                  <Input
                    value={formSku}
                    onChange={(e) => setFormSku(e.target.value)}
                    placeholder="Stock Keeping Unit"
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
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <p className="text-sm font-medium">Base Price (Cost)</p>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={formBasePrice}
                      onChange={(e) => setFormBasePrice(e.target.value)}
                      placeholder="0.00"
                    />
                    <p className="text-xs text-muted-foreground">What you paid for this item</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm font-medium">Selling Price</p>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={formPrice}
                      onChange={(e) => setFormPrice(e.target.value)}
                      placeholder="0.00"
                      className="bg-muted/50"
                    />
                    <p className="text-xs text-muted-foreground">Auto-calculated from base price + margin</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
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
                <div className="space-y-1">
                  <p className="text-sm font-medium">Margin Percentage (optional)</p>
                  <Input
                    type="number"
                    min="0"
                    max="100"
                    step="0.01"
                    value={formMarginPercentage}
                    onChange={(e) => setFormMarginPercentage(e.target.value)}
                    placeholder="0.00"
                  />
                  <p className="text-xs text-muted-foreground">Profit margin as a percentage (e.g., 25 for 25%)</p>
                </div>
                {formError && (
                  <p className="text-sm text-destructive">{formError}</p>
                )}
              </div>
              <div className="flex justify-end gap-2 pt-4 border-t mt-4">
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

      <div className="flex items-center gap-4">        
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm">
              View: {stockFilter === "all" ? "All" : "Low Stock"}
              <ChevronDown className="ml-2 h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuItem onClick={() => setStockFilter("all")}>
              All
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setStockFilter("lowStock")}>
              Low Stock
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <div className="text-sm font-medium text-red-600">
          Items Low in Stock: {lowStockCount}
        </div>
      </div>

      <div className="space-y-4">
        {loading && <p className="text-sm text-muted-foreground">Loading inventory...</p>}
        {error && !loading && (
          <p className="text-sm text-destructive">Failed to load: {error}</p>
        )}
        {!loading && !error && (
          <>
            {/* Desktop View */}
            <div className="hidden md:block rounded-lg border bg-card">
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
                          {formatCurrency(product.hasVariants ? product.variants?.[0]?.price : product.price)}
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
            </div>

            {/* Mobile View */}
            <div className="grid grid-cols-1 gap-4 md:hidden">
              {filtered.map((product) => {
                const category = categories.find((c) => c.id === product.categoryId);
                const totalStock = product.hasVariants
                  ? product.variants?.reduce((sum, v) => sum + v.stock, 0)
                  : product.stock;
                const isLowStock = (totalStock || 0) <= product.lowStockThreshold;

                return (
                  <div key={product.id} className="bg-card rounded-lg border p-4 space-y-3 shadow-sm">
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="font-semibold">{product.name}</h3>
                        <p className="text-sm text-muted-foreground">{category?.name}</p>
                      </div>
                      <Badge variant={product.status === "active" ? "default" : "secondary"}>
                        {product.status}
                      </Badge>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <p className="text-muted-foreground">Price</p>
                        <p className="font-medium">
                          {formatCurrency(product.hasVariants ? product.variants?.[0]?.price : product.price)}
                          {product.hasVariants && "+"}
                        </p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Stock</p>
                        <div className="flex items-center gap-1">
                          {isLowStock && <AlertTriangle className="w-3 h-3 text-destructive" />}
                          <span className={isLowStock ? "text-destructive font-medium" : "font-medium"}>
                            {totalStock}
                          </span>
                        </div>
                      </div>
                    </div>

                    {product.hasVariants && (
                      <div className="text-xs text-muted-foreground bg-muted/50 p-2 rounded">
                        {product.variants?.length} variants available
                      </div>
                    )}

                    <div className="flex items-center justify-end gap-2 pt-2 border-t">
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8"
                        onClick={() => openEditDialog(product)}
                      >
                        Edit
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8"
                        onClick={() => openVariantDialog(product)}
                      >
                        Variants
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive"
                        onClick={() => handleDeleteProduct(product)}
                        disabled={deletingId === product.id}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
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
