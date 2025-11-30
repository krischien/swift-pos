import bcrypt from "bcryptjs";
import { getDatabase, dbExecute, dbQuery } from "./mobileDb";
import { Category, Product, Variant, User } from "@/types/pos";

// Helper to generate CUID-like IDs
const generateId = () => {
  return `${Date.now().toString(36)}${Math.random().toString(36).substr(2)}`;
};

export const mobileServices = {
  // Auth
  async login(payload: { email: string; password: string }): Promise<User> {
    try {
      console.log("Attempting login for:", payload.email);
      const db = await getDatabase();
      console.log("Database connection obtained");
      
      // Try to query for user
      let result: any;
      try {
        result = await dbQuery(db, "SELECT * FROM User WHERE email = ?", [payload.email]);
        console.log("Query result:", result);
      } catch (queryError) {
        console.error("Query error:", queryError);
        // Try alternative query method
        if (db.query) {
          result = await db.query("SELECT * FROM User WHERE email = ?", [payload.email]);
          result = { values: result.values || result.rows || [] };
        } else {
          throw queryError;
        }
      }

      if (!result || !result.values || result.values.length === 0) {
        throw new Error("Invalid credentials");
      }

      const user = result.values[0] as any;
      console.log("User found:", {
        id: user.id,
        email: user.email,
        role: user.role,
      });

      const passwordMatches = await bcrypt.compare(payload.password, user.password);
      if (!passwordMatches) {
        throw new Error("Invalid credentials");
      }

      return {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role as "admin" | "cashier",
      };
    } catch (error) {
      console.error("Login error:", error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error("Full error details:", error);
      throw new Error(`Login failed: ${errorMessage}`);
    }
  },

  // Categories
  async getCategories(): Promise<Category[]> {
    const db = await getDatabase();
    const result = await dbQuery(db, "SELECT * FROM Category ORDER BY name");
    return (result.values || []).map((row: any) => ({
      id: row.id,
      name: row.name,
    }));
  },

  async createCategory(payload: { name: string }): Promise<Category> {
    const db = await getDatabase();
    const id = generateId();

    await dbExecute(db, "INSERT INTO Category (id, name) VALUES (?, ?)", [
      id,
      payload.name,
    ]);

    return {
      id,
      name: payload.name,
    };
  },

  async updateCategory(id: string, payload: { name: string }): Promise<Category> {
    const db = await getDatabase();

    await dbExecute(db, "UPDATE Category SET name = ? WHERE id = ?", [
      payload.name,
      id,
    ]);

    const result = await dbQuery(db, "SELECT * FROM Category WHERE id = ?", [id]);
    const row = result.values?.[0] as any;
    return {
      id: row.id,
      name: row.name,
    };
  },

  async deleteCategory(id: string): Promise<void> {
    const db = await getDatabase();
    await dbExecute(db, "DELETE FROM Category WHERE id = ?", [id]);
  },

  // Products
  async getProducts(params?: { categoryId?: string | null; search?: string }): Promise<Product[]> {
    const db = await getDatabase();
    let query = `
      SELECT p.*, c.name as categoryName 
      FROM Product p 
      LEFT JOIN Category c ON p.categoryId = c.id 
      WHERE 1=1
    `;
    const args: any[] = [];

    if (params?.categoryId) {
      query += " AND p.categoryId = ?";
      args.push(params.categoryId);
    }

    if (params?.search) {
      query += " AND p.name LIKE ?";
      args.push(`%${params.search}%`);
    }

    query += " AND p.status = 'active' ORDER BY p.name";

    const result = await dbQuery(db, query, args);
    const products = (result.values || []).map((row: any) => ({
      id: row.id,
      name: row.name,
      categoryId: row.categoryId,
      itemCode: row.itemCode,
      sku: row.sku,
      hasVariants: Boolean(row.hasVariants),
      basePrice: row.basePrice,
      price: row.price,
      stock: row.stock,
      lowStockThreshold: row.lowStockThreshold,
      marginPercentage: row.marginPercentage,
      status: row.status,
      image: row.image,
      barcode: row.barcode,
      qrCode: row.qrCode,
    })) as Product[];

    // Load variants for products that have them
    for (const product of products) {
      if (product.hasVariants) {
        const variants = await mobileServices.getVariants(product.id);
        (product as any).variants = variants;
      }
    }

    return products;
  },

  async createProduct(payload: {
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
  }): Promise<Product> {
    const db = await getDatabase();
    const id = generateId();

    await dbExecute(
      db,
      `INSERT INTO Product (id, name, categoryId, itemCode, sku, hasVariants, basePrice, price, stock, lowStockThreshold, marginPercentage, status, image, barcode, qrCode)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        payload.name,
        payload.categoryId,
        payload.itemCode,
        payload.sku || null,
        payload.hasVariants ? 1 : 0,
        payload.basePrice || null,
        payload.price || null,
        payload.stock || null,
        payload.lowStockThreshold || 0,
        payload.marginPercentage || null,
        payload.status || "active",
        payload.image || null,
        payload.barcode || null,
        payload.qrCode || null,
      ]
    );

    return mobileServices.getProducts().then((products) => products.find((p) => p.id === id)!);
  },

  async updateProduct(
    id: string,
    payload: Partial<{
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
    }>
  ): Promise<Product> {
    const db = await getDatabase();
    const updates: string[] = [];
    const values: any[] = [];

    if (payload.name !== undefined) {
      updates.push("name = ?");
      values.push(payload.name);
    }
    if (payload.categoryId !== undefined) {
      updates.push("categoryId = ?");
      values.push(payload.categoryId);
    }
    if (payload.itemCode !== undefined) {
      updates.push("itemCode = ?");
      values.push(payload.itemCode);
    }
    if (payload.sku !== undefined) {
      updates.push("sku = ?");
      values.push(payload.sku || null);
    }
    if (payload.hasVariants !== undefined) {
      updates.push("hasVariants = ?");
      values.push(payload.hasVariants ? 1 : 0);
    }
    if (payload.basePrice !== undefined) {
      updates.push("basePrice = ?");
      values.push(payload.basePrice || null);
    }
    if (payload.price !== undefined) {
      updates.push("price = ?");
      values.push(payload.price);
    }
    if (payload.stock !== undefined) {
      updates.push("stock = ?");
      values.push(payload.stock);
    }
    if (payload.lowStockThreshold !== undefined) {
      updates.push("lowStockThreshold = ?");
      values.push(payload.lowStockThreshold);
    }
    if (payload.marginPercentage !== undefined) {
      updates.push("marginPercentage = ?");
      values.push(payload.marginPercentage || null);
    }
    if (payload.status !== undefined) {
      updates.push("status = ?");
      values.push(payload.status);
    }
    if (payload.image !== undefined) {
      updates.push("image = ?");
      values.push(payload.image);
    }

    if (updates.length > 0) {
      values.push(id);
      await dbExecute(db, `UPDATE Product SET ${updates.join(", ")} WHERE id = ?`, values);
    }

    return mobileServices.getProducts().then((products) => products.find((p) => p.id === id)!);
  },

  async deleteProduct(id: string): Promise<void> {
    const db = await getDatabase();
    await dbExecute(db, "DELETE FROM Variant WHERE productId = ?", [id]);
    await dbExecute(db, "DELETE FROM Product WHERE id = ?", [id]);
  },

  // Variants
  async getVariants(productId: string): Promise<Variant[]> {
    const db = await getDatabase();
    const result = await dbQuery(db, "SELECT * FROM Variant WHERE productId = ?", [productId]);
    return (result.values || []).map((row: any) => ({
      id: row.id,
      productId: row.productId,
      name: row.name,
      price: row.price,
      stock: row.stock,
    }));
  },

  async createVariant(
    productId: string,
    payload: { name: string; price: number; stock: number }
  ): Promise<Variant> {
    const db = await getDatabase();
    const id = generateId();

    await dbExecute(
      db,
      "INSERT INTO Variant (id, productId, name, price, stock) VALUES (?, ?, ?, ?, ?)",
      [id, productId, payload.name, payload.price, payload.stock]
    );

    return {
      id,
      productId,
      name: payload.name,
      price: payload.price,
      stock: payload.stock,
    };
  },

  async updateVariant(
    id: string,
    payload: Partial<{ name: string; price: number; stock: number }>
  ): Promise<Variant> {
    const db = await getDatabase();
    const updates: string[] = [];
    const values: any[] = [];

    if (payload.name !== undefined) {
      updates.push("name = ?");
      values.push(payload.name);
    }
    if (payload.price !== undefined) {
      updates.push("price = ?");
      values.push(payload.price);
    }
    if (payload.stock !== undefined) {
      updates.push("stock = ?");
      values.push(payload.stock);
    }

    if (updates.length > 0) {
      values.push(id);
      await dbExecute(db, `UPDATE Variant SET ${updates.join(", ")} WHERE id = ?`, values);
    }

    const result = await dbQuery(db, "SELECT * FROM Variant WHERE id = ?", [id]);
    const row = result.values?.[0] as any;
    return {
      id: row.id,
      productId: row.productId,
      name: row.name,
      price: row.price,
      stock: row.stock,
    };
  },

  async deleteVariant(id: string): Promise<void> {
    const db = await getDatabase();
    await dbExecute(db, "DELETE FROM Variant WHERE id = ?", [id]);
  },

  // Sales
  async getSales(params?: { from?: string; to?: string }): Promise<any[]> {
    const db = await getDatabase();
    let query = "SELECT * FROM Sale WHERE 1=1";
    const args: any[] = [];

    if (params?.from) {
      query += " AND createdAt >= ?";
      args.push(params.from);
    }
    if (params?.to) {
      query += " AND createdAt <= ?";
      args.push(params.to);
    }

    query += " ORDER BY createdAt DESC";

    const result = await dbQuery(db, query, args);
    const sales = (result.values || []).map((row: any) => ({
      id: row.id,
      ticketNumber: row.ticketNumber,
      cashierId: row.cashierId,
      cashierName: row.cashierName,
      total: row.total,
      paymentMethod: row.paymentMethod,
      amountReceived: row.amountReceived,
      change: row.change,
      createdAt: row.createdAt,
      discountPercent: row.discountPercent || 0,
    }));

    // Load items for each sale
    for (const sale of sales) {
      const itemsResult = await dbQuery(db, "SELECT * FROM SaleItem WHERE saleId = ?", [sale.id]);
      (sale as any).items = (itemsResult.values || []).map((item: any) => ({
        id: item.id,
        saleId: item.saleId,
        productId: item.productId,
        variantId: item.variantId,
        productName: item.productName,
        variantName: item.variantName,
        quantity: item.quantity,
        price: item.price,
        subtotal: item.subtotal,
      }));
    }

    return sales;
  },

  async createSale(payload: {
    cartItems: any[];
    cashierId: string;
    cashierName: string;
    paymentMethod?: string;
    amountReceived: number;
    taxRate?: number;
    discountPercent?: number;
    ticketNumber?: string;
  }): Promise<any> {
    const db = await getDatabase();
    const saleId = generateId();
    const ticketNumber =
      payload.ticketNumber ||
      `T-${Date.now().toString(36).toUpperCase()}-${Math.floor(Math.random() * 999)
        .toString()
        .padStart(3, "0")}`;

    const subtotal = payload.cartItems.reduce((sum, item) => sum + item.subtotal, 0);
    const discountPercent = payload.discountPercent || 0;
    const discountAmount = subtotal * (discountPercent / 100);
    const netSubtotal = Math.max(0, subtotal - discountAmount);
    const taxRate = payload.taxRate || 0.12;
    const tax = netSubtotal * taxRate;
    const total = netSubtotal + tax;
    const change = payload.amountReceived - total;

    await dbExecute(
      db,
      `INSERT INTO Sale (id, ticketNumber, cashierId, cashierName, total, paymentMethod, amountReceived, change, createdAt, discountPercent)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        saleId,
        ticketNumber,
        payload.cashierId,
        payload.cashierName,
        total,
        payload.paymentMethod || "cash",
        payload.amountReceived,
        change,
        new Date().toISOString(),
        discountPercent,
      ]
    );

    // Insert sale items
    for (const item of payload.cartItems) {
      const itemId = generateId();
      await dbExecute(
        db,
        `INSERT INTO SaleItem (id, saleId, productId, variantId, productName, variantName, quantity, price, subtotal)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          itemId,
          saleId,
          item.productId,
          item.variantId || null,
          item.name,
          item.variantName || null,
          item.quantity,
          item.price,
          item.subtotal,
        ]
      );

      // Update stock
      if (item.variantId) {
        await dbExecute(db, "UPDATE Variant SET stock = stock - ? WHERE id = ?", [
          item.quantity,
          item.variantId,
        ]);
      } else {
        await dbExecute(db, "UPDATE Product SET stock = stock - ? WHERE id = ?", [
          item.quantity,
          item.productId,
        ]);
      }
    }

    // Return the created sale with items
    const sales = await mobileServices.getSales();
    return sales.find((s) => s.id === saleId)!;
  },

  // Users
  async getUsers(): Promise<User[]> {
    const db = await getDatabase();
    const result = await dbQuery(db, "SELECT id, name, email, role FROM User ORDER BY name");
    return (result.values || []).map((row: any) => ({
      id: row.id,
      name: row.name,
      email: row.email,
      role: row.role as "admin" | "cashier",
    }));
  },

  async createUser(payload: {
    name: string;
    email: string;
    password: string;
    role: "admin" | "cashier";
  }): Promise<User> {
    const db = await getDatabase();
    const id = generateId();
    const hashedPassword = await bcrypt.hash(payload.password, 10);

    await dbExecute(
      db,
      "INSERT INTO User (id, name, email, password, role) VALUES (?, ?, ?, ?, ?)",
      [id, payload.name, payload.email, hashedPassword, payload.role]
    );

    return {
      id,
      name: payload.name,
      email: payload.email,
      role: payload.role,
    };
  },

  async updateUser(
    id: string,
    payload: Partial<{
      name: string;
      email: string;
      password: string;
      role: "admin" | "cashier";
    }>
  ): Promise<User> {
    const db = await getDatabase();
    const updates: string[] = [];
    const values: any[] = [];

    if (payload.name !== undefined) {
      updates.push("name = ?");
      values.push(payload.name);
    }
    if (payload.email !== undefined) {
      updates.push("email = ?");
      values.push(payload.email);
    }
    if (payload.password !== undefined) {
      const hashedPassword = await bcrypt.hash(payload.password, 10);
      updates.push("password = ?");
      values.push(hashedPassword);
    }
    if (payload.role !== undefined) {
      updates.push("role = ?");
      values.push(payload.role);
    }

    if (updates.length > 0) {
      values.push(id);
      await dbExecute(db, `UPDATE User SET ${updates.join(", ")} WHERE id = ?`, values);
    }

    const result = await dbQuery(db, "SELECT id, name, email, role FROM User WHERE id = ?", [id]);
    const row = result.values?.[0] as any;
    return {
      id: row.id,
      name: row.name,
      email: row.email,
      role: row.role as "admin" | "cashier",
    };
  },

  async deleteUser(id: string): Promise<void> {
    const db = await getDatabase();
    await dbExecute(db, "DELETE FROM User WHERE id = ?", [id]);
  },
};
