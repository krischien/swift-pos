export type UserRole = "admin" | "cashier";

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
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
  hasVariants: boolean;
  price?: number;
  stock?: number;
  lowStockThreshold: number;
  status: "active" | "inactive";
  variants?: Variant[];
  image?: string;
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
