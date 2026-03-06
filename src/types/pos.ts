export type UserRole = "admin" | "cashier" | "owner" | "super_admin";

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  storeIds?: string[];
}

export interface Category {
  id: string;
  name: string;
}

export interface Variant {
  id: string;
  productId: string;
  name: string;
  price: number;
  stock: number;
}

export interface Product {
  id: string;
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
  variants?: Variant[];
  image?: string;
  barcode?: string;
  qrCode?: string;
  unitOfMeasure?: string;
}

export interface CartItem {
  id: string;
  productId: string;
  variantId?: string;
  name: string;
  variantName?: string;
  price: number;
  quantity: number;
  subtotal: number;
}

export interface Sale {
  id: string;
  cashierId: string;
  cashierName: string;
  total: number;
  paymentMethod: "cash";
  amountReceived: number;
  change: number;
  createdAt: Date;
  items: SaleItem[];
}

export interface SaleItem {
  id: string;
  saleId: string;
  productId: string;
  variantId?: string;
  productName: string;
  variantName?: string;
  quantity: number;
  price: number;
  subtotal: number;
}
