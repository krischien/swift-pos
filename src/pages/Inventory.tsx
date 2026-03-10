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
import { Plus, Search, AlertTriangle, Trash2, Download, ChevronDown, ChevronLeft, ChevronRight, Barcode, QrCode, FileSpreadsheet, FileText, Package } from "lucide-react";
import { useEffect, useState } from "react";
import { Capacitor } from "@capacitor/core";
import { api } from "@/lib/api";
import { useDataLayer } from "@/contexts/DataLayerContext";
import { useStore } from "@/contexts/StoreContext";
import { Category, Product, Variant } from "@/types/pos";
import { formatCurrency } from "@/lib/currency";
import { useSettings } from "@/contexts/SettingsContext";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
import { OCRScanDialog } from "@/components/inventory/OCRScanDialog";
import { cn } from "@/lib/utils";

const Inventory = () => {
  const dataService = useDataLayer();
  const { activeStoreId } = useStore();
  const { storeName, storeAddress } = useSettings();
  const [search, setSearch] = useState("");
  const [stockFilter, setStockFilter] = useState<"all" | "lowStock" | "outOfStock">("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(25);
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
  const [formUnitOfMeasure, setFormUnitOfMeasure] = useState("PCS");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [variantDialogOpen, setVariantDialogOpen] = useState(false);
  const [variantProduct, setVariantProduct] = useState<Product | null>(null);
  const [variantRows, setVariantRows] = useState<(Variant & { isNew?: boolean })[]>([]);
  const [variantSavingId, setVariantSavingId] = useState<string | null>(null);
  const [restockDialogOpen, setRestockDialogOpen] = useState(false);

  const load = async () => {
    try {
      setLoading(true);
      setError(null);
      const [cats, prods] = await Promise.all([
        dataService.getCategories(),
        dataService.getProducts(),
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
  }, [activeStoreId]);

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

  // Low stock: stock > 0 AND stock <= threshold (excludes zero - zero gets "Out of Stock" badge)
  const isLowStock = (product: Product): boolean => {
    if (product.hasVariants && product.variants) {
      return product.variants.some(
        (v) => v.stock > 0 && v.stock <= product.lowStockThreshold
      );
    }
    const stock = product.stock || 0;
    return stock > 0 && stock <= product.lowStockThreshold;
  };

  const hasZeroStock = (product: Product): boolean => {
    if (product.hasVariants && product.variants) {
      return product.variants.some((v) => (v.stock ?? 0) <= 0);
    }
    return (product.stock ?? 0) <= 0;
  };

  const needsStockAttention = (product: Product): boolean => {
    return isLowStock(product) || hasZeroStock(product);
  };

  const filtered = products.filter((p) => {
    // Apply search filter
    const matchesSearch = p.name.toLowerCase().includes(search.toLowerCase());
    if (!matchesSearch) return false;
    
    // Apply stock filter
    if (stockFilter === "lowStock") {
      return needsStockAttention(p);
    }
    if (stockFilter === "outOfStock") {
      return hasZeroStock(p);
    }
    return true; // "all" - show all products
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / itemsPerPage));
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedItems = filtered.slice(startIndex, startIndex + itemsPerPage);

  useEffect(() => {
    if (currentPage > totalPages && totalPages > 0) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);
  
  // Calculate counts (from all products) - low stock excludes out of stock
  const outOfStockCount = products.filter((product) => hasZeroStock(product)).length;
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
    setFormUnitOfMeasure("PCS");
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
    setFormUnitOfMeasure(product.unitOfMeasure ?? "PCS");
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
        unitOfMeasure: formUnitOfMeasure || "PCS",
      };

      if (isEditing && editingProduct) {
        await dataService.updateProduct(editingProduct.id, basePayload);
      } else {
        await dataService.createProduct({
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
      setFormUnitOfMeasure("PCS");

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
      await dataService.deleteProduct(product.id);
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

  const handleImportItems = async (items: Array<{
    name: string;
    categoryId: string;
    itemCode: string;
    hasVariants: boolean;
    basePrice?: number;
    price?: number;
    stock?: number;
    lowStockThreshold?: number;
    marginPercentage?: number;
    status: "active";
    unitOfMeasure?: string;
  }>) => {
    try {
      setLoading(true);
      for (const item of items) {
        await dataService.createProduct(item);
      }
      await load();
      alert(`Successfully imported ${items.length} items`);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Failed to import";
      alert(`Failed to import items: ${msg}`);
    } finally {
      setLoading(false);
    }
  };

  const handleRestockProduct = async (productId: string, quantity: number, variantId?: string) => {
    try {
      const product = products.find((p) => p.id === productId);
      if (!product) return;

      if (variantId && product.hasVariants && product.variants) {
        const variant = product.variants.find((v) => v.id === variantId);
        if (variant) {
          await dataService.updateVariant(variantId, {
            stock: (variant.stock || 0) + quantity,
          });
        }
      } else {
        const currentStock = product.stock || 0;
        await dataService.updateProduct(productId, {
          stock: currentStock + quantity,
        });
      }

      await load();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Failed to restock";
      alert(`Failed to restock: ${msg}`);
    }
  };

  const openVariantDialog = async (product: Product) => {
    setVariantProduct(product);
    setVariantDialogOpen(true);
    try {
      const variants = (await dataService.getVariants(product.id)) as Variant[];
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
        const created = (await dataService.createVariant(variantProduct.id, {
          name: row.name,
          price: row.price,
          stock: row.stock,
        })) as Variant;
        setVariantRows((rows) =>
          rows.map((r) => (r.id === row.id ? { ...created } : r)),
        );
      } else {
        const updated = (await dataService.updateVariant(row.id, {
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
      await dataService.deleteVariant(row.id);
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
    
    // Filter products that need stock attention (low or zero)
    const lowStockProducts = products.filter((product) => needsStockAttention(product));
    
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

  const handleExportBIRInventory = async (format: "xlsx" | "pdf" = "xlsx") => {
    const currentYear = new Date().getFullYear();
    const inventoryDate = `${currentYear}-12-31`;
    const companyName = storeName?.trim() || "";
    const companyAddress = storeAddress?.trim() || "";

    // PDF is server-only; XLSX can fallback to client-side on mobile
    const useApi = !Capacitor.isNativePlatform() || format === "pdf";
    if (useApi) {
      try {
        const blob = await api.getBirInventoryReport({
          companyName,
          tin: "",
          address: companyAddress,
          inventoryDate,
          format,
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `BIR-Inventory-Report-${currentYear}.${format}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        return;
      } catch (_apiError) {
        if (format === "pdf") {
          alert("PDF export requires server connection. Please ensure the server is running.");
          return;
        }
        // Fallback to client-side XLSX
      }
    }

    // Client-side XLSX fallback (mobile or when server unavailable)
    try {
      const productsData = await dataService.getProducts();
      const productsArr = productsData as Product[];

      if (productsArr.length === 0) {
        alert("No inventory items found to export.");
        return;
      }

      const rows: any[] = [];
      let grandTotal = 0;

      for (const product of productsArr) {
        const unitOfMeasure = product.unitOfMeasure || "PCS";
        const unitPrice = product.basePrice || product.price || 0;
        const locationAddr = companyAddress || "";

        if (product.hasVariants && product.variants?.length) {
          for (const variant of product.variants) {
            const qty = variant.stock || 0;
            const totalCost = unitPrice * qty;
            grandTotal += totalCost;
            rows.push({
              "PRODUCT / INVENTORY CODE": product.itemCode || product.sku || "",
              "ITEM DESCRIPTION": `${product.name} - ${variant.name}`,
              "LOCATION - ADDRESS": locationAddr,
              "LOCATION - CODE": "",
              "LOCATION - REMARKS": "",
              "INVENTORY VALUATION METHOD": "FIFO",
              "UNIT PRICE": unitPrice,
              "QUANTITY IN STOCKS": qty,
              "UNIT OF MEASUREMENT": unitOfMeasure,
              "TOTAL WEIGHT / VOLUME": "",
              "TOTAL COST": totalCost,
            });
          }
        } else {
          const qty = product.stock || 0;
          const totalCost = unitPrice * qty;
          grandTotal += totalCost;
          rows.push({
            "PRODUCT / INVENTORY CODE": product.itemCode || product.sku || "",
            "ITEM DESCRIPTION": product.name,
            "LOCATION - ADDRESS": locationAddr,
            "LOCATION - CODE": "",
            "LOCATION - REMARKS": "",
            "INVENTORY VALUATION METHOD": "FIFO",
            "UNIT PRICE": unitPrice,
            "QUANTITY IN STOCKS": qty,
            "UNIT OF MEASUREMENT": unitOfMeasure,
            "TOTAL WEIGHT / VOLUME": "",
            "TOTAL COST": totalCost,
          });
        }
      }

      const XLSX = await import("xlsx");
      const pad = (arr: any[], len = 11) => [...arr, ...Array(Math.max(0, len - arr.length)).fill("")];
      const sheetData: any[][] = [];

      sheetData.push(pad(["For Retail / Manufacturing Industry"]));
      sheetData.push(pad([]));
      sheetData.push(pad([], 14)); // row3 - ANNEX A in col N (index 13)
      sheetData[2][13] = "ANNEX A";
      sheetData.push(pad([]));
      const row5 = pad([]);
      row5[5] = companyName;
      sheetData.push(row5);
      const row6 = pad([]);
      row6[4] = "MERCHANDISE/ RAW MATERIALS/GOODS IN PROCESS / FINISHED GOODS INVENTORY";
      sheetData.push(row6);
      const row7 = pad([]);
      row7[5] = `As of December 31, ${currentYear}`;
      sheetData.push(row7);
      sheetData.push(pad([]));
      sheetData.push([
        "PRODUCT / INVENTORY CODE",
        "ITEM DESCRIPTION",
        "LOCATION (Note 1)",
        "",
        "",
        "INVENTORY VALUATION METHOD (Note 2)",
        "UNIT PRICE",
        "QUANTITY IN STOCKS",
        "UNIT OF MEASUREMENT",
        "",
        "TOTAL COST",
      ]);
      sheetData.push([
        "",
        "",
        "ADDRESS",
        "CODE",
        "REMARKS",
        "",
        "",
        "",
        "(In weight or volume e.g., kilos, grams, liters, etc.)",
        "TOTAL WEIGHT / VOLUME",
        "",
      ]);
      sheetData.push([]);

      for (const row of rows) {
        sheetData.push([
          row["PRODUCT / INVENTORY CODE"],
          row["ITEM DESCRIPTION"],
          row["LOCATION - ADDRESS"],
          row["LOCATION - CODE"],
          row["LOCATION - REMARKS"],
          row["INVENTORY VALUATION METHOD"],
          row["UNIT PRICE"],
          row["QUANTITY IN STOCKS"],
          row["UNIT OF MEASUREMENT"],
          row["TOTAL WEIGHT / VOLUME"],
          row["TOTAL COST"],
        ]);
      }

      // Total row
      sheetData.push([
        "TOTAL",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        grandTotal,
      ]);
      sheetData.push(pad([]));
      // Note a: A="Note a", B="a", C-K=paragraph (reference layout - NOT all in column A)
      const note1a =
        "Include all goods whether taxpayer has title thereto or not, provided these goods are actually situated in location/address at the Head Office or Branch or Facilities (with or without sales activity of the taxpayer). Facilities shall include but not limited to place of production, showroom, warehouse, storage place, leased property, etc. Include also goods out on consignment, though not physically present are nonetheless owned by the taxpayer.";
      sheetData.push(["Note a", "a", note1a, "", "", "", "", "", "", "", ""]);
      // Note b: A=empty, B="b", C-K="Use the following codes:"
      sheetData.push(["", "b", "Use the following codes:", "", "", "", "", "", "", "", ""]);
      // Note 1b rows: A=empty, B=empty, C=code, D-E=desc, G-K=remark
      sheetData.push(["", "", "CH", "Goods on consignment held by the taxpayer", "", "", "Indicate the name of the consignor in the Remarks column", "", "", "", ""]);
      sheetData.push(["", "", "P", "Parked goods or goods owned by related parties", "", "", "Indicate the name of related party/owner in the Remarks column", "", "", "", ""]);
      sheetData.push(["", "", "O", "Goods owned by the taxpayer", "", "", "", "", "", "", ""]);
      sheetData.push(["", "", "CO", "Goods out on consignment held in the hands of entity other than taxpayer", "", "", "Indicate the name of the entity in the Remarks column", "", "", "", ""]);
      // Note 2: A="Note 2", B=empty, C-K=text
      sheetData.push(["Note 2", "", "Indicate costing method applied, e.g., Standard Costing, FIFO, Weighted Average, Specific Identification, etc.", "", "", "", "", "", "", "", ""]);
      sheetData.push(pad([]));
      // Signature block: B-K=declaration, F-J=signature line + labels (reference layout)
      const declaration =
        "We declare, under the penalties of perjury, that this schedule has been made in good faith, verified by us, and to the best of our knowledge and belief, is true and correct pursuant to the provisions of the National Internal Revenue Code, as amended, and the regulations issued under authority thereof.";
      sheetData.push(["", declaration, "", "", "", "", "", "", "", "", ""]);
      sheetData.push(["", "", "", "", "", "_________________________", "", "", "", "", ""]);
      sheetData.push(["", "", "", "", "", "Name and Signature of Authorized Representative", "", "", "", "", ""]);
      sheetData.push(["", "", "", "", "", "TIN: _________________________", "", "", "", "", ""]);

      const ws = XLSX.utils.aoa_to_sheet(sheetData);
      ws["!cols"] = [
        { wch: 20 },
        { wch: 30 },
        { wch: 25 },
        { wch: 15 },
        { wch: 20 },
        { wch: 25 },
        { wch: 12 },
        { wch: 18 },
        { wch: 20 },
        { wch: 18 },
        { wch: 15 },
      ];
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "ANNEX A");
      const wbout = XLSX.write(wb, { bookType: "xlsx", type: "array" });
      const blob = new Blob([wbout], { type: "application/octet-stream" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `BIR-Inventory-Report-${currentYear}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e: any) {
      console.error("BIR Export Error:", e);
      alert(e.message ?? "Failed to export BIR inventory report");
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold">Inventory Management</h1>
          <p className="text-muted-foreground">Manage your products and stock levels</p>
        </div>
        <div className="flex gap-2 w-full md:w-auto flex-wrap">
          <OCRScanDialog categories={categories} onImport={handleImportItems} />
          <Dialog open={restockDialogOpen} onOpenChange={setRestockDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" className="gap-2 flex-1 md:flex-none">
                <Package className="w-4 h-4" />
                Restock
              </Button>
            </DialogTrigger>
            <DialogContent className="max-h-[90vh] flex flex-col">
              <DialogHeader>
                <DialogTitle>Restock Products</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 overflow-y-auto flex-1 pr-2">
                <p className="text-sm text-muted-foreground">
                  Select products to restock. Enter the quantity to add to current stock.
                </p>
                <div className="space-y-2 max-h-[60vh] overflow-y-auto">
                  {products
                    .filter((p) => p.status === "active")
                    .flatMap((product) => {
                      if (product.hasVariants && product.variants && product.variants.length > 0) {
                        return product.variants.map((variant) => ({
                          id: variant.id,
                          productId: product.id,
                          variantId: variant.id,
                          name: `${product.name} (${variant.name})`,
                          stock: variant.stock || 0,
                          lowStockThreshold: product.lowStockThreshold,
                          isVariant: true,
                        }));
                      }
                      return [{
                        id: product.id,
                        productId: product.id,
                        variantId: undefined as string | undefined,
                        name: product.name,
                        stock: product.stock || 0,
                        lowStockThreshold: product.lowStockThreshold,
                        isVariant: false,
                      }];
                    })
                    .sort((a, b) => {
                      const aLow = a.stock <= a.lowStockThreshold;
                      const bLow = b.stock <= b.lowStockThreshold;
                      if (aLow && !bLow) return -1;
                      if (!aLow && bLow) return 1;
                      return 0;
                    })
                    .map((item) => {
                      const isLow = item.stock <= item.lowStockThreshold;
                      return (
                        <div key={item.id} className="flex items-center gap-4 p-3 border rounded-lg">
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <p className={cn("font-medium", isLow && "text-destructive")}>{item.name}</p>
                              {isLow && <AlertTriangle className="w-4 h-4 text-destructive" />}
                            </div>
                            <p className="text-sm text-muted-foreground">
                              Current Stock: {item.stock}
                            </p>
                          </div>
                          <Input
                            type="number"
                            min="0"
                            placeholder="Qty to add"
                            className="w-32"
                            id={`restock-${item.id}`}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                const input = e.currentTarget;
                                const qty = parseInt(input.value, 10) || 0;
                                if (qty > 0) {
                                  handleRestockProduct(item.productId, qty, item.variantId);
                                  input.value = "";
                                }
                              }
                            }}
                          />
                          <Button
                            size="sm"
                            onClick={() => {
                              const input = document.getElementById(`restock-${item.id}`) as HTMLInputElement | null;
                              const qty = parseInt(input?.value || "0", 10) || 0;
                              if (qty > 0) {
                                handleRestockProduct(item.productId, qty, item.variantId);
                                if (input) input.value = "";
                              }
                            }}
                          >
                            Add
                          </Button>
                        </div>
                      );
                    })}
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-4 border-t mt-4">
                <Button variant="outline" onClick={() => setRestockDialogOpen(false)}>
                  Close
                </Button>
              </div>
            </DialogContent>
          </Dialog>
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
              <DropdownMenuItem onClick={() => handleExportBIRInventory("xlsx")}>
                <FileSpreadsheet className="w-4 h-4 mr-2" />
                BIR Inventory Report (XLSX)
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleExportBIRInventory("pdf")}>
                <FileText className="w-4 h-4 mr-2" />
                BIR Inventory Report (PDF)
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
                  <p className="text-sm font-medium">Unit of Measure</p>
                  <Input
                    value={formUnitOfMeasure}
                    onChange={(e) => setFormUnitOfMeasure(e.target.value)}
                    placeholder="PCS, KLS, etc."
                  />
                  <p className="text-xs text-muted-foreground">e.g., PCS, KLS, BOX, BTL</p>
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
              View: {stockFilter === "all" ? "All" : stockFilter === "outOfStock" ? "Out of Stock" : "Low Stock"}
              <ChevronDown className="ml-2 h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuItem onClick={() => setStockFilter("all")}>
              All
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setStockFilter("outOfStock")}>
              Out of Stock
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setStockFilter("lowStock")}>
              Low Stock
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <div className="flex gap-4 text-sm font-medium">
          <span className="text-slate-600">Out of Stock: {outOfStockCount}</span>
          <span className="text-amber-600">Low Stock: {lowStockCount - outOfStockCount}</span>
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
                  {paginatedItems.map((product) => {
                    const category = categories.find((c) => c.id === product.categoryId);
                    const totalStock = product.hasVariants
                      ? product.variants?.reduce((sum, v) => sum + (v.stock ?? 0), 0)
                      : product.stock;
                    const hasZeroStockVariant = product.hasVariants && product.variants
                      ? product.variants.some((v) => (v.stock ?? 0) <= 0)
                      : (product.stock ?? 0) <= 0;
                    const isProductLowStock = isLowStock(product);

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
                            {hasZeroStockVariant && (
                              <AlertTriangle className="w-4 h-4 text-destructive" />
                            )}
                            {isProductLowStock && !hasZeroStockVariant && (
                              <AlertTriangle className="w-4 h-4 text-destructive" />
                            )}
                            <span className={cn(
                              (isProductLowStock || hasZeroStockVariant) && "text-destructive font-semibold"
                            )}>
                              {totalStock}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          {formatCurrency(product.hasVariants ? product.variants?.[0]?.price : product.price)}
                          {product.hasVariants && "+"}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-row items-center gap-1">
                            {hasZeroStockVariant ? (
                              <Badge className="bg-slate-600 hover:bg-slate-600 text-white border-slate-600">Disabled</Badge>
                            ) : (
                              <Badge className={product.status === "active" ? "bg-emerald-600 hover:bg-emerald-600 text-white border-emerald-600" : "bg-secondary text-secondary-foreground"}>
                                {product.status}
                              </Badge>
                            )}
                            {hasZeroStockVariant ? (
                              <Badge className="bg-slate-500 hover:bg-slate-500 text-white border-slate-500">Out of Stock</Badge>
                            ) : isProductLowStock ? (
                              <Badge className="bg-amber-500 hover:bg-amber-500 text-white border-amber-500">Low Stock</Badge>
                            ) : null}
                          </div>
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

            {/* Mobile View */}
            <div className="grid grid-cols-1 gap-4 md:hidden">
              {paginatedItems.map((product) => {
                const category = categories.find((c) => c.id === product.categoryId);
                const totalStock = product.hasVariants
                  ? product.variants?.reduce((sum, v) => sum + (v.stock ?? 0), 0)
                  : product.stock;
                const hasZeroStockVariant = product.hasVariants && product.variants
                  ? product.variants.some((v) => (v.stock ?? 0) <= 0)
                  : (product.stock ?? 0) <= 0;
                const isProductLowStock = isLowStock(product);
                const showRestock = totalStock <= 0 || hasZeroStockVariant;
                const showDisabled = totalStock <= 0 || hasZeroStockVariant;

                return (
                  <div key={product.id} className="bg-card rounded-lg border p-4 space-y-3 shadow-sm">
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className={cn("font-semibold", (isProductLowStock || showRestock) && "text-destructive")}>
                          {product.name}
                        </h3>
                        <p className="text-sm text-muted-foreground">{category?.name}</p>
                      </div>
                      <div className="flex flex-row items-center gap-1">
                        {showDisabled ? (
                          <Badge className="bg-slate-600 hover:bg-slate-600 text-white h-5 text-[10px] px-1">Disabled</Badge>
                        ) : (
                          <Badge className={product.status === "active" ? "bg-emerald-600 hover:bg-emerald-600 text-white border-emerald-600 h-5 text-[10px] px-1" : "bg-secondary text-secondary-foreground h-5 text-[10px] px-1"}>
                            {product.status}
                          </Badge>
                        )}
                        {showRestock ? (
                          <Badge className="bg-slate-500 hover:bg-slate-500 text-white border-slate-500 h-5 text-[10px] px-1">Out of Stock</Badge>
                        ) : isProductLowStock ? (
                          <Badge className="bg-amber-500 hover:bg-amber-500 text-white border-amber-500 h-5 text-[10px] px-1">Low Stock</Badge>
                        ) : null}
                      </div>
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
                          {totalStock <= 0 ? (
                            <Badge className="bg-slate-500 hover:bg-slate-500 text-white border-slate-500 h-5 text-[10px] px-1">Out of Stock</Badge>
                          ) : isProductLowStock ? (
                            <Badge className="bg-amber-500 hover:bg-amber-500 text-white border-amber-500 h-5 text-[10px] px-1">Low Stock</Badge>
                          ) : null}
                          <span className={cn(
                            (isProductLowStock || totalStock <= 0) && "text-destructive font-medium",
                            "font-medium"
                          )}>
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
