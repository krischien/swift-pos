import express from "express";
import cors from "cors";
import bcrypt from "bcryptjs";
import {
  listCategories as listCategoriesService,
  createCategory as createCategoryService,
  updateCategory as updateCategoryService,
  deleteCategory as deleteCategoryService,
} from "./services/categoryService";
import {
  listProducts as listProductsService,
  getProductById,
  createProduct as createProductService,
  deleteProduct as deleteProductService,
  updateProduct as updateProductService,
} from "./services/productService";
import {
  createSale as createSaleService,
  listSales as listSalesService,
  getSaleById,
} from "./services/saleService";
import {
  listVariantsByProduct,
  createVariant as createVariantService,
  updateVariant as updateVariantService,
  deleteVariant as deleteVariantService,
} from "./services/variantService";
import {
  listUsers as listUsersService,
  createUser as createUserService,
  updateUser as updateUserService,
  deleteUser as deleteUserService,
  getUserById as getUserByIdService,
} from "./services/userService";
import { prisma } from "./db";
import cron from "node-cron";
import { performBackup, cleanupOldBackups, listBackups, restoreFromBackup, getLatestBackup } from "./utils/backupService";

const app = express();
const port = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

// Simple request logger to help debug 404s etc.
app.use((req, _res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

// Health check
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok" });
});

// Auth - finds existing user by email and uses stored role
app.post("/api/login", async (req, res) => {
  try {
    const { email, password } = req.body as {
      email: string;
      password?: string;
    };

    if (!email || !password) {
      return res.status(400).json({ message: "Email and password are required" });
    }

    let user = await prisma.user.findUnique({ where: { email } });

    if (!user) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const passwordMatches = await bcrypt.compare(password, user.password);
    if (!passwordMatches) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const { password: _password, ...sanitizedUser } = user;

    res.json(sanitizedUser);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Login failed" });
  }
});

// Categories
app.get("/api/categories", async (_req, res) => {
  try {
    const categories = await listCategoriesService();
    res.json(categories);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to fetch categories" });
  }
});

app.post("/api/categories", async (req, res) => {
  try {
    const { name } = req.body as { name: string };

    if (!name || !name.trim()) {
      return res.status(400).json({ message: "Category name is required" });
    }

    const category = await createCategoryService(name.trim());
    res.status(201).json(category);
  } catch (error: any) {
    console.error(error);
    res.status(400).json({ message: error.message ?? "Failed to create category" });
  }
});

app.put("/api/categories/:id", async (req, res) => {
  try {
    const { name } = req.body as { name: string };

    if (!name || !name.trim()) {
      return res.status(400).json({ message: "Category name is required" });
    }

    const category = await updateCategoryService(req.params.id, name.trim());
    res.json(category);
  } catch (error: any) {
    console.error(error);
    res.status(400).json({ message: error.message ?? "Failed to update category" });
  }
});

app.delete("/api/categories/:id", async (req, res) => {
  try {
    await deleteCategoryService(req.params.id);
    res.status(204).send();
  } catch (error: any) {
    console.error(error);
    res.status(400).json({ message: error.message ?? "Failed to delete category" });
  }
});

// Products
app.get("/api/products", async (req, res) => {
  try {
    const { categoryId, search, status } = req.query as {
      categoryId?: string;
      search?: string;
      status?: "active" | "inactive";
    };

    const products = await listProductsService({
      categoryId: categoryId || null,
      search,
      status,
    });
    res.json(products);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to fetch products" });
  }
});

app.get("/api/products/:id", async (req, res) => {
  try {
    const product = await getProductById(req.params.id);
    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }
    res.json(product);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to fetch product" });
  }
});

app.post("/api/products", async (req, res) => {
  try {
    const product = await createProductService(req.body);
    res.status(201).json(product);
  } catch (error: any) {
    console.error(error);
    res.status(400).json({ message: error.message ?? "Failed to create product" });
  }
});

app.put("/api/products/:id", async (req, res) => {
  try {
    const product = await updateProductService(req.params.id, req.body);
    res.json(product);
  } catch (error: any) {
    console.error(error);
    res.status(400).json({ message: error.message ?? "Failed to update product" });
  }
});

app.delete("/api/products/:id", async (req, res) => {
  try {
    await deleteProductService(req.params.id);
    res.status(204).send();
  } catch (error: any) {
    console.error(error);
    res.status(400).json({ message: error.message ?? "Failed to delete product" });
  }
});

// Variants
app.get("/api/products/:productId/variants", async (req, res) => {
  try {
    const variants = await listVariantsByProduct(req.params.productId);
    res.json(variants);
  } catch (error: any) {
    console.error(error);
    res.status(500).json({ message: error.message ?? "Failed to fetch variants" });
  }
});

app.post("/api/products/:productId/variants", async (req, res) => {
  try {
    const { name, price, stock } = req.body as {
      name: string;
      price: number;
      stock: number;
    };
    const variant = await createVariantService(req.params.productId, {
      name,
      price,
      stock,
    });
    res.status(201).json(variant);
  } catch (error: any) {
    console.error(error);
    res.status(400).json({ message: error.message ?? "Failed to create variant" });
  }
});

