import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { isSaaS } from "@/config/appMode";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Product } from "@/types/pos";
import { useDataLayer } from "@/contexts/DataLayerContext";
import { useStore } from "@/contexts/StoreContext";
import { formatCurrency } from "@/lib/currency";
import { useToast } from "@/hooks/use-toast";
import { useSettings } from "@/contexts/SettingsContext";
import JsBarcode from "jsbarcode";
import QRCode from "qrcode";
import { Printer } from "lucide-react";

/** Select value is `productId` (base) or `productId::variantId`. */
function parseStickerSelection(value: string): { productId: string; variantId?: string } {
  const parts = value.split("::");
  if (parts.length === 2 && parts[0] && parts[1]) {
    return { productId: parts[0], variantId: parts[1] };
  }
  return { productId: value };
}

function buildStickerSelectOptions(products: Product[]): { value: string; label: string }[] {
  const items: { value: string; label: string }[] = [];
  for (const p of products.filter((x) => x.status === "active")) {
    if (p.hasVariants && p.variants && p.variants.length > 0) {
      for (const v of p.variants) {
        const code = p.sku || p.itemCode;
        items.push({
          value: `${p.id}::${v.id}`,
          label: `${p.name} — ${v.name}${code ? ` (${code})` : ""}`,
        });
      }
    } else {
      items.push({
        value: p.id,
        label: `${p.name} ${p.sku ? `(${p.sku})` : p.itemCode ? `(${p.itemCode})` : ""}`.trim(),
      });
    }
  }
  return items;
}

