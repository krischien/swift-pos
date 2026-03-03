import { useState, useCallback, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Scan, Loader2, Upload, Camera } from "lucide-react";
import { processImage, parseMenuItems } from "@/lib/ocrService";
import { Category } from "@/types/pos";

export interface ParsedMenuItem {
  name: string;
  price: number;
}

interface OCRScanDialogProps {
  categories: Category[];
  onImport: (items: Array<{
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
  }>) => Promise<void>;
}

type ImageInputMode = "upload" | "camera";

export function OCRScanDialog({ categories, onImport }: OCRScanDialogProps) {
  const [open, setOpen] = useState(false);
  const [imageInputMode, setImageInputMode] = useState<ImageInputMode>("upload");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [items, setItems] = useState<ParsedMenuItem[]>([]);
  const [extracting, setExtracting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [bulkCategoryId, setBulkCategoryId] = useState<string>("");
  const [bulkMargin, setBulkMargin] = useState("0");
  const [bulkStock, setBulkStock] = useState("0");
  const [bulkLowStock, setBulkLowStock] = useState("5");
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageFile(file);
    const reader = new FileReader();
    reader.onload = () => setImagePreview(reader.result as string);
    reader.readAsDataURL(file);
    setItems([]);
  }, []);

  const startCamera = useCallback(async () => {
    setCameraError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
      }).catch(() =>
        navigator.mediaDevices.getUserMedia({ video: true })
      );
      setCameraStream(stream);
      setImageFile(null);
      setImagePreview(null);
      setItems([]);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Camera access denied";
      setCameraError(msg);
    }
  }, []);

  const stopCamera = useCallback(() => {
    if (cameraStream) {
      cameraStream.getTracks().forEach((t) => t.stop());
      setCameraStream(null);
    }
  }, [cameraStream]);

  useEffect(() => {
    if (cameraStream && videoRef.current) {
      videoRef.current.srcObject = cameraStream;
    }
  }, [cameraStream]);

  useEffect(() => {
    return () => stopCamera();
  }, [stopCamera]);

  useEffect(() => {
    if (!open) stopCamera();
  }, [open, stopCamera]);

  const handleCapture = useCallback(() => {
    const video = videoRef.current;
    if (!video || !cameraStream) return;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0);
    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        const file = new File([blob], `capture-${Date.now()}.jpg`, { type: "image/jpeg" });
        setImageFile(file);
        setImagePreview(canvas.toDataURL("image/jpeg"));
        setItems([]);
        stopCamera();
      },
      "image/jpeg",
      0.9
    );
  }, [cameraStream, stopCamera]);

  const handleModeChange = useCallback((mode: ImageInputMode) => {
    setImageInputMode(mode);
    setImageFile(null);
    setImagePreview(null);
    setItems([]);
    setCameraError(null);
    if (mode === "upload") stopCamera();
  }, [stopCamera]);

  const handleExtract = useCallback(async () => {
    if (!imageFile) {
      alert("Please select an image first.");
      return;
    }
    setExtracting(true);
    try {
      const lines = await processImage(imageFile);
      const parsed = parseMenuItems(lines);
      setItems(parsed);
      if (parsed.length === 0) {
        alert("No menu items found. Try a clearer image or different format.");
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "OCR failed";
      alert(`Failed to extract menu items: ${msg}`);
    } finally {
      setExtracting(false);
    }
  }, [imageFile]);

  const updateItem = useCallback((index: number, field: "name" | "price", value: string | number) => {
    setItems((prev) => {
      const next = [...prev];
      if (field === "name") next[index] = { ...next[index], name: value as string };
      else next[index] = { ...next[index], price: typeof value === "number" ? value : parseFloat(String(value)) || 0 };
      return next;
    });
  }, []);

  const handleImport = useCallback(async () => {
    if (!bulkCategoryId) {
      alert("Please select a category.");
      return;
    }
    if (items.length === 0) {
      alert("No items to import.");
      return;
    }
    setImporting(true);
    try {
      const margin = parseFloat(bulkMargin) || 0;
      const stock = parseInt(bulkStock, 10) || 0;
      const lowStockThreshold = parseInt(bulkLowStock, 10) || 5;

      const productItems = items.map((item) => {
        const itemCode = `OCR-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        let basePrice: number | undefined;
        let price: number | undefined;
        if (margin > 0) {
          price = item.price;
          basePrice = item.price / (1 + margin / 100);
        } else {
          basePrice = item.price;
          price = item.price;
        }
        return {
          name: item.name,
          categoryId: bulkCategoryId,
          itemCode,
          hasVariants: false,
          basePrice,
          price,
          stock,
          lowStockThreshold,
          marginPercentage: margin || undefined,
          status: "active" as const,
          unitOfMeasure: "PCS",
        };
      });

      await onImport(productItems);
      setOpen(false);
      setImageFile(null);
      setImagePreview(null);
      setItems([]);
      setBulkCategoryId("");
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Import failed";
      alert(`Failed to import: ${msg}`);
    } finally {
      setImporting(false);
    }
  }, [bulkCategoryId, bulkMargin, bulkStock, bulkLowStock, items, onImport]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2 flex-1 md:flex-none">
          <Scan className="w-4 h-4" />
          Scan Menu
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] flex flex-col max-w-2xl">
        <DialogHeader>
          <DialogTitle>Scan Menu (OCR)</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 overflow-y-auto flex-1 pr-2">
          <div className="space-y-2">
            <p className="text-sm font-medium">1. Upload or capture menu image</p>
            <div className="flex gap-2">
              <Button
                type="button"
                variant={imageInputMode === "upload" ? "default" : "outline"}
                size="sm"
                className="gap-2"
                onClick={() => handleModeChange("upload")}
              >
                <Upload className="w-4 h-4" />
                Upload
              </Button>
              <Button
                type="button"
                variant={imageInputMode === "camera" ? "default" : "outline"}
                size="sm"
                className="gap-2"
                onClick={() => handleModeChange("camera")}
              >
                <Camera className="w-4 h-4" />
                Camera
              </Button>
            </div>

            {imageInputMode === "upload" && (
              <Input
                type="file"
                accept="image/*"
                onChange={handleFileChange}
              />
            )}

            {imageInputMode === "camera" && (
              <div className="space-y-2">
                {!cameraStream ? (
                  <Button onClick={startCamera} variant="secondary" size="sm">
                    Start Camera
                  </Button>
                ) : (
                  <div className="space-y-2">
                    <video
                      ref={videoRef}
                      autoPlay
                      playsInline
                      muted
                      className="w-full max-h-48 rounded-md border bg-black object-contain"
                    />
                    <div className="flex gap-2">
                      <Button onClick={handleCapture} size="sm">
                        Capture
                      </Button>
                      <Button onClick={stopCamera} variant="outline" size="sm">
                        Cancel
                      </Button>
                    </div>
                  </div>
                )}
                {cameraError && (
                  <p className="text-sm text-destructive">{cameraError}</p>
                )}
              </div>
            )}

            {imagePreview && (
              <img
                src={imagePreview}
                alt="Preview"
                className="mt-2 max-h-32 rounded-md border object-contain"
              />
            )}
          </div>

          <div className="space-y-2">
            <Button
              variant="secondary"
              onClick={handleExtract}
              disabled={!imageFile || extracting}
            >
              {extracting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Extracting...
                </>
              ) : (
                "Extract Menu Items"
              )}
            </Button>
          </div>

          {items.length > 0 && (
            <>
              <div className="space-y-2">
                <p className="text-sm font-medium">2. Edit items (optional)</p>
                <div className="border rounded-md max-h-48 overflow-y-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead className="w-24">Price</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {items.map((item, i) => (
                        <TableRow key={i}>
                          <TableCell>
                            <Input
                              value={item.name}
                              onChange={(e) => updateItem(i, "name", e.target.value)}
                              className="h-8"
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              min="0"
                              step="0.01"
                              value={item.price}
                              onChange={(e) => updateItem(i, "price", e.target.value)}
                              className="h-8"
                            />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-sm font-medium">3. Bulk settings</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-muted-foreground">Category (required)</label>
                    <Select value={bulkCategoryId} onValueChange={setBulkCategoryId}>
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
                  <div>
                    <label className="text-xs text-muted-foreground">Margin %</label>
                    <Input
                      type="number"
                      min="0"
                      value={bulkMargin}
                      onChange={(e) => setBulkMargin(e.target.value)}
                      placeholder="0"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">Default stock</label>
                    <Input
                      type="number"
                      min="0"
                      value={bulkStock}
                      onChange={(e) => setBulkStock(e.target.value)}
                      placeholder="0"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">Low stock threshold</label>
                    <Input
                      type="number"
                      min="0"
                      value={bulkLowStock}
                      onChange={(e) => setBulkLowStock(e.target.value)}
                      placeholder="5"
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t">
                <Button variant="outline" onClick={() => setOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleImport} disabled={importing}>
                  {importing ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Importing...
                    </>
                  ) : (
                    `Import ${items.length} items`
                  )}
                </Button>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
