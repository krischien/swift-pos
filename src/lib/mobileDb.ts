import { Capacitor } from "@capacitor/core";

const DB_NAME = "quickpos";
const DB_VERSION = 1;
const DEFAULT_PASSWORD = "password123";
const DEFAULT_PASSWORD_HASH = "$2b$10$VwNM8YMo1sKEtKKbZ2tgMOtLdbBL2hjD9VtH003WfLW7C2iU0NICq";

let db: any = null;

// Helper to execute SQL (handles different plugin APIs)
export const dbExecute = async (db: any, sql: string, params: any[] = []) => {
  try {
    console.log("dbExecute:", sql, "params:", params);
    // Prioritize run() for statements with parameters or if available, as execute() often doesn't support params in some bindings
    if (typeof db.run === "function") {
      const result = await db.run(sql, params);
      console.log("db.run result:", result);
      return result;
    } else if (typeof db.execute === "function") {
      // Fallback to execute, but warn if params are present as they might be ignored
      if (params.length > 0) {
         console.warn("Calling db.execute with params, this may fail if the underlying plugin doesn't support binding in execute()");
      }
      const result = await db.execute(sql, params.length > 0 ? undefined : false); 
      // Note: passing array to execute might be treated as 'transaction' boolean in some versions
      console.log("db.execute result:", result);
      return result;
    } else if (typeof db.executeSet === "function") {
      const result = await db.executeSet([{ statement: sql, values: params }]);
      console.log("db.executeSet result:", result);
      return result;
    }
    console.error("Available db methods:", Object.keys(db));
    throw new Error("No valid execute method found. Available methods: " + Object.keys(db).join(", "));
  } catch (error) {
    console.error("dbExecute error:", error, "SQL:", sql, "DB type:", typeof db, "DB keys:", Object.keys(db || {}));
    throw error;
  }
};

// Helper to query SQL (handles different plugin APIs)
export const dbQuery = async (db: any, sql: string, params: any[] = []) => {
  try {
    console.log("dbQuery:", sql, "params:", params);
    if (typeof db.query === "function") {
      const result = await db.query(sql, params);
      console.log("db.query result:", result);
      // Handle different result formats
      if (result && result.values) {
        return { values: result.values };
      } else if (result && result.rows) {
        return { values: result.rows };
      } else if (Array.isArray(result)) {
        return { values: result };
      } else if (result && typeof result === "object") {
        // Try to extract values from result object
        const values = (result as any).values || (result as any).rows || [];
        return { values };
      }
      return { values: [] };
    } else if (typeof db.execute === "function") {
      // Some plugins use execute for SELECT queries too
      const result = await db.execute(sql, params);
      console.log("db.execute (query) result:", result);
      if (result && result.values) {
        return { values: result.values };
      } else if (result && result.rows) {
        return { values: result.rows };
      } else if (Array.isArray(result)) {
        return { values: result };
      }
      return { values: [] };
    }
    console.error("Available db methods:", Object.keys(db));
    throw new Error("No valid query method found. Available methods: " + Object.keys(db).join(", "));
  } catch (error) {
    console.error("dbQuery error:", error, "SQL:", sql, "DB type:", typeof db, "DB keys:", Object.keys(db || {}));
    throw error;
  }
};