const StickerGenerator = () => {
  const dataService = useDataLayer();
  const navigate = useNavigate();
  const { activeStoreId, stores } = useStore();
  const isFnb = isSaaS() && stores.find((s) => s.id === activeStoreId)?.businessMode === "fnb";

  useEffect(() => {
    if (isFnb) navigate("/pos", { replace: true });
  }, [isFnb, navigate]);
  const { toast } = useToast();
  const { stickerCodeType, enablePerKiloPurchase } = useSettings();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  /** `productId` or `productId::variantId` */
  const [selectedOptionValue, setSelectedOptionValue] = useState<string>("");
  const [sku, setSku] = useState("");
  const [weight, setWeight] = useState("");
  const [price, setPrice] = useState("");
  const [productName, setProductName] = useState("");
  const [barcodeDataUrl, setBarcodeDataUrl] = useState<string>("");
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string>("");
  const [stickerData, setStickerData] = useState<{
    sku: string;
    price: number;
    productName: string;
    /** Only when Per Kilo Purchase is enabled */
    weight?: number;
  } | null>(null);

  const stickerOptions = useMemo(() => buildStickerSelectOptions(products), [products]);

  const effectiveUnitPrice = useMemo(() => {
    if (!selectedOptionValue) return undefined;
    const { productId, variantId } = parseStickerSelection(selectedOptionValue);
    const product = products.find((p) => p.id === productId);
    if (!product) return undefined;
    if (variantId) {
      const v = product.variants?.find((x) => x.id === variantId);
      if (v) return v.price;
    }
    return product.price;
  }, [selectedOptionValue, products]);

  useEffect(() => {
    loadProducts();
  }, [activeStoreId]);

  useEffect(() => {
    if (!selectedOptionValue) return;
    const { productId, variantId } = parseStickerSelection(selectedOptionValue);
    const product = products.find((p) => p.id === productId);
    if (!product) return;

    if (variantId) {
      const variant = product.variants?.find((v) => v.id === variantId);
      if (variant) {
        const baseCode = product.sku || product.itemCode || "";
        setSku(baseCode ? `${baseCode}-${variant.name}` : variant.id.slice(0, 8));
        setProductName(`${product.name} — ${variant.name}`);
        if (variant.price == null) return;
        if (!enablePerKiloPurchase) {
          setPrice(String(variant.price));
          return;
        }
        if (weight) {
          setPrice((parseFloat(weight) * variant.price).toFixed(2));
        } else {
          setPrice(String(variant.price));
        }
        return;
      }
    }

    setSku(product.sku || product.itemCode || "");
    setProductName(product.name);
    if (product.price == null) return;
    if (!enablePerKiloPurchase) {
      setPrice(String(product.price));
      return;
    }
    if (weight) {
      setPrice((parseFloat(weight) * product.price).toFixed(2));
    } else {
      setPrice(String(product.price));
    }
  }, [selectedOptionValue, products, weight, enablePerKiloPurchase]);

  useEffect(() => {
    if (!selectedOptionValue) return;
    if (!stickerOptions.some((o) => o.value === selectedOptionValue)) {
      setSelectedOptionValue("");
    }
  }, [stickerOptions, selectedOptionValue]);

  const loadProducts = async () => {
    try {
      setLoading(true);
      const storeId =
        activeStoreId && activeStoreId !== "default" ? activeStoreId : undefined;
      const prods = await dataService.getProducts(undefined, storeId);
      setProducts(prods as Product[]);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Failed to load products",
        description: error.message || "Unable to fetch products",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleWeightChange = (value: string) => {
    setWeight(value);
    if (!enablePerKiloPurchase) return;
    if (selectedOptionValue && value && effectiveUnitPrice != null) {
      setPrice((parseFloat(value) * effectiveUnitPrice).toFixed(2));
    }
  };

  const generateSticker = () => {
    if (!sku || !price) {
      toast({
        variant: "destructive",
        title: "Missing information",
        description: enablePerKiloPurchase
          ? "Please fill in SKU, Weight, and Price"
          : "Please fill in SKU and Price",
      });
      return;
    }

    if (enablePerKiloPurchase && !weight) {
      toast({
        variant: "destructive",
        title: "Missing information",
        description: "Please enter weight (kg)",
      });
      return;
    }

    const priceNum = parseFloat(price);

    let weightNum: number | undefined;
    if (enablePerKiloPurchase) {
      const w = parseFloat(weight);
      if (isNaN(w) || w <= 0) {
        toast({
          variant: "destructive",
          title: "Invalid weight",
          description: "Weight must be a positive number",
        });
        return;
      }
      weightNum = w;
    }

    if (isNaN(priceNum) || priceNum <= 0) {
      toast({
        variant: "destructive",
        title: "Invalid price",
        description: "Price must be a positive number",
      });
      return;
    }

    const data = enablePerKiloPurchase
      ? { sku, weight: weightNum!, price: priceNum }
      : { sku, price: priceNum };

    const dataString = JSON.stringify(data);

    // Generate based on selected code type
    try {
      if (stickerCodeType === "barcode") {
        // Generate barcode only
        const canvas = document.createElement("canvas");
        JsBarcode(canvas, dataString, {
          format: "CODE128",
          width: 2,
          height: 80,
          displayValue: true,
          fontSize: 14,
          margin: 10,
        });
        setBarcodeDataUrl(canvas.toDataURL("image/png"));
        setQrCodeDataUrl(""); // Clear QR code
        setStickerData({
          sku,
          price: priceNum,
          productName: productName || sku,
          ...(enablePerKiloPurchase && weightNum != null ? { weight: weightNum } : {}),
        });
      } else {
        // Generate QR code only
        QRCode.toDataURL(dataString, {
          width: 200,
          margin: 2,
          errorCorrectionLevel: "M",
        })
          .then((dataUrl) => {
            setQrCodeDataUrl(dataUrl);
            setBarcodeDataUrl(""); // Clear barcode
            setStickerData({
              sku,
              price: priceNum,
              productName: productName || sku,
              ...(enablePerKiloPurchase && weightNum != null ? { weight: weightNum } : {}),
            });
          })
          .catch((error) => {
            console.error("Failed to generate QR code:", error);
            toast({
              variant: "destructive",
              title: "QR Code generation failed",
              description: error.message || "Unable to generate QR code",
            });
          });
      }
    } catch (error: any) {
      console.error("Failed to generate code:", error);
      toast({
        variant: "destructive",
        title: "Code generation failed",
        description: error.message || "Unable to generate code",
      });
    }
  };

  const handlePrint = () => {
    if (!stickerData) return;

    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    const printContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Print Sticker</title>
          <style>
            @media print {
              @page {
                size: 4in 3in;
                margin: 0.2in;
              }
              body {
                margin: 0;
                padding: 0;
              }
            }
            body {
              font-family: Arial, sans-serif;
              padding: 10px;
              width: 3.6in;
            }
            .sticker {
              border: 2px solid #000;
              padding: 10px;
              text-align: center;
              background: white;
            }
            .product-name {
              font-size: 14px;
              font-weight: bold;
              margin-bottom: 5px;
              word-wrap: break-word;
            }
            .barcode-container {
              margin: 10px 0;
            }
            .barcode-container img {
              max-width: 100%;
              height: auto;
            }
            .qr-container {
              margin: 10px 0;
            }
            .qr-container img {
              width: 120px;
              height: 120px;
            }
            .info {
              font-size: 12px;
              margin: 5px 0;
            }
            .sku {
              font-weight: bold;
            }
            .weight-price {
              display: flex;
              justify-content: space-between;
              margin-top: 10px;
              font-size: 14px;
            }
            .price {
              font-size: 18px;
              font-weight: bold;
              color: #2563eb;
            }
          </style>
        </head>
        <body>
          <div class="sticker">
            <div class="product-name">${stickerData.productName}</div>
            <div class="info sku">SKU: ${stickerData.sku}</div>
            ${stickerCodeType === "barcode" && barcodeDataUrl ? `<div class="barcode-container"><img src="${barcodeDataUrl}" alt="Barcode" /></div>` : ""}
            ${stickerCodeType === "qr" && qrCodeDataUrl ? `<div class="qr-container"><img src="${qrCodeDataUrl}" alt="QR Code" /></div>` : ""}
            <div class="weight-price" style="${stickerData.weight != null ? "" : "justify-content: center;"}">
              ${stickerData.weight != null ? `<span class="info">Weight: ${stickerData.weight} kg</span>` : ""}
              <span class="price">${formatCurrency(stickerData.price)}</span>
            </div>
          </div>
        </body>
      </html>
    `;

    printWindow.document.write(printContent);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 250);
  };

  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold">Sticker Generator</h1>
        <p className="text-muted-foreground">
          {enablePerKiloPurchase
            ? "Generate QR/Barcode stickers for weighed (per kg) items"
            : "Generate QR/Barcode stickers with SKU and price"}
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Input Form */}
        <Card>
          <CardHeader>
            <CardTitle>Sticker Information</CardTitle>
            <CardDescription>Enter product details for the sticker</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="product">Product</Label>
              <Select value={selectedOptionValue} onValueChange={setSelectedOptionValue}>
                <SelectTrigger id="product">
                  <SelectValue placeholder="Select a product or variant" />
                </SelectTrigger>
                <SelectContent>
                  {stickerOptions.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="sku">SKU / Item Code</Label>
              <Input
                id="sku"
                placeholder="Enter SKU or Item Code"
                value={sku}
                onChange={(e) => setSku(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="product-name">Product Name (Optional)</Label>
              <Input
                id="product-name"
                placeholder="Product name"
                value={productName}
                onChange={(e) => setProductName(e.target.value)}
              />
            </div>

            {enablePerKiloPurchase && (
              <div className="space-y-2">
                <Label htmlFor="weight">Weight (kg)</Label>
                <Input
                  id="weight"
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={weight}
                  onChange={(e) => handleWeightChange(e.target.value)}
                />
                {effectiveUnitPrice != null && (
                  <p className="text-xs text-muted-foreground">
                    Price per kg: {formatCurrency(effectiveUnitPrice)}
                  </p>
                )}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="price">{enablePerKiloPurchase ? "Price" : "Price (unit)"}</Label>
              <Input
                id="price"
                type="number"
                step="0.01"
                placeholder="0.00"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
              />
            </div>

            <Button onClick={generateSticker} className="w-full" disabled={loading}>
              Generate Sticker
            </Button>
          </CardContent>
        </Card>

        {/* Sticker Preview */}
        <Card>
          <CardHeader>
            <CardTitle>Sticker Preview</CardTitle>
            <CardDescription>Preview and print your sticker</CardDescription>
          </CardHeader>
          <CardContent>
            {stickerData ? (
              <div className="space-y-4">
                <div className="border-2 border-gray-800 p-4 text-center bg-white max-w-xs mx-auto">
                  <div className="font-bold text-sm mb-2 break-words">{stickerData.productName}</div>
                  <div className="text-xs mb-2 font-semibold">SKU: {stickerData.sku}</div>
                  
                  {stickerCodeType === "barcode" && barcodeDataUrl && (
                    <div className="my-3">
                      <img src={barcodeDataUrl} alt="Barcode" className="max-w-full h-auto" />
                    </div>
                  )}
                  
                  {stickerCodeType === "qr" && qrCodeDataUrl && (
                    <div className="my-3 flex justify-center">
                      <img src={qrCodeDataUrl} alt="QR Code" className="w-32 h-32" />
                    </div>
                  )}
                  
                  <div
                    className={`flex mt-4 text-sm ${enablePerKiloPurchase && stickerData.weight != null ? "justify-between items-center" : "justify-center"}`}
                  >
                    {enablePerKiloPurchase && stickerData.weight != null && (
                      <span>Weight: {stickerData.weight} kg</span>
                    )}
                    <span className="text-lg font-bold text-primary">
                      {formatCurrency(stickerData.price)}
                    </span>
                  </div>
                </div>

                <Button onClick={handlePrint} className="w-full" variant="default">
                  <Printer className="w-4 h-4 mr-2" />
                  Print Sticker
                </Button>
              </div>
            ) : (
              <div className="flex items-center justify-center h-64 text-muted-foreground">
                <p>Generate a sticker to see preview</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default StickerGenerator;

