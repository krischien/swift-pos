import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Camera, Upload, Loader2, Trash2, ChevronDown, ChevronUp } from "lucide-react";
import { useState, useRef, useCallback, useEffect } from "react";
import { processImage, parseMenuItems, MenuItem } from "@/lib/ocrService";
import { Category } from "@/types/pos";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

interface OCRScanDialogProps {
  categories: Category[];
  onImport: (items: any[]) => Promise<void>;
}

export function OCRScanDialog({ categories, onImport }: OCRScanDialogProps) {
  const [open, setOpen] = useState(false);
  const [image, setImage] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [processing, setProcessing] = useState(false);
  const [items, setItems] = useState<MenuItem[]>([]);
  const [ocrText, setOcrText] = useState<string>("");
  const [showOcrText, setShowOcrText] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [cameraMode, setCameraMode] = useState(false);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  // Default settings for import
  const [defaultCategory, setDefaultCategory] = useState<string>("");
  const [defaultStock, setDefaultStock] = useState<string>("100");
  const [defaultLowStock, setDefaultLowStock] = useState<string>("10");
  const [defaultMargin, setDefaultMargin] = useState<string>("30");

  const stopCamera = useCallback(() => {
    if (cameraStream) {
      cameraStream.getTracks().forEach((t) => t.stop());
      setCameraStream(null);
    }
    setCameraMode(false);
    setCameraError(null);
  }, [cameraStream]);

  useEffect(() => {
    if (cameraStream && videoRef.current) {
      videoRef.current.srcObject = cameraStream;
    }
  }, [cameraStream]);

  useEffect(() => {
    if (!open) stopCamera();
  }, [open, stopCamera]);

  const startCamera = useCallback(async () => {
    setCameraError(null);
    try {
      const stream = await navigator.mediaDevices
        .getUserMedia({ video: { facingMode: "environment" } })
        .catch(() => navigator.mediaDevices.getUserMedia({ video: true }));
      setCameraStream(stream);
      setCameraMode(true);
      if (image) URL.revokeObjectURL(image);
      setImage(null);
      setImageFile(null);
      setItems([]);
    } catch (e: unknown) {
      setCameraError(e instanceof Error ? e.message : "Camera access denied");
    }
  }, [image]);

  const handleCaptureFromCamera = useCallback(() => {
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
        if (image) URL.revokeObjectURL(image);
        setImage(URL.createObjectURL(file));
        setImageFile(file);
        setItems([]);
        stopCamera();
      },
      "image/jpeg",
      0.9
    );
  }, [cameraStream, stopCamera, image]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Clean up previous image URL if exists
    if (image) {
      URL.revokeObjectURL(image);
    }

    // Show preview only, don't process yet
    const url = URL.createObjectURL(file);
    setImage(url);
    setImageFile(file);
    setItems([]);
    setOcrText("");
    setShowOcrText(false);
  };

  const handleExtractItems = async () => {
    if (!imageFile) return;

    setProcessing(true);
    setOcrText("");

    try {
      // Process image
      const text = await processImage(imageFile);
      setOcrText(text);
      
      const extractedItems = parseMenuItems(text);
      setItems(extractedItems);
    } catch (error) {
      console.error("OCR Error:", error);
      alert("Failed to scan image. Please try again.");
    } finally {
      setProcessing(false);
    }
  };

  const handleRemoveItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const handleItemChange = (index: number, field: keyof MenuItem, value: string | number) => {
    setItems(
      items.map((item, i) => {
        if (i === index) {
          return { ...item, [field]: value };
        }
        return item;
      })
    );
  };

  const handleImport = async () => {
    if (items.length === 0) return;
    if (!defaultCategory) {
      alert("Please select a default category for these items");
      return;
    }

    const itemsToImport = items.map((item) => {
      const basePrice = item.price || 0;
      const margin = parseFloat(defaultMargin) || 0;
      const calculatedBasePrice = basePrice / (1 + margin / 100);

      return {
        name: item.name,
        categoryId: defaultCategory,
        price: basePrice, // Selling Price
        basePrice: parseFloat(calculatedBasePrice.toFixed(2)), // Cost Price
        stock: parseInt(defaultStock) || 0,
        lowStockThreshold: parseInt(defaultLowStock) || 10,
        marginPercentage: margin,
        status: "active",
        itemCode: `OCR-${Date.now().toString(36)}-${Math.random().toString(36).substr(2, 5).toUpperCase()}`,
        hasVariants: false,
      };
    });

    await onImport(itemsToImport);
    setOpen(false);
    
    // Reset state
    if (image) {
      URL.revokeObjectURL(image);
    }
    setImage(null);
    setImageFile(null);
    setItems([]);
    setOcrText("");
    setShowOcrText(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2 justify-center flex-1 tablet-portrait:flex-none tablet-portrait:w-auto tablet-landscape:flex-none tablet-landscape:w-auto lg:flex-none lg:w-auto">
          <Camera className="w-4 h-4" />
          Scan Menu
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-5xl max-h-[90vh] flex flex-col overflow-hidden">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="text-center">Scan Menu with OCR</DialogTitle>
        </DialogHeader>

        <div 
          className="flex flex-col gap-6 flex-1 overflow-y-auto scrollbar-hidden no-scrollbar"
          style={{ 
            scrollbarWidth: 'none', /* Firefox */
            msOverflowStyle: 'none', /* IE 10+ */
            WebkitOverflowScrolling: 'touch' /* iOS momentum scrolling */
          } as React.CSSProperties}
        >
          {/* Style tag for this specific component as a fallback */}
          <style>{`
            .no-scrollbar::-webkit-scrollbar {
              display: none !important;
              width: 0 !important;
              height: 0 !important;
              background: transparent !important;
            }
            .no-scrollbar {
              -ms-overflow-style: none !important;
              scrollbar-width: none !important;
            }
          `}</style>
          {/* Upload Section */}
          <div className="space-y-4">
            <Label>Upload or Capture Menu Image</Label>
            {!cameraMode ? (
              <div className="flex gap-4">
                <Button
                  variant="outline"
                  type="button"
                  className="flex-1 h-10 flex items-center justify-center gap-2"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload className="w-5 h-5" />
                  <span>Upload File</span>
                </Button>
                <Button
                  variant="outline"
                  type="button"
                  className="flex-1 h-10 flex items-center justify-center gap-2"
                  onClick={startCamera}
                >
                  <Camera className="w-5 h-5" />
                  <span>Camera</span>
                </Button>
                <input
                  type="file"
                  ref={fileInputRef}
                  className="hidden"
                  accept="image/*"
                  onChange={handleFileSelect}
                />
              </div>
            ) : (
              <div className="space-y-2">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full max-h-64 rounded-lg border bg-black object-contain"
                />
                <div className="flex gap-2">
                  <Button type="button" onClick={handleCaptureFromCamera} size="sm">
                    Capture Photo
                  </Button>
                  <Button type="button" variant="outline" onClick={stopCamera} size="sm">
                    Cancel
                  </Button>
                </div>
                {cameraError && (
                  <p className="text-sm text-destructive">{cameraError}</p>
                )}
              </div>
            )}
          </div>

          {/* Image Preview and Extract Section */}
          {image && (
            <div className="space-y-4">
              <div className="bg-muted rounded-lg overflow-hidden border relative min-h-[300px] flex items-center justify-center">
                {image && (
                  <img
                    src={image}
                    alt="Menu Preview"
                    className="max-w-full max-h-[400px] object-contain"
                  />
                )}
                {processing && (
                  <div className="absolute inset-0 bg-background/80 flex flex-col items-center justify-center z-10">
                    <Loader2 className="w-8 h-8 animate-spin mb-2" />
                    <p className="text-sm font-medium">Extracting menu items...</p>
                  </div>
                )}
              </div>
              <Button
                onClick={handleExtractItems}
                disabled={processing}
                className="w-full"
                size="lg"
              >
                {processing ? "Extracting..." : "Extract Menu Items"}
              </Button>

              {/* Extracted Items Section */}
              {items.length > 0 && (
                <div className="flex flex-col gap-4">
                  {/* Extracted Items Table */}
                  <div className="flex flex-col border rounded-lg">
                    <div className="p-3 border-b bg-muted/30">
                      <h3 className="font-semibold">Extracted Menu Items ({items.length})</h3>
                      <p className="text-sm text-muted-foreground">Review and edit items before importing</p>
                    </div>
                    
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-[60%]">Item Name</TableHead>
                          <TableHead>Price</TableHead>
                          <TableHead className="w-[50px]"></TableHead>
                        </TableRow>
                      </TableHeader>
                        <TableBody>
                          {items.map((item, index) => (
                            <TableRow key={index}>
                              <TableCell>
                                <Input
                                  value={item.name}
                                  onChange={(e) => handleItemChange(index, "name", e.target.value)}
                                  className="h-8"
                                />
                              </TableCell>
                              <TableCell>
                                <Input
                                  type="number"
                                  value={item.price || ""}
                                  onChange={(e) => handleItemChange(index, "price", parseFloat(e.target.value) || 0)}
                                  className="h-8"
                                  step="0.01"
                                  placeholder="0.00"
                                />
                              </TableCell>
                              <TableCell>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-destructive"
                                  onClick={() => handleRemoveItem(index)}
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                  </div>

                  {/* Settings Section */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 border rounded-lg bg-muted/30">
                    <div className="space-y-1">
                      <Label className="text-xs">Category</Label>
                      <Select value={defaultCategory} onValueChange={setDefaultCategory}>
                        <SelectTrigger className="h-9">
                          <SelectValue placeholder="Select Category" />
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
                      <Label className="text-xs">Margin %</Label>
                      <Input
                        type="number"
                        value={defaultMargin}
                        onChange={(e) => setDefaultMargin(e.target.value)}
                        className="h-9"
                        placeholder="30"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Default Stock</Label>
                      <Input
                        type="number"
                        value={defaultStock}
                        onChange={(e) => setDefaultStock(e.target.value)}
                        className="h-9"
                        placeholder="100"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Low Stock Threshold</Label>
                      <Input
                        type="number"
                        value={defaultLowStock}
                        onChange={(e) => setDefaultLowStock(e.target.value)}
                        className="h-9"
                        placeholder="10"
                      />
                    </div>
                  </div>

                  {/* OCR Text Collapsible */}
                  {ocrText && (
                    <Collapsible open={showOcrText} onOpenChange={setShowOcrText}>
                      <CollapsibleTrigger asChild>
                        <Button variant="outline" className="w-full justify-between">
                          <span>View OCR Text</span>
                          {showOcrText ? (
                            <ChevronUp className="w-4 h-4" />
                          ) : (
                            <ChevronDown className="w-4 h-4" />
                          )}
                        </Button>
                      </CollapsibleTrigger>
                      <CollapsibleContent className="mt-2">
                        <div className="p-4 border rounded-lg bg-muted/30 max-h-[200px] overflow-auto">
                          <pre className="text-xs whitespace-pre-wrap font-mono">{ocrText}</pre>
                        </div>
                      </CollapsibleContent>
                    </Collapsible>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="mt-4 flex-shrink-0">
          {items.length > 0 && (
            <Button 
              onClick={handleImport} 
              disabled={!defaultCategory || processing}
              size="lg"
              className="w-full"
            >
              Import {items.length} {items.length === 1 ? "Product" : "Products"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