export const initDatabase = async (): Promise<any> => {
  // Only initialize on native platforms
  if (!Capacitor.isNativePlatform()) {
    throw new Error("Database can only be initialized on native platforms");
  }

  if (db) {
    return db;
  }

  let CapacitorSQLite: any;
  let SQLiteConnection: any;
  
  try {
    // Use a more robust import that handles module resolution issues
    const sqliteModule = await import("@capacitor-community/sqlite");
    CapacitorSQLite = sqliteModule.CapacitorSQLite;
    SQLiteConnection = sqliteModule.SQLiteConnection;
    
    // Verify the classes are available
    if (!CapacitorSQLite || !SQLiteConnection) {
      throw new Error("SQLite plugin classes not found in module");
    }
  } catch (error: any) {
    console.error("Failed to import @capacitor-community/sqlite:", error);
    throw new Error(
      `SQLite plugin is not available: ${error?.message || "Unknown error"}. ` +
      "Make sure you're running on a native platform and the plugin is properly installed."
    );
  }

  const sqlite = new SQLiteConnection(CapacitorSQLite);
  
  try {
    // Try to retrieve existing connection first
    try {
      const isConn = (await sqlite.checkConnectionsConsistency()).result;
      if (isConn) {
        db = await sqlite.retrieveConnection(DB_NAME, false);
        // Check if tables exist by trying to query
        try {
          await dbQuery(db, "SELECT COUNT(*) FROM User LIMIT 1");
          await ensureUserPasswordColumn(db);
          console.log("Database already initialized");
          return db;
        } catch {
          // Tables don't exist, need to create them
          console.log("Database exists but tables missing, creating...");
        }
      }
    } catch {
      // Connection doesn't exist, will create new
    }

    // Create new connection
    db = await sqlite.createConnection(DB_NAME, false, "no-encryption", DB_VERSION, false);
    await db.open();
    await createTables(db);
    await ensureUserPasswordColumn(db);
    await ensureProductSkuAndMarginColumns(db);
    await seedDatabase(db);
    console.log("Database initialized successfully");
  } catch (error) {
    console.error("Database initialization error:", error);
    throw error;
  }

  return db;
};

const createTables = async (db: any) => {
  // Users table
  await dbExecute(db, `
    CREATE TABLE IF NOT EXISTS User (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      role TEXT NOT NULL
    )
  `);

  // Categories table
  await dbExecute(db, `
    CREATE TABLE IF NOT EXISTS Category (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL
    )
  `);

  // Products table
  await dbExecute(db, `
    CREATE TABLE IF NOT EXISTS Product (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      categoryId TEXT NOT NULL,
      itemCode TEXT UNIQUE,
      sku TEXT,
      hasVariants INTEGER DEFAULT 0,
      basePrice REAL,
      price REAL,
      stock INTEGER,
      lowStockThreshold INTEGER DEFAULT 0,
      marginPercentage REAL,
      status TEXT DEFAULT 'active',
      image TEXT,
      barcode TEXT,
      qrCode TEXT,
      FOREIGN KEY (categoryId) REFERENCES Category(id)
    )
  `);

  // Variants table
  await dbExecute(db, `
    CREATE TABLE IF NOT EXISTS Variant (
      id TEXT PRIMARY KEY,
      productId TEXT NOT NULL,
      name TEXT NOT NULL,
      price REAL NOT NULL,
      stock INTEGER NOT NULL,
      FOREIGN KEY (productId) REFERENCES Product(id)
    )
  `);

  // Sales table
  await dbExecute(db, `
    CREATE TABLE IF NOT EXISTS Sale (
      id TEXT PRIMARY KEY,
      ticketNumber TEXT UNIQUE,
      cashierId TEXT NOT NULL,
      cashierName TEXT NOT NULL,
      total REAL NOT NULL,
      paymentMethod TEXT DEFAULT 'cash',
      amountReceived REAL NOT NULL,
      change REAL NOT NULL,
      createdAt TEXT NOT NULL,
      discountPercent REAL DEFAULT 0,
      FOREIGN KEY (cashierId) REFERENCES User(id)
    )
  `);

  // SaleItems table
  await dbExecute(db, `
    CREATE TABLE IF NOT EXISTS SaleItem (
      id TEXT PRIMARY KEY,
      saleId TEXT NOT NULL,
      productId TEXT NOT NULL,
      variantId TEXT,
      productName TEXT NOT NULL,
      variantName TEXT,
      quantity INTEGER NOT NULL,
      price REAL NOT NULL,
      subtotal REAL NOT NULL,
      FOREIGN KEY (saleId) REFERENCES Sale(id),
      FOREIGN KEY (productId) REFERENCES Product(id),
      FOREIGN KEY (variantId) REFERENCES Variant(id)
    )
  `);
};

const ensureUserPasswordColumn = async (db: any) => {
  try {
    await dbQuery(db, "SELECT password FROM User LIMIT 1");
    console.log("User table already has password column");
  } catch {
    console.warn("Password column missing on User table, adding column...");
    await dbExecute(db, "ALTER TABLE User ADD COLUMN password TEXT");
    await dbExecute(db, "UPDATE User SET password = ?", [DEFAULT_PASSWORD_HASH]);
  }
};

