import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Upload, Camera, Loader2, X } from "lucide-react";
import { processImage, parseMenuItems, type MenuItem } from "@/lib/ocrService";
import { Category } from "@/types/pos";
import { formatCurrency } from "@/lib/currency";

interface OCRScanDialogProps {
  open: boolean;
  onClose: () => void;
  categories: Category[];
  onImport: (items: Array<MenuItem & { categoryId: string; marginPercentage: number; stock: number; lowStockThreshold: number }>) => Promise<void>;
}

export function OCRScanDialog({
  open,
  onClose,
  categories,
  onImport,
}: OCRScanDialogProps) {
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [extractedItems, setExtractedItems] = useState<MenuItem[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const [marginPercentage, setMarginPercentage] = useState("0");
  const [defaultStock, setDefaultStock] = useState("0");
  const [defaultLowStock, setDefaultLowStock] = useState("10");
  const [ocrText, setOcrText] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (file: File) => {
    setImageFile(file);
    const reader = new FileReader();
    reader.onloadend = () => {
      setImagePreview(reader.result as string);
    };
    reader.readAsDataURL(file);
    setExtractedItems([]);
    setOcrText("");
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type.startsWith("image/")) {
      handleFileSelect(file);
    }
  };

  const handleCameraCapture = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type.startsWith("image/")) {
      handleFileSelect(file);
    }
  };

  const handleProcessImage = async () => {
    if (!imageFile) return;

    setProcessing(true);
    try {
      const text = await processImage(imageFile);
      setOcrText(text);
      const items = parseMenuItems(text);
      setExtractedItems(items);
    } catch (error) {
      console.error("OCR processing failed:", error);
      alert("Failed to process image. Please try again.");
    } finally {
      setProcessing(false);
    }
  };

  const capitalizeItemName = (name: string): string => {
    return name
      .split(/\s+/)
      .map((word) => {
        if (word.length === 0) return word;
        // Capitalize first letter, lowercase the rest
        return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
      })
      .join(" ");
  };

  const handleEditItem = (index: number, field: "name" | "price", value: string) => {
    setExtractedItems((items) =>
      items.map((item, i) =>
        i === index
          ? {
              ...item,
              [field]: field === "name" ? capitalizeItemName(value) : value ? parseFloat(value) : undefined,
            }
          : item
      )
    );
  };

  const handleRemoveItem = (index: number) => {
    setExtractedItems((items) => items.filter((_, i) => i !== index));
  };

  const handleImport = async () => {
    if (!selectedCategory || extractedItems.length === 0) {
      alert("Please select a category and ensure items are extracted.");
      return;
    }

    const itemsToImport = extractedItems.map((item) => ({
      ...item,
      categoryId: selectedCategory,
      marginPercentage: parseFloat(marginPercentage) || 0,
      stock: parseInt(defaultStock) || 0,
      lowStockThreshold: parseInt(defaultLowStock) || 10,
    }));

    try {
      await onImport(itemsToImport);
      handleClose();
    } catch (error) {
      console.error("Import failed:", error);
    }
  };

  const handleClose = () => {
    setImageFile(null);
    setImagePreview(null);
    setExtractedItems([]);
    setOcrText("");
    setSelectedCategory("");
    setMarginPercentage("0");
    setDefaultStock("0");
    setDefaultLowStock("10");
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (cameraInputRef.current) cameraInputRef.current.value = "";
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Scan Menu with OCR</DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-4">
          {/* Image Upload Section */}
          <div className="space-y-2">
            <Label>Upload Menu Image</Label>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                className="flex-1"
              >
                <Upload className="w-4 h-4 mr-2" />
                Upload File
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileUpload}
                className="hidden"
              />
              <Button
                type="button"
                variant="outline"
                onClick={() => cameraInputRef.current?.click()}
                className="flex-1"
              >
                <Camera className="w-4 h-4 mr-2" />
                Camera
              </Button>
              <input
                ref={cameraInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handleCameraCapture}
                className="hidden"
              />
            </div>

            {imagePreview && (
              <div className="mt-4">
                <div className="relative border rounded-lg overflow-hidden">
                  <img
                    src={imagePreview}
                    alt="Menu preview"
                    className="w-full max-h-64 object-contain bg-muted"
                  />
                </div>
                <Button
                  onClick={handleProcessImage}
                  disabled={processing}
                  className="mt-2 w-full"
                >
                  {processing ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    "Extract Menu Items"
                  )}
                </Button>
              </div>
            )}
          </div>

          {/* Extracted Items Table */}
          {extractedItems.length > 0 && (
            <div className="space-y-4">
              <div>
                <Label>Extracted Menu Items ({extractedItems.length})</Label>
                <p className="text-sm text-muted-foreground">
                  Review and edit items before importing
                </p>
              </div>

              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Item Name</TableHead>
                      <TableHead className="w-32">Price</TableHead>
                      <TableHead className="w-20"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {extractedItems.map((item, index) => (
                      <TableRow key={index}>
                        <TableCell>
                          <Input
                            value={item.name}
                            onChange={(e) =>
                              handleEditItem(index, "name", e.target.value)
                            }
                            className="h-8"
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            step="0.01"
                            value={item.price ?? ""}
                            onChange={(e) =>
                              handleEditItem(index, "price", e.target.value)
                            }
                            placeholder="0.00"
                            className="h-8"
                          />
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleRemoveItem(index)}
                            className="h-8 w-8"
                          >
                            <X className="w-4 h-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Import Settings */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Category *</Label>
                  <Select
                    value={selectedCategory}
                    onValueChange={setSelectedCategory}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map((cat) => (
                        <SelectItem key={cat.id} value={cat.id}>
                          {cat.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Margin Percentage (%)</Label>
                  <Input
                    type="number"
                    step="0.1"
                    value={marginPercentage}
                    onChange={(e) => setMarginPercentage(e.target.value)}
                    placeholder="0"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Default Stock</Label>
                  <Input
                    type="number"
                    value={defaultStock}
                    onChange={(e) => setDefaultStock(e.target.value)}
                    placeholder="0"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Low Stock Threshold</Label>
                  <Input
                    type="number"
                    value={defaultLowStock}
                    onChange={(e) => setDefaultLowStock(e.target.value)}
                    placeholder="10"
                  />
                </div>
              </div>

              {/* OCR Text Preview (Collapsible) */}
              {ocrText && (
                <details className="border rounded-lg p-2">
                  <summary className="text-sm font-medium cursor-pointer">
                    View OCR Text
                  </summary>
                  <pre className="mt-2 text-xs bg-muted p-2 rounded overflow-auto max-h-32">
                    {ocrText}
                  </pre>
                </details>
              )}

              <Button
                onClick={handleImport}
                disabled={!selectedCategory || extractedItems.length === 0}
                className="w-full"
              >
                Import {extractedItems.length} Product{extractedItems.length !== 1 ? "s" : ""}
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

