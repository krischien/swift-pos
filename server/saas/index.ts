import express from "express";
import cors from "cors";
import os from "os";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { saasPrisma } from "./db.js";
import { authMiddleware, isSuperAdmin, getJwtSecret } from "./middleware/auth.js";
import type { AuthRequest } from "./middleware/auth.js";
import { tenantMiddleware } from "./middleware/tenant.js";
import { suspendedCheckMiddleware } from "./middleware/suspendedCheck.js";
import { superAdminMiddleware } from "./middleware/superAdmin.js";
import { ownerMiddleware } from "./middleware/owner.js";
import adminRouter from "./routes/admin.js";
import * as categoryService from "./services/categoryService.js";
import * as productService from "./services/productService.js";
import * as saleService from "./services/saleService.js";
import { changePhpFromCents, paymentCoversTotal, phpToCents } from "../utils/money.js";
import * as variantService from "./services/variantService.js";
import * as userService from "./services/userService.js";
import { runSeedDemo } from "./services/seedDemoService.js";
import { runBootstrapSeed, ensureDemoQuickLoginUsers } from "./services/bootstrapSeedService.js";
import { DEMO_TRIAL_DAYS, addDays } from "./constants/demo.js";
import { normalizeBusinessMode } from "./utils/businessMode.js";
import * as fnbService from "./services/fnbService.js";
import { FnbStoreError } from "./services/fnbService.js";
import { ensureSqliteSaasDatabaseUrl } from "./validateDatabaseEnv.js";

const app = express();
const port = process.env.SAAS_PORT || 4001;

// CORS: SAAS_CORS_ORIGINS=* allows all. Otherwise listed origins — plus Capacitor / Ionic
// WebView origins so mobile apps don't get "failed to fetch" when the VPS env omits them.
const corsOriginsRaw = process.env.SAAS_CORS_ORIGINS?.split(",").map((o) => o.trim()).filter(Boolean) ?? [];
const allowAllCors = corsOriginsRaw.includes("*");
const corsOriginsExplicit = corsOriginsRaw.filter((o) => o !== "*");
const mobileWebViewOrigins = [
  "capacitor://localhost",
  "ionic://localhost",
  "http://localhost",
  "https://localhost",
];
const corsAllowedSet = new Set([...corsOriginsExplicit, ...mobileWebViewOrigins]);

function corsOriginOption(): boolean | ((origin: string | undefined, cb: (err: Error | null, allow?: boolean) => void) => void) {
  if (allowAllCors || corsOriginsExplicit.length === 0) {
    return true;
  }
  return (origin, callback) => {
    if (!origin) {
      callback(null, true);
      return;
    }
    if (corsAllowedSet.has(origin)) {
      callback(null, true);
      return;
    }
    // Some Capacitor builds vary the scheme/host slightly
    if (/^capacitor:\/\//i.test(origin) || /^ionic:\/\//i.test(origin)) {
      callback(null, true);
      return;
    }
    callback(null, false);
  };
}

app.use(
  cors({
    origin: corsOriginOption(),
    credentials: true,
  })
);
app.use(express.json());

