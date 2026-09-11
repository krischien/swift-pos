export type UserRole = "admin" | "cashier" | "owner" | "super_admin";

export type BusinessMode = "retail" | "fnb";

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
  tracksCylinder?: boolean;
  cylinderSize?: string | null;
  depositAmount?: number;
  emptyStock?: number;
}

export interface CartItem {
  id: string;
  /** Retail line — mutually exclusive with menuItemId. */
  productId?: string;
  /** F&B line — mutually exclusive with productId. */
  menuItemId?: string;
  variantId?: string;
  name: string;
  variantName?: string;
  price: number;
  quantity: number;
  subtotal: number;
  /** Customer brought empty canister — exchange at sale */
  broughtEmpty?: boolean;
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
  status?: string;
  voidedAt?: Date | string | null;
  voidedById?: string | null;
  voidedByName?: string | null;
}

export interface SaleItem {
  id: string;
  saleId: string;
  productId?: string | null;
  menuItemId?: string | null;
  variantId?: string;
  productName: string;
  variantName?: string;
  quantity: number;
  price: number;
  subtotal: number;
}

export interface Ingredient {
  id: string;
  storeId: string;
  name: string;
  sku?: string | null;
  barcode?: string | null;
  stock: number;
  lowStockThreshold: number;
  unitOfMeasure?: string | null;
  status: string;
}

export interface MenuCategory {
  id: string;
  storeId: string;
  name: string;
}

export interface RecipeLine {
  id: string;
  menuItemId: string;
  ingredientId: string;
  quantity: number;
  wastagePercent?: number | null;
  ingredient?: Ingredient;
}

export interface CylinderLoan {
  id: string;
  storeId: string;
  saleId: string;
  productId: string;
  quantity: number;
  customerName?: string | null;
  customerPhone?: string | null;
  depositAmount: number;
  depositRefunded: boolean;
  status: "out" | "returned" | "written_off";
  outAt: string;
  returnedAt?: string | null;
  product?: { id: string; name: string; cylinderSize?: string | null };
  sale?: { id: string; ticketNumber?: string | null; createdAt: string; cashierName?: string | null };
}

export interface CylinderStats {
  filledOnHand: number;
  onCustomer: number;
  emptyOnHand: number;
  depositLiability: number;
  lowFilledCount: number;
  outOfFilledCount: number;
  lowEmptyCount: number;
  outOfEmptyCount: number;
}

export interface MenuItem {
  id: string;
  storeId: string;
  menuCategoryId: string;
  name: string;
  price: number;
  status: string;
  image?: string | null;
  barcode?: string | null;
  recipeLines?: RecipeLine[];
  menuCategory?: MenuCategory;
}
