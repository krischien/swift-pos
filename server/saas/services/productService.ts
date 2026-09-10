import { saasPrisma } from "../db.js";
import { generateBarcode, generateQRCode } from "../../utils/barcodeGenerator.js";

export interface ListProductsOptions {
  categoryId?: string | null;
  search?: string;
  status?: "active" | "inactive";
}

export async function listProducts(storeId: string, options: ListProductsOptions = {}) {
  const { categoryId, search, status } = options;

  return saasPrisma.product.findMany({
    where: {
      storeId,
      ...(categoryId ? { categoryId } : {}),
      ...(status ? { status } : {}),
      ...(search
        ? {
            name: {
              contains: search,
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

export async function getProductById(id: string, storeId: string) {
  const product = await saasPrisma.product.findFirst({
    where: { id, storeId },
    include: {
      variants: true,
      category: true,
    },
  });
  return product;
}

export async function createProduct(
  storeId: string,
  input: {
    name: string;
    categoryId: string;
    itemCode?: string;
    sku?: string;
    hasVariants: boolean;
    basePrice?: number;
    price?: number;
    stock?: number;
    lowStockThreshold?: number;
    marginPercentage?: number;
    status?: "active" | "inactive";
    image?: string;
    barcode?: string;
    qrCode?: string;
    unitOfMeasure?: string;
  }
) {
  // Verify category belongs to store
  const category = await saasPrisma.category.findFirst({
    where: { id: input.categoryId, storeId },
  });
  if (!category) throw new Error("Category not found");

  let barcode: string | undefined = input.barcode;
  let qrCode: string | undefined = input.qrCode;

  if (input.itemCode && !barcode) {
    try {
      barcode = await generateBarcode(input.itemCode);
      qrCode = await generateQRCode(input.itemCode);
    } catch (error) {
      console.error("Failed to generate barcode/QR code:", error);
    }
  }

  return saasPrisma.product.create({
    data: {
      storeId,
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
  storeId: string,
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
  }>
) {
  const existing = await saasPrisma.product.findFirst({ where: { id, storeId } });
  if (!existing) throw new Error("Product not found");

  const updateData: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(input)) {
    if (val !== undefined && key !== "barcode" && key !== "qrCode") {
      updateData[key] = val;
    }
  }

  const itemCodeToUse = (input.itemCode ?? existing.itemCode) as string | undefined;
  if (itemCodeToUse) {
    const shouldGenerate =
      input.itemCode !== undefined ||
      !existing.barcode ||
      !existing.qrCode;
    if (shouldGenerate) {
      try {
        updateData.barcode = await generateBarcode(itemCodeToUse);
        updateData.qrCode = await generateQRCode(itemCodeToUse);
      } catch (error) {
        console.error("Failed to generate barcode/QR code:", error);
      }
    }
  }

  return saasPrisma.product.update({
    where: { id },
    data: updateData,
  });
}

export async function deleteProduct(id: string, storeId: string) {
  const existing = await saasPrisma.product.findFirst({ where: { id, storeId } });
  if (!existing) throw new Error("Product not found");
  await saasPrisma.variant.deleteMany({ where: { productId: id } });
  return saasPrisma.product.delete({ where: { id } });
}
