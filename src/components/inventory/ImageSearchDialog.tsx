import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Camera, Upload, Loader2, X, Search } from "lucide-react";
import { useState, useRef } from "react";
import { findSimilarProducts, ImageMatch } from "@/lib/imageSimilarityService";
import { Product } from "@/types/pos";
import { Badge } from "@/components/ui/badge";

interface ImageSearchDialogProps {
  products: Product[];
  onSelectProduct: (product: Product) => void;
  enableImageSearch?: boolean;
  enableBarcodeScanning?: boolean;
}

export function ImageSearchDialog({ 
  products, 
  onSelectProduct,
  enableImageSearch = true,
  enableBarcodeScanning = false
}: ImageSearchDialogProps) {
  const [open, setOpen] = useState(false);
  const [image, setImage] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [processing, setProcessing] = useState(false);
  const [matches, setMatches] = useState<ImageMatch[]>([]);
  const [searching, setSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type.startsWith("image/")) {
      setImageFile(file);
      const reader = new FileReader();
      reader.onload = () => {
        setImage(reader.result as string);
        setMatches([]);
        setHasSearched(false);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleCameraClick = () => {
    if (cameraInputRef.current) {
      cameraInputRef.current.click();
    }
  };

  const handleOpenChange = (isOpen: boolean) => {
    setOpen(isOpen);
    if (!isOpen) {
      // Reset state
      setImage(null);
      setImageFile(null);
      setMatches([]);
      setHasSearched(false);
    }
  };

  const handleSearch = async () => {
    if (!image) return;

    setSearching(true);
    setProcessing(true);
    try {
      const results = await findSimilarProducts(
        image,
        products.filter((p) => p.image && p.status === "active")
      );
      setMatches(results);
      setHasSearched(true);
      if (results.length === 0) {
        alert("No similar products found.");
      }
    } catch (error) {
      alert("Failed to search for similar products");
      console.error(error);
    } finally {
      setSearching(false);
      setProcessing(false);
    }
  };

  const handleClose = () => {
    setOpen(false);
    handleOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="absolute right-2 top-1/2 -translate-y-1/2"
        >
          <Search className="w-4 h-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Search Products by Image</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 overflow-y-auto flex-1">
          {!image ? (
            <div className="space-y-6 py-4">
              <div className="flex flex-col gap-4">
                 <div className="p-8 border-2 border-dashed rounded-lg flex flex-col items-center justify-center text-center space-y-4 bg-muted/10 hover:bg-muted/20 transition-colors">
                  <div className="p-4 bg-primary/10 rounded-full">
                    <Camera className="w-8 h-8 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-lg">Take a Photo</h3>
                    <p className="text-sm text-muted-foreground">Use your camera to find similar products</p>
                  </div>
                  <Button 
                    size="lg" 
                    className="w-full sm:w-auto min-w-[200px]"
                    onClick={handleCameraClick}
                    disabled={!enableImageSearch}
                  >
                    <Camera className="w-4 h-4 mr-2" />
                    Open Camera
                  </Button>
                </div>

                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-background px-2 text-muted-foreground">Or upload image</span>
                  </div>
                </div>

                <Button
                  variant="outline"
                  size="lg"
                  className="w-full"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={!enableImageSearch}
                >
                  <Upload className="w-4 h-4 mr-2" />
                  Select from Gallery
                </Button>
              </div>
              
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileSelect}
                className="hidden"
              />
              <input
                ref={cameraInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handleFileSelect}
                className="hidden"
              />
            </div>
          ) : (
            <div className="space-y-4">
              <div className="relative">
                <img
                  src={image}
                  alt="Search image"
                  className="w-full max-h-64 object-contain rounded-lg border"
                />
                <Button
                  variant="destructive"
                  size="icon"
                  className="absolute top-2 right-2"
                  onClick={() => {
                    setImage(null);
                    setImageFile(null);
                    setMatches([]);
                    setHasSearched(false);
                  }}
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
              {matches.length === 0 ? (
                <Button
                  onClick={handleSearch}
                  disabled={searching}
                  className="w-full"
                >
                  {searching ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Searching...
                    </>
                  ) : (
                    <>
                      <Search className="w-4 h-4 mr-2" />
                      Find Similar Products
                    </>
                  )}
                </Button>
              ) : (
                <div className="space-y-2">
                  <p className="text-sm font-medium">
                    Found {matches.length} similar product{matches.length !== 1 ? "s" : ""}:
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {matches.map((match) => {
                      const product = products.find(p => p.id === match.productId);
                      return product ? (
                      <div
                        key={match.productId}
                        className="border rounded-lg p-3 hover:bg-muted cursor-pointer transition-colors"
                        onClick={() => {
                          onSelectProduct(product);
                          handleClose();
                        }}
                      >
                        <div className="flex gap-3">
                          {match.image && (
                            <img
                              src={match.image}
                              alt={match.productName}
                              className="w-16 h-16 object-cover rounded border"
                            />
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="font-medium truncate">{match.productName}</p>
                            <Badge variant="secondary" className="mt-1">
                              {match.similarity}% match
                            </Badge>
                          </div>
                        </div>
                      </div>
                      ) : null;
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
