import type { InventoryList } from "./types";

/** Product shape from Prisma (with variants) */
export interface PosProduct {
  id: string;
  name: string;
  itemCode: string | null;
  sku: string | null;
  hasVariants: boolean;
  basePrice: number | null;
  price: number | null;
  stock: number | null;
  unitOfMeasure: string | null;
  variants?: Array<{
    id: string;
    name: string;
    price: number;
    stock: number;
  }>;
}

export interface CompanyInfo {
  name: string;
  tin: string;
  address: string;
}

/**
 * Maps POS products and company info to BIR InventoryList format.
 */
export function mapPosToInventoryList(
  products: PosProduct[],
  company: CompanyInfo,
  inventoryDate: string
): InventoryList {
  const [year, month, day] = inventoryDate.split("-").map(Number);
  const periodStart = `${year}-01-01`;
  const periodEnd = inventoryDate;

  const items: InventoryList["items"] = [];
  let lineNo = 1;

  for (const product of products) {
    const unitOfMeasure = product.unitOfMeasure || "PCS";
    const unitCost = product.basePrice ?? product.price ?? 0;

    if (product.hasVariants && product.variants?.length) {
      for (const variant of product.variants) {
        const quantity = variant.stock ?? 0;
        const totalCost = unitCost * quantity;
        items.push({
          lineNo: lineNo++,
          productCode: product.itemCode || product.sku || "",
          description: `${product.name} - ${variant.name}`,
          unit: unitOfMeasure,
          quantity,
          unitCost,
          totalCost,
          locationAddress: company.address,
          costingMethod: "FIFO",
        });
      }
    } else {
      const quantity = product.stock ?? 0;
      const totalCost = unitCost * quantity;
      items.push({
        lineNo: lineNo++,
        productCode: product.itemCode || product.sku || "",
        description: product.name,
        unit: unitOfMeasure,
        quantity,
        unitCost,
        totalCost,
        locationAddress: company.address,
        costingMethod: "FIFO",
      });
    }
  }

  return {
    header: {
      periodStart,
      periodEnd,
      inventoryDate,
      currency: "PHP",
    },
    company: {
      name: company.name,
      tin: company.tin,
      address: company.address,
    },
    items,
  };
}