app.use((req, _res, next) => {
  console.log(`[SAAS ${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

app.get("/api/health", async (_req, res) => {
  let database = "unknown";
  try {
    await saasPrisma.$queryRawUnsafe("SELECT sqlite_version()");
    database = "sqlite";
  } catch {
    database = "postgres";
  }
  res.json({ status: "ok", mode: "saas", database });
});

// Reset demo user passwords (dev only - fixes "invalid credentials" when DB has stale hashes)
app.post("/api/demo/reset-passwords", async (_req, res) => {
  try {
    const DEMO_EMAILS = ["admin@demo.com", "owner@demo.com", "cashier@demo.com"];
    const hashedPassword = await bcrypt.hash("password123", 10);
    let updated = 0;
    for (const email of DEMO_EMAILS) {
      const user = await saasPrisma.user.findUnique({ where: { email } });
      if (user) {
        await saasPrisma.user.update({
          where: { email },
          data: { password: hashedPassword },
        });
        updated++;
      }
    }
    res.json({
      message: `Reset passwords for ${updated} demo user(s). Use password123 to log in.`,
      updated,
    });
  } catch (error: unknown) {
    console.error("[demo reset-passwords]", error);
    res.status(500).json({ message: "Failed to reset passwords" });
  }
});

// Org users (owner only) - registered early so route is found
app.get("/api/org/users", authMiddleware, suspendedCheckMiddleware, async (req: AuthRequest, res) => {
  try {
    const orgId = req.auth?.organizationId;
    if (!orgId) return res.status(400).json({ message: "No organization" });
    if (req.auth?.role !== "owner") return res.status(403).json({ message: "Owner access required" });
    const users = await userService.getUsersByOrganization(orgId);
    const sanitized = users.map((u: { password?: string; storeAccess: { storeId: string }[] }) => {
      const { password: _p, storeAccess, ...rest } = u;
      return { ...rest, storeIds: storeAccess.map((a) => a.storeId) };
    });
    res.json(sanitized);
  } catch (error: unknown) {
    console.error(error);
    res.status(500).json({ message: "Failed to fetch users" });
  }
});

// --- Auth (no auth middleware) ---

app.post("/api/auth/signup", async (req, res) => {
  try {
    const { organizationName, storeName, adminEmail, adminPassword, adminName, adminPhone } = req.body as {
      organizationName?: string;
      storeName?: string;
      adminEmail?: string;
      adminPassword?: string;
      adminName?: string;
      adminPhone?: string;
    };

    if (!organizationName?.trim() || !storeName?.trim() || !adminEmail?.trim() || !adminPassword) {
      return res.status(400).json({ message: "Organization name, store name, email, and password are required" });
    }

    const existing = await userService.getUserByEmail(adminEmail);
    if (existing) {
      return res.status(400).json({ message: "Email already registered" });
    }

    const trialEndsAt = new Date();
    trialEndsAt.setDate(trialEndsAt.getDate() + 7);
    const org = await saasPrisma.organization.create({
      data: {
        name: organizationName.trim(),
        trialEndsAt,
        phone: adminPhone?.trim() || null,
      },
    });

    const store = await saasPrisma.store.create({
      data: {
        organizationId: org.id,
        name: storeName.trim(),
      },
    });

    const hashedPassword = await bcrypt.hash(adminPassword, 10);
    const user = await saasPrisma.user.create({
      data: {
        organizationId: org.id,
        name: (adminName || adminEmail).trim(),
        email: adminEmail.trim().toLowerCase(),
        password: hashedPassword,
        role: "owner",
      },
    });

    await saasPrisma.userStore.create({
      data: { userId: user.id, storeId: store.id },
    });

    const token = jwt.sign(
      {
        userId: user.id,
        email: user.email,
        organizationId: org.id,
        role: user.role,
        storeIds: [store.id],
      },
      getJwtSecret(),
      { expiresIn: "7d" }
    );

    const { password: _p, ...sanitizedUser } = user;
    res.status(201).json({
      token,
      user: sanitizedUser,
      organization: org,
      stores: [store],
    });
  } catch (error: unknown) {
    console.error(error);
    res.status(500).json({ message: "Signup failed" });
  }
});

app.post("/api/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body as { email?: string; password?: string };

    if (!email?.trim() || !password) {
      return res.status(400).json({ message: "Email and password are required" });
    }

    const user = await userService.getUserByEmail(email.trim().toLowerCase());
    if (!user) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    if (user.role === "super_admin" && !isSuperAdmin(user.email)) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const passwordMatches = await bcrypt.compare(password, user.password);
    if (!passwordMatches) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    let storeIds: string[] = [];
    let organization = null;

    if (user.organizationId) {
      const access = await saasPrisma.userStore.findMany({
        where: { userId: user.id },
        include: { store: true },
      });
      storeIds = access.map((a) => a.storeId);
      organization = await saasPrisma.organization.findUnique({
        where: { id: user.organizationId },
        select: { id: true, name: true, plan: true, trialEndsAt: true },
      });
      // Block access for suspended orgs or expired free trials (suspend instead of delete)
      if (organization) {
        const plan = organization.plan?.toLowerCase();
        const trialEndsAt = organization.trialEndsAt
          ? new Date(organization.trialEndsAt)
          : null;
        const trialExpired =
          plan === "free" && trialEndsAt && trialEndsAt < new Date();
        if (plan === "suspended") {
          return res.status(403).json({
            message: "Account suspended. Please contact support to restore access.",
          });
        }
        if (trialExpired) {
          // Auto-suspend expired free trials
          await saasPrisma.organization.update({
            where: { id: organization.id },
            data: { plan: "suspended" },
          });
          return res.status(403).json({
            message: "Trial expired. Please upgrade to continue using the service.",
          });
        }
      }
    } else if (isSuperAdmin(user.email)) {
      // Super admin: no org, no stores by default
      storeIds = [];
    }

    const stores = storeIds.length
      ? await saasPrisma.store.findMany({
          where: { id: { in: storeIds } },
        })
      : [];

    const token = jwt.sign(
      {
        userId: user.id,
        email: user.email,
        organizationId: user.organizationId,
        role: user.role,
        storeIds,
      },
      getJwtSecret(),
      { expiresIn: "7d" }
    );

    const { password: _p, ...sanitizedUser } = user;
    res.json({
      token,
      user: sanitizedUser,
      organization,
      stores,
    });
  } catch (error: unknown) {
    console.error(error);
    res.status(500).json({ message: "Login failed" });
  }
});

// --- Protected routes (auth + tenant) ---

// Owner-only routes (categories, users) - auth + tenant + owner role, scoped to active store
const ownerRouter = express.Router();
ownerRouter.use(authMiddleware);
ownerRouter.use(suspendedCheckMiddleware);
ownerRouter.use(tenantMiddleware);
ownerRouter.use(ownerMiddleware);

ownerRouter.post("/api/categories", async (req: AuthRequest, res) => {
  try {
    const storeId = (req as any).storeId;
    if (!storeId) return res.status(400).json({ message: "storeId is required" });
    const { name } = req.body as { name?: string };
    if (!name?.trim()) return res.status(400).json({ message: "Category name is required" });
    const category = await categoryService.createCategory(storeId, name.trim());
    res.status(201).json(category);
  } catch (error: unknown) {
    console.error(error);
    res.status(400).json({ message: (error as Error).message ?? "Failed to create category" });
  }
});

ownerRouter.put("/api/categories/:id", async (req: AuthRequest, res) => {
  try {
    const storeId = (req as any).storeId;
    if (!storeId) return res.status(400).json({ message: "storeId is required" });
    const { name } = req.body as { name?: string };
    if (!name?.trim()) return res.status(400).json({ message: "Category name is required" });
    const category = await categoryService.updateCategory(req.params.id, storeId, name.trim());
    res.json(category);
  } catch (error: unknown) {
    console.error(error);
    res.status(400).json({ message: (error as Error).message ?? "Failed to update category" });
  }
});

ownerRouter.delete("/api/categories/:id", async (req: AuthRequest, res) => {
  try {
    const storeId = (req as any).storeId;
    if (!storeId) return res.status(400).json({ message: "storeId is required" });
    await categoryService.deleteCategory(req.params.id, storeId);
    res.status(204).send();
  } catch (error: unknown) {
    console.error(error);
    res.status(400).json({ message: (error as Error).message ?? "Failed to delete category" });
  }
});

ownerRouter.patch("/api/store", async (req: AuthRequest, res) => {
  try {
    const storeId = (req as any).storeId;
    if (!storeId) return res.status(400).json({ message: "storeId is required" });
    if (req.body && Object.prototype.hasOwnProperty.call(req.body, "businessMode")) {
      return res.status(400).json({
        message: "Store type (retail vs F&B) cannot be changed. Create a new store instead.",
      });
    }
    const { name, address } = req.body as { name?: string; address?: string };
    const store = await saasPrisma.store.update({
      where: { id: storeId },
      data: {
        ...(name !== undefined && { name: name.trim() }),
        ...(address !== undefined && { address: address?.trim() || null }),
      },
      select: { id: true, name: true, address: true, receiptLogoUrl: true, businessMode: true },
    });
    res.json(store);
  } catch (error: unknown) {
    console.error(error);
    res.status(400).json({ message: (error as Error).message ?? "Failed to update store" });
  }
});

ownerRouter.get("/api/users", async (req: AuthRequest, res) => {
  try {
    const storeId = (req as any).storeId;
    const organizationId = (req as any).organizationId;
    if (!storeId || !organizationId) return res.status(400).json({ message: "storeId is required" });
    const users = await userService.getUsersByStore(storeId);
    const sanitized = users.map((u: Record<string, unknown>) => {
      const { password: _p, ...rest } = u;
      return rest;
    });
    res.json(sanitized);
  } catch (error: unknown) {
    console.error(error);
    res.status(500).json({ message: "Failed to fetch users" });
  }
});

ownerRouter.post("/api/users", async (req: AuthRequest, res) => {
  try {
    const storeId = (req as any).storeId;
    const organizationId = (req as any).organizationId;
    if (!storeId || !organizationId) return res.status(400).json({ message: "storeId is required" });
    const { name, email, password, role, storeIds } = req.body as {
      name?: string;
      email?: string;
      password?: string;
      role?: string;
      storeIds?: string[];
    };
    if (!name || !email || !password || !role) {
      return res.status(400).json({ message: "Name, email, password, and role are required" });
    }
    if (role !== "owner" && role !== "cashier") {
      return res.status(400).json({ message: "Role must be owner or cashier" });
    }
    const org = await saasPrisma.organization.findUnique({
      where: { id: organizationId },
      include: { stores: { select: { id: true } } },
    });
    const validStoreIds = (storeIds || []).filter((sid) =>
      org?.stores.some((s) => s.id === sid)
    );
    const storesToAssign =
      validStoreIds.length > 0 ? validStoreIds : org?.stores.map((s) => s.id) ?? [storeId];
    const user = await userService.createUser(
      organizationId,
      storesToAssign,
      { name, email, password, role: role as "owner" | "cashier" }
    );
    res.status(201).json(user);
  } catch (error: unknown) {
    console.error(error);
    res.status(400).json({ message: (error as Error).message ?? "Failed to create user" });
  }
});

ownerRouter.put("/api/users/:id", async (req: AuthRequest, res) => {
  try {
    const organizationId = (req as any).organizationId;
    if (!organizationId) return res.status(400).json({ message: "Not authorized" });
    const { name, email, password, role, storeIds } = req.body as {
      name?: string;
      email?: string;
      password?: string;
      role?: string;
      storeIds?: string[];
    };
    if (role !== undefined && role !== "owner" && role !== "cashier") {
      return res.status(400).json({ message: "Role must be owner or cashier" });
    }
    const user = await userService.updateUser(req.params.id, organizationId, {
      name,
      email,
      password,
      role,
      storeIds,
    });
    res.json(user);
  } catch (error: unknown) {
    console.error(error);
    res.status(400).json({ message: (error as Error).message ?? "Failed to update user" });
  }
});

ownerRouter.delete("/api/users/:id", async (req: AuthRequest, res) => {
  try {
    const organizationId = (req as any).organizationId;
    if (!organizationId) return res.status(400).json({ message: "Not authorized" });
    await userService.deleteUser(req.params.id, organizationId);
    res.status(204).send();
  } catch (error: unknown) {
    console.error(error);
    res.status(400).json({ message: (error as Error).message ?? "Failed to delete user" });
  }
});

function fnbErrorStatus(e: unknown): number {
  if (e instanceof FnbStoreError) return 403;
  return 400;
}

// --- F&B (owner): ingredients, menu, recipes — requires storeId + fnb businessMode ---
ownerRouter.post("/api/ingredients", async (req: AuthRequest, res) => {
  try {
    const storeId = (req as any).storeId;
    if (!storeId) return res.status(400).json({ message: "storeId is required" });
    await fnbService.requireFnbStore(storeId);
    const { name, sku, barcode, stock, lowStockThreshold, unitOfMeasure, status } = req.body as Record<
      string,
      unknown
    >;
    if (!name || typeof name !== "string" || !name.trim()) {
      return res.status(400).json({ message: "Ingredient name is required" });
    }
    const row = await fnbService.createIngredient(storeId, {
      name,
      sku: sku as string | undefined,
      barcode: barcode as string | undefined,
      stock: typeof stock === "number" ? stock : undefined,
      lowStockThreshold: typeof lowStockThreshold === "number" ? lowStockThreshold : undefined,
      unitOfMeasure: unitOfMeasure as string | undefined,
      status: status as string | undefined,
    });
    res.status(201).json(row);
  } catch (error: unknown) {
    console.error(error);
    res.status(fnbErrorStatus(error)).json({ message: (error as Error).message ?? "Failed" });
  }
});

ownerRouter.patch("/api/ingredients/:id", async (req: AuthRequest, res) => {
  try {
    const storeId = (req as any).storeId;
    if (!storeId) return res.status(400).json({ message: "storeId is required" });
    await fnbService.requireFnbStore(storeId);
    const row = await fnbService.updateIngredient(req.params.id, storeId, req.body as Record<string, unknown>);
    res.json(row);
  } catch (error: unknown) {
    console.error(error);
    res.status(fnbErrorStatus(error)).json({ message: (error as Error).message ?? "Failed" });
  }
});

ownerRouter.delete("/api/ingredients/:id", async (req: AuthRequest, res) => {
  try {
    const storeId = (req as any).storeId;
    if (!storeId) return res.status(400).json({ message: "storeId is required" });
    await fnbService.requireFnbStore(storeId);
    await fnbService.deleteIngredient(req.params.id, storeId);
    res.status(204).send();
  } catch (error: unknown) {
    console.error(error);
    res.status(fnbErrorStatus(error)).json({ message: (error as Error).message ?? "Failed" });
  }
});

ownerRouter.post("/api/menu-categories", async (req: AuthRequest, res) => {
  try {
    const storeId = (req as any).storeId;
    if (!storeId) return res.status(400).json({ message: "storeId is required" });
    await fnbService.requireFnbStore(storeId);
    const { name } = req.body as { name?: string };
    if (!name?.trim()) return res.status(400).json({ message: "Category name is required" });
    const row = await fnbService.createMenuCategory(storeId, name);
    res.status(201).json(row);
  } catch (error: unknown) {
    console.error(error);
    res.status(fnbErrorStatus(error)).json({ message: (error as Error).message ?? "Failed" });
  }
});

ownerRouter.patch("/api/menu-categories/:id", async (req: AuthRequest, res) => {
  try {
    const storeId = (req as any).storeId;
    if (!storeId) return res.status(400).json({ message: "storeId is required" });
    await fnbService.requireFnbStore(storeId);
    const { name } = req.body as { name?: string };
    if (!name?.trim()) return res.status(400).json({ message: "Category name is required" });
    const row = await fnbService.updateMenuCategory(req.params.id, storeId, name);
    res.json(row);
  } catch (error: unknown) {
    console.error(error);
    res.status(fnbErrorStatus(error)).json({ message: (error as Error).message ?? "Failed" });
  }
});

ownerRouter.delete("/api/menu-categories/:id", async (req: AuthRequest, res) => {
  try {
    const storeId = (req as any).storeId;
    if (!storeId) return res.status(400).json({ message: "storeId is required" });
    await fnbService.requireFnbStore(storeId);
    await fnbService.deleteMenuCategory(req.params.id, storeId);
    res.status(204).send();
  } catch (error: unknown) {
    console.error(error);
    res.status(fnbErrorStatus(error)).json({ message: (error as Error).message ?? "Failed" });
  }
});

ownerRouter.post("/api/menu-items", async (req: AuthRequest, res) => {
  try {
    const storeId = (req as any).storeId;
    if (!storeId) return res.status(400).json({ message: "storeId is required" });
    await fnbService.requireFnbStore(storeId);
    const { menuCategoryId, name, price, status, image, barcode } = req.body as Record<string, unknown>;
    if (!menuCategoryId || typeof menuCategoryId !== "string") {
      return res.status(400).json({ message: "menuCategoryId is required" });
    }
    if (!name || typeof name !== "string" || !name.trim()) {
      return res.status(400).json({ message: "Menu item name is required" });
    }
    if (typeof price !== "number" || price < 0) {
      return res.status(400).json({ message: "Valid price is required" });
    }
    const row = await fnbService.createMenuItem(storeId, {
      menuCategoryId,
      name,
      price,
      status: status as string | undefined,
      image: image as string | undefined,
      barcode: barcode as string | undefined,
    });
    res.status(201).json(row);
  } catch (error: unknown) {
    console.error(error);
    res.status(fnbErrorStatus(error)).json({ message: (error as Error).message ?? "Failed" });
  }
});

ownerRouter.patch("/api/menu-items/:id", async (req: AuthRequest, res) => {
  try {
    const storeId = (req as any).storeId;
    if (!storeId) return res.status(400).json({ message: "storeId is required" });
    await fnbService.requireFnbStore(storeId);
    const row = await fnbService.updateMenuItem(req.params.id, storeId, req.body as Record<string, unknown>);
    res.json(row);
  } catch (error: unknown) {
    console.error(error);
    res.status(fnbErrorStatus(error)).json({ message: (error as Error).message ?? "Failed" });
  }
});

ownerRouter.delete("/api/menu-items/:id", async (req: AuthRequest, res) => {
  try {
    const storeId = (req as any).storeId;
    if (!storeId) return res.status(400).json({ message: "storeId is required" });
    await fnbService.requireFnbStore(storeId);
    await fnbService.deleteMenuItem(req.params.id, storeId);
    res.status(204).send();
  } catch (error: unknown) {
    console.error(error);
    res.status(fnbErrorStatus(error)).json({ message: (error as Error).message ?? "Failed" });
  }
});

ownerRouter.put("/api/menu-items/:id/recipe", async (req: AuthRequest, res) => {
  try {
    const storeId = (req as any).storeId;
    if (!storeId) return res.status(400).json({ message: "storeId is required" });
    await fnbService.requireFnbStore(storeId);
    const { lines } = req.body as {
      lines?: Array<{ ingredientId: string; quantity: number; wastagePercent?: number }>;
    };
    if (!Array.isArray(lines)) {
      return res.status(400).json({ message: "lines array is required" });
    }
    const row = await fnbService.replaceRecipe(req.params.id, storeId, lines);
    res.json(row);
  } catch (error: unknown) {
    console.error(error);
    res.status(fnbErrorStatus(error)).json({ message: (error as Error).message ?? "Failed" });
  }
});

// Protected routes (auth + tenant) - POS, products, sales, etc. Owner + cashier can access.
const protectedRouter = express.Router();
protectedRouter.use(authMiddleware);
protectedRouter.use(suspendedCheckMiddleware);
protectedRouter.use(tenantMiddleware);

// Read-only: categories and store (needed for POS - both owner and cashier)
protectedRouter.get("/api/categories", async (req: AuthRequest, res) => {
  try {
    const storeId = (req as any).storeId;
    if (!storeId) return res.status(400).json({ message: "storeId is required" });
    const categories = await categoryService.listCategories(storeId);
    res.json(categories);
  } catch (error: unknown) {
    console.error(error);
    res.status(500).json({ message: "Failed to fetch categories" });
  }
});

protectedRouter.get("/api/store", async (req: AuthRequest, res) => {
  try {
    const storeId = (req as any).storeId;
    if (!storeId) return res.status(400).json({ message: "storeId is required" });
    const store = await saasPrisma.store.findFirst({
      where: { id: storeId },
      select: { id: true, name: true, address: true, receiptLogoUrl: true, businessMode: true },
    });
    if (!store) return res.status(404).json({ message: "Store not found" });
    res.json(store);
  } catch (error: unknown) {
    console.error(error);
    res.status(500).json({ message: "Failed to fetch store" });
  }
});

protectedRouter.get("/api/ingredients", async (req: AuthRequest, res) => {
  try {
    const storeId = (req as any).storeId;
    if (!storeId) return res.status(400).json({ message: "storeId is required" });
    try {
      await fnbService.requireFnbStore(storeId);
    } catch {
      return res.status(403).json({ message: "Ingredients are only available for Food & Beverage stores" });
    }
    const rows = await fnbService.listIngredients(storeId);
    res.json(rows);
  } catch (error: unknown) {
    console.error(error);
    res.status(500).json({ message: "Failed to fetch ingredients" });
  }
});

protectedRouter.get("/api/menu-categories", async (req: AuthRequest, res) => {
  try {
    const storeId = (req as any).storeId;
    if (!storeId) return res.status(400).json({ message: "storeId is required" });
    try {
      await fnbService.requireFnbStore(storeId);
    } catch {
      return res.status(403).json({ message: "Menu is only available for Food & Beverage stores" });
    }
    const rows = await fnbService.listMenuCategories(storeId);
    res.json(rows);
  } catch (error: unknown) {
    console.error(error);
    res.status(500).json({ message: "Failed to fetch menu categories" });
  }
});

protectedRouter.get("/api/menu-items", async (req: AuthRequest, res) => {
  try {
    const storeId = (req as any).storeId;
    if (!storeId) return res.status(400).json({ message: "storeId is required" });
    try {
      await fnbService.requireFnbStore(storeId);
    } catch {
      return res.status(403).json({ message: "Menu is only available for Food & Beverage stores" });
    }
    const { menuCategoryId } = req.query as { menuCategoryId?: string };
    const rows = await fnbService.listMenuItems(storeId, menuCategoryId || null);
    res.json(rows);
  } catch (error: unknown) {
    console.error(error);
    res.status(500).json({ message: "Failed to fetch menu items" });
  }
});

protectedRouter.get("/api/products", async (req: AuthRequest, res) => {
  try {
    const storeId = (req as any).storeId;
    if (!storeId) return res.status(400).json({ message: "storeId is required" });
    const { categoryId, search, status } = req.query as {
      categoryId?: string;
      search?: string;
      status?: "active" | "inactive";
    };
    const products = await productService.listProducts(storeId, {
      categoryId: categoryId || null,
      search,
      status,
    });
    res.json(products);
  } catch (error: unknown) {
    console.error(error);
    res.status(500).json({ message: "Failed to fetch products" });
  }
});

protectedRouter.get("/api/products/:id", async (req: AuthRequest, res) => {
  try {
    const storeId = (req as any).storeId;
    if (!storeId) return res.status(400).json({ message: "storeId is required" });
    const product = await productService.getProductById(req.params.id, storeId);
    if (!product) return res.status(404).json({ message: "Product not found" });
    res.json(product);
  } catch (error: unknown) {
    console.error(error);
    res.status(500).json({ message: "Failed to fetch product" });
  }
});

protectedRouter.post("/api/products", async (req: AuthRequest, res) => {
  try {
    const storeId = (req as any).storeId;
    if (!storeId) return res.status(400).json({ message: "storeId is required" });
    const product = await productService.createProduct(storeId, req.body);
    res.status(201).json(product);
  } catch (error: unknown) {
    console.error(error);
    res.status(400).json({ message: (error as Error).message ?? "Failed to create product" });
  }
});

protectedRouter.put("/api/products/:id", async (req: AuthRequest, res) => {
  try {
    const storeId = (req as any).storeId;
    if (!storeId) return res.status(400).json({ message: "storeId is required" });
    const product = await productService.updateProduct(req.params.id, storeId, req.body);
    res.json(product);
  } catch (error: unknown) {
    console.error(error);
    res.status(400).json({ message: (error as Error).message ?? "Failed to update product" });
  }
});

protectedRouter.delete("/api/products/:id", async (req: AuthRequest, res) => {
  try {
    const storeId = (req as any).storeId;
    if (!storeId) return res.status(400).json({ message: "storeId is required" });
    await productService.deleteProduct(req.params.id, storeId);
    res.status(204).send();
  } catch (error: unknown) {
    console.error(error);
    res.status(400).json({ message: (error as Error).message ?? "Failed to delete product" });
  }
});

protectedRouter.get("/api/products/:productId/variants", async (req: AuthRequest, res) => {
  try {
    const storeId = (req as any).storeId;
    if (!storeId) return res.status(400).json({ message: "storeId is required" });
    const variants = await variantService.listVariantsByProduct(req.params.productId, storeId);
    res.json(variants);
  } catch (error: unknown) {
    console.error(error);
    res.status(500).json({ message: (error as Error).message ?? "Failed to fetch variants" });
  }
});

protectedRouter.post("/api/products/:productId/variants", async (req: AuthRequest, res) => {
  try {
    const storeId = (req as any).storeId;
    if (!storeId) return res.status(400).json({ message: "storeId is required" });
    const { name, price, stock } = req.body as { name?: string; price?: number; stock?: number };
    if (!name || price == null || stock == null) {
      return res.status(400).json({ message: "name, price, and stock are required" });
    }
    const variant = await variantService.createVariant(
      req.params.productId,
      storeId,
      { name, price, stock }
    );
    res.status(201).json(variant);
  } catch (error: unknown) {
    console.error(error);
    res.status(400).json({ message: (error as Error).message ?? "Failed to create variant" });
  }
});

protectedRouter.put("/api/variants/:id", async (req: AuthRequest, res) => {
  try {
    const storeId = (req as any).storeId;
    if (!storeId) return res.status(400).json({ message: "storeId is required" });
    const variant = await variantService.updateVariant(req.params.id, storeId, req.body);
    res.json(variant);
  } catch (error: unknown) {
    console.error(error);
    res.status(400).json({ message: (error as Error).message ?? "Failed to update variant" });
  }
});

protectedRouter.delete("/api/variants/:id", async (req: AuthRequest, res) => {
  try {
    const storeId = (req as any).storeId;
    if (!storeId) return res.status(400).json({ message: "storeId is required" });
    await variantService.deleteVariant(req.params.id, storeId);
    res.status(204).send();
  } catch (error: unknown) {
    console.error(error);
    res.status(400).json({ message: (error as Error).message ?? "Failed to delete variant" });
  }
});

protectedRouter.get("/api/sales", async (req: AuthRequest, res) => {
  try {
    const storeId = (req as any).storeId;
    if (!storeId) return res.status(400).json({ message: "storeId is required" });
    const { from, to, voidFilter } = req.query as {
      from?: string;
      to?: string;
      voidFilter?: string;
    };
    const vfRaw = voidFilter?.toLowerCase();
    const voidFilterParsed =
      vfRaw === "voided" || vfRaw === "all" || vfRaw === "active"
        ? (vfRaw as "active" | "voided" | "all")
        : undefined;
    const sales = await saleService.listSales(storeId, {
      from: from ? new Date(from) : undefined,
      to: to ? new Date(to) : undefined,
      voidFilter: voidFilterParsed,
    });
    res.json(sales);
  } catch (error: unknown) {
    console.error(error);
    res.status(500).json({ message: "Failed to fetch sales" });
  }
});

protectedRouter.get("/api/sales/void-count", async (req: AuthRequest, res) => {
  try {
    const storeId = (req as any).storeId;
    if (!storeId) return res.status(400).json({ message: "storeId is required" });
    const { from, to } = req.query as { from?: string; to?: string };
    const count = await saleService.countVoidedSales(storeId, {
      from: from ? new Date(from) : undefined,
      to: to ? new Date(to) : undefined,
    });
    res.json({ count });
  } catch (error: unknown) {
    console.error(error);
    res.status(500).json({ message: "Failed to fetch void count" });
  }
});

protectedRouter.get("/api/sales/:id", async (req: AuthRequest, res) => {
  try {
    const storeId = (req as any).storeId;
    if (!storeId) return res.status(400).json({ message: "storeId is required" });
    const sale = await saleService.getSaleById(req.params.id, storeId);
    if (!sale) return res.status(404).json({ message: "Sale not found" });
    res.json(sale);
  } catch (error: unknown) {
    console.error(error);
    res.status(500).json({ message: "Failed to fetch sale" });
  }
});

protectedRouter.post("/api/sales/:id/void", async (req: AuthRequest, res) => {
  try {
    const storeId = (req as any).storeId;
    if (!storeId) return res.status(400).json({ message: "storeId is required" });
    const sale = await saleService.voidSale(req.params.id, storeId);
    if (!sale) return res.status(404).json({ message: "Sale not found" });
    res.json(sale);
  } catch (error: unknown) {
    const msg = (error as Error).message;
    if (msg?.includes("already voided")) return res.status(400).json({ message: msg });
    console.error(error);
    res.status(500).json({ message: "Failed to void sale" });
  }
});

protectedRouter.post("/api/sales", async (req: AuthRequest, res) => {
  try {
    const storeId = (req as any).storeId;
    if (!storeId) return res.status(400).json({ message: "storeId is required" });
    const body = req.body as Record<string, unknown>;
    const cartItems = (body.cartItems || body.items) as Array<{
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
    if (!cartItems?.length) {
      return res.status(400).json({ message: "cartItems or items is required" });
    }
    const taxRate = (body.taxRate as number) ?? 0.1;
    const discountPercent = (body.discountPercent as number) ?? 0;
    const amountReceived = body.amountReceived as number;
    const subtotal = cartItems.reduce((sum, item) => sum + item.subtotal, 0);
    const discountAmount = subtotal * Math.max(0, Math.min(100, discountPercent)) / 100;
    const netSubtotal = Math.max(0, subtotal - discountAmount);
    const total = netSubtotal + netSubtotal * taxRate;
    const receivedCents = phpToCents(amountReceived);
    const totalCents = phpToCents(total);
    if (!paymentCoversTotal(amountReceived, total)) {
      return res.status(400).json({ message: "Amount received is less than total due" });
    }
    const change = changePhpFromCents(receivedCents, totalCents);

    const items = cartItems.map((item) => ({
      productId: item.productId,
      menuItemId: item.menuItemId,
      variantId: item.variantId,
      productName: item.productName ?? item.name ?? "",
      variantName: item.variantName,
      quantity: item.quantity,
      price: item.price,
      subtotal: item.subtotal,
    }));
    const rawPaymentMethod = (body.paymentMethod as string)?.toLowerCase();
    const paymentMethod = rawPaymentMethod === "gcash" ? "gcash" : "cash";
    const sale = await saleService.createSale({
      storeId,
      cashierId: body.cashierId as string,
      cashierName: body.cashierName as string,
      total,
      paymentMethod,
      amountReceived,
      change,
      items,
      ticketNumber: body.ticketNumber as string | undefined,
      gcashTransactionId: body.gcashTransactionId as string | undefined,
    });
    res.status(201).json(sale);
  } catch (error: unknown) {
    console.error(error);
    res.status(400).json({ message: (error as Error).message ?? "Failed to create sale" });
  }
});

// Org-scoped routes (auth only, no storeId required)
const orgRouter = express.Router();
orgRouter.use(authMiddleware);
orgRouter.use(suspendedCheckMiddleware);
orgRouter.get("/api/org", async (req: AuthRequest, res) => {
  try {
    const orgId = req.auth?.organizationId;
    if (!orgId) {
      return res.json(null);
    }
    const org = await saasPrisma.organization.findUnique({
      where: { id: orgId },
      select: { id: true, name: true, plan: true, trialEndsAt: true, phone: true, email: true, address: true },
    });
    res.json(org);
  } catch (error: unknown) {
    console.error(error);
    res.status(500).json({ message: "Failed to fetch organization" });
  }
});

orgRouter.get("/api/stores", async (req: AuthRequest, res) => {
  try {
    const orgId = req.auth?.organizationId;
    const role = req.auth?.role;
    const storeIds = req.auth?.storeIds ?? [];

    // Super admin has no org and JWT storeIds are empty — return Demo org stores so POS can load catalog
    if (role === "super_admin" && !orgId) {
      const demoOrg = await saasPrisma.organization.findFirst({
        where: { name: "Demo Organization", email: "demo@example.com" },
      });
      if (demoOrg) {
        const stores = await saasPrisma.store.findMany({
          where: { organizationId: demoOrg.id },
          select: { id: true, name: true, businessMode: true },
          orderBy: { createdAt: "asc" },
        });
        return res.json(stores);
      }
      return res.json([]);
    }

    // Owners get all org stores so they can switch and cover for cashiers
    if (role === "owner" && orgId) {
      const stores = await saasPrisma.store.findMany({
        where: { organizationId: orgId },
        select: { id: true, name: true, businessMode: true },
        orderBy: { createdAt: "asc" },
      });
      return res.json(stores);
    }

    // Cashiers / other org users: list stores from DB (JWT storeIds may be stale after reseed)
    if (req.auth?.userId && orgId) {
      const rows = await saasPrisma.userStore.findMany({
        where: { userId: req.auth.userId },
        include: { store: { select: { id: true, name: true, businessMode: true } } },
        orderBy: { storeId: "asc" },
      });
      return res.json(
        rows.map((r) => ({
          id: r.store.id,
          name: r.store.name,
          businessMode: r.store.businessMode,
        })),
      );
    }

    if (storeIds.length === 0) {
      return res.json([]);
    }
    const stores = await saasPrisma.store.findMany({
      where: { id: { in: storeIds } },
      select: { id: true, name: true, businessMode: true },
    });
    res.json(stores);
  } catch (error: unknown) {
    console.error(error);
    res.status(500).json({ message: "Failed to fetch stores" });
  }
});

orgRouter.patch("/api/org", async (req: AuthRequest, res) => {
  try {
    const orgId = req.auth?.organizationId;
    if (!orgId) return res.status(400).json({ message: "No organization" });
    if (req.auth?.role !== "owner") return res.status(403).json({ message: "Owner access required" });
    const { phone, email, address } = req.body as { phone?: string; email?: string; address?: string };
    const org = await saasPrisma.organization.update({
      where: { id: orgId },
      data: {
        ...(phone !== undefined && { phone: phone?.trim() || null }),
        ...(email !== undefined && { email: email?.trim() || null }),
        ...(address !== undefined && { address: address?.trim() || null }),
      },
    });
    if (address !== undefined) {
      await saasPrisma.store.updateMany({
        where: { organizationId: orgId },
        data: { address: address?.trim() || null },
      });
    }
    res.json(org);
  } catch (error: unknown) {
    console.error(error);
    res.status(400).json({ message: (error as Error).message ?? "Failed to update organization" });
  }
});

// Org stores CRUD (owner only) - list all stores in org, create, update, delete
orgRouter.get("/api/org/stores", async (req: AuthRequest, res) => {
  try {
    const orgId = req.auth?.organizationId;
    if (!orgId) return res.status(400).json({ message: "No organization" });
    if (req.auth?.role !== "owner") return res.status(403).json({ message: "Owner access required" });
    const stores = await saasPrisma.store.findMany({
      where: { organizationId: orgId },
      select: { id: true, name: true, address: true, createdAt: true, businessMode: true },
      orderBy: { createdAt: "asc" },
    });
    res.json(stores);
  } catch (error: unknown) {
    console.error(error);
    res.status(500).json({ message: "Failed to fetch stores" });
  }
});

orgRouter.post("/api/org/stores", async (req: AuthRequest, res) => {
  try {
    const orgId = req.auth?.organizationId;
    if (!orgId) return res.status(400).json({ message: "No organization" });
    if (req.auth?.role !== "owner") return res.status(403).json({ message: "Owner access required" });
    const userId = req.auth?.userId;
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    const { name, address, businessMode: rawMode } = req.body as {
      name?: string;
      address?: string;
      businessMode?: string;
    };
    if (!name?.trim()) return res.status(400).json({ message: "Store name is required" });
    const org = await saasPrisma.organization.findUnique({
      where: { id: orgId },
      select: { address: true },
    });
    const businessMode = normalizeBusinessMode(rawMode);
    const store = await saasPrisma.store.create({
      data: {
        organizationId: orgId,
        name: name.trim(),
        address: address?.trim() || org?.address || null,
        businessMode,
      },
      select: { id: true, name: true, address: true, createdAt: true, businessMode: true },
    });
    await saasPrisma.userStore.create({
      data: { userId, storeId: store.id },
    });
    res.status(201).json(store);
  } catch (error: unknown) {
    console.error(error);
    res.status(400).json({ message: (error as Error).message ?? "Failed to create store" });
  }
});

orgRouter.patch("/api/org/stores/:id", async (req: AuthRequest, res) => {
  try {
    const orgId = req.auth?.organizationId;
    if (!orgId) return res.status(400).json({ message: "No organization" });
    if (req.auth?.role !== "owner") return res.status(403).json({ message: "Owner access required" });
    const existing = await saasPrisma.store.findFirst({
      where: { id: req.params.id, organizationId: orgId },
    });
    if (!existing) return res.status(404).json({ message: "Store not found" });
    if (req.body && Object.prototype.hasOwnProperty.call(req.body, "businessMode")) {
      return res.status(400).json({
        message: "Store type (retail vs F&B) cannot be changed. Create a new store instead.",
      });
    }
    const { name, address } = req.body as { name?: string; address?: string };
    const store = await saasPrisma.store.update({
      where: { id: req.params.id },
      data: {
        ...(name !== undefined && { name: name.trim() }),
        ...(address !== undefined && { address: address?.trim() || null }),
      },
      select: { id: true, name: true, address: true, createdAt: true, businessMode: true },
    });
    res.json(store);
  } catch (error: unknown) {
    console.error(error);
    res.status(400).json({ message: (error as Error).message ?? "Failed to update store" });
  }
});

orgRouter.delete("/api/org/stores/:id", async (req: AuthRequest, res) => {
  try {
    const orgId = req.auth?.organizationId;
    if (!orgId) return res.status(400).json({ message: "No organization" });
    if (req.auth?.role !== "owner") return res.status(403).json({ message: "Owner access required" });
    const existing = await saasPrisma.store.findFirst({
      where: { id: req.params.id, organizationId: orgId },
    });
    if (!existing) return res.status(404).json({ message: "Store not found" });
    await saasPrisma.store.delete({ where: { id: req.params.id } });
    res.status(204).send();
  } catch (error: unknown) {
    console.error(error);
    res.status(400).json({ message: (error as Error).message ?? "Failed to delete store" });
  }
});

orgRouter.get("/api/notifications", async (req: AuthRequest, res) => {
  try {
    const orgId = req.auth?.organizationId;
    if (!orgId) {
      return res.json([]);
    }
    const now = new Date();
    const notifications = await saasPrisma.organizationNotification.findMany({
      where: {
        organizationId: orgId,
        OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
      },
      orderBy: { createdAt: "desc" },
      take: 10,
    });
    res.json(notifications);
  } catch (error: unknown) {
    console.error(error);
    res.status(500).json({ message: "Failed to fetch notifications" });
  }
});

// Demo seed - owners and super_admins (for demo purposes)
orgRouter.post("/api/demo/seed", async (req: AuthRequest, res) => {
  try {
    const role = req.auth?.role;
    if (role !== "owner" && role !== "super_admin") {
      return res.status(403).json({ message: "Owner or super admin access required" });
    }
    const result = await runSeedDemo();
    res.json({
      message: "Demo data seeded successfully",
      ...result,
      password: "password123",
    });
  } catch (error: unknown) {
    const msg =
      error instanceof Error
        ? error.message
        : typeof error === "object" && error !== null && "message" in error
          ? String((error as { message: unknown }).message)
          : "Failed to seed demo data";
    console.error("[demo seed]", error);
    res.status(500).json({ message: msg });
  }
});

app.use(orgRouter);

// Super admin routes (auth + super_admin role only) - MUST be before ownerRouter so /api/admin/* is handled first
const adminRoutes = express.Router();
adminRoutes.use(authMiddleware);
adminRoutes.use(superAdminMiddleware);
adminRoutes.use(adminRouter);
app.use("/api/admin", adminRoutes);

// Protected routes (owner + cashier) - MUST be before ownerRouter so POS/categories/products work for cashiers
app.use(protectedRouter);

// Owner-only routes (categories POST/PUT/DELETE, users, store PATCH) - requires owner role
app.use(ownerRouter);

async function resetDemoPasswords() {
  const DEMO_EMAILS = ["admin@demo.com", "owner@demo.com", "cashier@demo.com"];
  const hashedPassword = await bcrypt.hash("password123", 10);
  let updated = 0;
  for (const email of DEMO_EMAILS) {
    const user = await saasPrisma.user.findUnique({ where: { email } });
    if (user) {
      await saasPrisma.user.update({
        where: { email },
        data: { password: hashedPassword },
      });
      updated++;
    }
  }
  if (updated > 0) {
    console.log(`[Demo] Reset passwords for ${updated} demo user(s). Use password123 to log in.`);
  }
}

async function unsuspendDemoOrg() {
  const owner = await saasPrisma.user.findUnique({
    where: { email: "owner@demo.com" },
  });
  if (!owner?.organizationId) return;
  const trialEndsAt = addDays(new Date(), DEMO_TRIAL_DAYS);
  await saasPrisma.organization.update({
    where: { id: owner.organizationId },
    data: { plan: "free", trialEndsAt },
  });
  console.log(`[Demo] Demo organization active. Trial ends ${trialEndsAt.toISOString().slice(0, 10)}.`);
}

/** Full demo seed when Demo Organization has no catalog (or DB is empty). Dev only. */
async function runSeedDemoIfEmptyDev() {
  if (process.env.NODE_ENV === "production") return;
  if (process.env.SAAS_AUTO_SEED_DEMO === "false") return;

  const demoOrg = await saasPrisma.organization.findFirst({
    where: { name: "Demo Organization", email: "demo@example.com" },
    include: { stores: { select: { id: true } } },
  });

  let needFullSeed = false;
  if (!demoOrg) {
    const totalProducts = await saasPrisma.product.count();
    needFullSeed = totalProducts === 0;
  } else {
    const storeIds = demoOrg.stores.map((s) => s.id);
    const demoProductCount =
      storeIds.length === 0
        ? 0
        : await saasPrisma.product.count({ where: { storeId: { in: storeIds } } });
    needFullSeed = demoProductCount === 0;
  }

  if (!needFullSeed) return;

  console.log(
    "[Bootstrap] Demo catalog empty (no Demo org or no products in its stores) — running full demo seed (3 stores incl. F&B, trial, sales history)…"
  );
  await runSeedDemo();
  console.log("[Bootstrap] Full demo seed finished.");
}

async function start() {
  ensureSqliteSaasDatabaseUrl();
  try {
    await runBootstrapSeed();
    // Dev: full catalog seed when empty, then quick-login emails (after seed: cashier@demo.com), passwords, trial
    if (process.env.NODE_ENV !== "production") {
      await runSeedDemoIfEmptyDev();
      await ensureDemoQuickLoginUsers();
      await resetDemoPasswords();
      await unsuspendDemoOrg();
    }
  } catch (e) {
    console.error("[Bootstrap] Failed:", e);
  }
  app.listen(port, "0.0.0.0", () => {
    console.log(`SaaS API server running on http://localhost:${port}`);
    const net = Object.values(os.networkInterfaces()).flat().find((i) => i && !i.internal && i.family === "IPv4");
    if (net) console.log(`  For mobile: use http://${net.address}:${port}`);
  });
}
start();
