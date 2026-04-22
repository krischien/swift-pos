import type {
  Category,
  Product,
  Variant,
  User,
  Sale,
  Ingredient,
  MenuCategory,
  MenuItem,
} from "@/types/pos";

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
  getSales: (
    params?: { from?: string; to?: string; voidFilter?: "active" | "voided" | "all" },
    storeId?: string,
  ) => Promise<Sale[]>;
  getVoidCount?: (params?: { from?: string; to?: string }, storeId?: string) => Promise<number>;
  createSale: (payload: CreateSalePayload, storeId?: string) => Promise<Sale>;
  voidSale?: (id: string, storeId?: string) => Promise<Sale | null>;

  // F&B (SaaS fnb stores only)
  getIngredients: (storeId?: string) => Promise<Ingredient[]>;
  createIngredient: (
    payload: CreateIngredientPayload,
    storeId?: string,
  ) => Promise<Ingredient>;
  updateIngredient: (
    id: string,
    payload: UpdateIngredientPayload,
    storeId?: string,
  ) => Promise<Ingredient>;
  deleteIngredient: (id: string, storeId?: string) => Promise<void>;

  getMenuCategories: (storeId?: string) => Promise<MenuCategory[]>;
  createMenuCategory: (payload: { name: string }, storeId?: string) => Promise<MenuCategory>;
  updateMenuCategory: (
    id: string,
    payload: { name: string },
    storeId?: string,
  ) => Promise<MenuCategory>;
  deleteMenuCategory: (id: string, storeId?: string) => Promise<void>;

  getMenuItems: (
    params?: { menuCategoryId?: string | null },
    storeId?: string,
  ) => Promise<MenuItem[]>;
  createMenuItem: (payload: CreateMenuItemPayload, storeId?: string) => Promise<MenuItem>;
  updateMenuItem: (
    id: string,
    payload: UpdateMenuItemPayload,
    storeId?: string,
  ) => Promise<MenuItem>;
  deleteMenuItem: (id: string, storeId?: string) => Promise<void>;
  replaceMenuItemRecipe: (
    menuItemId: string,
    payload: ReplaceRecipePayload,
    storeId?: string,
  ) => Promise<MenuItem>;

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

export interface CreateIngredientPayload {
  name: string;
  sku?: string;
  barcode?: string;
  stock?: number;
  lowStockThreshold?: number;
  unitOfMeasure?: string;
  status?: string;
}

export type UpdateIngredientPayload = Partial<CreateIngredientPayload> & {
  sku?: string | null;
  barcode?: string | null;
  unitOfMeasure?: string | null;
};

export interface CreateMenuItemPayload {
  menuCategoryId: string;
  name: string;
  price: number;
  status?: string;
  image?: string;
  barcode?: string;
}

export type UpdateMenuItemPayload = Partial<{
  menuCategoryId: string;
  name: string;
  price: number;
  status: string;
  image: string | null;
  barcode: string | null;
}>;

export interface ReplaceRecipePayload {
  lines: Array<{ ingredientId: string; quantity: number; wastagePercent?: number }>;
}

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
  cartItems?: Array<{
    id: string;
    productId?: string;
    menuItemId?: string;
    variantId?: string;
    name?: string;
    productName?: string;
    variantName?: string;
    quantity: number;
    price: number;
    subtotal: number;
  }>;
  items?: Array<{
    productId?: string;
    menuItemId?: string;
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
