import { prisma } from "../db";
import { generateBarcode, generateQRCode } from "../utils/barcodeGenerator";

export interface ListProductsOptions {
  categoryId?: string | null;
  search?: string;
  status?: "active" | "inactive";
}

export async function listCategories() {
  return prisma.category.findMany({
    orderBy: { name: "asc" },
  });
}

export async function listProducts(options: ListProductsOptions = {}) {
  const { categoryId, search, status } = options;

  return prisma.product.findMany({
    where: {
      ...(categoryId ? { categoryId } : {}),
      ...(status ? { status } : {}),
      ...(search
        ? {
            name: {
              contains: search,
              mode: "insensitive",
            },
          }
        : {}),
    },
    include: {
      variants: true,
      category: true,
    },
    orderBy: {
      name: "asc",
    },
  });
}

export async function getProductById(id: string) {
  return prisma.product.findUnique({
    where: { id },
    include: {
      variants: true,
      category: true,
    },
  });
}

export async function createProduct(input: {
  name: string;
  categoryId: string;
  itemCode: string;
  sku?: string;
  hasVariants: boolean;
  basePrice?: number;
  price?: number;
  stock?: number;
  lowStockThreshold?: number;
  marginPercentage?: number;
  status?: "active" | "inactive";
  image?: string;
  unitOfMeasure?: string;
}) {
  // Generate barcode and QR code from Item Code
  let barcode: string | undefined;
  let qrCode: string | undefined;
  
  if (input.itemCode) {
    try {
      barcode = await generateBarcode(input.itemCode);
      qrCode = await generateQRCode(input.itemCode);
    } catch (error) {
      console.error("Failed to generate barcode/QR code:", error);
      // Continue without codes if generation fails
    }
  }

  return prisma.product.create({
    data: {
      name: input.name,
      categoryId: input.categoryId,
      itemCode: input.itemCode,
      sku: input.sku,
      hasVariants: input.hasVariants,
      basePrice: input.basePrice,
      price: input.price,
      stock: input.stock,
      lowStockThreshold: input.lowStockThreshold ?? 0,
      marginPercentage: input.marginPercentage,
      status: input.status ?? "active",
      image: input.image,
      unitOfMeasure: input.unitOfMeasure ?? "PCS",
      barcode,
      qrCode,
    },
  });
}

export async function updateProduct(
  id: string,
  input: Partial<{
    name: string;
    categoryId: string;
    itemCode: string;
    sku?: string;
    hasVariants: boolean;
    basePrice?: number;
    price?: number;
    stock?: number;
    lowStockThreshold: number;
    marginPercentage?: number;
    status: "active" | "inactive";
    image?: string;
    barcode?: string;
    qrCode?: string;
    unitOfMeasure?: string;
  }>,
) {
  // Build update data, handling categoryId separately if needed
  const updateData: any = {};
  
  // Copy all fields except categoryId
  Object.keys(input).forEach((key) => {
    if (key !== "categoryId" && input[key as keyof typeof input] !== undefined) {
      updateData[key] = input[key as keyof typeof input];
    }
  });
  
  // Handle categoryId separately - use direct field assignment
  if (input.categoryId !== undefined) {
    updateData.categoryId = input.categoryId;
  }
  
  // Get current product to check if codes exist and get Item Code
  const currentProduct = await prisma.product.findUnique({
    where: { id },
    select: { itemCode: true, barcode: true, qrCode: true },
  });
  
  const itemCodeToUse = input.itemCode ?? currentProduct?.itemCode;
  
  // Generate barcode and QR code if:
  // 1. Item Code is being updated, OR
  // 2. Current product doesn't have barcode or QR code
  if (itemCodeToUse) {
    const shouldGenerate =
      input.itemCode !== undefined || // Item Code is being changed
      !currentProduct?.barcode || // No barcode exists
      !currentProduct?.qrCode; // No QR code exists
    
    if (shouldGenerate) {
      try {
        updateData.barcode = await generateBarcode(itemCodeToUse);
        updateData.qrCode = await generateQRCode(itemCodeToUse);
      } catch (error) {
        console.error("Failed to generate barcode/QR code:", error);
        // Continue without updating codes if generation fails
      }
    }
  }
  
  return prisma.product.update({
    where: { id },
    data: updateData,
  });
}

export async function deleteProduct(id: string) {
  await prisma.variant.deleteMany({ where: { productId: id } });
  return prisma.product.delete({ where: { id } });
}


