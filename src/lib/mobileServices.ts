import bcrypt from "bcryptjs";
import { getDatabase, dbExecute, dbQuery } from "./mobileDb";
import { Category, Product, Variant, User } from "@/types/pos";

// Helper to generate CUID-like IDs
const generateId = () => {
  return `${Date.now().toString(36)}${Math.random().toString(36).substr(2)}`;
};

async function withTransaction<T>(db: any, operation: () => Promise<T>): Promise<T> {
  const native =
    typeof db.beginTransaction === "function" &&
    typeof db.commitTransaction === "function" &&
    typeof db.rollbackTransaction === "function";
  try {
    if (native) await db.beginTransaction();
    else await dbExecute(db, "BEGIN TRANSACTION");
    const result = await operation();
    if (native) await db.commitTransaction();
    else await dbExecute(db, "COMMIT");
    return result;
  } catch (error) {
    try {
      if (native) await db.rollbackTransaction();
      else await dbExecute(db, "ROLLBACK");
    } catch {
      // Preserve the original transaction error.
    }
    throw error;
  }
}

export const mobileServices = {
  // Auth
  async login(payload: { email: string; password: string }): Promise<User> {
    try {
      console.log("Attempting login for:", payload.email);
      const db = await getDatabase();
      console.log("Database connection obtained");

      const normalizedEmail = String(payload.email || "").trim().toLowerCase();
      // Try to query for user
      let result: any;
      try {
        result = await dbQuery(db, "SELECT * FROM User WHERE LOWER(email) = ?", [normalizedEmail]);
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
      unitOfMeasure: row.unitOfMeasure || "PCS",
      tracksCylinder: Boolean(row.tracksCylinder),
      cylinderSize: row.cylinderSize,
      depositAmount: row.depositAmount ?? 0,
      emptyStock: row.emptyStock ?? 0,
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
    unitOfMeasure?: string;
    tracksCylinder?: boolean;
    cylinderSize?: string;
    depositAmount?: number;
    emptyStock?: number;
  }): Promise<Product> {
    const db = await getDatabase();
    const id = generateId();

    await dbExecute(
      db,
      `INSERT INTO Product (id, name, categoryId, itemCode, sku, hasVariants, basePrice, price, stock, lowStockThreshold, marginPercentage, status, image, barcode, qrCode, unitOfMeasure, tracksCylinder, cylinderSize, depositAmount, emptyStock)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
        payload.unitOfMeasure || "PCS",
        payload.tracksCylinder ? 1 : 0,
        payload.cylinderSize || null,
        payload.depositAmount || 0,
        payload.emptyStock || 0,
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
      unitOfMeasure?: string;
      tracksCylinder?: boolean;
      cylinderSize?: string;
      depositAmount?: number;
      emptyStock?: number;
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
    if (payload.unitOfMeasure !== undefined) {
      updates.push("unitOfMeasure = ?");
      values.push(payload.unitOfMeasure);
    }
    if (payload.tracksCylinder !== undefined) {
      updates.push("tracksCylinder = ?");
      values.push(payload.tracksCylinder ? 1 : 0);
    }
    if (payload.cylinderSize !== undefined) {
      updates.push("cylinderSize = ?");
      values.push(payload.cylinderSize || null);
    }
    if (payload.depositAmount !== undefined) {
      updates.push("depositAmount = ?");
      values.push(payload.depositAmount);
    }
    if (payload.emptyStock !== undefined) {
      updates.push("emptyStock = ?");
      values.push(payload.emptyStock);
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
      customerId: row.customerId,
      depositAmount: row.depositAmount ?? 0,
      amountDue: row.amountDue ?? row.total,
      status: row.status ?? "completed",
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
        broughtEmptyQuantity: item.broughtEmptyQuantity ?? 0,
      }));
    }

    return sales;
  },

  async createSale(payload: {
    cartItems?: any[];
    items?: any[];
    cashierId: string;
    cashierName: string;
    paymentMethod?: string;
    amountReceived: number;
    taxRate?: number;
    discountPercent?: number;
    ticketNumber?: string;
    customerId?: string;
    customerName?: string;
    customerPhone?: string;
    cylinderTrackingEnabled?: boolean;
    collectDeposits?: boolean;
  }): Promise<any> {
    const db = await getDatabase();
    const cartItems = payload.cartItems ?? payload.items ?? [];
    if (!cartItems.length) throw new Error("Cart is empty");
    const saleId = generateId();
    const ticketNumber = payload.ticketNumber ||
      `T-${Date.now().toString(36).toUpperCase()}-${Math.floor(Math.random() * 999).toString().padStart(3, "0")}`;
    const subtotal = cartItems.reduce(
      (sum, item) => sum + Number(item.subtotal ?? item.quantity * item.price),
      0,
    );
    const discountPercent = Math.max(0, Math.min(100, payload.discountPercent ?? 0));
    const netSubtotal = Math.max(0, subtotal - subtotal * (discountPercent / 100));
    const total = netSubtotal + netSubtotal * (payload.taxRate ?? 0.1);
    const settings = (await dbQuery(db, "SELECT * FROM StoreSettings WHERE storeId='solo'")).values?.[0] as any;
    const trackingEnabled =
      payload.cylinderTrackingEnabled ?? Boolean(settings?.enableCylinderTracking);
    const collectDeposits =
      payload.collectDeposits ?? Boolean(settings?.collectCylinderDeposits ?? 1);
    const products = new Map<string, any>();
    for (const item of cartItems) {
      if (!item.productId || products.has(item.productId)) continue;
      const product = (await dbQuery(db, "SELECT * FROM Product WHERE id=?", [item.productId])).values?.[0];
      if (!product) throw new Error("Product not found");
      products.set(item.productId, product);
    }
    const cylinderLines = cartItems.filter((item) => Boolean(products.get(item.productId)?.tracksCylinder));
    if (cylinderLines.length && !trackingEnabled) throw new Error("Canister Monitoring is disabled");
    const exchangeQuantity = (item: any) =>
      Math.min(item.quantity, Math.max(0, Math.floor(
        item.broughtEmptyQuantity ?? (item.broughtEmpty ? item.quantity : 0),
      )));
    const outstanding = cylinderLines.reduce(
      (sum, item) => sum + Math.max(0, item.quantity - exchangeQuantity(item)),
      0,
    );
    if (outstanding > 0 && !payload.customerId) {
      throw new Error("Customer is required when a canister remains with the customer");
    }
    let customer: any = null;
    if (payload.customerId) {
      customer = (await dbQuery(
        db,
        "SELECT * FROM Customer WHERE id=? AND storeId='solo' AND archived=0",
        [payload.customerId],
      )).values?.[0];
      if (!customer) throw new Error("Customer not found");
    }
    const depositAmount = cylinderLines.reduce((sum, item) => {
      const loanQty = Math.max(0, item.quantity - exchangeQuantity(item));
      return sum + (collectDeposits ? loanQty * Number(products.get(item.productId).depositAmount ?? 0) : 0);
    }, 0);
    const amountDue = total + depositAmount;
    if (payload.amountReceived + 0.005 < amountDue) {
      throw new Error("Amount received is less than total due");
    }
    const change = Math.round((payload.amountReceived - amountDue) * 100) / 100;

    await withTransaction(db, async () => {
      await dbExecute(db, `INSERT INTO Sale
        (id, ticketNumber, cashierId, cashierName, total, depositAmount, amountDue, customerId,
         paymentMethod, amountReceived, change, createdAt, discountPercent)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
        saleId, ticketNumber, payload.cashierId, payload.cashierName, total, depositAmount,
        amountDue, payload.customerId ?? null, payload.paymentMethod || "cash",
        payload.amountReceived, change, new Date().toISOString(), discountPercent,
      ]);

      for (const item of cartItems) {
        const itemId = generateId();
        const quantity = Math.max(0, Math.floor(item.quantity));
        const broughtEmptyQuantity = exchangeQuantity(item);
        await dbExecute(db, `INSERT INTO SaleItem
          (id, saleId, productId, variantId, productName, variantName, quantity, price,
           subtotal, broughtEmptyQuantity)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
          itemId, saleId, item.productId, item.variantId || null,
          item.name ?? item.productName, item.variantName || null, quantity, item.price,
          item.subtotal ?? quantity * item.price, broughtEmptyQuantity,
        ]);
        if (item.variantId) {
          await dbExecute(db, "UPDATE Variant SET stock=stock-? WHERE id=?", [quantity, item.variantId]);
        } else {
          await dbExecute(db, "UPDATE Product SET stock=stock-? WHERE id=?", [quantity, item.productId]);
        }
        const product = products.get(item.productId);
        if (!product?.tracksCylinder) continue;
        if (broughtEmptyQuantity > 0) {
          await dbExecute(db, "UPDATE Product SET emptyStock=emptyStock+? WHERE id=?", [
            broughtEmptyQuantity, item.productId,
          ]);
        }
        const loanQuantity = quantity - broughtEmptyQuantity;
        if (loanQuantity > 0) {
          await dbExecute(db, `INSERT INTO CylinderLoan
            (id, storeId, saleId, saleItemId, productId, customerId, quantity, returnedQuantity,
             customerName, customerPhone, depositAmount, depositRefunded, status, outAt)
            VALUES (?, 'solo', ?, ?, ?, ?, ?, 0, ?, ?, ?, 0, 'out', ?)`, [
            generateId(), saleId, itemId, item.productId, payload.customerId, loanQuantity,
            customer?.name ?? payload.customerName ?? null,
            customer?.phone ?? payload.customerPhone ?? null,
            collectDeposits ? Number(product.depositAmount ?? 0) * loanQuantity : 0,
            new Date().toISOString(),
          ]);
        }
      }
    });

    const sales = await mobileServices.getSales();
    return sales.find((sale) => sale.id === saleId)!;
  },

  async getCustomers(params?: { search?: string; page?: number; pageSize?: number; archived?: boolean }) {
    const db = await getDatabase();
    const page = Math.max(1, params?.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, params?.pageSize ?? 25));
    const q = params?.search?.trim().toLowerCase();
    const where = `storeId = 'solo' AND archived = ?${q ? " AND (normalizedName LIKE ? OR normalizedPhone LIKE ? OR LOWER(nickname) LIKE ? OR LOWER(address) LIKE ?)" : ""}`;
    const args: any[] = [params?.archived ? 1 : 0];
    if (q) args.push(`%${q}%`, `%${q.replace(/[^\d+]/g, "")}%`, `%${q}%`, `%${q}%`);
    const rows = await dbQuery(db, `SELECT * FROM Customer WHERE ${where} ORDER BY isSuki DESC, updatedAt DESC LIMIT ? OFFSET ?`, [
      ...args, pageSize, (page - 1) * pageSize,
    ]);
    const count = await dbQuery(db, `SELECT COUNT(*) count FROM Customer WHERE ${where}`, args);
    return { items: rows.values ?? [], total: Number((count.values?.[0] as any)?.count ?? 0), page, pageSize };
  },

  async getRecentCustomers(limit = 12) {
    const db = await getDatabase();
    const result = await dbQuery(db, `SELECT c.*, MAX(s.createdAt) lastSaleAt
      FROM Customer c LEFT JOIN Sale s ON s.customerId=c.id
      WHERE c.storeId='solo' AND c.archived=0
      GROUP BY c.id ORDER BY lastSaleAt IS NULL, lastSaleAt DESC, c.updatedAt DESC LIMIT ?`, [limit]);
    return result.values ?? [];
  },

  async getCustomerByQr(token: string) {
    const db = await getDatabase();
    const result = await dbQuery(db, "SELECT * FROM Customer WHERE storeId = 'solo' AND qrToken = ? AND archived = 0", [token]);
    if (!result.values?.[0]) throw new Error("Customer not found");
    return result.values[0];
  },

  async getCustomer(id: string) {
    const db = await getDatabase();
    const customer = (await dbQuery(db, "SELECT * FROM Customer WHERE id = ? AND storeId = 'solo'", [id])).values?.[0] as any;
    if (!customer) throw new Error("Customer not found");
    const sales = (await dbQuery(db, "SELECT * FROM Sale WHERE customerId = ? ORDER BY createdAt DESC", [id])).values ?? [];
    const cylinderLoans = await mobileServices.getCylinderLoans({ status: "all" });
    const customerLoans = cylinderLoans.filter((loan: any) => loan.customerId === id);
    const since = Date.now() - 180 * 86_400_000;
    const sales180 = sales.filter((sale: any) =>
      new Date(sale.createdAt).getTime() >= since && sale.status !== "void");
    let returnedQuantity = 0;
    let writtenOffQuantity = 0;
    let weightedReturnDays = 0;
    let weightedReturnQuantity = 0;
    for (const loan of customerLoans as any[]) {
      const events = loan.returns ?? [];
      const eventQuantity = events.reduce(
        (sum: number, event: any) => sum + Number(event.quantity),
        0,
      );
      const resolvedReturned = Math.min(
        Number(loan.quantity),
        eventQuantity > 0
          ? eventQuantity
          : loan.status === "returned"
            ? (Number(loan.returnedQuantity) || Number(loan.quantity))
            : Number(loan.returnedQuantity ?? 0),
      );
      returnedQuantity += resolvedReturned;
      if (loan.status === "written_off") {
        writtenOffQuantity += Math.max(0, Number(loan.quantity) - resolvedReturned);
      }
      for (const event of events) {
        weightedReturnDays +=
          Math.max(0, (new Date(event.returnedAt).getTime() - new Date(loan.outAt).getTime()) / 86_400_000) *
          Number(event.quantity);
        weightedReturnQuantity += Number(event.quantity);
      }
      if (!events.length && loan.status === "returned" && loan.returnedAt && resolvedReturned > 0) {
        weightedReturnDays +=
          Math.max(0, (new Date(loan.returnedAt).getTime() - new Date(loan.outAt).getTime()) / 86_400_000) *
          resolvedReturned;
        weightedReturnQuantity += resolvedReturned;
      }
    }
    const completedOutcomes = returnedQuantity + writtenOffQuantity;
    const avgReturnDays = weightedReturnQuantity
      ? weightedReturnDays / weightedReturnQuantity
      : null;
    return {
      ...customer,
      sales,
      cylinderLoans: customerLoans,
      evidence: {
        lastPurchaseAt: sales[0]?.createdAt ?? null,
        frequency180d: sales180.length,
        monetary180d: sales180.reduce((sum: number, sale: any) => sum + Number(sale.total ?? 0), 0),
        completedOutcomes,
        reliableQualification: completedOutcomes >= 3,
        returnRate: completedOutcomes ? returnedQuantity / completedOutcomes : null,
        avgReturnDays,
        openQuantity: customerLoans
          .filter((loan: any) => ["out", "partial"].includes(loan.status))
          .reduce((sum: number, loan: any) => sum + loan.quantity - loan.returnedQuantity, 0),
        writeoffs: writtenOffQuantity,
      },
    };
  },

  async createCustomer(payload: { name: string; phone?: string | null; nickname?: string | null; address?: string | null }) {
    const db = await getDatabase();
    const id = generateId();
    const name = payload.name.trim();
    if (!name) throw new Error("Customer name is required");
    const phone = payload.phone?.replace(/[^\d+]/g, "") || null;
    if (phone) {
      const duplicate = await dbQuery(
        db,
        "SELECT id FROM Customer WHERE storeId='solo' AND archived=0 AND normalizedPhone=? LIMIT 1",
        [phone],
      );
      if (duplicate.values?.length) {
        throw new Error("An active customer already uses this phone number");
      }
    }
    const now = new Date().toISOString();
    const qrToken = `${crypto.randomUUID()}-${generateId()}`;
    await dbExecute(db, `INSERT INTO Customer
      (id, storeId, name, normalizedName, phone, normalizedPhone, nickname, address, qrToken, createdAt, updatedAt)
      VALUES (?, 'solo', ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
      id, name, name.toLowerCase().replace(/\s+/g, " "), payload.phone?.trim() || null,
      phone, payload.nickname?.trim() || null,
      payload.address?.trim() || null, qrToken, now, now,
    ]);
    return (await dbQuery(db, "SELECT * FROM Customer WHERE id = ?", [id])).values![0];
  },

  async updateCustomer(id: string, payload: { name: string; phone?: string | null; nickname?: string | null; address?: string | null }) {
    const db = await getDatabase();
    const name = payload.name.trim();
    if (!name) throw new Error("Customer name is required");
    const phone = payload.phone?.replace(/[^\d+]/g, "") || null;
    if (phone) {
      const duplicate = await dbQuery(
        db,
        "SELECT id FROM Customer WHERE storeId='solo' AND archived=0 AND normalizedPhone=? AND id<>? LIMIT 1",
        [phone, id],
      );
      if (duplicate.values?.length) {
        throw new Error("An active customer already uses this phone number");
      }
    }
    await dbExecute(db, `UPDATE Customer SET name=?, normalizedName=?, phone=?, normalizedPhone=?,
      nickname=?, address=?, updatedAt=? WHERE id=? AND storeId='solo'`, [
      name, name.toLowerCase().replace(/\s+/g, " "), payload.phone?.trim() || null,
      phone, payload.nickname?.trim() || null,
      payload.address?.trim() || null, new Date().toISOString(), id,
    ]);
    return (await dbQuery(db, "SELECT * FROM Customer WHERE id = ?", [id])).values![0];
  },

  async archiveCustomer(id: string, archived = true) {
    const db = await getDatabase();
    await dbExecute(db, "UPDATE Customer SET archived=?, updatedAt=? WHERE id=? AND storeId='solo'", [
      archived ? 1 : 0, new Date().toISOString(), id,
    ]);
    return (await dbQuery(db, "SELECT * FROM Customer WHERE id = ?", [id])).values![0];
  },

  async setCustomerSuki(id: string, payload: { enabled: boolean; note?: string; actorId: string }) {
    const db = await getDatabase();
    const actor = await dbQuery(db, "SELECT role FROM User WHERE id = ?", [payload.actorId]);
    if (!["admin", "owner"].includes(String((actor.values?.[0] as any)?.role))) {
      throw new Error("Admin access required");
    }
    await dbExecute(db, `UPDATE Customer SET isSuki=?, sukiAssignedAt=?, sukiAssignedById=?,
      sukiNote=?, updatedAt=? WHERE id=? AND storeId='solo'`, [
      payload.enabled ? 1 : 0, payload.enabled ? new Date().toISOString() : null,
      payload.enabled ? payload.actorId : null, payload.enabled ? payload.note?.trim() || null : null,
      new Date().toISOString(), id,
    ]);
    return (await dbQuery(db, "SELECT * FROM Customer WHERE id = ?", [id])).values![0];
  },

  async getCylinderLoans(params?: { status?: string }) {
    const db = await getDatabase();
    const status = params?.status ?? "out";
    const result = await dbQuery(db, `SELECT * FROM CylinderLoan WHERE storeId='solo'${status === "all" ? "" : " AND status=?"} ORDER BY outAt DESC`, status === "all" ? [] : [status]);
    const loans = result.values ?? [];
    for (const loan of loans as any[]) {
      loan.product = (await dbQuery(
        db,
        "SELECT id, name, cylinderSize FROM Product WHERE id=?",
        [loan.productId],
      )).values?.[0] ?? null;
      loan.customer = loan.customerId
        ? (await dbQuery(db, "SELECT * FROM Customer WHERE id=?", [loan.customerId])).values?.[0] ?? null
        : null;
      loan.sale = (await dbQuery(
        db,
        "SELECT id, ticketNumber, createdAt, cashierName FROM Sale WHERE id=?",
        [loan.saleId],
      )).values?.[0] ?? null;
      loan.returns = (await dbQuery(
        db,
        "SELECT * FROM CylinderReturn WHERE loanId=? ORDER BY returnedAt",
        [loan.id],
      )).values ?? [];
    }
    return loans;
  },

  async getCylinderStats() {
    const db = await getDatabase();
    const products = (await dbQuery(db, "SELECT stock, emptyStock, lowStockThreshold FROM Product WHERE tracksCylinder=1")).values ?? [];
    const loans = (await dbQuery(db, "SELECT quantity, returnedQuantity, depositAmount FROM CylinderLoan WHERE storeId='solo' AND status IN ('out','partial')")).values ?? [];
    const refunds = (await dbQuery(db, "SELECT COALESCE(SUM(refundAmount), 0) total FROM CylinderReturn WHERE loanId IN (SELECT id FROM CylinderLoan WHERE storeId='solo' AND status IN ('out','partial'))")).values?.[0] as any;
    return {
      filledOnHand: products.reduce((sum: number, p: any) => sum + Number(p.stock ?? 0), 0),
      emptyOnHand: products.reduce((sum: number, p: any) => sum + Number(p.emptyStock ?? 0), 0),
      onCustomer: loans.reduce((sum: number, l: any) => sum + Number(l.quantity) - Number(l.returnedQuantity), 0),
      depositLiability: Math.max(0, loans.reduce((sum: number, l: any) => sum + Number(l.depositAmount), 0) - Number(refunds?.total ?? 0)),
      lowFilledCount: products.filter((p: any) => Number(p.stock) > 0 && Number(p.stock) <= Number(p.lowStockThreshold)).length,
      outOfFilledCount: products.filter((p: any) => Number(p.stock ?? 0) <= 0).length,
      lowEmptyCount: products.filter((p: any) => Number(p.emptyStock) > 0 && Number(p.emptyStock) <= Number(p.lowStockThreshold)).length,
      outOfEmptyCount: products.filter((p: any) => Number(p.emptyStock ?? 0) <= 0).length,
    };
  },

  async returnCylinderLoan(loanId: string, options: { quantity: number; refundAmount?: number; note?: string; actorId?: string; actorName?: string; eventId?: string }) {
    const db = await getDatabase();
    const eventId = options.eventId ?? generateId();
    const prior = (await dbQuery(db, "SELECT * FROM CylinderReturn WHERE id=?", [eventId])).values?.[0] as any;
    if (prior) {
      if (prior.loanId !== loanId) throw new Error("Return event id is already in use");
      return (await mobileServices.getCylinderLoans({ status: "all" }))
        .find((candidate: any) => candidate.id === loanId);
    }
    const result = await dbQuery(db, "SELECT * FROM CylinderLoan WHERE id=? AND storeId='solo'", [loanId]);
    const loan = result.values?.[0] as any;
    if (!loan || !["out", "partial"].includes(loan.status)) throw new Error("Outstanding canister record not found");
    const quantity = Math.floor(options.quantity);
    const remaining = loan.quantity - loan.returnedQuantity;
    if (quantity <= 0 || quantity > remaining) throw new Error(`Return quantity must be between 1 and ${remaining}`);
    const next = loan.returnedQuantity + quantity;
    const returnedAt = new Date().toISOString();
    await withTransaction(db, async () => {
      await dbExecute(db, "UPDATE CylinderLoan SET returnedQuantity=?, status=?, returnedAt=? WHERE id=?", [
        next, next === loan.quantity ? "returned" : "partial", next === loan.quantity ? returnedAt : null, loanId,
      ]);
      await dbExecute(db, `INSERT INTO CylinderReturn
        (id, loanId, storeId, quantity, refundAmount, actorId, actorName, note, returnedAt)
        VALUES (?, ?, 'solo', ?, ?, ?, ?, ?, ?)`, [
        eventId, loanId, quantity, Math.max(0, options.refundAmount ?? 0),
        options.actorId ?? null, options.actorName ?? null, options.note?.trim() || null, returnedAt,
      ]);
      await dbExecute(db, "UPDATE Product SET emptyStock=emptyStock+? WHERE id=?", [quantity, loan.productId]);
    });
    return (await mobileServices.getCylinderLoans({ status: "all" }))
      .find((candidate: any) => candidate.id === loanId);
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
