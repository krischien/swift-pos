import type { Category, Product, Variant, User, Sale } from "@/types/pos";

export interface DataService {
  // Auth
  login: (payload: { email: string; password: string }) => Promise<User>;

  // Categories
  getCategories: (storeId?: string) => Promise<Category[]>;
  createCategory: (payload: { name: string }, storeId?: string) => Promise<Category>;
  updateCategory: (id: string, payload: { name: string }, storeId?: string) => Promise<Category>;
  deleteCategory: (id: string, storeId?: string) => Promise<void>;

  // Products
  getProducts: (
    params?: { categoryId?: string | null; search?: string },
    storeId?: string
  ) => Promise<Product[]>;
  createProduct: (payload: CreateProductPayload, storeId?: string) => Promise<Product>;
  updateProduct: (id: string, payload: UpdateProductPayload, storeId?: string) => Promise<Product>;
  deleteProduct: (id: string, storeId?: string) => Promise<void>;

  // Variants
  getVariants: (productId: string, storeId?: string) => Promise<Variant[]>;
  createVariant: (
    productId: string,
    payload: { name: string; price: number; stock: number },
    storeId?: string
  ) => Promise<Variant>;
  updateVariant: (
    id: string,
    payload: Partial<{ name: string; price: number; stock: number }>,
    storeId?: string
  ) => Promise<Variant>;
  deleteVariant: (id: string, storeId?: string) => Promise<void>;

  // Sales
  getSales: (params?: { from?: string; to?: string }, storeId?: string) => Promise<Sale[]>;
  getVoidCount?: (params?: { from?: string; to?: string }, storeId?: string) => Promise<number>;
  createSale: (payload: CreateSalePayload, storeId?: string) => Promise<Sale>;
  voidSale?: (id: string, storeId?: string) => Promise<Sale | null>;

  // Users (org-scoped in SaaS; store-scoped or global in Solo)
  getUsers: (storeId?: string) => Promise<User[]>;
  createUser: (payload: CreateUserPayload, storeId?: string) => Promise<User>;
  updateUser: (id: string, payload: UpdateUserPayload, storeId?: string) => Promise<User>;
  deleteUser: (id: string, storeId?: string) => Promise<void>;
}

export interface CreateProductPayload {
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
  barcode?: string;
  qrCode?: string;
  unitOfMeasure?: string;
}

export type UpdateProductPayload = Partial<CreateProductPayload> & {
  lowStockThreshold?: number;
  status?: "active" | "inactive";
};

export interface CreateSalePayload {
  cashierId: string;
  cashierName: string;
  total?: number;
  paymentMethod?: string;
  amountReceived: number;
  change?: number;
  taxRate?: number;
  discountPercent?: number;
  ticketNumber?: string;
  gcashTransactionId?: string;
  cartItems?: Array<{ id: string; productId: string; variantId?: string; name?: string; productName?: string; variantName?: string; quantity: number; price: number; subtotal: number }>;
  items?: Array<{
    productId: string;
    variantId?: string;
    productName: string;
    variantName?: string;
    quantity: number;
    price: number;
    subtotal: number;
  }>;
}

export interface CreateUserPayload {
  name: string;
  email: string;
  password: string;
  role: "owner" | "cashier";
  storeIds?: string[];
}

export type UpdateUserPayload = Partial<CreateUserPayload>;