app.put("/api/variants/:id", async (req, res) => {
  try {
    const variant = await updateVariantService(req.params.id, req.body);
    res.json(variant);
  } catch (error: any) {
    console.error(error);
    res.status(400).json({ message: error.message ?? "Failed to update variant" });
  }
});

app.delete("/api/variants/:id", async (req, res) => {
  try {
    await deleteVariantService(req.params.id);
    res.status(204).send();
  } catch (error: any) {
    console.error(error);
    res.status(400).json({ message: error.message ?? "Failed to delete variant" });
  }
});

// Sales
app.get("/api/sales", async (req, res) => {
  try {
    const { from, to } = req.query as { from?: string; to?: string };
    const sales = await listSalesService({
      from: from ? new Date(from) : undefined,
      to: to ? new Date(to) : undefined,
    });
    res.json(sales);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to fetch sales" });
  }
});

app.get("/api/sales/:id", async (req, res) => {
  try {
    const sale = await getSaleById(req.params.id);
    if (!sale) {
      return res.status(404).json({ message: "Sale not found" });
    }
    res.json(sale);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to fetch sale" });
  }
});

app.post("/api/sales", async (req, res) => {
  try {
    const sale = await createSaleService(req.body);
    res.status(201).json(sale);
  } catch (error: any) {
    console.error(error);
    res.status(400).json({ message: error.message ?? "Failed to create sale" });
  }
});

// Users
app.get("/api/users", async (_req, res) => {
  try {
    const users = await listUsersService();
    // Remove passwords from response
    const sanitized = users.map(({ password, ...user }) => user);
    res.json(sanitized);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to fetch users" });
  }
});

app.get("/api/users/:id", async (req, res) => {
  try {
    const user = await getUserByIdService(req.params.id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    const { password, ...sanitized } = user;
    res.json(sanitized);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to fetch user" });
  }
});

app.post("/api/users", async (req, res) => {
  try {
    const { name, email, password, role } = req.body as {
      name: string;
      email: string;
      password: string;
      role: "admin" | "cashier";
    };

    if (!name || !email || !password || !role) {
      return res.status(400).json({ message: "Name, email, password, and role are required" });
    }

    const user = await createUserService({ name, email, password, role });
    const { password: _password, ...sanitized } = user;
    res.status(201).json(sanitized);
  } catch (error: any) {
    console.error(error);
    res.status(400).json({ message: error.message ?? "Failed to create user" });
  }
});

app.put("/api/users/:id", async (req, res) => {
  try {
    const { name, email, password, role } = req.body as {
      name?: string;
      email?: string;
      password?: string;
      role?: "admin" | "cashier";
    };

    const updateData: any = {};
    if (name !== undefined) updateData.name = name;
    if (email !== undefined) updateData.email = email;
    if (password !== undefined) updateData.password = password;
    if (role !== undefined) updateData.role = role;

    const user = await updateUserService(req.params.id, updateData);
    const { password: _password, ...sanitized } = user;
    res.json(sanitized);
  } catch (error: any) {
    console.error(error);
    res.status(400).json({ message: error.message ?? "Failed to update user" });
  }
});

app.delete("/api/users/:id", async (req, res) => {
  try {
    await deleteUserService(req.params.id);
    res.status(204).send();
  } catch (error: any) {
    console.error(error);
    res.status(400).json({ message: error.message ?? "Failed to delete user" });
  }
});

// Backup Management Endpoints
app.get("/api/backups", async (_req, res) => {
  try {
    const backups = listBackups();
    res.json(backups);
  } catch (error: any) {
    console.error(error);
    res.status(500).json({ message: error.message ?? "Failed to list backups" });
  }
});

app.post("/api/backups/restore", async (req, res) => {
  try {
    const { backupFilename } = req.body as { backupFilename?: string };
    
    // If no filename provided, use the latest backup
    const filename = backupFilename || getLatestBackup();
    
    if (!filename) {
      return res.status(404).json({ message: "No backups found" });
    }

    await restoreFromBackup(filename, true);
    res.json({ 
      message: "Database restored successfully",
      restoredFrom: filename 
    });
  } catch (error: any) {
    console.error(error);
    res.status(400).json({ message: error.message ?? "Failed to restore database" });
  }
});

app.post("/api/backups/create", async (_req, res) => {
  try {
    const backupPath = await performBackup();
    res.json({ 
      message: "Backup created successfully",
      path: backupPath 
    });
  } catch (error: any) {
    console.error(error);
    res.status(500).json({ message: error.message ?? "Failed to create backup" });
  }
});

// Schedule automatic backup at 12:00 AM (midnight) every day
cron.schedule("0 0 * * *", async () => {
  console.log("[CRON] Starting scheduled backup at midnight...");
  try {
    await performBackup();
    // Clean up backups older than 30 days
    cleanupOldBackups(30);
    console.log("[CRON] Scheduled backup completed successfully");
  } catch (error: any) {
    console.error("[CRON] Scheduled backup failed:", error.message);
  }
}, {
  timezone: "Asia/Manila", // Adjust timezone as needed
});

console.log("[CRON] Scheduled backup configured to run daily at 12:00 AM");

app.listen(port, () => {
  console.log(`API server running on http://localhost:${port}`);
});