const ensureProductSkuAndMarginColumns = async (db: any) => {
  try {
    await dbQuery(db, "SELECT sku, marginPercentage, basePrice, barcode, qrCode FROM Product LIMIT 1");
    console.log("Product table already has all required columns");
  } catch {
    console.warn("Some columns missing on Product table, adding columns...");
    try {
      await dbQuery(db, "SELECT sku FROM Product LIMIT 1");
    } catch {
      await dbExecute(db, "ALTER TABLE Product ADD COLUMN sku TEXT");
    }
    try {
      await dbQuery(db, "SELECT marginPercentage FROM Product LIMIT 1");
    } catch {
      await dbExecute(db, "ALTER TABLE Product ADD COLUMN marginPercentage REAL");
    }
    try {
      await dbQuery(db, "SELECT basePrice FROM Product LIMIT 1");
    } catch {
      await dbExecute(db, "ALTER TABLE Product ADD COLUMN basePrice REAL");
    }
    try {
      await dbQuery(db, "SELECT barcode FROM Product LIMIT 1");
    } catch {
      await dbExecute(db, "ALTER TABLE Product ADD COLUMN barcode TEXT");
    }
    try {
      await dbQuery(db, "SELECT qrCode FROM Product LIMIT 1");
    } catch {
      await dbExecute(db, "ALTER TABLE Product ADD COLUMN qrCode TEXT");
    }
  }
};

const seedDatabase = async (db: any) => {
  // Check if already seeded
  const userCheck = await dbQuery(db, "SELECT COUNT(*) as count FROM User");
  if (userCheck.values && userCheck.values[0] && (userCheck.values[0] as any).count > 0) {
    return; // Already seeded
  }

  // Seed admin user
  await dbExecute(
    db,
    `INSERT INTO User (id, name, email, password, role) VALUES (?, ?, ?, ?, ?)`,
    ["1", "John Doe", "john@example.com", DEFAULT_PASSWORD_HASH, "admin"]
  );

  // Seed cashier user
  await dbExecute(
    db,
    `INSERT INTO User (id, name, email, password, role) VALUES (?, ?, ?, ?, ?)`,
    ["2", "Cashier User", "cashier@example.com", DEFAULT_PASSWORD_HASH, "cashier"]
  );

  // Seed categories
  const categories = [
    { id: "1", name: "Beverages" },
    { id: "2", name: "Snacks" },
    { id: "3", name: "Meals" },
    { id: "4", name: "Desserts" },
    { id: "5", name: "Hot Drinks" },
  ];

  for (const cat of categories) {
    await dbExecute(db, `INSERT INTO Category (id, name) VALUES (?, ?)`, [cat.id, cat.name]);
  }

  // Seed sample products (simplified - you can expand this)
  const products = [
    {
      id: "1",
      name: "Cola",
      categoryId: "1",
      itemCode: "ITEM-0001",
      hasVariants: 1,
      status: "active",
    },
    {
      id: "2",
      name: "Orange Juice",
      categoryId: "1",
      itemCode: "ITEM-0002",
      hasVariants: 0,
      price: 2.5,
      stock: 60,
      status: "active",
    },
  ];

  for (const prod of products) {
    await dbExecute(
      db,
      `INSERT INTO Product (id, name, categoryId, itemCode, hasVariants, price, stock, status, lowStockThreshold) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        prod.id,
        prod.name,
        prod.categoryId,
        prod.itemCode,
        prod.hasVariants,
        prod.price || null,
        prod.stock || null,
        prod.status,
        10,
      ]
    );
  }

  // Seed variants for Cola
  const variants = [
    { id: "v1", productId: "1", name: "Small (330ml)", price: 1.5, stock: 50 },
    { id: "v2", productId: "1", name: "Medium (500ml)", price: 2.0, stock: 40 },
    { id: "v3", productId: "1", name: "Large (1L)", price: 3.0, stock: 30 },
  ];

  for (const variant of variants) {
    await dbExecute(
      db,
      `INSERT INTO Variant (id, productId, name, price, stock) VALUES (?, ?, ?, ?, ?)`,
      [variant.id, variant.productId, variant.name, variant.price, variant.stock]
    );
  }

  console.log(`Default login credentials use password: ${DEFAULT_PASSWORD}`);
};

export const getDatabase = async (): Promise<any> => {
  if (!db) {
    return await initDatabase();
  }
  return db;
};

