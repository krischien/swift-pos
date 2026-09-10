/**
 * BIR Annex A Inventory List data model.
 * Matches the structure required for compliant BIR reporting.
 */
export type ClassificationCode = "CH" | "P" | "O" | "CO";

export interface InventoryItem {
  lineNo: number;
  productCode: string;
  description: string;
  unit: string;
  quantity: number;
  unitCost: number;
  totalCost: number;
  classificationCode?: ClassificationCode;
  locationAddress?: string;
  locationCode?: string;
  locationRemarks?: string;
  costingMethod?: string;
  totalWeightVolume?: string;
}

export interface InventoryList {
  header: {
    periodStart: string; // YYYY-MM-DD
    periodEnd: string; // YYYY-MM-DD
    inventoryDate: string; // YYYY-MM-DD (as-of date)
    currency: string;
    remarks?: string;
  };
  company: {
    name: string;
    tin: string;
    address: string;
  };
  items: InventoryItem[];
}
